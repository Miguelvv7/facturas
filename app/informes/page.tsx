'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { formatearEuros } from '@/lib/domain/dinero'
import { hoy } from '@/lib/domain/fechas'
import { SECTORES } from '@/lib/domain/sectores'
import {
  clientesEnfriandose,
  compararConMesAnterior,
  productosBajoMinimo,
  ventasPorCliente,
  ventasPorProducto,
} from '@/lib/servicios/analisis'
import { Cargando, EstadoVacio, Insignia, Tarjeta, clases } from '@/components/ui'
import { CabeceraMovil } from '@/components/Navegacion'

type Rango = 'mes' | 'trimestre' | 'anio'

const RANGOS: { valor: Rango; etiqueta: string; meses: number }[] = [
  { valor: 'mes', etiqueta: 'Este mes', meses: 1 },
  { valor: 'trimestre', etiqueta: '3 meses', meses: 3 },
  { valor: 'anio', etiqueta: 'Este año', meses: 12 },
]

/** Primer día del periodo, contando hacia atrás desde hoy. */
function desdeHace(meses: number, hoyIso: string): string {
  const [a, m] = hoyIso.split('-').map(Number)
  if (meses === 12) return `${a}-01-01`
  const total = (a * 12 + (m - 1)) - (meses - 1)
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

export default function Informes() {
  const { facturas, productos, clientes, negocio, cargando } = useDatos()
  const [rango, setRango] = useState<Rango>('trimestre')
  const hoyIso = hoy()

  const periodo = useMemo(() => {
    const meses = RANGOS.find((r) => r.valor === rango)!.meses
    return { desde: desdeHace(meses, hoyIso), hasta: hoyIso }
  }, [rango, hoyIso])

  const porProducto = useMemo(
    () => ventasPorProducto(facturas, productos, periodo),
    [facturas, productos, periodo]
  )
  const porCliente = useMemo(
    () => ventasPorCliente(facturas, clientes, periodo, hoyIso),
    [facturas, clientes, periodo, hoyIso]
  )
  const enfriandose = useMemo(
    () => clientesEnfriandose(facturas, clientes, hoyIso),
    [facturas, clientes, hoyIso]
  )
  const mes = useMemo(
    () => compararConMesAnterior(facturas, productos, hoyIso.slice(0, 7)),
    [facturas, productos, hoyIso]
  )
  const bajoMinimo = useMemo(() => productosBajoMinimo(productos), [productos])

  const usaLitros = SECTORES[negocio?.sector ?? 'general'].usaLitros
  const beneficioTotal = porProducto.reduce((s, p) => s + p.beneficio, 0)
  const ingresosTotal = porProducto.reduce((s, p) => s + p.ingresos, 0)
  const maxIngreso = porProducto[0]?.ingresos ?? 0

  if (cargando) return <Cargando />

  const sinDatos = facturas.filter((f) => f.estado !== 'borrador').length === 0

  return (
    <>
      <CabeceraMovil titulo="Informes" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="mb-5 hidden text-2xl font-semibold md:block">Informes</h1>

        {sinDatos ? (
          <EstadoVacio
            titulo="Todavía no hay nada que analizar"
            descripcion="Cuando lleves unas cuantas ventas, aquí verás qué te deja más dinero y qué clientes se te están enfriando."
          />
        ) : (
          <>
            {/* --- Cómo va el mes --------------------------------------- */}
            <Tarjeta className="p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-piedra-500">Este mes llevas</p>
                {mes.variacion !== null && (
                  <span
                    className={clases(
                      'text-sm font-medium',
                      mes.variacion >= 0 ? 'text-exito' : 'text-error'
                    )}
                  >
                    {mes.variacion >= 0 ? '↑' : '↓'} {Math.abs(mes.variacion).toFixed(0)}% vs. mes
                    anterior
                  </span>
                )}
              </div>
              <p className="tabular mt-1 text-3xl font-semibold">{formatearEuros(mes.ingresos)}</p>
              <p className="mt-1.5 text-sm text-piedra-500">
                {mes.numVentas} venta{mes.numVentas === 1 ? '' : 's'} · ticket medio{' '}
                {formatearEuros(mes.ticketMedio)}
                {usaLitros && mes.litros > 0 && ` · ${mes.litros.toFixed(0)} litros`}
              </p>
            </Tarjeta>

            {/* --- Avisos ------------------------------------------------ */}
            {enfriandose.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-1 font-semibold">Se te están enfriando</h2>
                <p className="mb-3 text-sm text-piedra-500">
                  Compraban con regularidad y llevan tiempo sin pedir. Una llamada y quizá vuelven.
                </p>
                <Tarjeta className="divide-y divide-piedra-200">
                  {enfriandose.slice(0, 5).map((c) => (
                    <div key={c.clienteId} className="flex items-center justify-between px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.nombre}</p>
                        <p className="text-sm text-piedra-500">
                          {c.diasSinComprar} días sin comprar · pedía cada {c.cadenciaHabitual}
                        </p>
                      </div>
                      <Insignia tono="aviso">−{formatearEuros(c.ingresosPerdidos)}</Insignia>
                    </div>
                  ))}
                </Tarjeta>
              </div>
            )}

            {bajoMinimo.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 font-semibold">Te estás quedando sin</h2>
                <Tarjeta className="divide-y divide-piedra-200">
                  {bajoMinimo.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                      <p className="min-w-0 truncate font-medium">{p.nombre}</p>
                      <span className="tabular ml-4 shrink-0 text-sm text-aviso">
                        quedan {p.stock} · mínimo {p.stockMinimo}
                      </span>
                    </div>
                  ))}
                </Tarjeta>
              </div>
            )}

            {/* --- Selector de periodo ----------------------------------- */}
            <div className="mt-8 flex gap-2">
              {RANGOS.map((r) => (
                <button
                  key={r.valor}
                  onClick={() => setRango(r.valor)}
                  aria-pressed={rango === r.valor}
                  className={clases(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    rango === r.valor
                      ? 'bg-oliva-600 text-white'
                      : 'border border-piedra-300 bg-white text-piedra-600 hover:bg-piedra-50'
                  )}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>

            {/* --- Qué deja más dinero ----------------------------------- */}
            <div className="mt-4">
              <h2 className="mb-1 font-semibold">Qué te deja más dinero</h2>
              <p className="mb-3 text-sm text-piedra-500">
                No es lo mismo lo que más vendes que lo que más ganas.
              </p>

              {porProducto.length === 0 ? (
                <Tarjeta className="px-5 py-8 text-center text-sm text-piedra-500">
                  Sin ventas en este periodo.
                </Tarjeta>
              ) : (
                <>
                  <Tarjeta className="divide-y divide-piedra-200">
                    {porProducto.map((p) => (
                      <div key={p.productoId} className="px-5 py-3.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate font-medium">{p.nombre}</p>
                          <span className="tabular shrink-0 font-medium">
                            {formatearEuros(p.ingresos)}
                          </span>
                        </div>

                        {/* Barra proporcional al que más factura. */}
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-piedra-100">
                          <div
                            className="h-full rounded-full bg-oliva-500"
                            style={{
                              width: `${maxIngreso > 0 ? (p.ingresos / maxIngreso) * 100 : 0}%`,
                            }}
                          />
                        </div>

                        <p className="mt-1.5 text-sm text-piedra-500">
                          {p.unidades} uds.
                          {usaLitros && p.litros > 0 && ` · ${p.litros.toFixed(0)} L`}
                          {p.coste > 0 && (
                            <>
                              {' · ganas '}
                              <span
                                className={clases(
                                  'font-medium',
                                  p.beneficio >= 0 ? 'text-exito' : 'text-error'
                                )}
                              >
                                {formatearEuros(p.beneficio)} ({p.margen.toFixed(0)}%)
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    ))}
                  </Tarjeta>

                  {beneficioTotal > 0 && (
                    <p className="mt-3 text-sm text-piedra-500">
                      En total has facturado{' '}
                      <span className="font-medium text-piedra-700">
                        {formatearEuros(ingresosTotal)}
                      </span>{' '}
                      y te has quedado{' '}
                      <span className="font-medium text-exito">
                        {formatearEuros(beneficioTotal)}
                      </span>{' '}
                      antes de gastos e impuestos.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* --- Clientes ---------------------------------------------- */}
            <div className="mt-8">
              <h2 className="mb-3 font-semibold">Tus clientes</h2>

              {porCliente.length === 0 ? (
                <Tarjeta className="px-5 py-8 text-center text-sm text-piedra-500">
                  Sin ventas en este periodo.
                </Tarjeta>
              ) : (
                <Tarjeta className="divide-y divide-piedra-200">
                  {porCliente.map((c) => (
                    <div key={c.clienteId} className="flex items-center justify-between px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.nombre}</p>
                        <p className="text-sm text-piedra-500">
                          {c.numFacturas} factura{c.numFacturas === 1 ? '' : 's'}
                          {c.diasMediosPago !== null && ` · paga a ${c.diasMediosPago} días`}
                        </p>
                      </div>
                      <div className="ml-4 shrink-0 text-right">
                        <p className="tabular font-medium">{formatearEuros(c.ingresos)}</p>
                        {c.pendiente > 0 && (
                          <p className="tabular text-sm text-aviso">
                            debe {formatearEuros(c.pendiente)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}
            </div>

            <p className="mt-8 text-center text-sm text-piedra-500">
              ¿Buscas lo de Hacienda? Está en{' '}
              <Link href="/" className="font-medium text-oliva-700 underline">
                la pantalla de inicio
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </>
  )
}
