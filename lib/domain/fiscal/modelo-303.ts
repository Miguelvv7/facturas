/**
 * Modelo 303 — autoliquidación trimestral de IVA.
 *
 * Se declara por devengo: cuenta la fecha de expedición de la factura, no la
 * de cobro. Una factura emitida en marzo y cobrada en julio va en el 1T.
 */

import { Centimos, porcentaje } from '../dinero'
import { Factura, Gasto } from '../tipos'
import { computaFiscalmente } from '../factura-inalterable'
import { TipoIva } from './tipos-iva'
import { Periodo, enPeriodo } from './periodos'

export interface LineaDesgloseDevengado {
  tipoIva: TipoIva
  base: Centimos
  cuota: Centimos
}

export interface Modelo303 {
  periodo: Periodo
  // --- IVA devengado ---
  devengado: LineaDesgloseDevengado[]
  recargoEquivalencia: { tipo: number; base: Centimos; cuota: Centimos }[]
  /** Casilla 27: total cuota devengada. */
  totalDevengado: Centimos
  // --- IVA deducible ---
  /** Casillas 28-29: cuotas soportadas en operaciones interiores corrientes. */
  baseDeducible: Centimos
  cuotaDeducible: Centimos
  /** Casilla 45: total a deducir. */
  totalDeducible: Centimos
  // --- Resultado ---
  /** Casilla 46: devengado menos deducible. */
  resultado: Centimos
  /** Cuotas a compensar procedentes de periodos anteriores. */
  compensacionAnterior: Centimos
  /** Casilla 71: resultado de la liquidación. Positivo = a ingresar. */
  aIngresar: Centimos
  /** Si el resultado es negativo, queda a compensar en el siguiente trimestre. */
  aCompensar: Centimos
  // --- Informativo, no va en el modelo pero conviene verlo ---
  entregasIntracomunitarias: Centimos
  avisos: string[]
}

export function calcularModelo303(
  facturas: Factura[],
  gastos: Gasto[],
  periodo: Periodo,
  compensacionAnterior: Centimos = 0
): Modelo303 {
  const delPeriodo = facturas.filter((f) => computaFiscalmente(f) && enPeriodo(f.fecha, periodo))

  const basesDevengadas = new Map<TipoIva, { base: Centimos; cuota: Centimos }>()
  const basesRecargo = new Map<number, { base: Centimos; cuota: Centimos }>()

  for (const f of delPeriodo) {
    // Las rectificativas restan: se registran con importes negativos.
    for (const d of f.desglose) {
      if (d.tipoIva > 0) {
        const acc = basesDevengadas.get(d.tipoIva) ?? { base: 0, cuota: 0 }
        basesDevengadas.set(d.tipoIva, {
          base: acc.base + d.base,
          cuota: acc.cuota + d.cuotaIva,
        })
      }
      if (d.tipoRecargo > 0) {
        const acc = basesRecargo.get(d.tipoRecargo) ?? { base: 0, cuota: 0 }
        basesRecargo.set(d.tipoRecargo, {
          base: acc.base + d.base,
          cuota: acc.cuota + d.cuotaRecargo,
        })
      }
    }
  }

  const devengado = [...basesDevengadas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tipoIva, v]) => ({ tipoIva, base: v.base, cuota: v.cuota }))

  const recargoEquivalencia = [...basesRecargo.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tipo, v]) => ({ tipo, base: v.base, cuota: v.cuota }))

  const totalDevengado =
    devengado.reduce((s, d) => s + d.cuota, 0) +
    recargoEquivalencia.reduce((s, r) => s + r.cuota, 0)

  const gastosPeriodo = gastos.filter((g) => enPeriodo(g.fecha, periodo))

  let baseDeducible = 0
  let cuotaDeducible = 0
  for (const g of gastosPeriodo) {
    if (g.porcentajeDeducibleIva <= 0 || g.cuotaIva === 0) continue
    baseDeducible += porcentaje(g.base, g.porcentajeDeducibleIva)
    cuotaDeducible += porcentaje(g.cuotaIva, g.porcentajeDeducibleIva)
  }

  const resultado = totalDevengado - cuotaDeducible
  const neto = resultado - compensacionAnterior

  const avisos: string[] = []
  const sinNif = gastosPeriodo.filter((g) => g.porcentajeDeducibleIva > 0 && !g.nifProveedor)
  if (sinNif.length) {
    avisos.push(
      `${sinNif.length} gasto(s) deducen IVA sin NIF de proveedor. Sin factura completa Hacienda puede rechazar la deducción.`
    )
  }
  const sinJustificante = gastosPeriodo.filter(
    (g) => g.porcentajeDeducibleIva > 0 && !g.justificanteUrl
  )
  if (sinJustificante.length) {
    avisos.push(`${sinJustificante.length} gasto(s) deducen IVA sin justificante adjunto.`)
  }
  const borradores = facturas.filter((f) => f.estado === 'borrador' && enPeriodo(f.fecha, periodo))
  if (borradores.length) {
    avisos.push(
      `${borradores.length} factura(s) siguen en borrador y no se han incluido. Emítelas antes de presentar.`
    )
  }

  return {
    periodo,
    devengado,
    recargoEquivalencia,
    totalDevengado,
    baseDeducible,
    cuotaDeducible,
    totalDeducible: cuotaDeducible,
    resultado,
    compensacionAnterior,
    aIngresar: Math.max(0, neto),
    aCompensar: Math.max(0, -neto),
    entregasIntracomunitarias: delPeriodo
      .filter((f) => f.desglose.some((d) => d.tipoIva === 0))
      .reduce((s, f) => s + f.baseImponible, 0),
    avisos,
  }
}
