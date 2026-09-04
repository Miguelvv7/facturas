/**
 * Tipos de IVA y recargo de equivalencia aplicables a la venta de aceites.
 *
 * El aceite de oliva tributa al 4% de forma permanente desde el 1/1/2025
 * (Ley 7/2024), con independencia de su categoría: AOVE, virgen, refinado
 * u orujo. Los aceites de semillas se quedaron en el 10%.
 */

export type TipoIva = 0 | 4 | 10 | 21

/** Recargo de equivalencia asociado a cada tipo de IVA (art. 161 LIVA). */
export const RECARGO_EQUIVALENCIA: Record<TipoIva, number> = {
  0: 0,
  4: 0.5,
  10: 1.4,
  21: 5.2,
}


/**
 * Categorías comerciales del aceite de oliva según el Reglamento (UE) 1308/2013.
 * No afectan al IVA, pero el etiquetado es obligatorio y la denominación
 * no se puede elegir libremente.
 */
export const CATEGORIAS_ACEITE_OLIVA = [
  {
    codigo: 'aove',
    nombre: 'Aceite de oliva virgen extra',
    acidezMaxima: 0.8,
    nota: 'Acidez ≤ 0,8°. Obtenido solo por medios mecánicos.',
  },
  {
    codigo: 'avo',
    nombre: 'Aceite de oliva virgen',
    acidezMaxima: 2.0,
    nota: 'Acidez ≤ 2,0°.',
  },
  {
    codigo: 'oliva',
    nombre: 'Aceite de oliva',
    acidezMaxima: 1.0,
    nota: 'Mezcla de refinado y virgen. Acidez ≤ 1,0°.',
  },
  {
    codigo: 'orujo',
    nombre: 'Aceite de orujo de oliva',
    acidezMaxima: 1.0,
    nota: 'Obtenido del orujo. No puede llamarse "aceite de oliva" a secas.',
  },
] as const

export type CodigoAceiteOliva = (typeof CATEGORIAS_ACEITE_OLIVA)[number]['codigo']
