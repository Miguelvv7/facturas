'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clases } from './ui'

export interface Seccion {
  href: string
  etiqueta: string
  descripcion: string
  icono: React.ReactNode
}

const icono = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ICONOS = {
  inicio: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  facturas: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  informes: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  clientes: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  productos: 'M10 3h4v3l3 3v12H7V9l3-3V3ZM7 13h10',
  gastos: 'M3 7h18v12H3zM3 11h18M7 15h4',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  mas: 'M4 6h16M4 12h16M4 18h16',
}

/** Las que caben en la barra inferior del móvil: las del día a día. */
export const PRINCIPALES: Seccion[] = [
  { href: '/', etiqueta: 'Inicio', descripcion: 'Resumen y nueva venta', icono: icono(ICONOS.inicio) },
  { href: '/facturas', etiqueta: 'Facturas', descripcion: 'Todo lo que has emitido', icono: icono(ICONOS.facturas) },
  { href: '/calendario', etiqueta: 'Calendario', descripcion: 'Días con venta', icono: icono(ICONOS.calendario) },
  { href: '/informes', etiqueta: 'Informes', descripcion: 'Márgenes, clientes y resúmenes', icono: icono(ICONOS.informes) },
]

/** El resto, en la pantalla "Más" del móvil y en la barra lateral. */
export const SECUNDARIAS: Seccion[] = [
  { href: '/clientes', etiqueta: 'Clientes', descripcion: 'A quién le vendes', icono: icono(ICONOS.clientes) },
  { href: '/productos', etiqueta: 'Productos', descripcion: 'Qué vendes y a cuánto', icono: icono(ICONOS.productos) },
  { href: '/gastos', etiqueta: 'Gastos', descripcion: 'Lo que compras', icono: icono(ICONOS.gastos) },
  { href: '/ajustes', etiqueta: 'Ajustes', descripcion: 'Tus datos y la factura', icono: icono(ICONOS.ajustes) },
]

const activa = (ruta: string, href: string) =>
  href === '/' ? ruta === '/' : ruta.startsWith(href)

export function BarraLateral() {
  const ruta = usePathname()

  const enlace = (s: Seccion) => (
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
  )

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-piedra-200 bg-white md:flex">
      <div className="px-5 py-6">
        <span className="text-lg font-semibold text-oliva-700">Facturas</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {PRINCIPALES.map(enlace)}
        <div className="my-2 border-t border-piedra-200" />
        {SECUNDARIAS.filter((s) => s.href !== '/ajustes').map(enlace)}
      </nav>

      <div className="border-t border-piedra-200 p-3">
        {enlace(SECUNDARIAS.find((s) => s.href === '/ajustes')!)}
      </div>
    </aside>
  )
}

export function BarraInferior() {
  const ruta = usePathname()
  const enMas = SECUNDARIAS.some((s) => activa(ruta, s.href))

  const item = (href: string, etiqueta: string, contenido: React.ReactNode, resaltado: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={resaltado ? 'page' : undefined}
      className={clases(
        'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
        resaltado ? 'text-oliva-700' : 'text-piedra-500'
      )}
    >
      {contenido}
      {etiqueta}
    </Link>
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-piedra-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {PRINCIPALES.map((s) => item(s.href, s.etiqueta, s.icono, activa(ruta, s.href)))}
        {item('/mas', 'Más', icono(ICONOS.mas), enMas || ruta === '/mas')}
      </div>
    </nav>
  )
}

export function CabeceraMovil({ titulo }: { titulo: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-piedra-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <Link
        href="/ajustes"
        aria-label="Ajustes"
        className="rounded-lg p-2 text-piedra-500 hover:bg-piedra-100"
      >
        {icono(ICONOS.ajustes)}
      </Link>
    </header>
  )
}
