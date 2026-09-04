'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repositorioLocal } from '../data/repositorio-local'
import { repositorioSupabase } from '../data/repositorio-supabase'
import { Repositorio } from '../data/repositorio'
import { hayNube } from '../data/supabase'
import { useSesion } from './sesion'
import { Cliente, DatosNegocio, Factura, Gasto, Producto } from '../domain/tipos'

// Con Supabase configurado los datos van a la nube; si no, al navegador.
const repo: Repositorio = hayNube ? repositorioSupabase : repositorioLocal

interface Estado {
  cargando: boolean
  negocio: DatosNegocio | null
  clientes: Cliente[]
  productos: Producto[]
  facturas: Factura[]
  gastos: Gasto[]
  repo: Repositorio
  recargar: () => Promise<void>
}

const Contexto = createContext<Estado | null>(null)

export function ProveedorDatos({ children }: { children: React.ReactNode }) {
  const { sesion, comprobando } = useSesion()
  const [cargando, setCargando] = useState(true)
  const [negocio, setNegocio] = useState<DatosNegocio | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])

  const recargar = useCallback(async () => {
    // Sin sesión no hay nada que pedir: las políticas devolverían vacío.
    if (hayNube && !sesion) {
      setCargando(false)
      return
    }

    const [n, c, p, f, g] = await Promise.all([
      repo.negocio.obtener(),
      repo.clientes.listar(),
      repo.productos.listar(),
      repo.facturas.listar(),
      repo.gastos.listar(),
    ])
    setNegocio(n)
    setClientes(c)
    setProductos(p)
    setFacturas(f)
    setGastos(g)
    setCargando(false)
  }, [sesion])

  useEffect(() => {
    if (comprobando) return
    void recargar()
  }, [recargar, comprobando])

  const valor = useMemo(
    () => ({
      cargando,
      negocio,
      clientes,
      productos,
      facturas,
      gastos,
      repo,
      recargar,
    }),
    [cargando, negocio, clientes, productos, facturas, gastos, recargar]
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useDatos(): Estado {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useDatos debe usarse dentro de ProveedorDatos')
  return ctx
}
