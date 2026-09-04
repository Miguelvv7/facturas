/**
 * Registro de facturación encadenado (RD 1007/2023, "Verifactu").
 *
 * Obligatorio para autónomos desde el 1/7/2027. Se implementa desde ya porque
 * la cadena de huellas no se puede reconstruir hacia atrás: si las facturas de
 * hoy no nacen encadenadas, en 2027 hay que empezar una cadena nueva y las
 * anteriores quedan fuera del sistema.
 *
 * Aquí está la parte local del reglamento: huella, encadenado, inalterabilidad
 * y registro de eventos. El envío a la sede de la AEAT es un módulo aparte.
 */

import { Centimos, aEuros } from '../dinero'

export type TipoRegistro = 'alta' | 'anulacion'

/** Tipos de factura del catálogo L2 de la AEAT. */
export type TipoFactura =
  | 'F1' // Factura completa
  | 'F2' // Factura simplificada (ticket)
  | 'F3' // Factura emitida en sustitución de simplificadas
  | 'R1' // Rectificativa por error fundado en derecho
  | 'R2' // Rectificativa por concurso
  | 'R3' // Rectificativa por deuda incobrable
  | 'R4' // Rectificativa resto
  | 'R5' // Rectificativa en facturas simplificadas

export interface RegistroFacturacion {
  tipoRegistro: TipoRegistro
  /** NIF del emisor. */
  idEmisor: string
  /** Serie y número, tal cual aparece en la factura. */
  numSerieFactura: string
  /** Fecha de expedición en formato dd-mm-aaaa. */
  fechaExpedicion: string
  tipoFactura: TipoFactura
  cuotaTotal: Centimos
  importeTotal: Centimos
  /** Huella del registro inmediatamente anterior. Cadena vacía si es el primero. */
  huellaAnterior: string
  /** Marca temporal ISO-8601 con huso horario. */
  fechaHoraGeneracion: string
}

/** Importes en la huella: dos decimales, punto decimal, sin separador de miles. */
const importe = (c: Centimos): string => aEuros(c).toFixed(2)

/**
 * Cadena a resumir, en el orden exacto que fija la especificación técnica.
 * El orden y los nombres de campo no son negociables: cualquier desviación
 * produce una huella que la AEAT rechazará al cotejar.
 */
export function construirCadenaHuella(r: RegistroFacturacion): string {
  if (r.tipoRegistro === 'anulacion') {
    return [
      `IDEmisorFacturaAnulada=${r.idEmisor}`,
      `NumSerieFacturaAnulada=${r.numSerieFactura}`,
      `FechaExpedicionFacturaAnulada=${r.fechaExpedicion}`,
      `Huella=${r.huellaAnterior}`,
      `FechaHoraHusoGenRegistro=${r.fechaHoraGeneracion}`,
    ].join('&')
  }

  return [
    `IDEmisorFactura=${r.idEmisor}`,
    `NumSerieFactura=${r.numSerieFactura}`,
    `FechaExpedicionFactura=${r.fechaExpedicion}`,
    `TipoFactura=${r.tipoFactura}`,
    `CuotaTotal=${importe(r.cuotaTotal)}`,
    `ImporteTotal=${importe(r.importeTotal)}`,
    `Huella=${r.huellaAnterior}`,
    `FechaHoraHusoGenRegistro=${r.fechaHoraGeneracion}`,
  ].join('&')
}

const aHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/** SHA-256 en hexadecimal mayúsculas, como exige el reglamento. */
export async function calcularHuella(r: RegistroFacturacion): Promise<string> {
  const datos = new TextEncoder().encode(construirCadenaHuella(r))
  return aHex(await crypto.subtle.digest('SHA-256', datos))
}

/**
 * Verifica que una cadena de registros no ha sido alterada.
 * Devuelve el índice del primer registro corrupto, o null si la cadena es íntegra.
 */
export async function verificarCadena(
  registros: (RegistroFacturacion & { huella: string })[]
): Promise<number | null> {
  let anterior = ''
  for (let i = 0; i < registros.length; i++) {
    const r = registros[i]
    if (r.huellaAnterior !== anterior) return i
    if ((await calcularHuella(r)) !== r.huella) return i
    anterior = r.huella
  }
  return null
}

const URL_COTEJO = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'

/**
 * Contenido del QR que debe imprimirse en la factura. Permite al receptor
 * cotejarla contra la AEAT.
 */
export function urlCotejoQR(r: {
  idEmisor: string
  numSerieFactura: string
  fechaExpedicion: string
  importeTotal: Centimos
}): string {
  const params = new URLSearchParams({
    nif: r.idEmisor,
    numserie: r.numSerieFactura,
    fecha: r.fechaExpedicion,
    importe: importe(r.importeTotal),
  })
  return `${URL_COTEJO}?${params.toString()}`
}

/**
 * Registro de eventos exigido por el reglamento: el sistema debe dejar traza
 * de lo que ocurre, no solo de las facturas.
 */
export type TipoEvento =
  | 'inicio_sistema'
  | 'parada_sistema'
  | 'alta_factura'
  | 'anulacion_factura'
  | 'exportacion_registros'
  | 'deteccion_anomalia'
  | 'restauracion_copia'

export interface Evento {
  tipo: TipoEvento
  fechaHora: string
  detalle?: string
}
