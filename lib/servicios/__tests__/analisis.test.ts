import { describe, expect, it } from 'vitest'
import { euros, aEuros } from '../../domain/dinero'
import { Cliente, Factura, LineaFacturaGuardada, Producto } from '../../domain/tipos'
import {
  clientesEnfriandose,
  compararConMesAnterior,
  productosBajoMinimo,
  ventasPorCliente,
  ventasPorProducto,
} from '../analisis'

const producto = (id: string, over: Partial<Producto> = {}): Producto => ({
  id,
  nombre: `Producto ${id}`,
  categoria: 'Aceite de oliva',
  tipoIva: 4,
  precioVenta: euros(40),
  precioCoste: euros(25),
  litros: 5,
  stock: 100,
  activo: true,
  ...over,
})

const cliente = (id: string, over: Partial<Cliente> = {}): Cliente => ({
  id,
  nombre: `Cliente ${id}`,
  regimen: 'general',
  pais: 'ES',
  diasPago: 30,
  creadoEn: '2026-01-01',
  ...over,
})

const factura = (
  id: string,
  fecha: string,
  clienteId: string,
  lineas: LineaFacturaGuardada[],
  over: Partial<Factura> = {}
): Factura => {
  const base = lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0)
  return {
    id,
    serie: 'A',
    numero: Number(id),
    numeroCompleto: `A/2026/${id}`,
    tipoFactura: 'F1',
    clienteId,
    fecha,
    fechaVencimiento: fecha,
    lineas,
    baseImponible: base,
    desglose: [],
    totalIva: 0,
    totalRecargo: 0,
    tipoRetencion: 0,
    totalRetencion: 0,
    total: base,
    estado: 'emitida',
    huella: '',
    huellaAnterior: '',
    fechaHoraGeneracion: '',
    creadoEn: '',
    ...over,
  }
}

const linea = (productoId: string, cantidad: number, precio = 40): LineaFacturaGuardada => ({
  productoId,
  descripcion: 'x',
  cantidad,
  precioUnitario: euros(precio),
  tipoIva: 4,
})

const TODO_2026 = { desde: '2026-01-01', hasta: '2026-12-31' }

describe('ventas por producto', () => {
  it('calcula unidades, litros, beneficio y margen', () => {
    const r = ventasPorProducto(
      [factura('1', '2026-09-01', 'c1', [linea('p1', 10)])],
      [producto('p1')],
      TODO_2026
    )

    expect(r[0].unidades).toBe(10)
    expect(r[0].litros).toBe(50)
    expect(aEuros(r[0].ingresos)).toBe(400)
    expect(aEuros(r[0].coste)).toBe(250)
    expect(aEuros(r[0].beneficio)).toBe(150)
    expect(r[0].margen).toBeCloseTo(37.5)
  })

  it('ordena por ingresos, que no es lo mismo que por unidades', () => {
    const r = ventasPorProducto(
      [
        factura('1', '2026-09-01', 'c1', [linea('barato', 100, 1)]),
        factura('2', '2026-09-01', 'c1', [linea('caro', 5, 90)]),
      ],
      [producto('barato', { precioCoste: euros(0.9) }), producto('caro')],
      TODO_2026
    )

    expect(r[0].productoId).toBe('caro')
    expect(r[1].unidades).toBe(100)
  })

  it('descuenta el descuento de línea del ingreso', () => {
    const r = ventasPorProducto(
      [factura('1', '2026-09-01', 'c1', [{ ...linea('p1', 10), descuento: 10 }])],
      [producto('p1')],
      TODO_2026
    )
    expect(aEuros(r[0].ingresos)).toBe(360)
  })

  it('ignora conceptos libres sin producto', () => {
    const r = ventasPorProducto(
      [
        factura('1', '2026-09-01', 'c1', [
          { descripcion: 'Portes', cantidad: 1, precioUnitario: euros(45), tipoIva: 21 },
        ]),
      ],
      [producto('p1')],
      TODO_2026
    )
    expect(r).toHaveLength(0)
  })

  it('no cuenta borradores ni anuladas', () => {
    const r = ventasPorProducto(
      [
        factura('1', '2026-09-01', 'c1', [linea('p1', 10)], { estado: 'borrador' }),
        factura('2', '2026-09-01', 'c1', [linea('p1', 5)], { estado: 'anulada' }),
      ],
      [producto('p1')],
      TODO_2026
    )
    expect(r).toHaveLength(0)
  })
})

