/**
 * Traduce el motor fiscal a las pocas cifras que de verdad necesita ver
 * alguien que acaba de empezar. Aquí no se habla de modelos ni de casillas:
 * se habla de cuánto has vendido, cuánto te deben y cuánto tienes que apartar.
 */

import { Centimos } from '../domain/dinero'
import { Factura, Gasto } from '../domain/tipos'
import { computaFiscalmente } from '../domain/factura-inalterable'
import { calcularModelo303 } from '../domain/fiscal/modelo-303'
import { calcularModelo130 } from '../domain/fiscal/modelo-130'
import { Periodo, ejercicioDe, plazoPresentacion, trimestreDe } from '../domain/fiscal/periodos'
import { hoy } from '../domain/fechas'



export const periodoActual = (momento = new Date()): Periodo => {
  const iso = hoy(momento)
  return { ejercicio: ejercicioDe(iso), trimestre: trimestreDe(iso) }
}

export interface ResumenInicio {
  vendidoMes: Centimos
  pendienteCobro: Centimos
  facturasPendientes: number
  facturasVencidas: number
  /** IVA + IRPF que tocará pagar. Lo que debe apartar y no gastarse. */
  apartarHacienda: Centimos
  fechaLimite: string
  nombreTrimestre: string
}

export function calcularResumen(
  facturas: Factura[],
  gastos: Gasto[],
  opciones: { hoy?: Date; rendimientoNetoAnterior?: Centimos; pagos130Anteriores?: Centimos } = {}
): ResumenInicio {
  const momento = opciones.hoy ?? new Date()
  const hoyIso = hoy(momento)
  const periodo = periodoActual(momento)
  const prefijoMes = hoyIso.slice(0, 7)

  const emitidas = facturas.filter(computaFiscalmente)

  const vendidoMes = emitidas
    .filter((f) => f.fecha.startsWith(prefijoMes))
    .reduce((s, f) => s + f.baseImponible, 0)

  const pendientes = emitidas.filter((f) => f.estado === 'emitida' || f.estado === 'vencida')

  const iva = calcularModelo303(facturas, gastos, periodo)
  const irpf = calcularModelo130(facturas, gastos, periodo, {
    rendimientoNetoAnterior: opciones.rendimientoNetoAnterior,
    pagosAnteriores: opciones.pagos130Anteriores,
  })

  const plazo = plazoPresentacion(periodo, '303')

  return {
    vendidoMes,
    pendienteCobro: pendientes.reduce((s, f) => s + f.total, 0),
    facturasPendientes: pendientes.length,
    facturasVencidas: pendientes.filter((f) => f.fechaVencimiento < hoyIso).length,
    apartarHacienda: iva.aIngresar + irpf.aIngresar,
    fechaLimite: plazo.hasta,
    nombreTrimestre: `${periodo.trimestre}º trimestre`,
  }
}

/** Marca como vencidas las facturas cuyo plazo de pago ya pasó. */
export const estaVencida = (f: Factura, hoyIso = hoy()) =>
  f.estado === 'emitida' && f.fechaVencimiento < hoyIso
