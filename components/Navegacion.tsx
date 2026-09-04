'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clases } from './ui'

interface Seccion {
  href: string
  etiqueta: string
  icono: React.ReactNode
}

const icono = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SECCIONES: Seccion[] = [
  { href: '/', etiqueta: 'Inicio', icono: icono('M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5') },
  { href: '/facturas', etiqueta: 'Facturas', icono: icono('M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6') },
  { href: '/calendario', etiqueta: 'Calendario', icono: icono('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4') },
  { href: '/clientes', etiqueta: 'Clientes', icono: icono('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6') },
  { href: '/productos', etiqueta: 'Productos', icono: icono('M10 3h4v3l3 3v12H7V9l3-3V3ZM7 13h10') },
  { href: '/gastos', etiqueta: 'Gastos', icono: icono('M3 7h18v12H3zM3 11h18M7 15h4') },
]

const activa = (ruta: string, href: string) =>
  href === '/' ? ruta === '/' : ruta.startsWith(href)

export function BarraLateral() {
  const ruta = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-piedra-200 bg-white md:flex">
      <div className="px-5 py-6">
        <span className="text-lg font-semibold text-oliva-700">Aceites</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activa(ruta, s.href) ? 'page' : undefined}
            className={clases(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
              activa(ruta, s.href)
                ? 'bg-oliva-50 text-oliva-700'
                : 'text-piedra-600 hover:bg-piedra-100 hover:text-piedra-900'
            )}
          >
            {s.icono}
            {s.etiqueta}
          </Link>
        ))}
      </nav>

      <div className="border-t border-piedra-200 p-3">
        <Link
          href="/ajustes"
          className={clases(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
            activa(ruta, '/ajustes')
              ? 'bg-oliva-50 text-oliva-700'
              : 'text-piedra-600 hover:bg-piedra-100'
          )}
        >
          {icono('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z')}
          Ajustes
        </Link>
      </div>
    </aside>
  )
}

export function BarraInferior() {
  const ruta = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-piedra-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-6">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activa(ruta, s.href) ? 'page' : undefined}
            className={clases(
              'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium leading-tight transition-colors',
              activa(ruta, s.href) ? 'text-oliva-700' : 'text-piedra-500'
            )}
          >
            {s.icono}
            {s.etiqueta}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function CabeceraMovil({ titulo }: { titulo: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-piedra-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <Link href="/ajustes" aria-label="Ajustes" className="rounded-lg p-2 text-piedra-500 hover:bg-piedra-100">
        {icono('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 12h2M19 12h2M12 3v2M12 19v2')}
      </Link>
    </header>
  )
}
