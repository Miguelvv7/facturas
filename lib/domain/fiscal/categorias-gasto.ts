/**
 * Categorías de gasto y su porcentaje de IVA deducible.
 *
 * Esto no es configuración de interfaz: el porcentaje entra directo en el
 * cálculo del modelo 303, así que son reglas de Hacienda (art. 95 LIVA) y
 * viven en el dominio. Los gastos de uso mixto solo se deducen en parte.
 */

import { CategoriaGasto } from '../tipos'
import { TipoIva } from './tipos-iva'

interface DefinicionGasto {
  etiqueta: string
  /** Porcentaje de IVA deducible por defecto (0-100). */
  deducibleIva: number
  /** Tipo de IVA que suele llevar este gasto. */
  ivaHabitual: TipoIva
  /** Motivo de la limitación, para poder explicárselo al usuario. */
  nota?: string
}

export const CATEGORIAS_GASTO: Record<CategoriaGasto, DefinicionGasto> = {
  mercaderias: { etiqueta: 'Compra de aceite y género', deducibleIva: 100, ivaHabitual: 4 },
  envases_material: { etiqueta: 'Envases y embalaje', deducibleIva: 100, ivaHabitual: 21 },
  transporte: { etiqueta: 'Transporte y mensajería', deducibleIva: 100, ivaHabitual: 21 },
  combustible: {
    etiqueta: 'Gasolina',
    deducibleIva: 50,
    ivaHabitual: 21,
    nota: 'Se presume que el vehículo también se usa para asuntos personales.',
  },
  vehiculo: {
    etiqueta: 'Furgoneta o coche',
    deducibleIva: 50,
    ivaHabitual: 21,
    nota: 'Se presume que el vehículo también se usa para asuntos personales.',
  },
  alquiler: { etiqueta: 'Alquiler de local', deducibleIva: 100, ivaHabitual: 21 },
  suministros: { etiqueta: 'Luz, agua, gas', deducibleIva: 100, ivaHabitual: 21 },
  telefonia_internet: {
    etiqueta: 'Móvil e internet',
    deducibleIva: 50,
    ivaHabitual: 21,
    nota: 'Si la línea también es personal, solo se deduce la parte de uso profesional.',
  },
  publicidad: { etiqueta: 'Publicidad y web', deducibleIva: 100, ivaHabitual: 21 },
  seguros: {
    etiqueta: 'Seguros',
    deducibleIva: 0,
    ivaHabitual: 0,
    nota: 'Los seguros están exentos de IVA: no hay cuota que deducir.',
  },
  servicios_profesionales: {
    etiqueta: 'Gestoría y profesionales',
    deducibleIva: 100,
    ivaHabitual: 21,
  },
  material_oficina: { etiqueta: 'Material de oficina', deducibleIva: 100, ivaHabitual: 21 },
  dietas: {
    etiqueta: 'Comidas de trabajo',
    deducibleIva: 0,
    ivaHabitual: 10,
    nota: 'El IVA de las comidas no es deducible salvo casos muy concretos.',
  },
  cuota_autonomos: {
    etiqueta: 'Cuota de autónomos',
    deducibleIva: 0,
    ivaHabitual: 0,
    nota: 'No lleva IVA, pero sí es gasto y te baja el IRPF.',
  },
  financieros: { etiqueta: 'Comisiones y gastos bancarios', deducibleIva: 0, ivaHabitual: 0 },
  otros: { etiqueta: 'Otros', deducibleIva: 100, ivaHabitual: 21 },
}

/** En el orden en que conviene mostrarlas: primero lo que más se usa. */
export const ORDEN_CATEGORIAS_GASTO: CategoriaGasto[] = [
  'mercaderias',
  'envases_material',
  'transporte',
  'combustible',
  'vehiculo',
  'alquiler',
  'suministros',
  'telefonia_internet',
  'publicidad',
  'seguros',
  'servicios_profesionales',
  'material_oficina',
  'dietas',
  'cuota_autonomos',
  'financieros',
  'otros',
]
