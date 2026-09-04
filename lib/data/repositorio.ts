import {
  Cliente,
  DatosNegocio,
  Factura,
  Gasto,
  Lote,
  Producto,
} from '../domain/tipos'
import { Evento } from '../domain/fiscal/verifactu'

export interface Presentacion {
  id: string
  modelo: '303' | '130' | '390' | '349' | '347' | '111' | '115'
  ejercicio: number
  trimestre?: 1 | 2 | 3 | 4
  importe: number
  fechaPresentacion?: string
  notas?: string
}

export interface Coleccion<T extends { id: string }> {
  listar(): Promise<T[]>
  obtener(id: string): Promise<T | null>
  crear(entidad: Omit<T, 'id'>): Promise<T>
  actualizar(id: string, cambios: Partial<T>): Promise<T>
  borrar(id: string): Promise<void>
}

/**
 * Contrato único de acceso a datos. La interfaz de usuario habla siempre
 * con esto, nunca directamente con localStorage ni con Supabase.
 */
export interface Repositorio {
  negocio: {
    obtener(): Promise<DatosNegocio | null>
    guardar(datos: DatosNegocio): Promise<DatosNegocio>
  }
  clientes: Coleccion<Cliente>
  productos: Coleccion<Producto>
  lotes: Coleccion<Lote>
  gastos: Coleccion<Gasto>
  presentaciones: Coleccion<Presentacion>

  facturas: Coleccion<Factura> & {
    /** Última factura emitida de una serie. Necesaria para encadenar la huella. */
    ultimaDeSerie(serie: string): Promise<Factura | null>
    /** Siguiente número correlativo libre de la serie. */
    siguienteNumero(serie: string, ejercicio: number): Promise<number>
  }

  eventos: {
    listar(limite?: number): Promise<Evento[]>
    registrar(evento: Evento): Promise<void>
  }

  /** Borra todos los datos del usuario. La implementación decide el cómo. */
  vaciarTodo(): Promise<void>
}
