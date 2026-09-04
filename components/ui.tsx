'use client'

import React from 'react'

export const clases = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro'
type TamanoBoton = 'sm' | 'md' | 'lg'

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-oliva-600 text-white hover:bg-oliva-700 active:bg-oliva-800 shadow-suave',
  secundario: 'bg-white text-piedra-800 border border-piedra-300 hover:bg-piedra-50',
  fantasma: 'text-piedra-600 hover:bg-piedra-100 hover:text-piedra-900',
  peligro: 'bg-white text-error border border-red-200 hover:bg-red-50',
}

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-[15px] rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2.5',
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton
  tamano?: TamanoBoton
}) {
  return (
    <button
      className={clases(
        'inline-flex items-center justify-center font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANOS[tamano],
        className
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------

export function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string
  error?: string | null
  ayuda?: string
}) {
  const idCampo = id ?? `campo-${etiqueta.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="etiqueta">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        className={clases('campo', error && 'border-error focus:border-error focus:ring-error')}
        aria-invalid={!!error}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${idCampo}-error`} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      ) : ayuda ? (
        <p className="mt-1.5 text-sm text-piedra-500">{ayuda}</p>
      ) : null}
    </div>
  )
}

export function Selector({
  etiqueta,
  ayuda,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; ayuda?: string }) {
  const idCampo = id ?? `sel-${etiqueta.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="etiqueta">
        {etiqueta}
      </label>
      <select id={idCampo} className="campo appearance-none bg-white" {...props}>
        {children}
      </select>
      {ayuda && <p className="mt-1.5 text-sm text-piedra-500">{ayuda}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Tarjeta({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={clases('tarjeta', className)}>{children}</div>
}

type TonoEtiqueta = 'neutro' | 'exito' | 'aviso' | 'error' | 'oliva'

const TONOS: Record<TonoEtiqueta, string> = {
  neutro: 'bg-piedra-100 text-piedra-600',
  exito: 'bg-green-50 text-exito',
  aviso: 'bg-amber-50 text-aviso',
  error: 'bg-red-50 text-error',
  oliva: 'bg-oliva-100 text-oliva-700',
}

export function Insignia({
  tono = 'neutro',
  children,
}: {
  tono?: TonoEtiqueta
  children: React.ReactNode
}) {
  return (
    <span
      className={clases(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONOS[tono]
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: React.ReactNode
  ancho?: string
}) {
  React.useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPulsar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-piedra-900/40 backdrop-blur-[2px]"
        onClick={onCerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={clases(
          'relative flex max-h-[92vh] w-full flex-col bg-white shadow-media',
          'rounded-t-2xl sm:rounded-2xl',
          ancho
        )}
      >
        <div className="flex items-center justify-between border-b border-piedra-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1.5 rounded-lg p-1.5 text-piedra-500 hover:bg-piedra-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion: string
  accion?: React.ReactNode
}) {
  return (
    <div className="tarjeta flex flex-col items-center px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-piedra-800">{titulo}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-piedra-500">{descripcion}</p>
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}

export function Aviso({
  tono = 'aviso',
  children,
}: {
  tono?: 'aviso' | 'error' | 'info'
  children: React.ReactNode
}) {
  const estilos = {
    aviso: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    info: 'bg-oliva-50 text-oliva-900 border-oliva-200',
  }[tono]

  return (
    <div className={clases('rounded-xl border px-4 py-3 text-sm', estilos)}>{children}</div>
  )
}

// ---------------------------------------------------------------------------
// Piezas compartidas entre pantallas. Antes estaban copiadas en cada página,
// y las copias ya habían empezado a divergir.
// ---------------------------------------------------------------------------

export function Cargando() {
  return <div className="p-6 text-piedra-500">Cargando…</div>
}

export function BotonBorrar({ onClick, etiqueta }: { onClick: () => void; etiqueta: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      className="rounded-lg p-2 text-piedra-400 hover:bg-red-50 hover:text-error"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export function Flecha({ hacia = 'izquierda' }: { hacia?: 'izquierda' | 'derecha' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={hacia === 'izquierda' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Volver"
      className="-ml-2 rounded-lg p-2 text-piedra-500 hover:bg-piedra-100"
    >
      <Flecha />
    </button>
  )
}

export function PieModal({ onCancelar }: { onCancelar: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <Boton type="submit" className="flex-1">
        Guardar
      </Boton>
      <Boton type="button" variante="secundario" onClick={onCancelar}>
        Cancelar
      </Boton>
    </div>
  )
}
