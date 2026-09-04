'use client'

import Link from 'next/link'
import { DesgloseIva } from '@/lib/domain/fiscal/factura-calc'
import { Centimos, formatearEuros } from '@/lib/domain/dinero'
import { formatearFecha } from '@/lib/domain/fechas'
import { Factura } from '@/lib/domain/tipos'
import { estaVencida } from '@/lib/servicios/resumen'
import { Insignia, Tarjeta } from './ui'

/**
 * Estado visible de una factura. Estaba repetido en cuatro pantallas y dos de
 * ellas se habían olvidado de las anuladas, que aparecían como pendientes.
 */
export function InsigniaEstado({ factura }: { factura: Factura }) {
  if (factura.estado === 'anulada') return <Insignia tono="neutro">Anulada</Insignia>
  if (factura.estado === 'cobrada') return <Insignia tono="exito">Cobrada</Insignia>
  if (estaVencida(factura)) return <Insignia tono="error">Vencida</Insignia>
  return <Insignia tono="neutro">Pendiente</Insignia>
}

export function FilaFactura({
  factura,
  nombreCliente,
  mostrarFecha = true,
}: {
  factura: Factura
  nombreCliente: string
  mostrarFecha?: boolean
}) {
  return (
    <Link
      href={`/facturas/${factura.id}`}
      className="flex items-center justify-between px-5 py-3.5 hover:bg-piedra-50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{nombreCliente}</p>
        <p className="text-sm text-piedra-500">
          {factura.numeroCompleto}
          {mostrarFecha && ` · ${formatearFecha(factura.fecha, 'diaMes')}`}
        </p>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <span className="tabular font-medium">{formatearEuros(factura.total)}</span>
        <InsigniaEstado factura={factura} />
      </div>
    </Link>
  )
}

export interface ImportesFactura {
  baseImponible: Centimos
  desglose: DesgloseIva[]
  totalRecargo: Centimos
  total: Centimos
}

export function BloqueTotales({ importes }: { importes: ImportesFactura }) {
  return (
    <Tarjeta className="p-5">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-piedra-600">
          <span>Base</span>
          <span className="tabular">{formatearEuros(importes.baseImponible)}</span>
        </div>

        {importes.desglose
          .filter((d) => d.tipoIva > 0)
          .map((d) => (
            <div key={d.tipoIva} className="flex justify-between text-piedra-600">
              <span>IVA {d.tipoIva}%</span>
              <span className="tabular">{formatearEuros(d.cuotaIva)}</span>
            </div>
          ))}

        {importes.totalRecargo > 0 && (
          <div className="flex justify-between text-piedra-600">
            <span>Recargo de equivalencia</span>
            <span className="tabular">{formatearEuros(importes.totalRecargo)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-piedra-200 pt-3">
        <span className="font-semibold">Total</span>
        <span className="tabular text-xl font-semibold">{formatearEuros(importes.total)}</span>
      </div>
    </Tarjeta>
  )
}

/** Índice id→nombre, para no hacer un `find` por cada fila de la lista. */
export const mapaNombres = <T extends { id: string; nombre: string }>(items: T[]) =>
  new Map(items.map((i) => [i.id, i.nombre]))
