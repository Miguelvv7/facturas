'use client'

import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { formatearEuros, formatearEurosCorto } from '@/lib/domain/dinero'
import { formatearFecha, hoy } from '@/lib/domain/fechas'
import {
  DiaCalendario,
  NOMBRES_DIA,
  construirMes,
  mesAnterior,
  mesSiguiente,
} from '@/lib/servicios/calendario'
import { Cargando, Flecha, Tarjeta, clases } from '@/components/ui'
import { FilaFactura, mapaNombres } from '@/components/factura'
import { CabeceraMovil } from '@/components/Navegacion'

export default function Calendario() {
  const { facturas, clientes, cargando } = useDatos()
  const hoyIso = hoy()

  const [vista, setVista] = useState(() => ({
    ejercicio: Number(hoyIso.slice(0, 4)),
    mes: Number(hoyIso.slice(5, 7)),
  }))
  const [diaElegido, setDiaElegido] = useState<string | null>(null)

  const mes = useMemo(
    () => construirMes(facturas, vista.ejercicio, vista.mes, hoyIso),
    [facturas, vista, hoyIso]
  )

  // La intensidad del verde es relativa al mejor día, para que se vea de un
  // vistazo dónde se concentran las ventas.
  const maximo = mes.mejorDia?.total ?? 0

  const facturasDelDia = useMemo(
    () =>
      diaElegido
        ? facturas
            .filter((f) => f.fecha === diaElegido && f.estado !== 'borrador' && f.estado !== 'anulada')
            .sort((a, b) => b.total - a.total)
        : [],
    [facturas, diaElegido]
  )

  const nombres = useMemo(() => mapaNombres(clientes), [clientes])

  const tono = (d: DiaCalendario) => {
    if (d.total === 0) return ''
    const ratio = maximo > 0 ? d.total / maximo : 0
    if (ratio > 0.66) return 'bg-oliva-600 text-white'
    if (ratio > 0.33) return 'bg-oliva-300 text-oliva-900'
    return 'bg-oliva-100 text-oliva-900'
  }

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Calendario" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="mb-5 hidden text-2xl font-semibold md:block">Calendario</h1>

        <Tarjeta className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setVista(mesAnterior(vista.ejercicio, vista.mes))}
              aria-label="Mes anterior"
              className="rounded-lg p-2 text-piedra-500 hover:bg-piedra-100"
            >
              <Flecha hacia="izquierda" />
            </button>

            <h2 className="text-base font-semibold capitalize md:text-lg">{mes.nombre}</h2>

            <button
              onClick={() => setVista(mesSiguiente(vista.ejercicio, vista.mes))}
              aria-label="Mes siguiente"
              className="rounded-lg p-2 text-piedra-500 hover:bg-piedra-100"
            >
              <Flecha hacia="derecha" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {NOMBRES_DIA.map((d, i) => (
              <div
                key={i}
                className="py-1 text-center text-xs font-medium uppercase text-piedra-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {mes.semanas.flat().map((d) => {
              const seleccionado = diaElegido === d.fecha
              return (
                <button
                  key={d.fecha}
                  onClick={() => setDiaElegido(seleccionado ? null : d.fecha)}
                  disabled={d.numVentas === 0}
                  aria-label={`${d.fecha}${d.numVentas ? `, ${formatearEuros(d.total)} en ${d.numVentas} venta(s)` : ', sin ventas'}`}
                  aria-pressed={seleccionado}
                  className={clases(
                    'relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors',
                    !d.delMes && 'opacity-35',
                    d.numVentas > 0 ? tono(d) : 'text-piedra-600',
                    d.numVentas > 0 && 'hover:opacity-85 cursor-pointer',
                    d.numVentas === 0 && 'cursor-default',
                    seleccionado && 'ring-2 ring-piedra-900 ring-offset-1',
                    d.esHoy && !seleccionado && 'ring-1 ring-piedra-400'
                  )}
                >
                  <span className={clases('tabular', d.esHoy && 'font-bold')}>{d.dia}</span>
                  {d.numVentas > 0 && (
                    <span className="tabular mt-0.5 hidden text-[10px] leading-none opacity-90 sm:block">
                      {formatearEurosCorto(d.total)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Tarjeta>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tarjeta className="p-4">
            <p className="text-sm text-piedra-500">Vendido en el mes</p>
            <p className="tabular mt-1 text-xl font-semibold">{formatearEuros(mes.totalMes)}</p>
          </Tarjeta>
          <Tarjeta className="p-4">
            <p className="text-sm text-piedra-500">Días con venta</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {mes.diasConVenta}
              <span className="text-base font-normal text-piedra-500"> · {mes.numVentasMes} ventas</span>
            </p>
          </Tarjeta>
          <Tarjeta className="p-4">
            <p className="text-sm text-piedra-500">Mejor día</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {mes.mejorDia ? formatearEuros(mes.mejorDia.total) : '—'}
            </p>
            {mes.mejorDia && (
              <p className="text-sm text-piedra-500">día {mes.mejorDia.dia}</p>
            )}
          </Tarjeta>
        </div>

        {diaElegido && (
          <div className="mt-6">
            <h3 className="mb-3 font-semibold capitalize">{formatearFecha(diaElegido, 'conDiaSemana')}</h3>
            <Tarjeta className="divide-y divide-piedra-200">
              {facturasDelDia.map((f) => (
                <FilaFactura
                  key={f.id}
                  factura={f}
                  nombreCliente={nombres.get(f.clienteId) ?? 'Cliente'}
                  mostrarFecha={false}
                />
              ))}
            </Tarjeta>
          </div>
        )}

        {mes.numVentasMes === 0 && (
          <p className="mt-6 text-center text-sm text-piedra-500">
            No hay ventas en {mes.nombre}.
          </p>
        )}
      </div>
    </>
  )
}
