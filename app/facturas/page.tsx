'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { Factura } from '@/lib/domain/tipos'
import { formatearEuros } from '@/lib/domain/dinero'
import { Boton, Cargando, EstadoVacio, Tarjeta, clases } from '@/components/ui'
import { FilaFactura, mapaNombres } from '@/components/factura'
import { CabeceraMovil } from '@/components/Navegacion'

type Filtro = 'todas' | 'pendientes' | 'cobradas'

const FILTROS: { valor: Filtro; etiqueta: string; incluye: (f: Factura) => boolean }[] = [
  { valor: 'todas', etiqueta: 'Todas', incluye: () => true },
  {
    valor: 'pendientes',
    etiqueta: 'Sin cobrar',
    incluye: (f) => f.estado === 'emitida' || f.estado === 'vencida',
  },
  { valor: 'cobradas', etiqueta: 'Cobradas', incluye: (f) => f.estado === 'cobrada' },
]

export default function Facturas() {
  const { facturas, clientes, cargando } = useDatos()
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const nombres = useMemo(() => mapaNombres(clientes), [clientes])

  const listadas = useMemo(() => {
    const incluye = FILTROS.find((f) => f.valor === filtro)!.incluye
    return facturas
      .filter((f) => f.estado !== 'borrador' && incluye(f))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero)
  }, [facturas, filtro])

  const totalListado = useMemo(
    () => listadas.reduce((s, f) => s + f.total, 0),
    [listadas]
  )

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Facturas" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="hidden text-2xl font-semibold md:block">Facturas</h1>
          <Link href="/facturas/nueva" className="ml-auto">
            <Boton>Nueva venta</Boton>
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={clases(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filtro === f.valor
                  ? 'bg-oliva-600 text-white'
                  : 'border border-piedra-300 bg-white text-piedra-600 hover:bg-piedra-50'
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        {listadas.length === 0 ? (
          <EstadoVacio
            titulo={filtro === 'todas' ? 'Todavía no hay facturas' : 'Nada por aquí'}
            descripcion={
              filtro === 'todas'
                ? 'Cuando hagas tu primera venta aparecerá aquí.'
                : 'Prueba con otro filtro.'
            }
            accion={
              filtro === 'todas' ? (
                <Link href="/facturas/nueva">
                  <Boton>Hacer la primera</Boton>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Tarjeta className="divide-y divide-piedra-200">
              {listadas.map((f) => (
                <FilaFactura
                  key={f.id}
                  factura={f}
                  nombreCliente={nombres.get(f.clienteId) ?? 'Cliente'}
                />
              ))}
            </Tarjeta>

            <p className="mt-3 text-sm text-piedra-500">
              {listadas.length} factura{listadas.length > 1 ? 's' : ''} ·{' '}
              <span className="tabular font-medium text-piedra-700">
                {formatearEuros(totalListado)}
              </span>
            </p>
          </>
        )}
      </div>
    </>
  )
}
