/**
 * Generación del PDF de la factura.
 *
 * Incluye todas las menciones obligatorias del RD 1619/2012 (art. 6): número
 * y serie, fecha, identificación de emisor y destinatario, descripción de las
 * operaciones, base, tipo y cuota, y referencia a la norma en las exentas.
 */

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { Cliente, DatosNegocio, Factura } from '../domain/tipos'
import { formatearEuros } from '../domain/dinero'
import { urlCotejoQR } from '../domain/fiscal/verifactu'
import { baseLinea } from '../domain/fiscal/factura-calc'
import { medirLogo } from '../servicios/imagen'
import { aFormatoAEAT, formatearFecha } from '../domain/fechas'

/**
 * jsPDF no interpreta de forma fiable los colores en hexadecimal: según el
 * valor, unos salen bien y otros en negro. Se convierten a RGB a mano.
 */
type Rgb = [number, number, number]

const rgb = (hex: string): Rgb => {
  const limpio = hex.replace('#', '').trim()
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio
  const n = Number.parseInt(completo, 16)
  return Number.isFinite(n) && completo.length === 6
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [0, 0, 0]
}

const TINTA = '#1c1917'
const SUAVE = '#78716c'
const LINEA = '#e7e5e4'

const MARGEN = 18
const ANCHO = 210
const UTIL = ANCHO - MARGEN * 2

const fechaLarga = (iso: string) => formatearFecha(iso, 'larga')

const TEXTO_EXENCION: Record<string, string> = {
  intracomunitario:
    'Operación exenta de IVA por entrega intracomunitaria de bienes (art. 25 Ley 37/1992). Inversión del sujeto pasivo.',
  exportacion: 'Operación exenta de IVA por exportación de bienes (art. 21 Ley 37/1992).',
}

export interface DatosPdfFactura {
  factura: Factura
  cliente: Cliente
  negocio: DatosNegocio
}

