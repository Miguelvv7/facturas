/**
 * Fechas en formato aaaa-mm-dd, siempre interpretadas como día natural.
 *
 * Este es el único módulo que puede tocar `Date`. Nunca uses
 * `new Date(iso).toISOString()` fuera de aquí: construye la fecha a medianoche
 * local y la imprime en UTC, así que en España (UTC+1/+2) el día retrocede uno.
 * Un vencimiento a 30 días acababa cayendo a 29.
 */

export type FechaIso = string

/** Hoy según el reloj del usuario, no según UTC. */
export function hoy(momento = new Date()): FechaIso {
  return [
    momento.getFullYear(),
    String(momento.getMonth() + 1).padStart(2, '0'),
    String(momento.getDate()).padStart(2, '0'),
  ].join('-')
}

export function sumarDias(fecha: FechaIso, dias: number): FechaIso {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export const diasEntre = (desde: FechaIso, hasta: FechaIso): number => {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000
}

/** dd-mm-aaaa, el formato que exige la huella de la AEAT. */
export const aFormatoAEAT = (fecha: FechaIso) => fecha.split('-').reverse().join('-')

/**
 * ISO-8601 con huso horario, no en UTC: el reglamento antifraude pide la hora
 * local del sistema que emite la factura.
 */
export function ahoraConHuso(momento = new Date()): string {
  const desfase = -momento.getTimezoneOffset()
  const signo = desfase >= 0 ? '+' : '-'
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0')
  const local = new Date(momento.getTime() - momento.getTimezoneOffset() * 60000)
  return `${local.toISOString().slice(0, 19)}${signo}${pad(desfase / 60)}:${pad(desfase % 60)}`
}

export type EstiloFecha = 'corta' | 'larga' | 'diaMes' | 'conDiaSemana'

// Construir un Intl.DateTimeFormat es caro y se repetía por cada fila de las
// listas. Se crean una vez y se reutilizan.
const FORMATOS: Record<EstiloFecha, Intl.DateTimeFormat> = {
  corta: new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  larga: new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  diaMes: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
  conDiaSemana: new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
}

export function formatearFecha(fecha: FechaIso, estilo: EstiloFecha = 'corta'): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return FORMATOS[estilo].format(new Date(Date.UTC(a, m - 1, d)))
}