describe('ventas por cliente', () => {
  it('calcula media de días en pagar y pendiente', () => {
    const r = ventasPorCliente(
      [
        factura('1', '2026-09-01', 'c1', [linea('p1', 1)], {
          estado: 'cobrada',
          fechaCobro: '2026-09-11',
        }),
        factura('2', '2026-09-05', 'c1', [linea('p1', 1)], {
          estado: 'cobrada',
          fechaCobro: '2026-09-25',
        }),
        factura('3', '2026-09-10', 'c1', [linea('p1', 2)]),
      ],
      [cliente('c1')],
      TODO_2026,
      '2026-09-20'
    )

    expect(r[0].numFacturas).toBe(3)
    expect(r[0].diasMediosPago).toBe(15) // (10 + 20) / 2
    expect(aEuros(r[0].pendiente)).toBe(80)
    expect(r[0].ultimaCompra).toBe('2026-09-10')
    expect(r[0].diasSinComprar).toBe(10)
  })

  it('deja la media de pago en null si nunca ha pagado', () => {
    const r = ventasPorCliente(
      [factura('1', '2026-09-01', 'c1', [linea('p1', 1)])],
      [cliente('c1')],
      TODO_2026
    )
    expect(r[0].diasMediosPago).toBeNull()
  })
})

describe('clientes que se enfrían', () => {
  const compras = (fechas: string[], clienteId = 'c1') =>
    fechas.map((f, i) => factura(String(i + 1), f, clienteId, [linea('p1', 1)]))

  it('avisa del que compraba cada semana y lleva un mes callado', () => {
    const r = clientesEnfriandose(
      compras(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22']),
      [cliente('c1')],
      '2026-09-04'
    )
    expect(r).toHaveLength(1)
    expect(r[0].cadenciaHabitual).toBe(7)
    expect(r[0].diasSinComprar).toBe(44)
  })

  it('no avisa del que compra cada trimestre y lleva un mes', () => {
    const r = clientesEnfriandose(
      compras(['2025-09-01', '2025-12-01', '2026-03-01', '2026-08-01']),
      [cliente('c1')],
      '2026-09-04'
    )
    expect(r).toHaveLength(0)
  })

  it('no juzga a quien tiene menos de tres compras', () => {
    const r = clientesEnfriandose(compras(['2026-01-01', '2026-01-08']), [cliente('c1')], '2026-09-04')
    expect(r).toHaveLength(0)
  })

  it('ordena poniendo delante al que más dinero deja de traer', () => {
    const grande = compras(['2026-07-01', '2026-07-08', '2026-07-15'], 'grande').map((f) => ({
      ...f,
      baseImponible: euros(1000),
      total: euros(1000),
    }))
    const pequeno = compras(['2026-07-01', '2026-07-08', '2026-07-15'], 'pequeno').map((f) => ({
      ...f,
      id: `p${f.id}`,
      baseImponible: euros(20),
      total: euros(20),
    }))

    const r = clientesEnfriandose(
      [...grande, ...pequeno],
      [cliente('grande'), cliente('pequeno')],
      '2026-09-04'
    )
    expect(r[0].clienteId).toBe('grande')
  })
})

describe('comparativa mensual', () => {
  it('calcula variación, litros y ticket medio', () => {
    const r = compararConMesAnterior(
      [
        factura('1', '2026-08-10', 'c1', [linea('p1', 10)]),
        factura('2', '2026-09-01', 'c1', [linea('p1', 10)]),
        factura('3', '2026-09-15', 'c1', [linea('p1', 5)]),
      ],
      [producto('p1')],
      '2026-09'
    )

    expect(aEuros(r.ingresos)).toBe(600)
    expect(aEuros(r.ingresosAnterior)).toBe(400)
    expect(r.variacion).toBeCloseTo(50)
    expect(r.litros).toBe(75)
    expect(r.numVentas).toBe(2)
    expect(aEuros(r.ticketMedio)).toBe(300)
  })

  it('deja la variación en null si el mes anterior no hubo nada', () => {
    const r = compararConMesAnterior(
      [factura('1', '2026-09-01', 'c1', [linea('p1', 1)])],
      [producto('p1')],
      '2026-09'
    )
    expect(r.variacion).toBeNull()
  })

  it('cruza bien el cambio de año', () => {
    const r = compararConMesAnterior(
      [
        factura('1', '2025-12-10', 'c1', [linea('p1', 10)]),
        factura('2', '2026-01-10', 'c1', [linea('p1', 5)]),
      ],
      [producto('p1')],
      '2026-01'
    )
    expect(aEuros(r.ingresosAnterior)).toBe(400)
    expect(r.variacion).toBeCloseTo(-50)
  })
})

describe('stock bajo mínimo', () => {
  it('solo avisa de los que tienen mínimo definido y están por debajo', () => {
    const r = productosBajoMinimo([
      producto('a', { stock: 5, stockMinimo: 10 }),
      producto('b', { stock: 50, stockMinimo: 10 }),
      producto('c', { stock: 0 }),
      producto('d', { stock: 1, stockMinimo: 10, activo: false }),
    ])
    expect(r.map((p) => p.id)).toEqual(['a'])
  })
})
