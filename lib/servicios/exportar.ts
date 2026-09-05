/**
 * Sacar los datos de la aplicación.
 *
 * Dos motivos distintos: una copia de seguridad completa (por si acaso) y un
 * listado en formato de hoja de cálculo, que es lo que pide un gestor o lo que
 * hace falta para el libro registro de facturas emitidas.
 */

import { aEuros } from '../domain/dinero'
import { formatearFecha, hoy } from '../domain/fechas'
import { Cliente, DatosNegocio, Factura, Gasto, Producto } from '../domain/tipos'
import { CATEGORIAS_GASTO } from '../domain/fiscal/categorias-gasto'

export interface DatosExportables {
  negocio: DatosNegocio | null
  clientes: Cliente[]
  productos: Producto[]
  facturas: Factura[]
  gastos: Gasto[]
}

function descargar(contenido: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

const sufijoFecha = () => hoy().replace(/-/g, '')

export function exportarCopiaSeguridad(datos: DatosExportables) {
  const copia = {
    version: 1,
    generado: new Date().toISOString(),
    ...datos,
  }
  descargar(JSON.stringify(copia, null, 2), `copia-${sufijoFecha()}.json`, 'application/json')
}

/**
 * Excel en español espera punto y coma como separador y coma decimal. Con
 * comas se abre todo apelotonado en una sola columna.
 */
const celda = (valor: unknown): string => {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

const numero = (centimos: number) => String(aEuros(centimos)).replace('.', ',')

const aCsv = (cabeceras: string[], filas: unknown[][]) =>
  // El BOM hace que Excel reconozca los acentos.
  '﻿' + [cabeceras, ...filas].map((f) => f.map(celda).join(';')).join('\n')

const ESTADOS: Record<string, string> = {
  borrador: 'Borrador',
  emitida: 'Pendiente de cobro',
  cobrada: 'Cobrada',
  vencida: 'Vencida',
  anulada: 'Anulada',
}

/** Libro registro de facturas emitidas. */
export function exportarFacturasCsv(facturas: Factura[], clientes: Cliente[]) {
  const nombres = new Map(clientes.map((c) => [c.id, c]))

  const filas = facturas
    .filter((f) => f.estado !== 'borrador')
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
    .map((f) => {
      const cliente = nombres.get(f.clienteId)
      // El desglose se aplana en columnas por tipo: es como lo espera un gestor.
      const porTipo = (tipo: number) =>
        f.desglose.filter((d) => d.tipoIva === tipo).reduce((s, d) => s + d.base, 0)
      const cuotaTipo = (tipo: number) =>
        f.desglose.filter((d) => d.tipoIva === tipo).reduce((s, d) => s + d.cuotaIva, 0)

      return [
        f.numeroCompleto,
        formatearFecha(f.fecha),
        f.tipoFactura === 'F2' ? 'Ticket' : 'Factura',
        cliente?.nombre ?? '',
        cliente?.nif ?? '',
        numero(porTipo(4)),
        numero(cuotaTipo(4)),
        numero(porTipo(10)),
        numero(cuotaTipo(10)),
        numero(porTipo(21)),
        numero(cuotaTipo(21)),
        numero(f.baseImponible),
        numero(f.totalIva),
        numero(f.totalRecargo),
        numero(f.totalRetencion),
        numero(f.total),
        ESTADOS[f.estado] ?? f.estado,
        f.fechaCobro ? formatearFecha(f.fechaCobro) : '',
      ]
    })

  descargar(
    aCsv(
      [
        'Número', 'Fecha', 'Tipo', 'Cliente', 'NIF',
        'Base 4%', 'Cuota 4%', 'Base 10%', 'Cuota 10%', 'Base 21%', 'Cuota 21%',
        'Base total', 'IVA', 'Recargo', 'Retención', 'Total', 'Estado', 'Cobrada el',
      ],
      filas
    ),
    `facturas-${sufijoFecha()}.csv`,
    'text/csv'
  )
}

/** Libro registro de facturas recibidas. */
export function exportarGastosCsv(gastos: Gasto[]) {
  const filas = [...gastos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((g) => [
      formatearFecha(g.fecha),
      g.numeroFactura ?? '',
      g.proveedor,
      g.nifProveedor ?? '',
      CATEGORIAS_GASTO[g.categoria]?.etiqueta ?? g.categoria,
      g.descripcion,
      numero(g.base),
      `${g.tipoIva}%`,
      numero(g.cuotaIva),
      numero(g.total),
      `${g.porcentajeDeducibleIva}%`,
      // Lo que de verdad se resta en el modelo 303.
      numero(Math.round((g.cuotaIva * g.porcentajeDeducibleIva) / 100)),
    ])

  descargar(
    aCsv(
      [
        'Fecha', 'Nº factura', 'Proveedor', 'NIF', 'Categoría', 'Concepto',
        'Base', 'Tipo IVA', 'Cuota IVA', 'Total', '% deducible', 'IVA deducible',
      ],
      filas
    ),
    `gastos-${sufijoFecha()}.csv`,
    'text/csv'
  )
}
