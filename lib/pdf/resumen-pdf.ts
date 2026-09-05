/**
 * Resumen de un periodo en PDF. Es lo que se le entrega a un gestor o lo que
 * conviene archivar cada trimestre: cuánto se ha facturado, cuánto se ha
 * gastado, el desglose de IVA y el listado completo de operaciones.
 */

import { jsPDF } from 'jspdf'
import { Centimos, formatearEuros } from '../domain/dinero'
import { formatearFecha } from '../domain/fechas'
import { Cliente, DatosNegocio } from '../domain/tipos'
import { ResumenPeriodo, nombrarRango } from '../servicios/resumen-periodo'
import { CATEGORIAS_GASTO } from '../domain/fiscal/categorias-gasto'

const TINTA = '#1c1917'
const SUAVE = '#78716c'
const LINEA = '#e7e5e4'

const MARGEN = 16
const ANCHO = 210
const ALTO = 297
const UTIL = ANCHO - MARGEN * 2
const PIE = 22

const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export interface DatosResumen {
  resumen: ResumenPeriodo
  negocio: DatosNegocio
  clientes: Cliente[]
}

export function generarResumenPDF({ resumen, negocio, clientes }: DatosResumen): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ACENTO = negocio.factura?.colorAcento || '#65783e'
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]))

  let y = MARGEN
  let pagina = 1

  const texto = (
    t: string,
    x: number,
    yy: number,
    o: { size?: number; color?: string; bold?: boolean; align?: 'left' | 'right' } = {}
  ) => {
    doc.setFontSize(o.size ?? 9)
    doc.setTextColor(...rgb(o.color ?? TINTA))
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.text(t, x, yy, { align: o.align ?? 'left' })
  }

  const separador = (yy: number) => {
    doc.setDrawColor(...rgb(LINEA))
    doc.setLineWidth(0.2)
    doc.line(MARGEN, yy, ANCHO - MARGEN, yy)
  }

  const pieDePagina = () => {
    texto(
      `${negocio.nombreComercial || negocio.nombreCompleto} · ${nombrarRango(resumen.rango)}`,
      MARGEN,
      ALTO - 10,
      { size: 7.5, color: SUAVE }
    )
    texto(`Página ${pagina}`, ANCHO - MARGEN, ALTO - 10, {
      size: 7.5,
      color: SUAVE,
      align: 'right',
    })
  }

  /** Salta de página si no caben `alto` milímetros más. */
  const asegurarSitio = (alto: number) => {
    if (y + alto <= ALTO - PIE) return
    pieDePagina()
    doc.addPage()
    pagina += 1
    y = MARGEN
  }

  const titulo = (t: string) => {
    asegurarSitio(16)
    y += 6
    texto(t, MARGEN, y, { size: 11, bold: true })
    y += 2.5
    separador(y)
    y += 5.5
  }

  const fila = (
    etiqueta: string,
    valor: string,
    o: { bold?: boolean; color?: string; sangria?: number } = {}
  ) => {
    asegurarSitio(6)
    texto(etiqueta, MARGEN + (o.sangria ?? 0), y, {
      size: 9,
      color: o.color ?? (o.bold ? TINTA : SUAVE),
      bold: o.bold,
    })
    texto(valor, ANCHO - MARGEN, y, { size: 9, align: 'right', bold: o.bold, color: o.color })
    y += 5.5
  }

  // ---- Cabecera -----------------------------------------------------------
  doc.setFillColor(...rgb(ACENTO))
  doc.rect(0, 0, ANCHO, 34, 'F')

  texto('RESUMEN', MARGEN, 14, { size: 8, bold: true, color: '#ffffff' })
  texto(nombrarRango(resumen.rango), MARGEN, 24, { size: 17, bold: true, color: '#ffffff' })
  texto(negocio.nombreComercial || negocio.nombreCompleto, ANCHO - MARGEN, 14, {
    size: 10,
    bold: true,
    color: '#ffffff',
    align: 'right',
  })
  texto(`NIF ${negocio.nif}`, ANCHO - MARGEN, 20, {
    size: 8,
    color: '#ffffff',
    align: 'right',
  })
  texto(
    `Del ${formatearFecha(resumen.rango.desde, 'larga')} al ${formatearFecha(resumen.rango.hasta, 'larga')}`,
    ANCHO - MARGEN,
    26,
    { size: 8, color: '#ffffff', align: 'right' }
  )

  y = 46

  // ---- Las cuatro cifras que importan -------------------------------------
  const tarjetas: { titulo: string; valor: Centimos; destacar?: boolean }[] = [
    { titulo: 'Facturado', valor: resumen.baseImponible },
    { titulo: 'Gastos', valor: resumen.gastosDeducibles },
    { titulo: 'Beneficio', valor: resumen.beneficio, destacar: true },
    {
      titulo: resumen.resultadoIva >= 0 ? 'IVA a pagar' : 'IVA a compensar',
      valor: Math.abs(resumen.resultadoIva),
    },
  ]

  const anchoTarjeta = (UTIL - 3 * 3) / 4
  tarjetas.forEach((t, i) => {
    const x = MARGEN + i * (anchoTarjeta + 3)
    doc.setFillColor(...rgb(t.destacar ? ACENTO : '#f5f5f4'))
    doc.roundedRect(x, y, anchoTarjeta, 20, 2, 2, 'F')
    texto(t.titulo.toUpperCase(), x + 4, y + 7, {
      size: 6.5,
      bold: true,
      color: t.destacar ? '#ffffff' : SUAVE,
    })
    texto(formatearEuros(t.valor), x + 4, y + 15, {
      size: 11,
      bold: true,
      color: t.destacar ? '#ffffff' : TINTA,
    })
  })
  y += 26

  // ---- Ventas -------------------------------------------------------------
  titulo('Ventas')

  fila(
    `${resumen.numFacturas} factura${resumen.numFacturas === 1 ? '' : 's'}` +
      (resumen.numTickets ? ` y ${resumen.numTickets} ticket${resumen.numTickets === 1 ? '' : 's'}` : ''),
    formatearEuros(resumen.totalFacturado),
    { bold: true }
  )

  for (const d of resumen.desgloseVentas) {
    if (d.tipoIva === 0) {
      fila('Operaciones exentas o sin IVA', formatearEuros(d.base), { sangria: 4 })
    } else {
      fila(
        `IVA ${d.tipoIva}% sobre ${formatearEuros(d.base)}`,
        formatearEuros(d.cuota),
        { sangria: 4 }
      )
    }
  }

  if (resumen.recargoRepercutido > 0) {
    fila('Recargo de equivalencia', formatearEuros(resumen.recargoRepercutido), { sangria: 4 })
  }
  if (resumen.retencionSoportada > 0) {
    fila('Retencion de IRPF practicada', `-${formatearEuros(resumen.retencionSoportada)}`, {
      sangria: 4,
    })
  }

  y += 1
  fila('Cobrado', formatearEuros(resumen.cobrado))
  fila('Pendiente de cobro', formatearEuros(resumen.pendiente), {
    color: resumen.pendiente > 0 ? '#b45309' : undefined,
  })

  // ---- Gastos -------------------------------------------------------------
  titulo('Gastos')

  if (resumen.numGastos === 0) {
    fila('Sin gastos registrados en el periodo', '')
  } else {
    for (const g of resumen.gastosPorCategoria) {
      fila(g.etiqueta, formatearEuros(g.base), { sangria: 4 })
    }
    y += 1
    fila('Total gastos (sin IVA)', formatearEuros(resumen.gastosBase), { bold: true })
    fila('IVA soportado', formatearEuros(resumen.ivaSoportado))
    fila('IVA deducible', formatearEuros(resumen.ivaDeducible))
    if (resumen.ivaSoportado !== resumen.ivaDeducible) {
      fila(
        'IVA no deducible (cuenta como gasto)',
        formatearEuros(resumen.ivaSoportado - resumen.ivaDeducible),
        { sangria: 4 }
      )
    }
  }

  // ---- Resultado ----------------------------------------------------------
  titulo('Resultado del periodo')
  fila('Ingresos', formatearEuros(resumen.baseImponible))
  fila('Gastos deducibles', `-${formatearEuros(resumen.gastosDeducibles)}`)
  fila('Beneficio', formatearEuros(resumen.beneficio), { bold: true })

  y += 2
  fila('IVA repercutido a clientes', formatearEuros(resumen.ivaRepercutido))
  fila('IVA soportado deducible', `-${formatearEuros(resumen.ivaDeducible)}`)
  fila(
    resumen.resultadoIva >= 0 ? 'IVA a ingresar en Hacienda' : 'IVA a compensar',
    formatearEuros(Math.abs(resumen.resultadoIva)),
    { bold: true }
  )

  // ---- Detalle de facturas ------------------------------------------------
  if (resumen.facturas.length > 0) {
    titulo('Detalle de ventas')

    const COL_FECHA = MARGEN
    const COL_NUM = MARGEN + 22
    const COL_CLIENTE = MARGEN + 56
    const COL_BASE = ANCHO - MARGEN - 46
    const COL_IVA = ANCHO - MARGEN - 24
    const COL_TOTAL = ANCHO - MARGEN

    const cabeceraTabla = () => {
      texto('FECHA', COL_FECHA, y, { size: 6.5, bold: true, color: SUAVE })
      texto('NÚMERO', COL_NUM, y, { size: 6.5, bold: true, color: SUAVE })
      texto('CLIENTE', COL_CLIENTE, y, { size: 6.5, bold: true, color: SUAVE })
      texto('BASE', COL_BASE, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      texto('IVA', COL_IVA, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      texto('TOTAL', COL_TOTAL, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      y += 2
      separador(y)
      y += 4
    }

    cabeceraTabla()

    for (const f of resumen.facturas) {
      // Si la fila no cabe, se repite la cabecera en la página siguiente.
      if (y + 5 > ALTO - PIE) {
        asegurarSitio(5)
        cabeceraTabla()
      }

      const nombre = nombres.get(f.clienteId) ?? '—'
      texto(formatearFecha(f.fecha), COL_FECHA, y, { size: 8 })
      texto(f.numeroCompleto, COL_NUM, y, { size: 8 })
      texto(doc.splitTextToSize(nombre, 52)[0], COL_CLIENTE, y, { size: 8 })
      texto(formatearEuros(f.baseImponible), COL_BASE, y, { size: 8, align: 'right' })
      texto(formatearEuros(f.totalIva), COL_IVA, y, { size: 8, align: 'right' })
      texto(formatearEuros(f.total), COL_TOTAL, y, { size: 8, align: 'right', bold: true })
      y += 5
    }

    y += 1
    separador(y)
    y += 4.5
    texto('TOTAL', COL_CLIENTE, y, { size: 8.5, bold: true })
    texto(formatearEuros(resumen.baseImponible), COL_BASE, y, { size: 8.5, align: 'right', bold: true })
    texto(formatearEuros(resumen.ivaRepercutido), COL_IVA, y, { size: 8.5, align: 'right', bold: true })
    texto(formatearEuros(resumen.totalFacturado), COL_TOTAL, y, { size: 8.5, align: 'right', bold: true })
    y += 6
  }

  // ---- Detalle de gastos --------------------------------------------------
  if (resumen.gastos.length > 0) {
    titulo('Detalle de gastos')

    const COL_FECHA = MARGEN
    const COL_PROV = MARGEN + 22
    const COL_CAT = MARGEN + 74
    const COL_BASE = ANCHO - MARGEN - 46
    const COL_IVA = ANCHO - MARGEN - 24
    const COL_TOTAL = ANCHO - MARGEN

    const cabeceraTabla = () => {
      texto('FECHA', COL_FECHA, y, { size: 6.5, bold: true, color: SUAVE })
      texto('PROVEEDOR', COL_PROV, y, { size: 6.5, bold: true, color: SUAVE })
      texto('CATEGORÍA', COL_CAT, y, { size: 6.5, bold: true, color: SUAVE })
      texto('BASE', COL_BASE, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      texto('IVA', COL_IVA, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      texto('TOTAL', COL_TOTAL, y, { size: 6.5, bold: true, color: SUAVE, align: 'right' })
      y += 2
      separador(y)
      y += 4
    }

    cabeceraTabla()

    for (const g of resumen.gastos) {
      if (y + 5 > ALTO - PIE) {
        asegurarSitio(5)
        cabeceraTabla()
      }

      texto(formatearFecha(g.fecha), COL_FECHA, y, { size: 8 })
      texto(doc.splitTextToSize(g.proveedor || g.descripcion, 50)[0], COL_PROV, y, { size: 8 })
      texto(
        doc.splitTextToSize(CATEGORIAS_GASTO[g.categoria]?.etiqueta ?? g.categoria, 44)[0],
        COL_CAT,
        y,
        { size: 8, color: SUAVE }
      )
      texto(formatearEuros(g.base), COL_BASE, y, { size: 8, align: 'right' })
      texto(formatearEuros(g.cuotaIva), COL_IVA, y, { size: 8, align: 'right' })
      texto(formatearEuros(g.total), COL_TOTAL, y, { size: 8, align: 'right', bold: true })
      y += 5
    }
  }

  // ---- Nota final ---------------------------------------------------------
  asegurarSitio(16)
  y += 4
  separador(y)
  y += 5
  texto(
    'Documento informativo generado por la aplicación. No sustituye a la presentación de los modelos ante la AEAT.',
    MARGEN,
    y,
    { size: 7, color: SUAVE }
  )

  pieDePagina()
  return doc
}

export const nombreArchivoResumen = (resumen: ResumenPeriodo) =>
  `resumen-${resumen.rango.desde}-a-${resumen.rango.hasta}.pdf`

export function descargarResumenPDF(datos: DatosResumen) {
  generarResumenPDF(datos).save(nombreArchivoResumen(datos.resumen))
}