export async function generarFacturaPDF({
  factura,
  cliente,
  negocio,
}: DatosPdfFactura): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const estilo = negocio.factura
  const ACENTO = estilo.colorAcento || '#65783e'
  let y = MARGEN

  const texto = (
    t: string,
    x: number,
    yy: number,
    o: { size?: number; color?: string; bold?: boolean; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    doc.setFontSize(o.size ?? 9)
    doc.setTextColor(...rgb(o.color ?? TINTA))
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.text(t, x, yy, { align: o.align ?? 'left' })
  }

  const linea = (yy: number, color = LINEA) => {
    doc.setDrawColor(...rgb(color))
    doc.setLineWidth(0.2)
    doc.line(MARGEN, yy, ANCHO - MARGEN, yy)
  }

  // ---- Cabecera -----------------------------------------------------------
  if (estilo.logo) {
    // Se respeta la proporción original: un logo estirado canta mucho.
    const { ancho, alto } = await medirLogo(estilo.logo)
    const altoMm = 16
    const anchoMm = Math.min(60, (ancho / alto) * altoMm)
    doc.addImage(estilo.logo, 'PNG', MARGEN, y, anchoMm, altoMm)
    y += altoMm + 4
  }

  texto(negocio.nombreComercial || negocio.nombreCompleto, MARGEN, y + 4, {
    size: 17,
    bold: true,
    color: ACENTO,
  })
  texto('FACTURA', ANCHO - MARGEN, y + 4, { size: 17, bold: true, align: 'right' })
  y += 10

  const emisor = [
    negocio.nombreComercial ? negocio.nombreCompleto : null,
    `NIF ${negocio.nif}`,
    negocio.direccion,
    `${negocio.codigoPostal} ${negocio.ciudad} (${negocio.provincia})`,
    negocio.telefono,
    negocio.email,
  ].filter(Boolean) as string[]

  emisor.forEach((l, i) => texto(l, MARGEN, y + i * 4, { size: 8.5, color: SUAVE }))

  texto(factura.numeroCompleto, ANCHO - MARGEN, y, { size: 11, bold: true, align: 'right' })
  texto(fechaLarga(factura.fecha), ANCHO - MARGEN, y + 5, {
    size: 8.5,
    color: SUAVE,
    align: 'right',
  })
  if (factura.rectificaA) {
    texto('Factura rectificativa', ANCHO - MARGEN, y + 9.5, {
      size: 8.5,
      color: '#b45309',
      align: 'right',
    })
  }

  y += Math.max(emisor.length * 4, 14) + 6
  linea(y)
  y += 7

  // ---- Destinatario -------------------------------------------------------
  texto('FACTURAR A', MARGEN, y, { size: 7.5, color: SUAVE, bold: true })
  y += 5
  texto(cliente.nombre, MARGEN, y, { size: 10.5, bold: true })
  y += 4.5

  const datosCliente = [
    cliente.nif ? `NIF ${cliente.nif}` : null,
    cliente.direccion,
    [cliente.codigoPostal, cliente.ciudad, cliente.provincia && `(${cliente.provincia})`]
      .filter(Boolean)
      .join(' '),
  ].filter((l) => l && l.trim()) as string[]

  datosCliente.forEach((l, i) => texto(l, MARGEN, y + i * 4, { size: 8.5, color: SUAVE }))
  y += datosCliente.length * 4 + 6

  // Vencimiento, a la derecha del bloque de cliente.
  if (factura.fechaVencimiento !== factura.fecha) {
    texto('VENCIMIENTO', ANCHO - MARGEN, y - datosCliente.length * 4 - 6, {
      size: 7.5,
      color: SUAVE,
      bold: true,
      align: 'right',
    })
    texto(fechaLarga(factura.fechaVencimiento), ANCHO - MARGEN, y - datosCliente.length * 4 - 1, {
      size: 9,
      align: 'right',
    })
  }

  // ---- Tabla de líneas ----------------------------------------------------
  const COL_DESC = MARGEN
  const COL_CANT = MARGEN + 96
  const COL_PRECIO = MARGEN + 122
  const COL_IVA = MARGEN + 146
  const COL_IMPORTE = ANCHO - MARGEN

  doc.setFillColor(...rgb(ACENTO))
  doc.rect(MARGEN, y, UTIL, 7, 'F')
  const yCab = y + 4.8
  texto('CONCEPTO', COL_DESC + 2, yCab, { size: 7.5, bold: true, color: '#ffffff' })
  texto('CANT.', COL_CANT, yCab, { size: 7.5, bold: true, color: '#ffffff', align: 'right' })
  texto('PRECIO', COL_PRECIO, yCab, { size: 7.5, bold: true, color: '#ffffff', align: 'right' })
  texto('IVA', COL_IVA, yCab, { size: 7.5, bold: true, color: '#ffffff', align: 'right' })
  texto('IMPORTE', COL_IMPORTE - 2, yCab, {
    size: 7.5,
    bold: true,
    color: '#ffffff',
    align: 'right',
  })
  y += 7

  for (const l of factura.lineas) {
    const importe = baseLinea(l)

    y += 6
    const partes = doc.splitTextToSize(l.descripcion, 92) as string[]
    partes.forEach((p, i) => texto(p, COL_DESC + 2, y + i * 4, { size: 9 }))

    texto(String(l.cantidad), COL_CANT, y, { size: 9, align: 'right' })
    texto(formatearEuros(l.precioUnitario), COL_PRECIO, y, { size: 9, align: 'right' })
    texto(`${l.tipoIva}%`, COL_IVA, y, { size: 9, align: 'right' })
    texto(formatearEuros(importe), COL_IMPORTE - 2, y, { size: 9, align: 'right', bold: true })

    if (l.descuento || estilo.mostrarDescuentos) {
      texto(`Descuento ${l.descuento ?? 0}%`, COL_DESC + 2, y + partes.length * 4, {
        size: 7.5,
        color: SUAVE,
      })
      y += 4
    }
    y += (partes.length - 1) * 4 + 2
    linea(y + 1)
  }

  // ---- Totales ------------------------------------------------------------
  y += 8
  const xEtiqueta = ANCHO - MARGEN - 52
  const xValor = ANCHO - MARGEN

  const fila = (etiqueta: string, valor: string, o: { bold?: boolean; color?: string } = {}) => {
    texto(etiqueta, xEtiqueta, y, { size: 9, color: o.color ?? SUAVE })
    texto(valor, xValor, y, { size: 9, align: 'right', bold: o.bold, color: o.color })
    y += 5
  }

  fila('Base imponible', formatearEuros(factura.baseImponible))

  for (const d of factura.desglose) {
    if (d.tipoIva > 0) {
      fila(`IVA ${d.tipoIva}% sobre ${formatearEuros(d.base)}`, formatearEuros(d.cuotaIva))
    }
    if (d.tipoRecargo > 0) {
      fila(`Recargo eq. ${d.tipoRecargo}%`, formatearEuros(d.cuotaRecargo))
    }
  }

  if (factura.totalRetencion > 0) {
    fila(`Retención IRPF ${factura.tipoRetencion}%`, `−${formatearEuros(factura.totalRetencion)}`, {
      color: '#b45309',
    })
  }

  y += 1
  doc.setFillColor(...rgb(ACENTO))
  doc.rect(xEtiqueta - 4, y - 1, ANCHO - MARGEN - xEtiqueta + 4, 9, 'F')
  texto('TOTAL', xEtiqueta, y + 5, { size: 10.5, bold: true, color: '#ffffff' })
  texto(formatearEuros(factura.total), xValor - 2, y + 5, {
    size: 11.5,
    bold: true,
    color: '#ffffff',
    align: 'right',
  })
  y += 16

  // ---- Pie: cobro, exención, QR y huella ---------------------------------
  const exencion = factura.desglose.every((d) => d.tipoIva === 0)
    ? TEXTO_EXENCION[cliente.regimen]
    : null

  if (negocio.iban || estilo.condicionesPago) {
    texto('FORMA DE PAGO', MARGEN, y, { size: 7.5, color: SUAVE, bold: true })
    y += 5
    if (negocio.iban) {
      texto(`Transferencia · ${negocio.iban}`, MARGEN, y, { size: 9 })
      y += 5
    }
    if (estilo.condicionesPago) {
      texto(estilo.condicionesPago, MARGEN, y, { size: 8.5, color: SUAVE })
      y += 5
    }
    y += 3
  }

  if (exencion) {
    const partes = doc.splitTextToSize(exencion, UTIL - 40) as string[]
    partes.forEach((p, i) => texto(p, MARGEN, y + i * 4, { size: 8, color: SUAVE }))
    y += partes.length * 4 + 4
  }

  for (const bloque of [factura.notas, estilo.textoPie].filter(Boolean) as string[]) {
    const partes = doc.splitTextToSize(bloque, UTIL - 40) as string[]
    partes.forEach((p, i) => texto(p, MARGEN, y + i * 4, { size: 8, color: SUAVE }))
    y += partes.length * 4 + 4
  }

  // El QR de cotejo y la huella solo tienen sentido una vez emitida.
  if (factura.huella && estilo.mostrarQR) {
    const yQR = 262
    const url = urlCotejoQR({
      idEmisor: negocio.nif,
      numSerieFactura: factura.numeroCompleto,
      fechaExpedicion: aFormatoAEAT(factura.fecha),
      importeTotal: factura.total,
    })

    const png = await QRCode.toDataURL(url, { margin: 0, width: 200 })
    doc.addImage(png, 'PNG', MARGEN, yQR, 22, 22)

    texto('Factura verificable', MARGEN + 26, yQR + 5, { size: 7.5, bold: true, color: SUAVE })
    texto(`Huella: ${factura.huella.slice(0, 32)}…`, MARGEN + 26, yQR + 9.5, {
      size: 6.5,
      color: SUAVE,
    })
    texto('Sistema de facturación con registro encadenado (RD 1007/2023).', MARGEN + 26, yQR + 14, {
      size: 6.5,
      color: SUAVE,
    })
  }

  return doc
}

export const nombreArchivo = (f: Factura) => `${f.numeroCompleto.replace(/\//g, '-')}.pdf`

export async function descargarFacturaPDF(datos: DatosPdfFactura) {
  const doc = await generarFacturaPDF(datos)
  doc.save(nombreArchivo(datos.factura))
}
