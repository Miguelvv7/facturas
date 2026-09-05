'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDatos } from '@/lib/estado/datos'
import { LineaFacturaGuardada } from '@/lib/domain/tipos'
import { baseLinea, calcularTotales, RegimenCliente } from '@/lib/domain/fiscal/factura-calc'
import { formatearEuros, parsearEuros } from '@/lib/domain/dinero'
import { crearBorrador, crearClienteRapido, emitirFactura } from '@/lib/servicios/facturacion'
import { hoy } from '@/lib/domain/fechas'
import { Aviso, Boton, BotonVolver, Campo, Cargando, Modal, Selector, Tarjeta } from '@/components/ui'
import { SelectorCliente } from '@/components/SelectorCliente'
import { comprobarSimplificada, necesitaTicket } from '@/lib/domain/fiscal/factura-simplificada'
import { BloqueTotales } from '@/components/factura'

export default function NuevaVenta() {
  const router = useRouter()
  const { clientes, productos, negocio, repo, recargar, cargando } = useDatos()

  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [lineas, setLineas] = useState<LineaFacturaGuardada[]>([])
  const [notas, setNotas] = useState('')
  const [selector, setSelector] = useState(false)
  const [libre, setLibre] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emitiendo, setEmitiendo] = useState(false)

  const cliente = clientes.find((c) => c.id === clienteId)

  const totales = useMemo(
    () =>
      calcularTotales(lineas, {
        regimenCliente: (cliente?.regimen as RegimenCliente) ?? 'general',
      }),
    [lineas, cliente]
  )

  const esTicket = Boolean(cliente) && necesitaTicket(cliente?.nif)
  const avisoTicket = comprobarSimplificada(totales.total)

  const anadirProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId)
    if (!p) return
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.productoId === p.id)
      if (i !== -1) {
        const copia = [...ls]
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 }
        return copia
      }
      return [
        ...ls,
        {
          productoId: p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precioUnitario: p.precioVenta,
          tipoIva: p.tipoIva,
        },
      ]
    })
    setSelector(false)
  }

  const cambiarLinea = (i: number, cambios: Partial<LineaFacturaGuardada>) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)))

  const quitarLinea = (i: number) => setLineas((ls) => ls.filter((_, j) => j !== i))

  const emitir = async () => {
    setError(null)

    if (!negocio) return setError('Completa tus datos en Ajustes antes de facturar.')
    if (!clienteId) return setError('Elige a quién le vendes.')
    if (lineas.length === 0) return setError('Añade al menos un producto.')
    if (lineas.some((l) => l.cantidad <= 0)) return setError('Hay líneas con cantidad cero.')

    setEmitiendo(true)
    try {
      const borrador = await crearBorrador(repo, { clienteId, fecha, lineas, notas })
      const { factura } = await emitirFactura(repo, borrador.id)
      await recargar()
      router.push(`/facturas/${factura.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido emitir la factura.')
      setEmitiendo(false)
    }
  }

  if (cargando) return <Cargando />

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-10">
      <div className="mb-5 flex items-center gap-3">
        <BotonVolver onClick={() => router.back()} />
        <h1 className="text-xl font-semibold md:text-2xl">Nueva venta</h1>
      </div>

      {!negocio && (
        <div className="mb-5">
          <Aviso>
            Antes de facturar,{' '}
            <Link href="/ajustes" className="font-semibold underline">
              completa tus datos
            </Link>
            .
          </Aviso>
        </div>
      )}

      <Tarjeta className="space-y-4 p-5">
        <SelectorCliente
          clientes={clientes}
          seleccionado={cliente ?? null}
          onSeleccionar={(c) => setClienteId(c?.id ?? '')}
          onCrear={async (nombre) => {
            const nuevo = await crearClienteRapido(repo, nombre)
            await recargar()
            setClienteId(nuevo.id)
          }}
        />

        <Campo etiqueta="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        {cliente?.regimen === 'recargo_equivalencia' && (
          <Aviso tono="info">
            Esta tienda está en recargo de equivalencia: se le añade un recargo además del IVA.
            La app lo calcula sola.
          </Aviso>
        )}
      </Tarjeta>

      <div className="mt-5">
        <h2 className="mb-3 font-semibold">Qué le vendes</h2>

        {lineas.length > 0 && (
          <Tarjeta className="mb-3 divide-y divide-piedra-200">
            {lineas.map((l, i) => (
              <div key={i} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.descripcion}</p>
                    <p className="text-sm text-piedra-500">
                      {formatearEuros(l.precioUnitario)} · IVA {l.tipoIva}%
                    </p>
                  </div>
                  <button
                    onClick={() => quitarLinea(i)}
                    aria-label={`Quitar ${l.descripcion}`}
                    className="rounded-lg p-1.5 text-piedra-400 hover:bg-red-50 hover:text-error"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => cambiarLinea(i, { cantidad: Math.max(1, l.cantidad - 1) })}
                      aria-label="Quitar una unidad"
                      className="h-10 w-10 rounded-lg border border-piedra-300 text-lg font-medium hover:bg-piedra-50"
                    >
                      −
                    </button>
                    <input
                      aria-label={`Cantidad de ${l.descripcion}`}
                      type="number"
                      inputMode="decimal"
                      value={l.cantidad}
                      onChange={(e) => cambiarLinea(i, { cantidad: Number(e.target.value) })}
                      className="tabular h-10 w-16 rounded-lg border border-piedra-300 text-center"
                    />
                    <button
                      onClick={() => cambiarLinea(i, { cantidad: l.cantidad + 1 })}
                      aria-label="Añadir una unidad"
                      className="h-10 w-10 rounded-lg border border-piedra-300 text-lg font-medium hover:bg-piedra-50"
                    >
                      +
                    </button>
                  </div>
                  <span className="tabular font-semibold">
                    {formatearEuros(baseLinea(l))}
                  </span>
                </div>
              </div>
            ))}
          </Tarjeta>
        )}

        <div className="flex gap-3">
          <Boton
            variante="secundario"
            onClick={() => setSelector(true)}
            disabled={productos.length === 0}
            className="flex-1"
          >
            Añadir producto
          </Boton>
          <Boton variante="fantasma" onClick={() => setLibre(true)}>
            Concepto libre
          </Boton>
        </div>

        {productos.length === 0 && (
          <p className="mt-3 text-sm text-piedra-500">
            No tienes productos guardados.{' '}
            <Link href="/productos" className="font-medium text-oliva-700 underline">
              Añádelos aquí
            </Link>{' '}
            o usa un concepto libre.
          </p>
        )}
      </div>

      {lineas.length > 0 && (
        <div className="mt-5 space-y-3">
          <BloqueTotales importes={totales} />

          {esTicket && avisoTicket.mensaje && (
            <Aviso tono={avisoTicket.superaLimite ? 'error' : 'aviso'}>
              {avisoTicket.mensaje}
            </Aviso>
          )}
        </div>
      )}

      <div className="mt-5">
        <Campo
          etiqueta="Nota para el cliente"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Opcional. Ej.: cosecha 2025/2026, lote L-2601."
        />
      </div>

      {error && (
        <div className="mt-5">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="sticky bottom-24 mt-6 md:bottom-6">
        <Boton
          onClick={emitir}
          disabled={emitiendo || lineas.length === 0 || !clienteId}
          tamano="lg"
          className="w-full shadow-media"
        >
          {emitiendo
            ? 'Emitiendo…'
            : `${esTicket ? 'Emitir ticket' : 'Emitir factura'} · ${formatearEuros(totales.total)}`}
        </Boton>
        <p className="mt-2 text-center text-xs text-piedra-500">
          Una vez emitida no se puede modificar, solo rectificar.
        </p>
      </div>

      <SelectorProducto
        abierto={selector}
        onCerrar={() => setSelector(false)}
        onElegir={anadirProducto}
      />

      <ConceptoLibre
        abierto={libre}
        onCerrar={() => setLibre(false)}
        onAnadir={(l) => {
          setLineas((ls) => [...ls, l])
          setLibre(false)
        }}
      />
    </div>
  )
}

function SelectorProducto({
  abierto,
  onCerrar,
  onElegir,
}: {
  abierto: boolean
  onCerrar: () => void
  onElegir: (id: string) => void
}) {
  const { productos } = useDatos()
  const [busqueda, setBusqueda] = useState('')

  const termino = busqueda.toLowerCase()
  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(termino))

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Elige un producto">
      <input
        className="campo mb-4"
        placeholder="Buscar…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar producto"
      />
      <div className="-mx-1 divide-y divide-piedra-200">
        {filtrados.map((p) => (
          <button
            key={p.id}
            onClick={() => onElegir(p.id)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-3 text-left hover:bg-piedra-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{p.nombre}</p>
              <p className="text-sm text-piedra-500">IVA {p.tipoIva}% · {p.stock} uds.</p>
            </div>
            <span className="tabular ml-3 shrink-0 font-medium">
              {formatearEuros(p.precioVenta)}
            </span>
          </button>
        ))}
        {filtrados.length === 0 && (
          <p className="py-8 text-center text-sm text-piedra-500">Ningún producto coincide.</p>
        )}
      </div>
    </Modal>
  )
}

function ConceptoLibre({
  abierto,
  onCerrar,
  onAnadir,
}: {
  abierto: boolean
  onCerrar: () => void
  onAnadir: (l: LineaFacturaGuardada) => void
}) {
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [tipoIva, setTipoIva] = useState<'4' | '10' | '21'>('21')

  const anadir = (e: React.FormEvent) => {
    e.preventDefault()
    const importe = parsearEuros(precio)
    if (!descripcion.trim() || importe === null || importe <= 0) return

    onAnadir({
      descripcion: descripcion.trim(),
      cantidad: 1,
      precioUnitario: importe,
      tipoIva: Number(tipoIva) as 4 | 10 | 21,
    })
    setDescripcion('')
    setPrecio('')
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Concepto libre">
      <form onSubmit={anadir} className="space-y-4">
        <Campo
          etiqueta="Concepto"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Portes y transporte"
          autoFocus
        />
        <Campo
          etiqueta="Importe sin IVA"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="45.00"
        />
        <Selector
          etiqueta="IVA"
          value={tipoIva}
          onChange={(e) => setTipoIva(e.target.value as '4' | '10' | '21')}
          ayuda="Aceite de oliva 4%. Otros alimentos 10%. Transporte y no alimentario 21%."
        >
          <option value="4">4% · Aceite de oliva</option>
          <option value="10">10% · Otros alimentos</option>
          <option value="21">21% · Portes y resto</option>
        </Selector>
        <Boton type="submit" className="w-full">
          Añadir
        </Boton>
      </form>
    </Modal>
  )
}
