'use client'

import { useMemo, useRef, useState } from 'react'
import { Cliente } from '@/lib/domain/tipos'
import { Insignia, clases } from './ui'

/**
 * Buscador de clientes que además deja crear uno al vuelo escribiendo solo el
 * nombre. Para la venta al paso: pedirle el NIF y el domicilio a alguien que
 * compra dos botellas no tiene sentido, y la ley tampoco lo exige.
 */
export function SelectorCliente({
  clientes,
  seleccionado,
  onSeleccionar,
  onCrear,
}: {
  clientes: Cliente[]
  seleccionado: Cliente | null
  onSeleccionar: (cliente: Cliente) => void
  onCrear: (nombre: string) => Promise<void>
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const termino = busqueda.trim().toLowerCase()

  const coincidencias = useMemo(() => {
    if (!termino) return clientes.slice(0, 8)
    return clientes.filter((c) => c.nombre.toLowerCase().includes(termino)).slice(0, 8)
  }, [clientes, termino])

  // Solo se ofrece crear si no existe ya alguien con ese nombre exacto.
  const puedeCrear =
    termino.length > 0 && !clientes.some((c) => c.nombre.trim().toLowerCase() === termino)

  const elegir = (c: Cliente) => {
    onSeleccionar(c)
    setBusqueda('')
    setAbierto(false)
  }

  const crear = async () => {
    setCreando(true)
    try {
      await onCrear(busqueda.trim())
      setBusqueda('')
      setAbierto(false)
    } finally {
      setCreando(false)
    }
  }

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (coincidencias.length === 1) elegir(coincidencias[0])
      else if (puedeCrear) void crear()
    }
  }

  if (seleccionado) {
    return (
      <div>
        <span className="etiqueta">¿A quién le vendes?</span>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-piedra-300 bg-white px-3.5 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{seleccionado.nombre}</p>
            <p className="truncate text-sm text-piedra-500">
              {seleccionado.nif
                ? `NIF ${seleccionado.nif}`
                : 'Sin NIF · se le emitirá un ticket'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {seleccionado.regimen === 'recargo_equivalencia' && (
              <Insignia tono="oliva">Recargo</Insignia>
            )}
            <button
              type="button"
              onClick={() => {
                onSeleccionar(null as unknown as Cliente)
                setAbierto(true)
              }}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-oliva-700 hover:bg-oliva-50"
            >
              Cambiar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={contenedor}>
      <label htmlFor="buscar-cliente" className="etiqueta">
        ¿A quién le vendes?
      </label>

      <input
        id="buscar-cliente"
        className="campo"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
        placeholder="Escribe un nombre…"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="lista-clientes"
      />

      {abierto && (
        <div
          id="lista-clientes"
          className="mt-1.5 overflow-hidden rounded-xl border border-piedra-200 bg-white shadow-suave"
        >
          {coincidencias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => elegir(c)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-piedra-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.nombre}</p>
                {c.nif && <p className="truncate text-sm text-piedra-500">{c.nif}</p>}
              </div>
              {c.regimen === 'recargo_equivalencia' && <Insignia tono="oliva">Recargo</Insignia>}
            </button>
          ))}

          {puedeCrear && (
            <button
              type="button"
              onClick={crear}
              disabled={creando}
              className={clases(
                'w-full border-t border-piedra-200 px-3.5 py-3 text-left hover:bg-oliva-50',
                coincidencias.length === 0 && 'border-t-0'
              )}
            >
              <span className="font-medium text-oliva-700">
                {creando ? 'Creando…' : `Vender a «${busqueda.trim()}»`}
              </span>
              <span className="block text-sm text-piedra-500">
                Cliente nuevo, solo con el nombre. Se le emite un ticket.
              </span>
            </button>
          )}

          {coincidencias.length === 0 && !puedeCrear && (
            <p className="px-3.5 py-4 text-sm text-piedra-500">
              Escribe un nombre para buscar o crear un cliente.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
