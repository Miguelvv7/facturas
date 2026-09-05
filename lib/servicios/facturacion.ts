/**
 * Emisión de facturas: numeración correlativa, encadenado Verifactu,
 * descuento de stock y registro de eventos.
 *
 * Una factura nace como borrador y es modificable. Al emitirla se congela:
 * recibe número, huella y fecha de generación, y a partir de ahí solo puede
 * corregirse mediante una rectificativa.
 */

import { Repositorio } from '../data/repositorio'
import { Factura, LineaFacturaGuardada } from '../domain/tipos'
import { calcularTotales, LineaFactura, RegimenCliente } from '../domain/fiscal/factura-calc'
import { formatearEuros } from '../domain/dinero'
import { calcularHuella, TipoFactura, urlCotejoQR } from '../domain/fiscal/verifactu'
import { necesitaTicket } from '../domain/fiscal/factura-simplificada'
import { aFormatoAEAT as fechaAEAT, ahoraConHuso, hoy, sumarDias } from '../domain/fechas'

export const numeroCompleto = (serie: string, ejercicio: number, numero: number) =>
  `${serie}/${ejercicio}/${String(numero).padStart(4, '0')}`

export interface DatosBorrador {
  clienteId: string
  serie?: string
  tipoFactura?: TipoFactura
  fecha?: string
  lineas: LineaFacturaGuardada[]
  tipoRetencion?: number
  notas?: string
  rectificaA?: string
}

const aLineaCalculo = (l: LineaFacturaGuardada): LineaFactura => ({
  descripcion: l.descripcion,
  cantidad: l.cantidad,
  precioUnitario: l.precioUnitario,
  tipoIva: l.tipoIva,
  descuento: l.descuento,
})

export async function crearBorrador(
  repo: Repositorio,
  datos: DatosBorrador
): Promise<Factura> {
  const cliente = await repo.clientes.obtener(datos.clienteId)
  if (!cliente) throw new Error('El cliente indicado no existe.')
  if (datos.lineas.length === 0) throw new Error('La factura no tiene líneas.')

  const fecha = datos.fecha ?? hoy()
  // Sin NIF no cabe factura completa: se emite ticket (RD 1619/2012, art. 4).
  const tipoFactura =
    datos.tipoFactura ?? (necesitaTicket(cliente.nif) ? 'F2' : 'F1')
  const totales = calcularTotales(datos.lineas.map(aLineaCalculo), {
    regimenCliente: cliente.regimen as RegimenCliente,
    tipoRetencion: datos.tipoRetencion,
  })

  return repo.facturas.crear({
    serie: datos.serie ?? 'A',
    numero: 0,
    numeroCompleto: 'BORRADOR',
    tipoFactura,
    clienteId: datos.clienteId,
    fecha,
    fechaVencimiento: sumarDias(fecha, cliente.diasPago),
    lineas: datos.lineas,
    ...totales,
    estado: 'borrador',
    rectificaA: datos.rectificaA,
    notas: datos.notas,
    huella: '',
    huellaAnterior: '',
    fechaHoraGeneracion: '',
    creadoEn: new Date().toISOString(),
  })
}

/**
 * Da de alta un cliente con lo mínimo: el nombre. Para la venta al paso, en la
 * que pedir NIF y domicilio no tiene sentido. Se le emitirá ticket.
 */
export async function crearClienteRapido(repo: Repositorio, nombre: string) {
  const limpio = nombre.trim()
  if (!limpio) throw new Error('Ponle un nombre al cliente.')

  return repo.clientes.crear({
    nombre: limpio,
    regimen: 'general',
    pais: 'ES',
    diasPago: 0,
    creadoEn: new Date().toISOString(),
  })
}

/**
 * Líneas de una factura anterior, listas para volver a venderlas. Se refrescan
 * los precios: si un producto ha subido, el pedido repetido va al precio de
 * hoy, no al del año pasado.
 */
export async function lineasParaRepetir(
  repo: Repositorio,
  facturaId: string
): Promise<{ clienteId: string; lineas: LineaFacturaGuardada[] } | null> {
  const original = await repo.facturas.obtener(facturaId)
  if (!original) return null

  const lineas: LineaFacturaGuardada[] = []
  for (const linea of original.lineas) {
    const producto = linea.productoId ? await repo.productos.obtener(linea.productoId) : null
    lineas.push({
      ...linea,
      // Un concepto libre conserva su importe; un producto toma el actual.
      precioUnitario: producto?.precioVenta ?? linea.precioUnitario,
      tipoIva: producto?.tipoIva ?? linea.tipoIva,
      // El lote de aquella venta ya no vale para ésta.
      loteId: undefined,
      cantidad: Math.abs(linea.cantidad),
    })
  }

  return { clienteId: original.clienteId, lineas }
}

export interface FacturaEmitida {
  factura: Factura
  urlQR: string
}

