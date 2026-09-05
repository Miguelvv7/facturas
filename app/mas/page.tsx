'use client'

import Link from 'next/link'
import { useSesion } from '@/lib/estado/sesion'
import { SECUNDARIAS } from '@/components/Navegacion'
import { Boton, Tarjeta } from '@/components/ui'

/**
 * Segundo nivel de navegación, solo para móvil: en la barra inferior no caben
 * las ocho secciones. En pantalla grande todo está en la barra lateral.
 */
export default function Mas() {
  const { email, salir } = useSesion()

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:hidden">
      <h1 className="mb-5 text-2xl font-semibold">Más</h1>

      <Tarjeta className="divide-y divide-piedra-200">
        {SECUNDARIAS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 px-5 py-4 hover:bg-piedra-50"
          >
            <span className="text-piedra-500">{s.icono}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{s.etiqueta}</span>
              <span className="block truncate text-sm text-piedra-500">{s.descripcion}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-piedra-400">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </Tarjeta>

      {email && (
        <Tarjeta className="mt-5 p-5">
          <p className="text-sm text-piedra-500">Has entrado como</p>
          <p className="mt-0.5 truncate font-medium">{email}</p>
          <div className="mt-4">
            <Boton variante="secundario" onClick={() => void salir()}>
              Cerrar sesión
            </Boton>
          </div>
        </Tarjeta>
      )}
    </div>
  )
}
