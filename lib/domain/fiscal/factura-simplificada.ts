/**
 * Factura simplificada, el "ticket" de toda la vida (RD 1619/2012, art. 4).
 *
 * A un particular que compra dos botellas no se le puede pedir el NIF ni el
 * domicilio: se le da un ticket. La contrapartida es que tiene límite de
 * importe, y que quien lo recibe no puede deducirse el IVA.
 */

import { Centimos, euros } from '../dinero'

/** Límite general para poder emitir ticket en vez de factura completa. */
export const LIMITE_SIMPLIFICADA = euros(400)

/**
 * Límite ampliado para comercio al por menor, hostelería, transporte de
 * personas y algunos servicios más (art. 4.2 y 4.3 RD 1619/2012).
 */
export const LIMITE_SIMPLIFICADA_AMPLIADO = euros(3000)

export interface AvisoSimplificada {
  /** Si supera el límite y habría que pedirle los datos al cliente. */
  superaLimite: boolean
  mensaje: string | null
}

export function comprobarSimplificada(total: Centimos): AvisoSimplificada {
  if (total <= LIMITE_SIMPLIFICADA) {
    return { superaLimite: false, mensaje: null }
  }

  if (total <= LIMITE_SIMPLIFICADA_AMPLIADO) {
    return {
      superaLimite: false,
      mensaje:
        'Pasa de 400 €. Se puede seguir emitiendo como ticket en comercio al por menor y hostelería, pero no en todos los sectores.',
    }
  }

  return {
    superaLimite: true,
    mensaje:
      'Pasa de 3.000 €. A partir de aquí hace falta factura completa: pídele el NIF y la dirección al cliente.',
  }
}

/**
 * Un cliente sin NIF solo puede recibir ticket. La decisión no es del usuario:
 * la marca la ley, así que la toma la aplicación.
 */
export const necesitaTicket = (nifCliente?: string) => !nifCliente?.trim()
