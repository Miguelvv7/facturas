'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { hayNube, supabase } from '../data/supabase'

interface EstadoSesion {
  /** null mientras se comprueba si hay sesión guardada. */
  sesion: Session | null
  comprobando: boolean
  /** Si no hay Supabase configurado, la app va en modo local sin cuentas. */
  requiereLogin: boolean
  email: string | null
  entrar: (email: string, clave: string) => Promise<void>
  salir: () => Promise<void>
}

const Contexto = createContext<EstadoSesion | null>(null)

/** Traduce los errores de Supabase, que llegan en inglés y algo crípticos. */
function mensajeError(bruto: string): string {
  const m = bruto.toLowerCase()
  if (m.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos.'
  }
  if (m.includes('email not confirmed')) {
    return 'Tienes que confirmar el correo antes de entrar.'
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'No hay conexión con el servidor. Comprueba tu internet.'
  }
  return bruto
}

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [comprobando, setComprobando] = useState(hayNube)

  useEffect(() => {
    if (!hayNube) return

    const cliente = supabase()
    void cliente.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSesion(data.session)
      setComprobando(false)
    })

    const { data } = cliente.auth.onAuthStateChange((_evento: AuthChangeEvent, nueva: Session | null) =>
      setSesion(nueva)
    )
    return () => data.subscription.unsubscribe()
  }, [])

  const entrar = useCallback(async (email: string, clave: string) => {
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    })
    if (error) throw new Error(mensajeError(error.message))
  }, [])

  const salir = useCallback(async () => {
    await supabase().auth.signOut()
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      comprobando,
      requiereLogin: hayNube && !sesion,
      email: sesion?.user.email ?? null,
      entrar,
      salir,
    }),
    [sesion, comprobando, entrar, salir]
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): EstadoSesion {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion')
  return ctx
}
