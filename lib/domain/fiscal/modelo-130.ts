/**
 * Modelo 130 — pago fraccionado del IRPF en estimación directa.
 *
 * A diferencia del 303, el 130 es acumulativo: cada trimestre se recalcula
 * sobre el rendimiento neto de todo el año hasta la fecha y se descuenta lo
 * ya pagado en los trimestres anteriores.
 */

import { Centimos, euros, porcentaje } from '../dinero'
import { Factura, Gasto } from '../tipos'
import { computaFiscalmente } from '../factura-inalterable'
import { Periodo, enEjercicioHasta } from './periodos'

const TIPO_PAGO_FRACCIONADO = 20

/**
 * Minoración por rendimientos bajos (art. 110.3.c RIRPF). Depende del
 * rendimiento neto del ejercicio anterior.
 */
export function minoracionPorRendimiento(rendimientoNetoAnterior?: Centimos): Centimos {
  if (rendimientoNetoAnterior === undefined) return 0
  const r = rendimientoNetoAnterior
  if (r <= euros(9000)) return euros(100)
  if (r <= euros(10000)) return euros(75)
  if (r <= euros(11000)) return euros(50)
  if (r <= euros(12000)) return euros(25)
  return 0
}

export interface Modelo130 {
  periodo: Periodo
  /** Ingresos acumulados del ejercicio, sin IVA. */
  ingresos: Centimos
  /** Gastos deducibles acumulados del ejercicio. */
  gastos: Centimos
  rendimientoNeto: Centimos
  /** 20% del rendimiento neto. */
  pagoFraccionado: Centimos
  minoracion: Centimos
  /** Pagos fraccionados ingresados en trimestres anteriores del mismo año. */
  pagosAnteriores: Centimos
  /** Retenciones de IRPF soportadas en facturas emitidas. */
  retencionesSoportadas: Centimos
  /** Resultado. Nunca negativo: si sale a devolver, se declara cero. */
  aIngresar: Centimos
  avisos: string[]
}

/**
 * Gasto deducible en IRPF. El IVA que no se ha podido deducir en el 303
 * sí es gasto a efectos de IRPF, así que se suma a la base.
 */
function gastoDeducibleIrpf(g: Gasto): Centimos {
  if (!g.deducibleIrpf || g.porcentajeDeducibleIrpf <= 0) return 0
  const ivaNoDeducido = g.cuotaIva - porcentaje(g.cuotaIva, g.porcentajeDeducibleIva)
  return porcentaje(g.base + ivaNoDeducido, g.porcentajeDeducibleIrpf)
}

export function calcularModelo130(
  facturas: Factura[],
  gastos: Gasto[],
  periodo: Periodo,
  opciones: {
    rendimientoNetoAnterior?: Centimos
    /** Importes ya ingresados en los 130 anteriores del ejercicio. */
    pagosAnteriores?: Centimos
  } = {}
): Modelo130 {
  const facturasAcumuladas = facturas.filter(
    (f) => computaFiscalmente(f) && enEjercicioHasta(f.fecha, periodo)
  )
  const gastosAcumulados = gastos.filter((g) => enEjercicioHasta(g.fecha, periodo))

  const ingresos = facturasAcumuladas.reduce((s, f) => s + f.baseImponible, 0)
  const gastosTotal = gastosAcumulados.reduce((s, g) => s + gastoDeducibleIrpf(g), 0)
  const rendimientoNeto = ingresos - gastosTotal

  const pagoFraccionado =
    rendimientoNeto > 0 ? porcentaje(rendimientoNeto, TIPO_PAGO_FRACCIONADO) : 0
  const minoracion = Math.min(pagoFraccionado, minoracionPorRendimiento(opciones.rendimientoNetoAnterior))

  const retencionesSoportadas = facturasAcumuladas.reduce((s, f) => s + f.totalRetencion, 0)
  const pagosAnteriores = opciones.pagosAnteriores ?? 0

  const resultado = pagoFraccionado - minoracion - pagosAnteriores - retencionesSoportadas

  const avisos: string[] = []
  if (rendimientoNeto <= 0) {
    avisos.push('Rendimiento neto negativo o cero. El modelo se presenta igualmente, con resultado cero.')
  }
  if (opciones.rendimientoNetoAnterior === undefined) {
    avisos.push(
      'Falta el rendimiento neto del año anterior. Sin ese dato no se aplica la minoración de hasta 100 € por trimestre.'
    )
  }
  if (periodo.trimestre === 4) {
    avisos.push('El 4T se presenta en enero, hasta el día 30, no el 20.')
  }

  return {
    periodo,
    ingresos,
    gastos: gastosTotal,
    rendimientoNeto,
    pagoFraccionado,
    minoracion,
    pagosAnteriores,
    retencionesSoportadas,
    aIngresar: Math.max(0, resultado),
    avisos,
  }
}
