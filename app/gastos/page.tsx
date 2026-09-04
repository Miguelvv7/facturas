'use client'

import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { CategoriaGasto, Gasto } from '@/lib/domain/tipos'
import { TipoIva } from '@/lib/domain/fiscal/tipos-iva'
import { formatearEuros, parsearEuros, porcentaje } from '@/lib/domain/dinero'
import { CATEGORIAS_GASTO, ORDEN_CATEGORIAS_GASTO } from '@/lib/domain/fiscal/categorias-gasto'
import { Boton, BotonBorrar, Campo, Cargando, EstadoVacio, Modal, PieModal, Selector, Tarjeta } from '@/components/ui'
import { CabeceraMovil } from '@/components/Navegacion'
import { formatearFecha, hoy } from '@/lib/domain/fechas'

const VACIO = {
  descripcion: '',
  proveedor: '',
  nifProveedor: '',
  categoria: 'mercaderias' as CategoriaGasto,
  base: '',
  tipoIva: '21' as '0' | '4' | '10' | '21',
  porcentajeDeducibleIva: 100,
}


export default function Gastos() {
  const { gastos, repo, recargar, cargando } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ ...VACIO, fecha: hoy() })
  const [errores, setErrores] = useState<Record<string, string>>({})

  const ordenados = useMemo(
    () => [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [gastos]
  )

  const totalMes = useMemo(() => {
    const mes = hoy().slice(0, 7)
    return gastos.filter((g) => g.fecha.startsWith(mes)).reduce((s, g) => s + g.total, 0)
  }, [gastos])

  const abrir = () => {
    setForm({ ...VACIO, fecha: hoy() })
    setErrores({})
    setAbierto(true)
  }

  // El tipo de IVA y el porcentaje deducible los fija el dominio, no la pantalla.
  const elegirCategoria = (valor: CategoriaGasto) => {
    const cat = CATEGORIAS_GASTO[valor]
    setForm((f) => ({
      ...f,
      categoria: valor,
      porcentajeDeducibleIva: cat.deducibleIva,
      tipoIva: String(cat.ivaHabitual) as typeof f.tipoIva,
    }))
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    const base = parsearEuros(form.base)

    if (!form.descripcion.trim()) nuevos.descripcion = 'Di qué has comprado.'
    if (base === null || base <= 0) nuevos.base = 'Indica el importe.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    const baseCent = base!
    const tipoIva = Number(form.tipoIva) as TipoIva
    const cuotaIva = porcentaje(baseCent, tipoIva)

    await repo.gastos.crear({
      descripcion: form.descripcion.trim(),
      proveedor: form.proveedor.trim(),
      nifProveedor: form.nifProveedor.trim() || undefined,
      fecha: form.fecha,
      categoria: form.categoria,
      base: baseCent,
      tipoIva,
      cuotaIva,
      total: baseCent + cuotaIva,
      porcentajeDeducibleIva: form.porcentajeDeducibleIva,
      porcentajeDeducibleIrpf: 100,
      deducibleIrpf: true,
      creadoEn: new Date().toISOString(),
    })

    await recargar()
    setAbierto(false)
  }

  const borrar = async (g: Gasto) => {
    if (!confirm(`¿Borrar "${g.descripcion}"?`)) return
    await repo.gastos.borrar(g.id)
    await recargar()
  }

  const etiquetaCategoria = (c: CategoriaGasto) => CATEGORIAS_GASTO[c].etiqueta

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Gastos" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="hidden text-2xl font-semibold md:block">Gastos</h1>
          <Boton onClick={abrir} className="ml-auto">
            Nuevo gasto
          </Boton>
        </div>

        <Tarjeta className="mb-5 p-5">
          <p className="text-sm text-piedra-500">Gastado este mes</p>
          <p className="tabular mt-1 text-2xl font-semibold">{formatearEuros(totalMes)}</p>
          <p className="mt-1.5 text-sm text-piedra-500">
            Cada gasto que apuntas te baja lo que pagas a Hacienda. Guarda siempre la factura.
          </p>
        </Tarjeta>

        {ordenados.length === 0 ? (
          <EstadoVacio
            titulo="Sin gastos apuntados"
            descripcion="Apunta lo que compras: el aceite, los envases, la gasolina. Todo resta."
            accion={<Boton onClick={abrir}>Apuntar gasto</Boton>}
          />
        ) : (
          <Tarjeta className="divide-y divide-piedra-200">
            {ordenados.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.descripcion}</p>
                  <p className="truncate text-sm text-piedra-500">
                    {formatearFecha(g.fecha)} · {etiquetaCategoria(g.categoria)}
                    {g.proveedor && ` · ${g.proveedor}`}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-3">
                  <span className="tabular font-medium">{formatearEuros(g.total)}</span>
                  <BotonBorrar onClick={() => borrar(g)} etiqueta={`Borrar ${g.descripcion}`} />
                </div>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>

      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Nuevo gasto">
        <form onSubmit={guardar} className="space-y-4">
          <Campo
            etiqueta="Qué has comprado"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            error={errores.descripcion}
            placeholder="Garrafas de 5 litros"
            autoFocus
          />

          <Selector
            etiqueta="Tipo de gasto"
            value={form.categoria}
            onChange={(e) => elegirCategoria(e.target.value as CategoriaGasto)}
          >
            {ORDEN_CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIAS_GASTO[c].etiqueta}
              </option>
            ))}
          </Selector>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Importe sin IVA"
              value={form.base}
              onChange={(e) => setForm((f) => ({ ...f, base: e.target.value }))}
              error={errores.base}
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="120.00"
            />
            <Selector
              etiqueta="IVA"
              value={form.tipoIva}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipoIva: e.target.value as '0' | '4' | '10' | '21' }))
              }
            >
              <option value="21">21%</option>
              <option value="10">10%</option>
              <option value="4">4%</option>
              <option value="0">Sin IVA</option>
            </Selector>
          </div>

          {CATEGORIAS_GASTO[form.categoria].nota && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {form.porcentajeDeducibleIva < 100 && form.tipoIva !== '0' && (
                <>
                  Solo se deduce el <strong>{form.porcentajeDeducibleIva}% del IVA</strong>.{' '}
                </>
              )}
              {CATEGORIAS_GASTO[form.categoria].nota}
            </div>
          )}

          <Campo
            etiqueta="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Proveedor"
              value={form.proveedor}
              onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
              placeholder="Almazara San Isidro"
            />
            <Campo
              etiqueta="Su NIF"
              value={form.nifProveedor}
              onChange={(e) => setForm((f) => ({ ...f, nifProveedor: e.target.value.toUpperCase() }))}
              ayuda="Sin NIF no puedes deducir el IVA."
            />
          </div>

          <PieModal onCancelar={() => setAbierto(false)} />
        </form>
      </Modal>
    </>
  )
}
