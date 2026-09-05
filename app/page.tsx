'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { calcularResumen } from '@/lib/servicios/resumen'
import { formatearEuros } from '@/lib/domain/dinero'
import { formatearFecha } from '@/lib/domain/fechas'
import { Cargando, Tarjeta } from '@/components/ui'
import { FilaFactura, mapaNombres } from '@/components/factura'

const saludo = () => {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Inicio() {
  const { cargando, negocio, facturas, gastos, clientes } = useDatos()

  const resumen = useMemo(
    () =>
      calcularResumen(facturas, gastos, {
        rendimientoNetoAnterior: negocio?.rendimientoNetoAnterior,
      }),
    [facturas, gastos, negocio]
  )

  const nombres = useMemo(() => mapaNombres(clientes), [clientes])

  const recientes = useMemo(
    () =>
      [...facturas]
        .filter((f) => f.estado !== 'borrador')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 4),
    [facturas]
  )

  if (cargando) return <Cargando />

  const primerNombre = negocio?.nombreCompleto.split(' ')[0]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-[15px] text-piedra-500">
        {saludo()}
        {primerNombre ? `, ${primerNombre}` : ''}
      </p>

      {!negocio && (
        <Link
          href="/ajustes"
          className="mt-4 block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong className="font-semibold">Completa tus datos</strong> para poder emitir facturas.
        </Link>
      )}

      {/* El botón ocupa lo que ocupa a propósito: es lo que se hace aquí el 90% de las veces. */}
      <Link
        href="/facturas/nueva"
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-oliva-600 px-6 py-8 text-xl font-semibold text-white shadow-media transition-colors hover:bg-oliva-700 active:bg-oliva-800 md:py-10 md:text-2xl"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        Nueva venta
      </Link>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/informes" className="block">
          <Tarjeta className="h-full p-5 transition-colors hover:border-piedra-300">
            <p className="text-sm text-piedra-500">Vendido este mes</p>
            <p className="tabular mt-1.5 text-2xl font-semibold">
              {formatearEuros(resumen.vendidoMes)}
            </p>
            <p className="mt-1 text-sm text-oliva-700">Ver informes</p>
          </Tarjeta>
        </Link>

        <Link href="/facturas" className="block">
        <Tarjeta className="h-full p-5 transition-colors hover:border-piedra-300">
          <p className="text-sm text-piedra-500">Te deben</p>
          <p className="tabular mt-1.5 text-2xl font-semibold">
            {formatearEuros(resumen.pendienteCobro)}
          </p>
          <p className="mt-1 text-sm text-piedra-500">
            {resumen.facturasPendientes === 0
              ? 'Nada pendiente'
              : `${resumen.facturasPendientes} factura${resumen.facturasPendientes > 1 ? 's' : ''}`}
            {resumen.facturasVencidas > 0 && (
              <span className="text-error">
                {' '}
                · {resumen.facturasVencidas} vencida{resumen.facturasVencidas > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </Tarjeta>
        </Link>

        <Tarjeta className="border-oliva-200 bg-oliva-50 p-5">
          <p className="text-sm text-oliva-800">Aparta para Hacienda</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-oliva-900">
            {formatearEuros(resumen.apartarHacienda)}
          </p>
          <p className="mt-1 text-sm text-oliva-700">
            {resumen.apartarHacienda === 0
              ? 'Nada que pagar aún'
              : `Se paga antes del ${formatearFecha(resumen.fechaLimite, 'diaMes')}`}
          </p>
        </Tarjeta>
      </div>

      {resumen.apartarHacienda > 0 && (
        <p className="mt-3 text-sm text-piedra-500">
          Ese dinero no es tuyo: es el IVA que has cobrado a tus clientes más el adelanto del IRPF.
          Guárdalo aparte y el {resumen.nombreTrimestre.toLowerCase()} no te pillará por sorpresa.
        </p>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Últimas facturas</h2>
          <Link href="/facturas" className="text-sm font-medium text-oliva-700 hover:underline">
            Ver todas
          </Link>
        </div>

        {recientes.length === 0 ? (
          <Tarjeta className="px-5 py-10 text-center text-sm text-piedra-500">
            Todavía no has hecho ninguna factura.
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-piedra-200">
            {recientes.map((f) => (
              <FilaFactura
                key={f.id}
                factura={f}
                nombreCliente={nombres.get(f.clienteId) ?? 'Cliente'}
              />
            ))}
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
