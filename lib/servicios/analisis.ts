/**
 * Lo que no se ve en una lista de facturas: qué producto deja margen de
 * verdad, qué cliente se está enfriando y cómo va el mes contra el anterior.
 *
 * Un vendedor suele saber qué vende más. Casi nunca sabe qué le deja más
 * dinero, que no es lo mismo.
 */

import { Centimos } from '../domain/dinero'
import { Cliente, Factura, Producto } from '../domain/tipos'
import { computaFiscalmente } from '../domain/factura-inalterable'
import { baseLinea } from '../domain/fiscal/factura-calc'
import { FechaIso, diasEntre, hoy } from '../domain/fechas'

export interface VentaProducto {
  productoId: string
  nombre: string
  unidades: number
  litros: number
  ingresos: Centimos
  /** Estimado: usa el coste actual del producto, no el del día de la venta. */
  coste: Centimos
  beneficio: Centimos
  /** Margen sobre ingresos, en puntos porcentuales. */
  margen: number
}

export interface VentaCliente {
  clienteId: string
  nombre: string
  numFacturas: number
  ingresos: Centimos
  ultimaCompra: FechaIso
  diasSinComprar: number
  /** Media de días que tarda en pagar. null si nunca ha pagado nada. */
  diasMediosPago: number | null
  pendiente: Centimos
}

export interface Periodo {
  desde: FechaIso
  hasta: FechaIso
}

const enRango = (fecha: FechaIso, p: Periodo) => fecha >= p.desde && fecha <= p.hasta

const facturasDe = (facturas: Factura[], p: Periodo) =>
  facturas.filter((f) => computaFiscalmente(f) && enRango(f.fecha, p))

export function ventasPorProducto(
  facturas: Factura[],
  productos: Producto[],
  periodo: Periodo
): VentaProducto[] {
  const indice = new Map(productos.map((p) => [p.id, p]))
  const acumulado = new Map<string, VentaProducto>()

  for (const f of facturasDe(facturas, periodo)) {
    for (const linea of f.lineas) {
      // Los conceptos libres no tienen producto ni coste que analizar.
      if (!linea.productoId) continue
      const producto = indice.get(linea.productoId)
      if (!producto) continue

      const actual = acumulado.get(linea.productoId) ?? {
        productoId: linea.productoId,
        nombre: producto.nombre,
        unidades: 0,
        litros: 0,
        ingresos: 0,
        coste: 0,
        beneficio: 0,
        margen: 0,
      }

      actual.unidades += linea.cantidad
      actual.litros += linea.cantidad * (producto.litros ?? 0)
      actual.ingresos += baseLinea(linea)
      actual.coste += (producto.precioCoste ?? 0) * linea.cantidad
      acumulado.set(linea.productoId, actual)
    }
  }

  return [...acumulado.values()]
    .map((v) => ({
      ...v,
      beneficio: v.ingresos - v.coste,
      margen: v.ingresos > 0 ? ((v.ingresos - v.coste) / v.ingresos) * 100 : 0,
    }))
    .sort((a, b) => b.ingresos - a.ingresos)
}

export function ventasPorCliente(
  facturas: Factura[],
  clientes: Cliente[],
  periodo: Periodo,
  hoyIso = hoy()
): VentaCliente[] {
  const indice = new Map(clientes.map((c) => [c.id, c]))
  const acumulado = new Map<string, VentaCliente & { diasPago: number[] }>()

  for (const f of facturasDe(facturas, periodo)) {
    const cliente = indice.get(f.clienteId)
    if (!cliente) continue

    const actual = acumulado.get(f.clienteId) ?? {
      clienteId: f.clienteId,
      nombre: cliente.nombre,
      numFacturas: 0,
      ingresos: 0,
      ultimaCompra: f.fecha,
      diasSinComprar: 0,
      diasMediosPago: null,
      pendiente: 0,
      diasPago: [] as number[],
    }

    actual.numFacturas += 1
    actual.ingresos += f.baseImponible
    if (f.fecha > actual.ultimaCompra) actual.ultimaCompra = f.fecha
    if (f.estado === 'cobrada' && f.fechaCobro) {
      actual.diasPago.push(diasEntre(f.fecha, f.fechaCobro))
    } else {
      actual.pendiente += f.total
    }

    acumulado.set(f.clienteId, actual)
  }

  return [...acumulado.values()]
    .map(({ diasPago, ...v }) => ({
      ...v,
      diasSinComprar: diasEntre(v.ultimaCompra, hoyIso),
      diasMediosPago: diasPago.length
        ? Math.round(diasPago.reduce((s, d) => s + d, 0) / diasPago.length)
        : null,
    }))
    .sort((a, b) => b.ingresos - a.ingresos)
}

