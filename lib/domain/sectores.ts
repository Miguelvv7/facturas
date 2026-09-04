/**
 * Sectores de negocio.
 *
 * La aplicación nació para vender aceite, pero no puede tener el aceite metido
 * en los huesos: la usa también gente de otros ramos. El sector solo aporta
 * *sugerencias* — categorías de producto ya preparadas con su IVA — y nunca
 * impide elegir otra cosa. El usuario manda siempre.
 */

import { TipoIva } from './fiscal/tipos-iva'

export type Sector = 'aceite' | 'alimentacion' | 'servicios' | 'general'

export interface CategoriaSugerida {
  nombre: string
  tipoIva: TipoIva
  /** Por qué ese tipo, cuando no es evidente. */
  nota?: string
  /** Si el tipo lo impone la ley y cambiarlo es un error, no una preferencia. */
  fijadoPorLey?: boolean
}

interface DefinicionSector {
  etiqueta: string
  descripcion: string
  categorias: CategoriaSugerida[]
  /** Los negocios de producto llevan existencias; los de servicios, no. */
  usaStock: boolean
  /** Litros, kilos… Solo tiene sentido en algunos ramos. */
  usaLitros: boolean
  /** Retención de IRPF activada de salida. */
  retencionPorDefecto: number
}

export const SECTORES: Record<Sector, DefinicionSector> = {
  aceite: {
    etiqueta: 'Venta de aceite',
    descripcion: 'Aceite de oliva y otros aceites, a tiendas, hostelería o particulares.',
    usaStock: true,
    usaLitros: true,
    retencionPorDefecto: 0,
    categorias: [
      {
        nombre: 'Aceite de oliva',
        tipoIva: 4,
        nota: 'AOVE, virgen, refinado y orujo. Superreducido permanente desde 2025.',
        fijadoPorLey: true,
      },
      {
        nombre: 'Aceite de semillas',
        tipoIva: 10,
        nota: 'Girasol, maíz, soja o colza. No entró en la rebaja del oliva.',
        fijadoPorLey: true,
      },
      { nombre: 'Alimentación (otros)', tipoIva: 10 },
      { nombre: 'Cosmética y no alimentario', tipoIva: 21 },
      { nombre: 'Envases y material', tipoIva: 21 },
      { nombre: 'Portes y transporte', tipoIva: 21 },
    ],
  },

  alimentacion: {
    etiqueta: 'Alimentación y comercio',
    descripcion: 'Tienda o distribución de productos de alimentación.',
    usaStock: true,
    usaLitros: true,
    retencionPorDefecto: 0,
    categorias: [
      {
        nombre: 'Alimentos básicos',
        tipoIva: 4,
        nota: 'Pan, leche, huevos, frutas, verduras, legumbres, quesos y aceite de oliva.',
        fijadoPorLey: true,
      },
      { nombre: 'Resto de alimentación', tipoIva: 10 },
      { nombre: 'Bebidas alcohólicas', tipoIva: 21, fijadoPorLey: true },
      { nombre: 'Droguería y limpieza', tipoIva: 21 },
      { nombre: 'Envases y material', tipoIva: 21 },
      { nombre: 'Portes y transporte', tipoIva: 21 },
    ],
  },

  servicios: {
    etiqueta: 'Servicios o profesional',
    descripcion: 'Reformas, instalaciones, diseño, asesoría y oficios en general.',
    usaStock: false,
    usaLitros: false,
    // Un profesional que factura a empresas suele llevar retención del 15%.
    retencionPorDefecto: 15,
    categorias: [
      { nombre: 'Mano de obra', tipoIva: 21 },
      { nombre: 'Materiales', tipoIva: 21 },
      { nombre: 'Desplazamiento', tipoIva: 21 },
      {
        nombre: 'Obras de reforma en vivienda',
        tipoIva: 10,
        nota: 'Reformas en viviendas particulares, con condiciones. Consulta si dudas.',
      },
    ],
  },

  general: {
    etiqueta: 'Otro tipo de negocio',
    descripcion: 'Sin categorías preparadas: te creas las tuyas con el IVA que necesites.',
    usaStock: true,
    usaLitros: false,
    retencionPorDefecto: 0,
    categorias: [
      { nombre: 'General', tipoIva: 21 },
      { nombre: 'Tipo reducido', tipoIva: 10 },
      { nombre: 'Tipo superreducido', tipoIva: 4 },
      { nombre: 'Exento o sin IVA', tipoIva: 0 },
    ],
  },
}

export const categoriasDe = (sector: Sector) => SECTORES[sector].categorias

/** Busca una categoría sugerida por nombre, para recuperar su IVA y su nota. */
export const buscarCategoria = (sector: Sector, nombre: string) =>
  SECTORES[sector].categorias.find((c) => c.nombre === nombre)

export const TIPOS_IVA_DISPONIBLES: { valor: TipoIva; etiqueta: string }[] = [
  { valor: 21, etiqueta: '21% · General' },
  { valor: 10, etiqueta: '10% · Reducido' },
  { valor: 4, etiqueta: '4% · Superreducido' },
  { valor: 0, etiqueta: 'Sin IVA · Exento' },
]

/** Margen sobre el precio de venta, en puntos porcentuales. */
export const margen = (precioVenta: number, precioCoste: number): number =>
  precioVenta > 0 ? ((precioVenta - precioCoste) / precioVenta) * 100 : 0

/** Beneficio por unidad. */
export const beneficioUnitario = (precioVenta: number, precioCoste: number) =>
  precioVenta - precioCoste
