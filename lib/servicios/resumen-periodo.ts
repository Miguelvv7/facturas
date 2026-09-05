/**
 * Resumen de un periodo cualquiera: un mes, un trimestre, un año o las fechas
 * que se quieran. Es lo que se le entrega a un gestor y lo que conviene
 * guardar cada trimestre.
 *
 * Los modelos 303 y 130 trabajan sobre trimestres naturales; esto es más
 * flexible a propósito, porque un autónomo también quiere ver "cómo fue el
 * verano" o "de enero a marzo del año pasado".
 */

import { Centimos, porcentaje } from '../domain/dinero'
import { FechaIso } from '../domain/fechas'
import { Factura, Gasto } from '../domain/tipos'
import { computaFiscalmente } from '../domain/factura-inalterable'
import { TipoIva } from '../domain/fiscal/tipos-iva'
import { CATEGORIAS_GASTO } from '../domain/fiscal/categorias-gasto'
import { CategoriaGasto } from '../domain/tipos'

export interface Rango {
  desde: FechaIso
  hasta: FechaIso
}

export interface DesgloseTipo {
  tipoIva: TipoIva
  base: Centimos
  cuota: Centimos
}

export interface GastoPorCategoria {
  categoria: CategoriaGasto
  etiqueta: string
  base: Centimos
  cuotaIva: Centimos
  ivaDeducible: Centimos
}

export interface ResumenPeriodo {
  rango: Rango
  // --- Ventas ---
  numFacturas: number
  numTickets: number
  baseImponible: Centimos
  ivaRepercutido: Centimos
  recargoRepercutido: Centimos
  retencionSoportada: Centimos
  totalFacturado: Centimos
  desgloseVentas: DesgloseTipo[]
  /** Ya ingresado frente a lo que queda por cobrar. */
  cobrado: Centimos
  pendiente: Centimos
  // --- Gastos ---
  numGastos: number
  gastosBase: Centimos
  ivaSoportado: Centimos
  ivaDeducible: Centimos
  gastosPorCategoria: GastoPorCategoria[]
  /** Gasto deducible en IRPF, con el IVA no deducible incorporado. */
  gastosDeducibles: Centimos
  // --- Resultado ---
  beneficio: Centimos
  /** IVA repercutido menos deducible. Negativo significa a compensar. */
  resultadoIva: Centimos
  facturas: Factura[]
  gastos: Gasto[]
}

const enRango = (fecha: FechaIso, r: Rango) => fecha >= r.desde && fecha <= r.hasta

/** Mismo criterio que el modelo 130: el IVA no deducido sí es gasto en IRPF. */
function gastoDeducibleIrpf(g: Gasto): Centimos {
  if (!g.deducibleIrpf || g.porcentajeDeducibleIrpf <= 0) return 0
  const ivaNoDeducido = g.cuotaIva - porcentaje(g.cuotaIva, g.porcentajeDeducibleIva)
  return porcentaje(g.base + ivaNoDeducido, g.porcentajeDeducibleIrpf)
}

