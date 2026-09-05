'use client'

import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { formatearEuros } from '@/lib/domain/dinero'
import { hoy } from '@/lib/domain/fechas'
import {
  Rango,
  calcularResumenPeriodo,
  nombrarRango,
  rangoAnio,
  rangoMes,
  rangoTrimestre,
} from '@/lib/servicios/resumen-periodo'
import { descargarResumenPDF } from '@/lib/pdf/resumen-pdf'
import { Aviso, Boton, Campo, Modal, Selector, Tarjeta, clases } from './ui'

type Modo = 'mes' | 'trimestre' | 'anio' | 'fechas'

const MODOS: { valor: Modo; etiqueta: string }[] = [
  { valor: 'mes', etiqueta: 'Un mes' },
  { valor: 'trimestre', etiqueta: 'Un trimestre' },
  { valor: 'anio', etiqueta: 'Un año' },
  { valor: 'fechas', etiqueta: 'Entre fechas' },
]

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function DescargarResumen() {
  const { facturas, gastos, clientes, negocio } = useDatos()
  const hoyIso = hoy()
  const anioActual = Number(hoyIso.slice(0, 4))

  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<Modo>('trimestre')
  const [anio, setAnio] = useState(anioActual)
  const [mes, setMes] = useState(Number(hoyIso.slice(5, 7)))
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(
    (Math.ceil(Number(hoyIso.slice(5, 7)) / 3) as 1 | 2 | 3 | 4)
  )
  const [desde, setDesde] = useState(`${anioActual}-01-01`)
  const [hasta, setHasta] = useState(hoyIso)
  const [generando, setGenerando] = useState(false)

  // Años con actividad, para no ofrecer una lista infinita.
  const anios = useMemo(() => {
    const encontrados = new Set<number>([anioActual])
    for (const f of facturas) encontrados.add(Number(f.fecha.slice(0, 4)))
    for (const g of gastos) encontrados.add(Number(g.fecha.slice(0, 4)))
    return [...encontrados].sort((a, b) => b - a)
  }, [facturas, gastos, anioActual])

  const rango: Rango = useMemo(() => {
    switch (modo) {
      case 'mes':
        return rangoMes(anio, mes)
      case 'trimestre':
        return rangoTrimestre(anio, trimestre)
      case 'anio':
        return rangoAnio(anio)
      case 'fechas':
        return { desde, hasta }
    }
  }, [modo, anio, mes, trimestre, desde, hasta])

  const rangoInvalido = modo === 'fechas' && desde > hasta

  const resumen = useMemo(
    () => (rangoInvalido ? null : calcularResumenPeriodo(facturas, gastos, rango)),
    [facturas, gastos, rango, rangoInvalido]
  )

  const descargar = () => {
    if (!negocio || !resumen) return
    setGenerando(true)
    try {
      descargarResumenPDF({ resumen, negocio, clientes })
      setAbierto(false)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)} className="w-full">
        Descargar resumen
      </Boton>

      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Descargar resumen">
        <div className="space-y-5">
          <p className="text-sm text-piedra-500">
            Un PDF con todo lo del periodo: lo facturado, los gastos, el desglose de IVA y el
            listado de operaciones. Es lo que hay que darle a un gestor.
          </p>

          <div className="flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setModo(m.valor)}
                aria-pressed={modo === m.valor}
                className={clases(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  modo === m.valor
                    ? 'bg-oliva-600 text-white'
                    : 'border border-piedra-300 bg-white text-piedra-600 hover:bg-piedra-50'
                )}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>

          {modo === 'fechas' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
              <Campo
                etiqueta="Hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                error={rangoInvalido ? 'La fecha final va antes que la inicial.' : undefined}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {modo === 'mes' && (
                <Selector etiqueta="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Selector>
              )}

              {modo === 'trimestre' && (
                <Selector
                  etiqueta="Trimestre"
                  value={trimestre}
                  onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}
                >
                  <option value={1}>1º · enero a marzo</option>
                  <option value={2}>2º · abril a junio</option>
                  <option value={3}>3º · julio a septiembre</option>
                  <option value={4}>4º · octubre a diciembre</option>
                </Selector>
              )}

              <Selector etiqueta="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Selector>
            </div>
          )}

          {/* Vista previa de las cifras, para no descargar a ciegas. */}
          {resumen && (
            <Tarjeta className="p-4">
              <p className="text-sm font-medium capitalize">{nombrarRango(rango)}</p>

              {resumen.numFacturas + resumen.numTickets === 0 && resumen.numGastos === 0 ? (
                <p className="mt-2 text-sm text-piedra-500">
                  No hay nada en este periodo. El PDF saldría vacío.
                </p>
              ) : (
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-piedra-500">
                      Facturado · {resumen.numFacturas + resumen.numTickets} operaciones
                    </span>
                    <span className="tabular font-medium">
                      {formatearEuros(resumen.baseImponible)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-piedra-500">Gastos · {resumen.numGastos}</span>
                    <span className="tabular font-medium">
                      {formatearEuros(resumen.gastosDeducibles)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-piedra-200 pt-1.5">
                    <span className="font-medium">Beneficio</span>
                    <span className="tabular font-semibold">
                      {formatearEuros(resumen.beneficio)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-piedra-500">
                      {resumen.resultadoIva >= 0 ? 'IVA a pagar' : 'IVA a compensar'}
                    </span>
                    <span className="tabular font-medium">
                      {formatearEuros(Math.abs(resumen.resultadoIva))}
                    </span>
                  </div>
                </div>
              )}
            </Tarjeta>
          )}

          {!negocio && (
            <Aviso tono="aviso">
              Completa tus datos en Ajustes antes de generar el resumen.
            </Aviso>
          )}

          <Boton
            onClick={descargar}
            disabled={!negocio || !resumen || generando || rangoInvalido}
            tamano="lg"
            className="w-full"
          >
            {generando ? 'Generando…' : 'Descargar PDF'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
