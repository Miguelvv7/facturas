/**
 * Agrupa las ventas por día para pintarlas en un calendario mensual.
 * Las semanas empiezan en lunes, como en España.
 */

import { Centimos } from '../domain/dinero'
import { Factura } from '../domain/tipos'
import { FechaIso } from '../domain/fechas'
import { computaFiscalmente } from '../domain/factura-inalterable'

export interface DiaCalendario {
  fecha: FechaIso
  dia: number
  /** false para los huecos de relleno del mes anterior o siguiente. */
  delMes: boolean
  esHoy: boolean
  total: Centimos
  numVentas: number
}

export interface MesCalendario {
  ejercicio: number
  /** 1-12. */
  mes: number
  nombre: string
  /** Siempre semanas completas de 7 días, con relleno a los lados. */
  semanas: DiaCalendario[][]
  totalMes: Centimos
  numVentasMes: number
  diasConVenta: number
  mejorDia: DiaCalendario | null
}

export const NOMBRES_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Lunes = 0 … domingo = 6. getUTCDay() da domingo = 0, así que se rota. */
const diaSemanaLunes = (a: number, m: number, d: number) =>
  (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7

const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()

export function construirMes(
  facturas: Factura[],
  ejercicio: number,
  mes: number,
  hoyIso: FechaIso
): MesCalendario {
  const porDia = new Map<FechaIso, { total: Centimos; num: number }>()
  for (const f of facturas) {
    if (!computaFiscalmente(f)) continue
    const acc = porDia.get(f.fecha) ?? { total: 0, num: 0 }
    porDia.set(f.fecha, { total: acc.total + f.total, num: acc.num + 1 })
  }

  const crearDia = (a: number, m: number, d: number, delMes: boolean): DiaCalendario => {
    const fecha = iso(a, m, d)
    const v = porDia.get(fecha)
    return {
      fecha,
      dia: d,
      delMes,
      esHoy: fecha === hoyIso,
      total: v?.total ?? 0,
      numVentas: v?.num ?? 0,
    }
  }

  const total = diasDelMes(ejercicio, mes)
  const desplazamiento = diaSemanaLunes(ejercicio, mes, 1)

  const celdas: DiaCalendario[] = []

  // Relleno con los últimos días del mes anterior.
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anioAnterior = mes === 1 ? ejercicio - 1 : ejercicio
  const totalAnterior = diasDelMes(anioAnterior, mesAnterior)
  for (let i = desplazamiento; i > 0; i--) {
    celdas.push(crearDia(anioAnterior, mesAnterior, totalAnterior - i + 1, false))
  }

  for (let d = 1; d <= total; d++) celdas.push(crearDia(ejercicio, mes, d, true))

  // Relleno hasta completar la última semana.
  const mesSiguiente = mes === 12 ? 1 : mes + 1
  const anioSiguiente = mes === 12 ? ejercicio + 1 : ejercicio
  let d = 1
  while (celdas.length % 7 !== 0) celdas.push(crearDia(anioSiguiente, mesSiguiente, d++, false))

  const semanas: DiaCalendario[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  const delMes = celdas.filter((c) => c.delMes)
  const conVenta = delMes.filter((c) => c.numVentas > 0)

  return {
    ejercicio,
    mes,
    nombre: new Date(Date.UTC(ejercicio, mes - 1, 1)).toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    semanas,
    totalMes: delMes.reduce((s, c) => s + c.total, 0),
    numVentasMes: delMes.reduce((s, c) => s + c.numVentas, 0),
    diasConVenta: conVenta.length,
    mejorDia: conVenta.reduce<DiaCalendario | null>(
      (mejor, c) => (!mejor || c.total > mejor.total ? c : mejor),
      null
    ),
  }
}

export const mesAnterior = (a: number, m: number) =>
  m === 1 ? { ejercicio: a - 1, mes: 12 } : { ejercicio: a, mes: m - 1 }

export const mesSiguiente = (a: number, m: number) =>
  m === 12 ? { ejercicio: a + 1, mes: 1 } : { ejercicio: a, mes: m + 1 }
