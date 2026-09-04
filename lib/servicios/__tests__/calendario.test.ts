import { describe, expect, it } from 'vitest'
import { construirMes, mesAnterior, mesSiguiente } from '../calendario'
import { euros, aEuros } from '../../domain/dinero'
import { Factura } from '../../domain/tipos'

const factura = (fecha: string, total: number, over: Partial<Factura> = {}): Factura =>
  ({
    id: fecha + total,
    serie: 'A',
    numero: 1,
    numeroCompleto: 'A/2026/0001',
    tipoFactura: 'F1',
    clienteId: 'c1',
    fecha,
    fechaVencimiento: fecha,
    lineas: [],
    baseImponible: euros(total),
    desglose: [],
    totalIva: 0,
    totalRecargo: 0,
    tipoRetencion: 0,
    totalRetencion: 0,
    total: euros(total),
    estado: 'emitida',
    huella: '',
    huellaAnterior: '',
    fechaHoraGeneracion: '',
    creadoEn: '',
    ...over,
  }) as Factura

describe('calendario', () => {
  it('siempre devuelve semanas completas de 7 días', () => {
    for (let m = 1; m <= 12; m++) {
      const mes = construirMes([], 2026, m, '2026-09-04')
      expect(mes.semanas.every((s) => s.length === 7)).toBe(true)
    }
  })

  it('empieza las semanas en lunes', () => {
    // El 1 de septiembre de 2026 cae en martes: debe quedar un hueco delante.
    const mes = construirMes([], 2026, 9, '2026-09-04')
    const primera = mes.semanas[0]
    expect(primera[0].delMes).toBe(false)
    expect(primera[1].delMes).toBe(true)
    expect(primera[1].dia).toBe(1)
  })

  it('rellena los huecos con días del mes vecino', () => {
    const mes = construirMes([], 2026, 9, '2026-09-04')
    expect(mes.semanas[0][0].fecha).toBe('2026-08-31')
  })

  it('suma varias ventas del mismo día', () => {
    const mes = construirMes(
      [factura('2026-09-04', 100), factura('2026-09-04', 50), factura('2026-09-10', 200)],
      2026,
      9,
      '2026-09-04'
    )

    const dia4 = mes.semanas.flat().find((d) => d.fecha === '2026-09-04')!
    expect(aEuros(dia4.total)).toBe(150)
    expect(dia4.numVentas).toBe(2)
    expect(dia4.esHoy).toBe(true)

    expect(aEuros(mes.totalMes)).toBe(350)
    expect(mes.numVentasMes).toBe(3)
    expect(mes.diasConVenta).toBe(2)
    expect(mes.mejorDia?.fecha).toBe('2026-09-10')
  })

  it('no cuenta borradores ni anuladas', () => {
    const mes = construirMes(
      [
        factura('2026-09-04', 100, { estado: 'borrador' }),
        factura('2026-09-05', 100, { estado: 'anulada' }),
        factura('2026-09-06', 100, { estado: 'cobrada' }),
      ],
      2026,
      9,
      '2026-09-04'
    )
    expect(aEuros(mes.totalMes)).toBe(100)
    expect(mes.diasConVenta).toBe(1)
  })

  it('no atribuye al mes las ventas de los días de relleno', () => {
    const mes = construirMes([factura('2026-08-31', 999)], 2026, 9, '2026-09-04')
    const relleno = mes.semanas[0][0]
    expect(relleno.fecha).toBe('2026-08-31')
    expect(aEuros(relleno.total)).toBe(999)
    // Se ve en la celda, pero no suma al total de septiembre.
    expect(mes.totalMes).toBe(0)
  })

  it('cuenta bien los días de febrero bisiesto', () => {
    expect(construirMes([], 2028, 2, '2028-01-01').semanas.flat().filter((d) => d.delMes)).toHaveLength(29)
    expect(construirMes([], 2026, 2, '2026-01-01').semanas.flat().filter((d) => d.delMes)).toHaveLength(28)
  })

  it('cambia de mes cruzando el año', () => {
    expect(mesAnterior(2026, 1)).toEqual({ ejercicio: 2025, mes: 12 })
    expect(mesSiguiente(2026, 12)).toEqual({ ejercicio: 2027, mes: 1 })
    expect(mesSiguiente(2026, 9)).toEqual({ ejercicio: 2026, mes: 10 })
  })
})
