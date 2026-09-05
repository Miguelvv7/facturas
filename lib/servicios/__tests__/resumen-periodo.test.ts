import { describe, expect, it } from 'vitest'
import { euros, aEuros } from '../../domain/dinero'
import { Factura, Gasto } from '../../domain/tipos'
import { calcularTotales } from '../../domain/fiscal/factura-calc'
import {
  calcularResumenPeriodo,
  nombrarRango,
  rangoAnio,
  rangoMes,
  rangoTrimestre,
} from '../resumen-periodo'

const factura = (fecha: string, over: Partial<Factura> = {}): Factura => {
  const totales = calcularTotales(
    [{ descripcion: 'AOVE', cantidad: 10, precioUnitario: euros(38.5), tipoIva: 4 }],
    { regimenCliente: 'general' }
  )
  return {
    id: fecha + (over.id ?? ''),
    serie: 'A',
    numero: 1,
    numeroCompleto: 'A/2026/0001',
    tipoFactura: 'F1',
    clienteId: 'c1',
    fecha,
    fechaVencimiento: fecha,
    lineas: [],
    ...totales,
    estado: 'emitida',
    huella: '',
    huellaAnterior: '',
    fechaHoraGeneracion: '',
    creadoEn: '',
    ...over,
  }
}

const gasto = (fecha: string, over: Partial<Gasto> = {}): Gasto => ({
  id: fecha + (over.id ?? ''),
  descripcion: 'Compra',
  proveedor: 'Almazara',
  fecha,
  categoria: 'mercaderias',
  base: euros(100),
  tipoIva: 21,
  cuotaIva: euros(21),
  total: euros(121),
  porcentajeDeducibleIva: 100,
  porcentajeDeducibleIrpf: 100,
  deducibleIrpf: true,
  creadoEn: '',
  ...over,
})

describe('resumen de un periodo', () => {
  it('solo cuenta lo que cae dentro del rango, incluidos los extremos', () => {
    const facturas = [
      factura('2026-06-30', { id: 'antes' }),
      factura('2026-07-01', { id: 'primero' }),
      factura('2026-09-30', { id: 'ultimo' }),
      factura('2026-10-01', { id: 'despues' }),
    ]
    const r = calcularResumenPeriodo(facturas, [], rangoTrimestre(2026, 3))

    expect(r.numFacturas).toBe(2)
    expect(aEuros(r.baseImponible)).toBe(770)
  })

  it('separa facturas de tickets', () => {
    const r = calcularResumenPeriodo(
      [
        factura('2026-07-05', { id: 'a' }),
        factura('2026-07-06', { id: 'b', tipoFactura: 'F2' }),
        factura('2026-07-07', { id: 'c', tipoFactura: 'F2' }),
      ],
      [],
      rangoTrimestre(2026, 3)
    )
    expect(r.numFacturas).toBe(1)
    expect(r.numTickets).toBe(2)
  })

  it('separa lo cobrado de lo pendiente', () => {
    const r = calcularResumenPeriodo(
      [
        factura('2026-07-05', { id: 'a', estado: 'cobrada', fechaCobro: '2026-07-20' }),
        factura('2026-07-06', { id: 'b' }),
      ],
      [],
      rangoTrimestre(2026, 3)
    )
    expect(aEuros(r.cobrado)).toBe(400.4)
    expect(aEuros(r.pendiente)).toBe(400.4)
  })

  it('calcula el resultado de IVA restando el soportado deducible', () => {
    const r = calcularResumenPeriodo(
      [factura('2026-07-05')],
      [gasto('2026-07-10')],
      rangoTrimestre(2026, 3)
    )
    expect(aEuros(r.ivaRepercutido)).toBe(15.4)
    expect(aEuros(r.ivaDeducible)).toBe(21)
    // Sale negativo: ese trimestre queda a compensar.
    expect(aEuros(r.resultadoIva)).toBe(-5.6)
  })

  it('prorratea el IVA de un gasto de uso mixto', () => {
    const r = calcularResumenPeriodo(
      [],
      [gasto('2026-07-10', { porcentajeDeducibleIva: 50 })],
      rangoTrimestre(2026, 3)
    )
    expect(aEuros(r.ivaSoportado)).toBe(21)
    expect(aEuros(r.ivaDeducible)).toBe(10.5)
    // El IVA que no se deduce sí cuenta como gasto en IRPF.
    expect(aEuros(r.gastosDeducibles)).toBe(110.5)
  })

  it('agrupa los gastos por categoría, de mayor a menor', () => {
    const r = calcularResumenPeriodo(
      [],
      [
        gasto('2026-07-01', { id: '1', categoria: 'combustible', base: euros(50) }),
        gasto('2026-07-02', { id: '2', categoria: 'mercaderias', base: euros(900) }),
        gasto('2026-07-03', { id: '3', categoria: 'mercaderias', base: euros(100) }),
      ],
      rangoTrimestre(2026, 3)
    )
    expect(r.gastosPorCategoria).toHaveLength(2)
    expect(r.gastosPorCategoria[0].categoria).toBe('mercaderias')
    expect(aEuros(r.gastosPorCategoria[0].base)).toBe(1000)
    expect(r.gastosPorCategoria[0].etiqueta).toBe('Compra de aceite y género')
  })

  it('el beneficio descuenta los gastos deducibles', () => {
    const r = calcularResumenPeriodo(
      [factura('2026-07-05')],
      [gasto('2026-07-10', { base: euros(100), cuotaIva: euros(21) })],
      rangoTrimestre(2026, 3)
    )
    expect(aEuros(r.baseImponible)).toBe(385)
    expect(aEuros(r.gastosDeducibles)).toBe(100)
    expect(aEuros(r.beneficio)).toBe(285)
  })

  it('no cuenta borradores ni anuladas', () => {
    const r = calcularResumenPeriodo(
      [
        factura('2026-07-05', { id: 'a', estado: 'borrador' }),
        factura('2026-07-06', { id: 'b', estado: 'anulada' }),
      ],
      [],
      rangoTrimestre(2026, 3)
    )
    expect(r.numFacturas).toBe(0)
    expect(r.baseImponible).toBe(0)
  })
})

describe('rangos', () => {
  it('el mes acaba el último día real', () => {
    expect(rangoMes(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoMes(2028, 2).hasta).toBe('2028-02-29')
    expect(rangoMes(2026, 4).hasta).toBe('2026-04-30')
  })

  it('los trimestres cubren el año entero sin huecos', () => {
    expect(rangoTrimestre(2026, 1)).toEqual({ desde: '2026-01-01', hasta: '2026-03-31' })
    expect(rangoTrimestre(2026, 2)).toEqual({ desde: '2026-04-01', hasta: '2026-06-30' })
    expect(rangoTrimestre(2026, 3)).toEqual({ desde: '2026-07-01', hasta: '2026-09-30' })
    expect(rangoTrimestre(2026, 4)).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' })
  })

  it('nombra el rango como lo diría una persona', () => {
    expect(nombrarRango(rangoAnio(2026))).toBe('Año 2026')
    expect(nombrarRango(rangoMes(2026, 9))).toBe('septiembre de 2026')
    expect(nombrarRango(rangoTrimestre(2026, 3))).toBe('3º trimestre de 2026')
    expect(nombrarRango({ desde: '2026-03-15', hasta: '2026-05-20' })).toBe(
      'del 15 de marzo de 2026 al 20 de mayo de 2026'
    )
  })
})
