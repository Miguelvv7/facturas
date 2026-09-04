'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDatos } from '@/lib/estado/datos'
import { formatearEuros } from '@/lib/domain/dinero'
import { formatearFecha } from '@/lib/domain/fechas'
import { baseLinea } from '@/lib/domain/fiscal/factura-calc'
import { descargarFacturaPDF } from '@/lib/pdf/factura-pdf'
import { anularConRectificativa, marcarCobrada } from '@/lib/servicios/facturacion'
import { Aviso, Boton, BotonVolver, Cargando, Tarjeta } from '@/components/ui'
import { BloqueTotales, InsigniaEstado } from '@/components/factura'

export default function DetalleFactura({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { facturas, clientes, negocio, repo, recargar, cargando } = useDatos()
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const factura = facturas.find((f) => f.id === id)
  const cliente = clientes.find((c) => c.id === factura?.clienteId)

  if (cargando) return <Cargando />
  if (!factura) return <div className="p-6 text-piedra-500">Esta factura no existe.</div>

  const descargar = async () => {
    if (!cliente || !negocio) {
      return setError('Faltan los datos del cliente o del negocio.')
    }
    setOcupado(true)
    try {
      await descargarFacturaPDF({ factura, cliente, negocio })
    } catch {
      setError('No se ha podido generar el PDF.')
    }
    setOcupado(false)
  }

  const cobrar = async () => {
    setOcupado(true)
    await marcarCobrada(repo, factura.id)
    await recargar()
    setOcupado(false)
  }

  const anular = async () => {
    if (
      !confirm(
        'Se creará una factura rectificativa que anula esta. La original se conserva, como exige la ley. ¿Continuar?'
      )
    )
      return
    setOcupado(true)
    try {
      const { factura: rect } = await anularConRectificativa(repo, factura.id)
      await recargar()
      router.push(`/facturas/${rect.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido anular.')
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-10">
      <div className="mb-5 flex items-center gap-3">
        <BotonVolver onClick={() => router.push('/facturas')} />
        <h1 className="min-w-0 truncate text-xl font-semibold md:text-2xl">
          {factura.numeroCompleto}
        </h1>
        <div className="ml-auto">
          <InsigniaEstado factura={factura} />
        </div>
      </div>

      {error && (
        <div className="mb-5">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      {factura.rectificaA && (
        <div className="mb-5">
          <Aviso>Esta es una factura rectificativa: anula a otra anterior.</Aviso>
        </div>
      )}

      <Tarjeta className="p-5">
        <div className="flex justify-between text-sm">
          <span className="text-piedra-500">Cliente</span>
          <span className="text-right font-medium">{cliente?.nombre ?? '—'}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-piedra-500">Fecha</span>
          <span>{formatearFecha(factura.fecha, 'larga')}</span>
        </div>
        {factura.fechaVencimiento !== factura.fecha && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-piedra-500">Vence</span>
            <span>{formatearFecha(factura.fechaVencimiento, 'larga')}</span>
          </div>
        )}
        {factura.fechaCobro && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-piedra-500">Cobrada el</span>
            <span>{formatearFecha(factura.fechaCobro, 'larga')}</span>
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="mt-4 divide-y divide-piedra-200">
        {factura.lineas.map((l, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate font-medium">{l.descripcion}</p>
              <p className="text-sm text-piedra-500">
                {l.cantidad} × {formatearEuros(l.precioUnitario)} · IVA {l.tipoIva}%
                {l.descuento ? ` · −${l.descuento}%` : ''}
              </p>
            </div>
            <span className="tabular ml-4 shrink-0 font-medium">
              {formatearEuros(baseLinea(l))}
            </span>
          </div>
        ))}
      </Tarjeta>

      <div className="mt-4">
        <BloqueTotales importes={factura} />
      </div>

      <div className="mt-6 space-y-3">
        <Boton onClick={descargar} disabled={ocupado} tamano="lg" className="w-full">
          Descargar PDF
        </Boton>

        {(factura.estado === 'emitida' || factura.estado === 'vencida') && (
          <Boton onClick={cobrar} disabled={ocupado} variante="secundario" className="w-full">
            Marcar como cobrada
          </Boton>
        )}

        {factura.estado !== 'anulada' && (
          <Boton onClick={anular} disabled={ocupado} variante="peligro" className="w-full">
            Anular con rectificativa
          </Boton>
        )}
      </div>

      {factura.huella && (
        <p className="mt-6 break-all text-center text-xs text-piedra-400">
          Huella {factura.huella.slice(0, 24)}…
        </p>
      )}
    </div>
  )
}
