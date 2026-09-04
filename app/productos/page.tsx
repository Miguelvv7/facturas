'use client'

import { useMemo, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { Producto } from '@/lib/domain/tipos'
import { CATEGORIAS_ACEITE_OLIVA, CodigoAceiteOliva, TipoIva } from '@/lib/domain/fiscal/tipos-iva'
import {
  SECTORES,
  TIPOS_IVA_DISPONIBLES,
  buscarCategoria,
  categoriasDe,
  margen,
} from '@/lib/domain/sectores'
import { aEuros, formatearEuros, parsearEuros } from '@/lib/domain/dinero'
import {
  Aviso,
  Boton,
  BotonBorrar,
  Campo,
  Cargando,
  EstadoVacio,
  Modal,
  PieModal,
  Selector,
  Tarjeta,
} from '@/components/ui'
import { CabeceraMovil } from '@/components/Navegacion'

const VACIO = {
  nombre: '',
  referencia: '',
  categoria: '',
  categoriaAceite: 'aove' as CodigoAceiteOliva,
  tipoIva: 21 as TipoIva,
  precioVenta: '',
  precioCoste: '',
  litros: '',
  stock: '',
  stockMinimo: '',
  notas: '',
}

const aCentimos = (v: string) => parsearEuros(v) ?? 0
const aNumero = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')))

export default function Productos() {
  const { productos, negocio, repo, recargar, cargando } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const sector = negocio?.sector ?? 'general'
  const def = SECTORES[sector]
  const sugeridas = categoriasDe(sector)

  // Las categorías que el usuario ya ha escrito valen tanto como las sugeridas.
  const categoriasConocidas = useMemo(() => {
    const nombres = new Set(sugeridas.map((c) => c.nombre))
    for (const p of productos) if (p.categoria) nombres.add(p.categoria)
    return [...nombres]
  }, [productos, sugeridas])

  const abrir = (p?: Producto) => {
    setEditando(p ?? null)
    setForm(
      p
        ? {
            ...VACIO,
            nombre: p.nombre,
            referencia: p.referencia ?? '',
            categoria: p.categoria,
            categoriaAceite: p.categoriaAceite ?? 'aove',
            tipoIva: p.tipoIva,
            precioVenta: String(aEuros(p.precioVenta)),
            precioCoste: p.precioCoste ? String(aEuros(p.precioCoste)) : '',
            litros: p.litros ? String(p.litros) : '',
            stock: String(p.stock),
            stockMinimo: p.stockMinimo !== undefined ? String(p.stockMinimo) : '',
            notas: p.notas ?? '',
          }
        : { ...VACIO, tipoIva: sugeridas[0]?.tipoIva ?? 21, categoria: sugeridas[0]?.nombre ?? '' }
    )
    setErrores({})
    setAbierto(true)
  }

  /** Al elegir categoría se propone su IVA, pero se puede cambiar después. */
  const elegirCategoria = (nombre: string) => {
    const sugerida = buscarCategoria(sector, nombre)
    setForm((f) => ({ ...f, categoria: nombre, tipoIva: sugerida?.tipoIva ?? f.tipoIva }))
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    if (!form.nombre.trim()) nuevos.nombre = 'Ponle un nombre.'
    if (aCentimos(form.precioVenta) <= 0) nuevos.precioVenta = 'Indica a cuánto lo vendes.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    const datos = {
      nombre: form.nombre.trim(),
      referencia: form.referencia.trim() || undefined,
      categoria: form.categoria.trim(),
      categoriaAceite: sector === 'aceite' ? form.categoriaAceite : undefined,
      tipoIva: form.tipoIva,
      precioVenta: aCentimos(form.precioVenta),
      precioCoste: form.precioCoste ? aCentimos(form.precioCoste) : undefined,
      litros: def.usaLitros ? aNumero(form.litros) : undefined,
      stock: aNumero(form.stock) ?? 0,
      stockMinimo: aNumero(form.stockMinimo),
      notas: form.notas.trim() || undefined,
      activo: true,
    }

    if (editando) await repo.productos.actualizar(editando.id, datos)
    else await repo.productos.crear(datos)

    await recargar()
    setAbierto(false)
  }

  const borrar = async (p: Producto) => {
    if (!confirm(`¿Borrar ${p.nombre}?`)) return
    await repo.productos.borrar(p.id)
    await recargar()
  }

  const venta = aCentimos(form.precioVenta)
  const coste = aCentimos(form.precioCoste)
  const beneficio = venta - coste
  const litrosForm = aNumero(form.litros)
  const sugerida = buscarCategoria(sector, form.categoria)
  const ivaDistinto = sugerida && sugerida.tipoIva !== form.tipoIva

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Productos" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="hidden text-2xl font-semibold md:block">Productos</h1>
          <Boton onClick={() => abrir()} className="ml-auto">
            Nuevo producto
          </Boton>
        </div>

        {productos.length === 0 ? (
          <EstadoVacio
            titulo="Aún no tienes productos"
            descripcion="Añade lo que vendes con su precio. Así facturar es cuestión de dos toques."
            accion={<Boton onClick={() => abrir()}>Añadir producto</Boton>}
          />
        ) : (
          <Tarjeta className="divide-y divide-piedra-200">
            {productos.map((p) => {
              const m = p.precioCoste ? margen(p.precioVenta, p.precioCoste) : null
              const bajoMinimo = p.stockMinimo !== undefined && p.stock <= p.stockMinimo
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-4">
                  <button onClick={() => abrir(p)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <p className="truncate text-sm text-piedra-500">
                      {[
                        p.categoria,
                        `IVA ${p.tipoIva}%`,
                        p.litros ? `${formatearEuros(Math.round(p.precioVenta / p.litros))}/L` : null,
                        m !== null ? `margen ${m.toFixed(0)}%` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </button>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="tabular font-medium">{formatearEuros(p.precioVenta)}</p>
                      {def.usaStock && (
                        <p
                          className={`tabular text-sm ${bajoMinimo ? 'text-aviso' : 'text-piedra-500'}`}
                        >
                          {p.stock} uds.
                        </p>
                      )}
                    </div>
                    <BotonBorrar onClick={() => borrar(p)} etiqueta={`Borrar ${p.nombre}`} />
                  </div>
                </div>
              )
            })}
          </Tarjeta>
        )}
      </div>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={editando ? 'Editar producto' : 'Nuevo producto'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <Campo
            etiqueta="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={errores.nombre}
            placeholder={sector === 'aceite' ? 'AOVE Picual · Garrafa 5 L' : 'Nombre del producto'}
            autoFocus
          />

          {/* Lista abierta: se sugiere, no se impone. */}
          <div>
            <label htmlFor="cat-producto" className="etiqueta">
              Categoría
            </label>
            <input
              id="cat-producto"
              list="categorias-conocidas"
              className="campo"
              value={form.categoria}
              onChange={(e) => elegirCategoria(e.target.value)}
              placeholder="Escribe la tuya o elige una"
            />
            <datalist id="categorias-conocidas">
              {categoriasConocidas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {sugerida?.nota && <p className="mt-1.5 text-sm text-piedra-500">{sugerida.nota}</p>}
          </div>

          <Selector
            etiqueta="IVA"
            value={String(form.tipoIva)}
            onChange={(e) => setForm((f) => ({ ...f, tipoIva: Number(e.target.value) as TipoIva }))}
          >
            {TIPOS_IVA_DISPONIBLES.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Selector>

          {ivaDistinto && (
            <Aviso tono={sugerida.fijadoPorLey ? 'error' : 'aviso'}>
              {sugerida.fijadoPorLey ? (
                <>
                  <strong>Ojo:</strong> «{sugerida.nombre}» tributa al {sugerida.tipoIva}% por ley.
                  Con otro tipo la factura saldría mal.
                </>
              ) : (
                <>Lo habitual en «{sugerida.nombre}» es el {sugerida.tipoIva}%.</>
              )}
            </Aviso>
          )}

          {sector === 'aceite' && (
            <Selector
              etiqueta="Categoría del aceite"
              value={form.categoriaAceite}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoriaAceite: e.target.value as CodigoAceiteOliva }))
              }
              ayuda={CATEGORIAS_ACEITE_OLIVA.find((c) => c.codigo === form.categoriaAceite)?.nota}
            >
              {CATEGORIAS_ACEITE_OLIVA.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="A cuánto lo compras"
              value={form.precioCoste}
              onChange={(e) => setForm((f) => ({ ...f, precioCoste: e.target.value }))}
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="26.00"
              ayuda="Sin IVA. Solo lo ves tú."
            />
            <Campo
              etiqueta="A cuánto lo vendes"
              value={form.precioVenta}
              onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))}
              error={errores.precioVenta}
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="38.50"
              ayuda="Sin IVA. Es lo que va en la factura."
            />
          </div>

          {venta > 0 && coste > 0 && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                beneficio > 0 ? 'bg-oliva-50 text-oliva-900' : 'bg-red-50 text-red-900'
              }`}
            >
              {beneficio > 0 ? (
                <>
                  Ganas <strong className="font-semibold">{formatearEuros(beneficio)}</strong> por
                  unidad · margen del{' '}
                  <strong className="font-semibold">{margen(venta, coste).toFixed(1)}%</strong>
                  {litrosForm ? (
                    <> · {formatearEuros(Math.round(venta / litrosForm))} por litro</>
                  ) : null}
                </>
              ) : (
                <>
                  <strong className="font-semibold">Estás perdiendo dinero:</strong> lo vendes más
                  barato de lo que te cuesta.
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {def.usaLitros && (
              <Campo
                etiqueta="Litros por envase"
                value={form.litros}
                onChange={(e) => setForm((f) => ({ ...f, litros: e.target.value }))}
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder="5"
              />
            )}
            <Campo
              etiqueta="Referencia"
              value={form.referencia}
              onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          {def.usaStock && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Existencias"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                type="number"
                inputMode="decimal"
                placeholder="0"
              />
              <Campo
                etiqueta="Avisarme cuando baje de"
                value={form.stockMinimo}
                onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                type="number"
                inputMode="decimal"
                ayuda="Opcional."
              />
            </div>
          )}

          <Campo
            etiqueta="Notas"
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            placeholder="Opcional. Proveedor, condiciones…"
          />

          <PieModal onCancelar={() => setAbierto(false)} />
        </form>
      </Modal>
    </>
  )
}
