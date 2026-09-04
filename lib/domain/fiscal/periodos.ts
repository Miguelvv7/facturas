export type Trimestre = 1 | 2 | 3 | 4

export interface Periodo {
  ejercicio: number
  trimestre: Trimestre
}

export const trimestreDe = (fechaIso: string): Trimestre => {
  const mes = Number(fechaIso.slice(5, 7))
  return (Math.ceil(mes / 3) as Trimestre)
}

export const ejercicioDe = (fechaIso: string): number => Number(fechaIso.slice(0, 4))

export const enPeriodo = (fechaIso: string, p: Periodo): boolean =>
  ejercicioDe(fechaIso) === p.ejercicio && trimestreDe(fechaIso) === p.trimestre

export const enEjercicioHasta = (fechaIso: string, p: Periodo): boolean =>
  ejercicioDe(fechaIso) === p.ejercicio && trimestreDe(fechaIso) <= p.trimestre

/**
 * Plazo de presentación. Los tres primeros trimestres vencen el día 20 del
 * mes siguiente; el cuarto se presenta en enero, hasta el día 30.
 */
export function plazoPresentacion(p: Periodo, modelo: '303' | '130' | '390'): {
  desde: string
  hasta: string
} {
  if (modelo === '390') {
    return { desde: `${p.ejercicio + 1}-01-01`, hasta: `${p.ejercicio + 1}-01-30` }
  }
  if (p.trimestre === 4) {
    return { desde: `${p.ejercicio + 1}-01-01`, hasta: `${p.ejercicio + 1}-01-30` }
  }
  const mes = String(p.trimestre * 3 + 1).padStart(2, '0')
  return { desde: `${p.ejercicio}-${mes}-01`, hasta: `${p.ejercicio}-${mes}-20` }
}