export function calcularResumenPeriodo(
  todasFacturas: Factura[],
  todosGastos: Gasto[],
  rango: Rango
): ResumenPeriodo {
  const facturas = todasFacturas
    .filter((f) => computaFiscalmente(f) && enRango(f.fecha, rango))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)

  const gastos = todosGastos
    .filter((g) => enRango(g.fecha, rango))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const porTipo = new Map<TipoIva, { base: Centimos; cuota: Centimos }>()
  for (const f of facturas) {
    for (const d of f.desglose) {
      const acc = porTipo.get(d.tipoIva) ?? { base: 0, cuota: 0 }
      porTipo.set(d.tipoIva, { base: acc.base + d.base, cuota: acc.cuota + d.cuotaIva })
    }
  }

  const porCategoria = new Map<CategoriaGasto, GastoPorCategoria>()
  for (const g of gastos) {
    const acc = porCategoria.get(g.categoria) ?? {
      categoria: g.categoria,
      etiqueta: CATEGORIAS_GASTO[g.categoria]?.etiqueta ?? g.categoria,
      base: 0,
      cuotaIva: 0,
      ivaDeducible: 0,
    }
    acc.base += g.base
    acc.cuotaIva += g.cuotaIva
    acc.ivaDeducible += porcentaje(g.cuotaIva, g.porcentajeDeducibleIva)
    porCategoria.set(g.categoria, acc)
  }

  const baseImponible = facturas.reduce((s, f) => s + f.baseImponible, 0)
  const ivaRepercutido = facturas.reduce((s, f) => s + f.totalIva, 0)
  const ivaDeducible = gastos.reduce((s, g) => s + porcentaje(g.cuotaIva, g.porcentajeDeducibleIva), 0)
  const gastosDeducibles = gastos.reduce((s, g) => s + gastoDeducibleIrpf(g), 0)

  const cobradas = facturas.filter((f) => f.estado === 'cobrada')

  return {
    rango,
    numFacturas: facturas.filter((f) => f.tipoFactura !== 'F2').length,
    numTickets: facturas.filter((f) => f.tipoFactura === 'F2').length,
    baseImponible,
    ivaRepercutido,
    recargoRepercutido: facturas.reduce((s, f) => s + f.totalRecargo, 0),
    retencionSoportada: facturas.reduce((s, f) => s + f.totalRetencion, 0),
    totalFacturado: facturas.reduce((s, f) => s + f.total, 0),
    desgloseVentas: [...porTipo.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tipoIva, v]) => ({ tipoIva, base: v.base, cuota: v.cuota })),
    cobrado: cobradas.reduce((s, f) => s + f.total, 0),
    pendiente: facturas
      .filter((f) => f.estado !== 'cobrada')
      .reduce((s, f) => s + f.total, 0),

    numGastos: gastos.length,
    gastosBase: gastos.reduce((s, g) => s + g.base, 0),
    ivaSoportado: gastos.reduce((s, g) => s + g.cuotaIva, 0),
    ivaDeducible,
    gastosPorCategoria: [...porCategoria.values()].sort((a, b) => b.base - a.base),
    gastosDeducibles,

    beneficio: baseImponible - gastosDeducibles,
    resultadoIva: ivaRepercutido - ivaDeducible,
    facturas,
    gastos,
  }
}

// ---------------------------------------------------------------------------
// Rangos con nombre, para no obligar a teclear fechas.
// ---------------------------------------------------------------------------

const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export const rangoMes = (ejercicio: number, mes: number): Rango => ({
  desde: iso(ejercicio, mes, 1),
  hasta: iso(ejercicio, mes, ultimoDia(ejercicio, mes)),
})

export const rangoTrimestre = (ejercicio: number, trimestre: 1 | 2 | 3 | 4): Rango => {
  const primerMes = (trimestre - 1) * 3 + 1
  const ultimoMes = primerMes + 2
  return {
    desde: iso(ejercicio, primerMes, 1),
    hasta: iso(ejercicio, ultimoMes, ultimoDia(ejercicio, ultimoMes)),
  }
}

export const rangoAnio = (ejercicio: number): Rango => ({
  desde: `${ejercicio}-01-01`,
  hasta: `${ejercicio}-12-31`,
})

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Nombre legible del rango, para el título del documento. */
export function nombrarRango(r: Rango): string {
  const [a1, m1, d1] = r.desde.split('-').map(Number)
  const [a2, m2, d2] = r.hasta.split('-').map(Number)

  if (a1 === a2 && m1 === 1 && d1 === 1 && m2 === 12 && d2 === 31) return `Año ${a1}`

  if (a1 === a2 && m1 === m2 && d1 === 1 && d2 === ultimoDia(a1, m1)) {
    return `${MESES[m1 - 1]} de ${a1}`
  }

  if (a1 === a2 && d1 === 1 && d2 === ultimoDia(a2, m2) && m2 - m1 === 2 && m1 % 3 === 1) {
    return `${Math.ceil(m1 / 3)}º trimestre de ${a1}`
  }

  return `del ${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`
}
