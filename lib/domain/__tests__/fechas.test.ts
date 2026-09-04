import { describe, expect, it } from 'vitest'
import { aFormatoAEAT, diasEntre, sumarDias } from '../fechas'

describe('fechas', () => {
  it('suma días sin desplazarse por el huso horario', () => {
    // El fallo original: en UTC+2 esto devolvía 2026-10-03.
    expect(sumarDias('2026-09-04', 30)).toBe('2026-10-04')
    expect(sumarDias('2026-01-01', 0)).toBe('2026-01-01')
    expect(sumarDias('2026-12-20', 30)).toBe('2027-01-19')
  })

  it('cruza el cambio de hora sin perder un día', () => {
    // En España el horario de verano acaba el último domingo de octubre.
    expect(sumarDias('2026-10-20', 15)).toBe('2026-11-04')
    expect(sumarDias('2026-03-20', 15)).toBe('2026-04-04')
  })

  it('respeta los años bisiestos', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('cuenta los días entre dos fechas', () => {
    expect(diasEntre('2026-09-04', '2026-10-04')).toBe(30)
    expect(diasEntre('2026-10-04', '2026-09-04')).toBe(-30)
  })

  it('convierte al formato de la AEAT', () => {
    expect(aFormatoAEAT('2026-09-04')).toBe('04-09-2026')
  })
})
