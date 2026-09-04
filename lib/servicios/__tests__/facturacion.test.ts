/**
 * Recorre el mismo camino que hará el usuario: alta del negocio, cliente,
 * producto, emisión de facturas encadenadas y rectificación.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { repositorioLocal } from '../../data/repositorio-local'
import { euros, aEuros } from '../../domain/dinero'
import { verificarCadena } from '../../domain/fiscal/verifactu'
import { anularConRectificativa, crearBorrador, emitirFactura, marcarCobrada } from '../facturacion'
import { calcularResumen } from '../resumen'
import { DatosNegocio, PERSONALIZACION_POR_DEFECTO } from '../../domain/tipos'

// localStorage mínimo en memoria: el repositorio local habla con window.
const memoria = new Map<string, string>()
beforeEach(async () => {
  memoria.clear()
  ;(globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => void memoria.set(k, v),
      removeItem: (k: string) => void memoria.delete(k),
    },
  }
  // El repositorio cachea el almacén en memoria: sin esto los datos de un
  // test se colarían en el siguiente.
  await repositorioLocal.vaciarTodo()
})

const NEGOCIO: DatosNegocio = {
  nombreCompleto: 'Javier Ruiz Molina',
  nif: '12345678Z',
  direccion: 'Camino de la Almazara, 14',
  codigoPostal: '23600',
  ciudad: 'Martos',
  provincia: 'Jaén',
  sector: 'aceite',
  regimenIrpf: 'estimacion_directa_simplificada',
  aplicaRetencion: false,
  tipoRetencion: 0,
  factura: PERSONALIZACION_POR_DEFECTO,
}

const repo = repositorioLocal

async function prepararEscenario() {
  await repo.negocio.guardar(NEGOCIO)

  const cliente = await repo.clientes.crear({
    nombre: 'Restaurante La Parra, S.L.',
    nif: 'B12345674',
    regimen: 'general',
    pais: 'ES',
    diasPago: 30,
    creadoEn: new Date().toISOString(),
  })

  const producto = await repo.productos.crear({
    nombre: 'AOVE Picual · Garrafa 5 L',
    categoria: 'aceite_oliva',
    categoriaAceite: 'aove',
    tipoIva: 4,
    precioVenta: euros(38.5),
    litros: 5,
    stock: 100,
    activo: true,
  })

  return { cliente, producto }
}

describe('flujo completo de facturación', () => {
  it('emite una factura, asigna número y descuenta stock', async () => {
    const { cliente, producto } = await prepararEscenario()

    const borrador = await crearBorrador(repo, {
      clienteId: cliente.id,
      fecha: '2026-09-04',
      lineas: [
        {
          productoId: producto.id,
          descripcion: producto.nombre,
          cantidad: 10,
          precioUnitario: producto.precioVenta,
          tipoIva: 4,
        },
      ],
    })

    expect(borrador.estado).toBe('borrador')
    expect(borrador.numeroCompleto).toBe('BORRADOR')

    const { factura, urlQR } = await emitirFactura(repo, borrador.id)

    expect(factura.numeroCompleto).toBe('A/2026/0001')
    expect(factura.estado).toBe('emitida')
    expect(aEuros(factura.baseImponible)).toBe(385)
    expect(aEuros(factura.totalIva)).toBe(15.4)
    expect(aEuros(factura.total)).toBe(400.4)
    expect(factura.huella).toMatch(/^[0-9A-F]{64}$/)
    expect(urlQR).toContain('importe=400.40')

    // El vencimiento sale de los días de pago del cliente.
    expect(factura.fechaVencimiento).toBe('2026-10-04')

    const tras = await repo.productos.obtener(producto.id)
    expect(tras?.stock).toBe(90)
  })

  it('encadena las huellas entre facturas consecutivas', async () => {
    const { cliente, producto } = await prepararEscenario()

    const linea = {
      productoId: producto.id,
      descripcion: producto.nombre,
      cantidad: 1,
      precioUnitario: producto.precioVenta,
      tipoIva: 4 as const,
    }

    const b1 = await crearBorrador(repo, { clienteId: cliente.id, fecha: '2026-09-04', lineas: [linea] })
    const { factura: f1 } = await emitirFactura(repo, b1.id)

    const b2 = await crearBorrador(repo, { clienteId: cliente.id, fecha: '2026-09-05', lineas: [linea] })
    const { factura: f2 } = await emitirFactura(repo, b2.id)

    expect(f1.numeroCompleto).toBe('A/2026/0001')
    expect(f2.numeroCompleto).toBe('A/2026/0002')
    expect(f1.huellaAnterior).toBe('')
    expect(f2.huellaAnterior).toBe(f1.huella)

    const cadena = [f1, f2].map((f) => ({
      tipoRegistro: 'alta' as const,
      idEmisor: NEGOCIO.nif,
      numSerieFactura: f.numeroCompleto,
      fechaExpedicion: f.fecha.split('-').reverse().join('-'),
      tipoFactura: f.tipoFactura,
      cuotaTotal: f.totalIva + f.totalRecargo,
      importeTotal: f.total,
      huellaAnterior: f.huellaAnterior,
      fechaHoraGeneracion: f.fechaHoraGeneracion,
      huella: f.huella,
    }))

    expect(await verificarCadena(cadena)).toBeNull()
  })

  it('no deja emitir una factura completa sin NIF del cliente', async () => {
    await repo.negocio.guardar(NEGOCIO)
    const sinNif = await repo.clientes.crear({
      nombre: 'Cliente de paso',
      regimen: 'general',
      pais: 'ES',
      diasPago: 0,
      creadoEn: new Date().toISOString(),
    })

    const b = await crearBorrador(repo, {
      clienteId: sinNif.id,
      lineas: [{ descripcion: 'Aceite', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 }],
    })

    await expect(emitirFactura(repo, b.id)).rejects.toThrow(/NIF/)
  })

  it('no deja emitir sin haber configurado el negocio', async () => {
    const cliente = await repo.clientes.crear({
      nombre: 'Bar Manolo',
      nif: 'B12345674',
      regimen: 'general',
      pais: 'ES',
      diasPago: 0,
      creadoEn: new Date().toISOString(),
    })
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      lineas: [{ descripcion: 'Aceite', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 }],
    })

    await expect(emitirFactura(repo, b.id)).rejects.toThrow(/datos fiscales/)
  })

  it('impide borrar una factura ya emitida', async () => {
    const { cliente, producto } = await prepararEscenario()
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      lineas: [
        { productoId: producto.id, descripcion: 'x', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 },
      ],
    })
    const { factura } = await emitirFactura(repo, b.id)

    await expect(repo.facturas.borrar(factura.id)).rejects.toThrow(/no se puede borrar/)
  })

  it('impide reescribir los importes de una factura emitida', async () => {
    const { cliente, producto } = await prepararEscenario()
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      lineas: [
        { productoId: producto.id, descripcion: 'x', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 },
      ],
    })
    const { factura } = await emitirFactura(repo, b.id)

    for (const cambio of [
      { total: euros(1) },
      { baseImponible: euros(1) },
      { fecha: '2020-01-01' },
      { clienteId: 'otro' },
      { huella: 'FALSA' },
      { numeroCompleto: 'A/2026/9999' },
    ]) {
      await expect(repo.facturas.actualizar(factura.id, cambio)).rejects.toThrow(/no se puede modificar/)
    }

    // Marcar como cobrada sí es legítimo sobre una factura ya emitida.
    await expect(marcarCobrada(repo, factura.id, '2026-09-30')).resolves.toBeTruthy()
  })

  it('deja modificar libremente un borrador', async () => {
    const { cliente, producto } = await prepararEscenario()
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      lineas: [
        { productoId: producto.id, descripcion: 'x', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 },
      ],
    })

    const cambiado = await repo.facturas.actualizar(b.id, { total: euros(99) })
    expect(aEuros(cambiado.total)).toBe(99)
    await expect(repo.facturas.borrar(b.id)).resolves.toBeUndefined()
  })

  it('anula mediante rectificativa y conserva la original', async () => {
    const { cliente, producto } = await prepararEscenario()
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      fecha: '2026-09-04',
      lineas: [
        {
          productoId: producto.id,
          descripcion: producto.nombre,
          cantidad: 10,
          precioUnitario: producto.precioVenta,
          tipoIva: 4,
        },
      ],
    })
    const { factura: original } = await emitirFactura(repo, b.id)

    const { factura: rect } = await anularConRectificativa(repo, original.id)

    expect(rect.tipoFactura).toBe('R1')
    expect(rect.rectificaA).toBe(original.id)
    expect(aEuros(rect.total)).toBe(-400.4)

    const guardadas = await repo.facturas.listar()
    const originalTras = guardadas.find((f) => f.id === original.id)
    expect(originalTras?.estado).toBe('anulada')
    // La original sigue existiendo con sus importes intactos.
    expect(aEuros(originalTras!.total)).toBe(400.4)
  })

  it('deja traza en el registro de eventos', async () => {
    const { cliente, producto } = await prepararEscenario()
    const b = await crearBorrador(repo, {
      clienteId: cliente.id,
      lineas: [
        { productoId: producto.id, descripcion: 'x', cantidad: 1, precioUnitario: euros(10), tipoIva: 4 },
      ],
    })
    await emitirFactura(repo, b.id)

    const eventos = await repo.eventos.listar()
    expect(eventos[0].tipo).toBe('alta_factura')
  })
})

describe('resumen de inicio', () => {
  it('separa lo vendido de lo pendiente de cobro', async () => {
    const { cliente, producto } = await prepararEscenario()
    const hoy = new Date('2026-09-04T12:00:00')

    const linea = {
      productoId: producto.id,
      descripcion: producto.nombre,
      cantidad: 10,
      precioUnitario: producto.precioVenta,
      tipoIva: 4 as const,
    }

    const b1 = await crearBorrador(repo, { clienteId: cliente.id, fecha: '2026-09-01', lineas: [linea] })
    const { factura: f1 } = await emitirFactura(repo, b1.id)

    const b2 = await crearBorrador(repo, { clienteId: cliente.id, fecha: '2026-09-03', lineas: [linea] })
    await emitirFactura(repo, b2.id)

    await marcarCobrada(repo, f1.id, '2026-09-02')

    const facturas = await repo.facturas.listar()
    const r = calcularResumen(facturas, [], { hoy })

    // Vendido cuenta las dos: se declara por emisión, no por cobro.
    expect(aEuros(r.vendidoMes)).toBe(770)
    // Pendiente solo la segunda.
    expect(aEuros(r.pendienteCobro)).toBe(400.4)
    expect(r.facturasPendientes).toBe(1)
    // 3T de 2026 se presenta hasta el 20 de octubre.
    expect(r.fechaLimite).toBe('2026-10-20')
  })
})
