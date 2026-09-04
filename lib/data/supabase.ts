'use client'

import { createBrowserClient } from '@supabase/ssr'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/**
 * Si no hay configuración, la aplicación sigue funcionando contra el
 * almacenamiento del navegador. Así se puede trastear sin cuenta.
 */
export const hayNube = Boolean(URL && CLAVE)

let cliente: ReturnType<typeof createBrowserClient> | null = null

export function supabase() {
  if (!hayNube) throw new Error('Supabase no está configurado.')
  // Una sola instancia: cada createBrowserClient abre su propio canal de sesión.
  cliente ??= createBrowserClient(URL!, CLAVE!)
  return cliente
}
