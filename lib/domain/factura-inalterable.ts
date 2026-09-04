/**
 * Inalterabilidad de las facturas emitidas (RD 1007/2023).
 *
 * La regla se enuncia aquí una sola vez y la aplican tanto el almacenamiento
 * como el trigger de Postgres en `supabase/migrations/0001_esquema_inicial.sql`.
 * Si cambia la lista de campos, tiene que cambiar en los dos sitios.
 *
 * Es una regla por campo, no por estado: emitir una factura y marcarla como
 * cobrada son actualizaciones legítimas sobre una factura que ya no es
 * borrador. Lo que no puede cambiar nunca son los importes y la identidad.
 */

import { Factura } from './tipos'

/** Campos que quedan congelados en cuanto la factura deja de ser borrador. */
export const CAMPOS_CONGELADOS = [
  'baseImponible',
  'total',
  'totalIva',
  'totalRecargo',
  'totalRetencion',
  'desglose',
  'lineas',
  'fecha',
  'numeroCompleto',
  'numero',
  'serie',
  'clienteId',
  'huella',
  'huellaAnterior',
] as const satisfies readonly (keyof Factura)[]

export const esBorrador = (f: Factura) => f.estado === 'borrador'

/** Facturas que producen efectos fiscales. Borradores y anuladas quedan fuera. */
export const computaFiscalmente = (f: Factura) =>
  f.estado !== 'borrador' && f.estado !== 'anulada'

/**
 * Devuelve el nombre del primer campo congelado que se intenta cambiar,
 * o null si la modificación es legítima.
 */
export function campoCongeladoAlterado(
  actual: Factura,
  cambios: Partial<Factura>
): string | null {
  if (esBorrador(actual)) return null

  for (const campo of CAMPOS_CONGELADOS) {
    if (!(campo in cambios)) continue
    const nuevo = cambios[campo]
    if (nuevo === undefined) continue
    if (JSON.stringify(nuevo) !== JSON.stringify(actual[campo])) return campo
  }
  return null
}
