/**
 * Implementación de Repositorio sobre localStorage.
 *
 * Sirve para probar la aplicación sin infraestructura. No es el destino final:
 * Hacienda obliga a conservar las facturas entre 4 y 6 años y el navegador no
 * es un sitio donde confiar eso. La versión de Supabase sustituye a ésta sin
 * tocar la interfaz.
 */

import { Coleccion, Presentacion, Repositorio } from './repositorio'
import { Cliente, DatosNegocio, Factura, Gasto, Lote, Producto } from '../domain/tipos'
import { Evento } from '../domain/fiscal/verifactu'
import { campoCongeladoAlterado, esBorrador } from '../domain/factura-inalterable'

const CLAVE = 'aceites_app_v2'

interface Almacen {
  negocio: DatosNegocio | null
  clientes: Cliente[]
  productos: Producto[]
  lotes: Lote[]
  facturas: Factura[]
  gastos: Gasto[]
  presentaciones: Presentacion[]
  eventos: Evento[]
}

const vacio = (): Almacen => ({
  negocio: null,
  clientes: [],
  productos: [],
  lotes: [],
  facturas: [],
  gastos: [],
  presentaciones: [],
  eventos: [],
})

/**
 * El almacén se mantiene en memoria porque cada operación necesitaba releer y
 * reparsear el JSON entero: emitir una factura llegaba a hacerlo veinte veces.
 * localStorage pasa a ser solo la copia persistente.
 */
let cache: Almacen | null = null

const leer = (): Almacen => {
  if (cache) return cache
  if (typeof window === 'undefined') return vacio()

  let almacen: Almacen
  try {
    const bruto = window.localStorage.getItem(CLAVE)
    almacen = bruto ? { ...vacio(), ...JSON.parse(bruto) } : vacio()
  } catch {
    almacen = vacio()
  }
  cache = almacen
  return almacen
}

const escribir = (almacen: Almacen) => {
  cache = almacen
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CLAVE, JSON.stringify(almacen))
}

const nuevoId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

interface Invariantes<T> {
  alActualizar?: (actual: T, cambios: Partial<T>) => void
  alBorrar?: (actual: T) => void
}

function coleccion<T extends { id: string }>(
  clave: keyof Almacen,
  invariantes: Invariantes<T> = {}
): Coleccion<T> {
  const lista = (a: Almacen) => a[clave] as unknown as T[]

  return {
    async listar() {
      return lista(leer())
    },
    async obtener(id) {
      return lista(leer()).find((e) => e.id === id) ?? null
    },
    async crear(entidad) {
      const almacen = leer()
      const creada = { ...entidad, id: nuevoId() } as T
      lista(almacen).push(creada)
      escribir(almacen)
      return creada
    },
    async actualizar(id, cambios) {
      const almacen = leer()
      const items = lista(almacen)
      const i = items.findIndex((e) => e.id === id)
      if (i === -1) throw new Error(`No existe el registro ${id} en ${String(clave)}`)

      invariantes.alActualizar?.(items[i], cambios)

      items[i] = { ...items[i], ...cambios, id }
      escribir(almacen)
      return items[i]
    },
    async borrar(id) {
      const almacen = leer()
      const items = lista(almacen)
      const i = items.findIndex((e) => e.id === id)
      if (i === -1) return

      invariantes.alBorrar?.(items[i])

      items.splice(i, 1)
      escribir(almacen)
    },
  }
}

// Refleja exactamente lo que hace el trigger de Postgres.
const facturas = coleccion<Factura>('facturas', {
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
})

export const repositorioLocal: Repositorio = {
  negocio: {
    async obtener() {
      return leer().negocio
    },
    async guardar(datos) {
      const almacen = leer()
      almacen.negocio = datos
      escribir(almacen)
      return datos
    },
  },

  clientes: coleccion<Cliente>('clientes'),
  productos: coleccion<Producto>('productos'),
  lotes: coleccion<Lote>('lotes'),
  gastos: coleccion<Gasto>('gastos'),
  presentaciones: coleccion<Presentacion>('presentaciones'),

  facturas: {
    ...facturas,

    async ultimaDeSerie(serie) {
      return (
        leer()
          .facturas.filter((f) => f.serie === serie && !esBorrador(f))
          .sort((a, b) => a.numero - b.numero)
          .at(-1) ?? null
      )
    },

    async siguienteNumero(serie, ejercicio) {
      const numeros = leer()
        .facturas.filter(
          (f) => f.serie === serie && !esBorrador(f) && f.fecha.startsWith(String(ejercicio))
        )
        .map((f) => f.numero)
      return numeros.length ? Math.max(...numeros) + 1 : 1
    },
  },

  eventos: {
    async listar(limite = 200) {
      return leer().eventos.slice(-limite).reverse()
    },
    async registrar(evento) {
      const almacen = leer()
      almacen.eventos.push(evento)
      escribir(almacen)
    },
  },

  async vaciarTodo() {
    cache = vacio()
    if (typeof window !== 'undefined') window.localStorage.removeItem(CLAVE)
  },
}
