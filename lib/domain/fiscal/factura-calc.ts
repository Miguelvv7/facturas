import { Centimos, porcentaje, redondear } from '../dinero'
import { RECARGO_EQUIVALENCIA, TipoIva } from './tipos-iva'

/**
 * Régimen fiscal del cliente. Determina qué se repercute en la factura.
 */
export type RegimenCliente =
  /** Empresa o particular español en régimen general. IVA normal. */
  | 'general'
  /** Minorista persona física en recargo de equivalencia (art. 148 LIVA). */
  | 'recargo_equivalencia'
  /** Empresa de otro país de la UE con VIES válido. Inversión del sujeto pasivo. */
  | 'intracomunitario'
  /** Fuera de la UE. Exportación exenta (art. 21 LIVA). */
  | 'exportacion'

export interface LineaFactura {
  descripcion: string
  cantidad: number
  /** Precio unitario sin IVA, en céntimos. */
  precioUnitario: Centimos
  tipoIva: TipoIva
  /** Descuento sobre la línea, en puntos porcentuales. */
  descuento?: number
}

export interface DesgloseIva {
  tipoIva: TipoIva
  base: Centimos
  cuotaIva: Centimos
  tipoRecargo: number
  cuotaRecargo: Centimos
}

export interface TotalesFactura {
  /** Suma de bases antes de descuento global. */
  baseImponible: Centimos
  desglose: DesgloseIva[]
  totalIva: Centimos
  totalRecargo: Centimos
  /** Retención de IRPF, se resta del total. */
  tipoRetencion: number
  totalRetencion: Centimos
  total: Centimos
}

/** Importe de una línea ya con su descuento aplicado. */
export const baseLinea = (linea: LineaFactura): Centimos => {
  const bruto = linea.precioUnitario * linea.cantidad
  const descuento = linea.descuento ? (bruto * linea.descuento) / 100 : 0
  return redondear(bruto - descuento)
}

export interface OpcionesFactura {
  regimenCliente: RegimenCliente
  /**
   * Retención de IRPF en puntos. Solo aplica en facturas de profesionales
   * a empresas; en venta de mercancía normalmente es 0.
   */
  tipoRetencion?: number
}

export function calcularTotales(
  lineas: LineaFactura[],
  opciones: OpcionesFactura
): TotalesFactura {
  const { regimenCliente, tipoRetencion = 0 } = opciones

  // Ni las entregas intracomunitarias ni las exportaciones llevan IVA.
  // La base se conserva porque hay que declararla (modelos 349 y 303).
  const exenta = regimenCliente === 'intracomunitario' || regimenCliente === 'exportacion'

  const basesPorTipo = new Map<TipoIva, Centimos>()
  for (const linea of lineas) {
    const tipo = exenta ? 0 : linea.tipoIva
    basesPorTipo.set(tipo, (basesPorTipo.get(tipo) ?? 0) + baseLinea(linea))
  }

  const aplicaRecargo = regimenCliente === 'recargo_equivalencia'

  const desglose: DesgloseIva[] = [...basesPorTipo.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tipoIva, base]) => {
      const tipoRecargo = aplicaRecargo ? RECARGO_EQUIVALENCIA[tipoIva] : 0
      return {
        tipoIva,
        base,
        cuotaIva: porcentaje(base, tipoIva),
        tipoRecargo,
        cuotaRecargo: tipoRecargo ? porcentaje(base, tipoRecargo) : 0,
      }
    })

  const baseImponible = desglose.reduce((s, d) => s + d.base, 0)
  const totalIva = desglose.reduce((s, d) => s + d.cuotaIva, 0)
  const totalRecargo = desglose.reduce((s, d) => s + d.cuotaRecargo, 0)
  const totalRetencion = tipoRetencion ? porcentaje(baseImponible, tipoRetencion) : 0

  return {
    baseImponible,
    desglose,
    totalIva,
    totalRecargo,
    tipoRetencion,
    totalRetencion,
    total: baseImponible + totalIva + totalRecargo - totalRetencion,
  }
}
