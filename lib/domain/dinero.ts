/**
 * Todo el dinero se maneja en céntimos enteros.
 * Motivo: 0.1 + 0.2 !== 0.3 en coma flotante, y una factura que no cuadra
 * al céntimo es una factura que Hacienda puede rechazar.
 */

export type Centimos = number

export const euros = (valor: number): Centimos => Math.round(valor * 100)

export const aEuros = (c: Centimos): number => c / 100

/** Redondeo al alza en el 0,5 (redondeo comercial), como exige la AEAT. */
export const redondear = (c: number): Centimos =>
  c < 0 ? -Math.round(-c) : Math.round(c)

/** Aplica un porcentaje expresado en puntos (21 = 21%) sobre una base en céntimos. */
export const porcentaje = (base: Centimos, puntos: number): Centimos =>
  redondear((base * puntos) / 100)

export const formatearEuros = (c: Centimos): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(aEuros(c))

/** Sin céntimos. Para celdas estrechas, como las del calendario. */
export const formatearEurosCorto = (c: Centimos): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(aEuros(c))

/** Lee un importe tecleado por el usuario: admite coma, punto de miles y €. */
export const parsearEuros = (entrada: string): Centimos | null => {
  const limpio = entrada.trim().replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? euros(n) : null
}