/**
 * Clientes que compraban y han dejado de hacerlo. Se compara su ritmo habitual
 * con el tiempo que llevan sin pedir: un cliente que compraba cada semana y
 * lleva un mes callado es una señal; uno que compra cada trimestre, no.
 */
export interface ClienteEnfriandose {
  clienteId: string
  nombre: string
  diasSinComprar: number
  /** Cada cuántos días compraba de media. */
  cadenciaHabitual: number
  ingresosPerdidos: Centimos
}

export function clientesEnfriandose(
  facturas: Factura[],
  clientes: Cliente[],
  hoyIso = hoy()
): ClienteEnfriandose[] {
  const indice = new Map(clientes.map((c) => [c.id, c]))
  const porCliente = new Map<string, Factura[]>()

  for (const f of facturas) {
    if (!computaFiscalmente(f)) continue
    porCliente.set(f.clienteId, [...(porCliente.get(f.clienteId) ?? []), f])
  }

  const resultado: ClienteEnfriandose[] = []

  for (const [clienteId, suyas] of porCliente) {
    const cliente = indice.get(clienteId)
    // Con menos de tres compras no hay ritmo del que hablar.
    if (!cliente || suyas.length < 3) continue

    const fechas = suyas.map((f) => f.fecha).sort()
    const primera = fechas[0]
    const ultima = fechas.at(-1)!
    const cadencia = diasEntre(primera, ultima) / (fechas.length - 1)
    const silencio = diasEntre(ultima, hoyIso)

    // Se avisa cuando lleva más del doble de su ritmo habitual sin comprar.
    if (cadencia <= 0 || silencio < cadencia * 2) continue

    const gastoMedio = suyas.reduce((s, f) => s + f.baseImponible, 0) / suyas.length

    resultado.push({
      clienteId,
      nombre: cliente.nombre,
      diasSinComprar: silencio,
      cadenciaHabitual: Math.round(cadencia),
      ingresosPerdidos: Math.round((silencio / cadencia - 1) * gastoMedio),
    })
  }

  return resultado.sort((a, b) => b.ingresosPerdidos - a.ingresosPerdidos)
}

export interface ComparativaMes {
  ingresos: Centimos
  ingresosAnterior: Centimos
  /** Variación en puntos porcentuales. null si el mes anterior fue cero. */
  variacion: number | null
  litros: number
  numVentas: number
  ticketMedio: Centimos
}

const mesAnteriorA = (mes: string): string => {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

export function compararConMesAnterior(
  facturas: Factura[],
  productos: Producto[],
  mes: string
): ComparativaMes {
  const indice = new Map(productos.map((p) => [p.id, p]))
  const suma = (prefijo: string) =>
    facturas
      .filter((f) => computaFiscalmente(f) && f.fecha.startsWith(prefijo))
      .reduce((s, f) => s + f.baseImponible, 0)

  const delMes = facturas.filter((f) => computaFiscalmente(f) && f.fecha.startsWith(mes))
  const ingresos = suma(mes)
  const ingresosAnterior = suma(mesAnteriorA(mes))

  const litros = delMes.reduce(
    (s, f) =>
      s +
      f.lineas.reduce(
        (sl, l) => sl + l.cantidad * (l.productoId ? (indice.get(l.productoId)?.litros ?? 0) : 0),
        0
      ),
    0
  )

  return {
    ingresos,
    ingresosAnterior,
    variacion:
      ingresosAnterior > 0 ? ((ingresos - ingresosAnterior) / ingresosAnterior) * 100 : null,
    litros,
    numVentas: delMes.length,
    ticketMedio: delMes.length ? Math.round(ingresos / delMes.length) : 0,
  }
}

export const productosBajoMinimo = (productos: Producto[]) =>
  productos.filter((p) => p.activo && p.stockMinimo !== undefined && p.stock <= p.stockMinimo)