export async function emitirFactura(
  repo: Repositorio,
  facturaId: string
): Promise<FacturaEmitida> {
  const borrador = await repo.facturas.obtener(facturaId)
  if (!borrador) throw new Error('La factura no existe.')
  if (borrador.estado !== 'borrador') throw new Error('Esta factura ya está emitida.')

  const negocio = await repo.negocio.obtener()
  if (!negocio) throw new Error('Completa los datos fiscales del negocio antes de facturar.')

  const cliente = await repo.clientes.obtener(borrador.clienteId)
  // Una factura completa (F1) necesita identificar al destinatario.
  // La simplificada (F2) no, y por eso tiene límite de importe.
  if (borrador.tipoFactura === 'F1' && necesitaTicket(cliente?.nif)) {
    throw new Error(
      'Una factura completa necesita el NIF del cliente. Añádelo o emite un ticket.'
    )
  }

  const ejercicio = Number(borrador.fecha.slice(0, 4))
  const numero = await repo.facturas.siguienteNumero(borrador.serie, ejercicio)
  const numCompleto = numeroCompleto(borrador.serie, ejercicio, numero)

  const anterior = await repo.facturas.ultimaDeSerie(borrador.serie)
  const huellaAnterior = anterior?.huella ?? ''
  const fechaHoraGeneracion = ahoraConHuso()

  const huella = await calcularHuella({
    tipoRegistro: 'alta',
    idEmisor: negocio.nif,
    numSerieFactura: numCompleto,
    fechaExpedicion: fechaAEAT(borrador.fecha),
    tipoFactura: borrador.tipoFactura,
    cuotaTotal: borrador.totalIva + borrador.totalRecargo,
    importeTotal: borrador.total,
    huellaAnterior,
    fechaHoraGeneracion,
  })

  const factura = await repo.facturas.actualizar(facturaId, {
    numero,
    numeroCompleto: numCompleto,
    estado: 'emitida',
    huella,
    huellaAnterior,
    fechaHoraGeneracion,
  })

  await descontarStock(repo, factura)

  await repo.eventos.registrar({
    tipo: 'alta_factura',
    fechaHora: fechaHoraGeneracion,
    detalle: `${numCompleto} · ${formatearEuros(factura.total)} · huella ${huella.slice(0, 16)}…`,
  })

  return {
    factura,
    urlQR: urlCotejoQR({
      idEmisor: negocio.nif,
      numSerieFactura: numCompleto,
      fechaExpedicion: fechaAEAT(factura.fecha),
      importeTotal: factura.total,
    }),
  }
}

async function descontarStock(repo: Repositorio, factura: Factura) {
  for (const linea of factura.lineas) {
    if (linea.productoId) {
      const p = await repo.productos.obtener(linea.productoId)
      if (p) await repo.productos.actualizar(p.id, { stock: p.stock - linea.cantidad })
    }
    if (linea.loteId) {
      const l = await repo.lotes.obtener(linea.loteId)
      if (l) {
        await repo.lotes.actualizar(l.id, {
          cantidadActual: l.cantidadActual - linea.cantidad,
        })
      }
    }
  }
}

/**
 * Anula una factura emitida mediante rectificativa, que es la única vía legal.
 * La original se conserva intacta; la rectificativa lleva importes negativos.
 */
export async function anularConRectificativa(
  repo: Repositorio,
  facturaId: string,
  motivo: TipoFactura = 'R1'
): Promise<FacturaEmitida> {
  const original = await repo.facturas.obtener(facturaId)
  if (!original) throw new Error('La factura no existe.')
  if (original.estado === 'borrador') throw new Error('Un borrador se borra, no se rectifica.')
  if (original.estado === 'anulada') throw new Error('Esta factura ya está anulada.')

  const rectificativa = await crearBorrador(repo, {
    clienteId: original.clienteId,
    serie: `R${original.serie}`,
    tipoFactura: motivo,
    lineas: original.lineas.map((l) => ({ ...l, cantidad: -l.cantidad })),
    tipoRetencion: original.tipoRetencion,
    rectificaA: original.id,
    notas: `Rectifica a la factura ${original.numeroCompleto}.`,
  })

  const emitida = await emitirFactura(repo, rectificativa.id)
  await repo.facturas.actualizar(original.id, { estado: 'anulada' })

  await repo.eventos.registrar({
    tipo: 'anulacion_factura',
    fechaHora: ahoraConHuso(),
    detalle: `${original.numeroCompleto} anulada mediante ${emitida.factura.numeroCompleto}`,
  })

  return emitida
}

export async function marcarCobrada(
  repo: Repositorio,
  facturaId: string,
  fechaCobro = hoy()
): Promise<Factura> {
  return repo.facturas.actualizar(facturaId, { estado: 'cobrada', fechaCobro })
}
