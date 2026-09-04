/**
 * Repositorio contra Supabase.
 *
 * Misma interfaz que el local, así que las pantallas no se enteran del cambio.
 * Aquí solo hay traducción entre el snake_case de Postgres y el camelCase de
 * TypeScript, más las mismas reglas de inalterabilidad que aplica el trigger.
 */

import { Coleccion, Presentacion, Repositorio } from './repositorio'
import { supabase } from './supabase'
import { Cliente, DatosNegocio, Factura, Gasto, Lote, Producto, PERSONALIZACION_POR_DEFECTO } from '../domain/tipos'
import { Evento } from '../domain/fiscal/verifactu'
import { campoCongeladoAlterado, esBorrador } from '../domain/factura-inalterable'

type Fila = Record<string, unknown>

const aSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const aCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

const haciaFila = (obj: Record<string, unknown>): Fila => {
  const fila: Fila = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || v === undefined) continue
    fila[aSnake(k)] = v
  }
  return fila
}

const desdeFila = <T>(fila: Fila): T => {
  const obj: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fila)) {
    if (k === 'user_id') continue
    obj[aCamel(k)] = v ?? undefined
  }
  return obj as T
}

const fallar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

interface Invariantes<T> {
  alActualizar?: (actual: T, cambios: Partial<T>) => void
  alBorrar?: (actual: T) => void
}

function coleccion<T extends { id: string }>(
  tabla: string,
  opciones: { orden?: string; invariantes?: Invariantes<T> } = {}
): Coleccion<T> {
  const { orden = 'creado_en', invariantes = {} } = opciones

  const obtener = async (id: string): Promise<T | null> => {
    const { data, error } = await supabase().from(tabla).select('*').eq('id', id).maybeSingle()
    fallar(error)
    return data ? desdeFila<T>(data) : null
  }

  return {
    async listar() {
      const { data, error } = await supabase().from(tabla).select('*').order(orden)
      fallar(error)
      return (data ?? []).map((f: Fila) => desdeFila<T>(f))
    },

    obtener,

    async crear(entidad) {
      const { data, error } = await supabase()
        .from(tabla)
        .insert(haciaFila(entidad as Record<string, unknown>))
        .select()
        .single()
      fallar(error)
      return desdeFila<T>(data)
    },

    async actualizar(id, cambios) {
      if (invariantes.alActualizar) {
        const actual = await obtener(id)
        if (!actual) throw new Error(`No existe el registro ${id} en ${tabla}`)
        invariantes.alActualizar(actual, cambios)
      }

      const { data, error } = await supabase()
        .from(tabla)
        .update(haciaFila(cambios as Record<string, unknown>))
        .eq('id', id)
        .select()
        .single()
      fallar(error)
      return desdeFila<T>(data)
    },

    async borrar(id) {
      if (invariantes.alBorrar) {
        const actual = await obtener(id)
        if (!actual) return
        invariantes.alBorrar(actual)
      }
      const { error } = await supabase().from(tabla).delete().eq('id', id)
      fallar(error)
    },
  }
}

// La comprobación se hace también aquí, además del trigger, para dar un
// mensaje entendible en vez del error crudo de Postgres.
const facturas = coleccion<Factura>('facturas', {
  orden: 'fecha',
  invariantes: {
    alActualizar(actual, cambios) {
      const campo = campoCongeladoAlterado(actual, cambios)
      if (campo) {
        throw new Error(
          `Una factura emitida no se puede modificar (campo "${campo}"). Emite una factura rectificativa.`
        )
      }
    },
    alBorrar(actual) {
      if (!esBorrador(actual)) {
        throw new Error(
          'Una factura emitida no se puede borrar. Emite una rectificativa para anularla.'
        )
      }
    },
  },
})

export const repositorioSupabase: Repositorio = {
  negocio: {
    async obtener() {
      const { data, error } = await supabase().from('negocio').select('*').maybeSingle()
      fallar(error)
      if (!data) return null
      const negocio = desdeFila<DatosNegocio>(data)
      // `factura` viene como jsonb: puede estar vacío en cuentas recién creadas.
      return { ...negocio, factura: { ...PERSONALIZACION_POR_DEFECTO, ...negocio.factura } }
    },

    async guardar(datos) {
      const { data: existente } = await supabase().from('negocio').select('id').maybeSingle()

      const { data, error } = existente
        ? await supabase()
            .from('negocio')
            .update(haciaFila(datos as unknown as Record<string, unknown>))
            .eq('id', (existente as { id: string }).id)
            .select()
            .single()
        : await supabase()
            .from('negocio')
            .insert(haciaFila(datos as unknown as Record<string, unknown>))
            .select()
            .single()

      fallar(error)
      return desdeFila<DatosNegocio>(data)
    },
  },

  clientes: coleccion<Cliente>('clientes', { orden: 'nombre' }),
  productos: coleccion<Producto>('productos', { orden: 'nombre' }),
  lotes: coleccion<Lote>('lotes'),
  gastos: coleccion<Gasto>('gastos', { orden: 'fecha' }),
  presentaciones: coleccion<Presentacion>('presentaciones'),

  facturas: {
    ...facturas,

    async ultimaDeSerie(serie) {
      const { data, error } = await supabase()
        .from('facturas')
        .select('*')
        .eq('serie', serie)
        .neq('estado', 'borrador')
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle()
      fallar(error)
      return data ? desdeFila<Factura>(data) : null
    },

    async siguienteNumero(serie, ejercicio) {
      const { data, error } = await supabase()
        .from('facturas')
        .select('numero')
        .eq('serie', serie)
        .neq('estado', 'borrador')
        .gte('fecha', `${ejercicio}-01-01`)
        .lte('fecha', `${ejercicio}-12-31`)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle()
      fallar(error)
      return data ? (data as { numero: number }).numero + 1 : 1
    },
  },

  eventos: {
    async listar(limite = 200) {
      const { data, error } = await supabase()
        .from('eventos')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(limite)
      fallar(error)
      return (data ?? []).map((f: Fila) => desdeFila<Evento>(f))
    },

    async registrar(evento) {
      const { error } = await supabase().from('eventos').insert(haciaFila({ ...evento }))
      fallar(error)
    },
  },

  /**
   * Borra los datos del usuario, no su cuenta. El orden importa: las facturas
   * apuntan a clientes y productos.
   */
  async vaciarTodo() {
    const cliente = supabase()
    const { data: sesion } = await cliente.auth.getUser()
    const userId = sesion.user?.id
    if (!userId) throw new Error('No hay sesión iniciada.')

    // Las facturas emitidas están protegidas por el trigger, así que primero
    // se pasan a borrador y luego se borran.
    await cliente.from('facturas').update({ estado: 'borrador' }).eq('user_id', userId)

    for (const tabla of ['facturas', 'lotes', 'productos', 'gastos', 'clientes', 'presentaciones', 'negocio']) {
      const { error } = await cliente.from(tabla).delete().eq('user_id', userId)
      fallar(error)
    }
  },
}
