'use client'

import { useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { Cliente } from '@/lib/domain/tipos'
import { RegimenCliente } from '@/lib/domain/fiscal/factura-calc'
import { errorNif } from '@/lib/domain/fiscal/nif'
import { Boton, BotonBorrar, Campo, Cargando, EstadoVacio, Insignia, Modal, PieModal, Selector, Tarjeta } from '@/components/ui'
import { CabeceraMovil } from '@/components/Navegacion'

const REGIMENES: { valor: RegimenCliente; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'general',
    etiqueta: 'Empresa o particular normal',
    ayuda: 'Lo habitual: bares, restaurantes, empresas y particulares.',
  },
  {
    valor: 'recargo_equivalencia',
    etiqueta: 'Tienda en recargo de equivalencia',
    ayuda: 'Pequeños comercios que revenden. Hay que cobrarles un recargo extra además del IVA.',
  },
  {
    valor: 'intracomunitario',
    etiqueta: 'Empresa de otro país de la UE',
    ayuda: 'Se factura sin IVA. El cliente debe estar dado de alta en el registro VIES.',
  },
  {
    valor: 'exportacion',
    etiqueta: 'Cliente fuera de la UE',
    ayuda: 'Exportación: se factura sin IVA.',
  },
]

const VACIO = {
  nombre: '',
  nif: '',
  regimen: 'general' as RegimenCliente,
  email: '',
  telefono: '',
  direccion: '',
  codigoPostal: '',
  ciudad: '',
  provincia: '',
  pais: 'ES',
  diasPago: 0,
}

export default function Clientes() {
  const { clientes, repo, recargar, cargando } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const abrir = (c?: Cliente) => {
    setEditando(c ?? null)
    setForm(c ? { ...VACIO, ...c } : VACIO)
    setErrores({})
    setAbierto(true)
  }

  const cambiar = (campo: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    if (!form.nombre.trim()) nuevos.nombre = 'Pon al menos el nombre.'
    // El NIF no se exige para vender a particulares, pero si se escribe debe ser válido.
    if (form.nif.trim()) {
      const err = errorNif(form.nif)
      if (err) nuevos.nif = err
    }
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    const datos = { ...form, diasPago: Number(form.diasPago) || 0 }
    if (editando) await repo.clientes.actualizar(editando.id, datos)
    else await repo.clientes.crear({ ...datos, creadoEn: new Date().toISOString() })

    await recargar()
    setAbierto(false)
  }

  const borrar = async (c: Cliente) => {
    if (!confirm(`¿Borrar a ${c.nombre}? Sus facturas se conservan.`)) return
    await repo.clientes.borrar(c.id)
    await recargar()
  }

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Clientes" />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="hidden text-2xl font-semibold md:block">Clientes</h1>
          <Boton onClick={() => abrir()} className="ml-auto">
            Nuevo cliente
          </Boton>
        </div>

        {clientes.length === 0 ? (
          <EstadoVacio
            titulo="Aún no tienes clientes"
            descripcion="Añade el primero para poder hacerle una factura."
            accion={<Boton onClick={() => abrir()}>Añadir cliente</Boton>}
          />
        ) : (
          <Tarjeta className="divide-y divide-piedra-200">
            {clientes.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-4">
                <button onClick={() => abrir(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium">{c.nombre}</p>
                  <p className="truncate text-sm text-piedra-500">
                    {[c.nif, c.ciudad].filter(Boolean).join(' · ') || 'Sin datos fiscales'}
                  </p>
                </button>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {c.regimen === 'recargo_equivalencia' && <Insignia tono="oliva">Recargo</Insignia>}
                  {c.regimen === 'intracomunitario' && <Insignia tono="oliva">UE</Insignia>}
                  <BotonBorrar onClick={() => borrar(c)} etiqueta={`Borrar ${c.nombre}`} />
                </div>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <Campo
            etiqueta="Nombre o razón social"
            value={form.nombre}
            onChange={cambiar('nombre')}
            error={errores.nombre}
            placeholder="Restaurante La Parra, S.L."
            autoFocus
          />

          <Campo
            etiqueta="NIF o CIF"
            value={form.nif}
            onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value.toUpperCase() }))}
            error={errores.nif}
            ayuda="Obligatorio para hacerle una factura completa."
            placeholder="B12345674"
          />

          <Selector
            etiqueta="Tipo de cliente"
            value={form.regimen}
            onChange={(e) => setForm((f) => ({ ...f, regimen: e.target.value as RegimenCliente }))}
            ayuda={REGIMENES.find((r) => r.valor === form.regimen)?.ayuda}
          >
            {REGIMENES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </Selector>

          <Campo etiqueta="Dirección" value={form.direccion} onChange={cambiar('direccion')} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              etiqueta="C.P."
              value={form.codigoPostal}
              onChange={cambiar('codigoPostal')}
              inputMode="numeric"
            />
            <Campo
              etiqueta="Localidad"
              value={form.ciudad}
              onChange={cambiar('ciudad')}
              className="sm:col-span-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono" value={form.telefono} onChange={cambiar('telefono')} type="tel" />
            <Campo etiqueta="Correo" value={form.email} onChange={cambiar('email')} type="email" />
          </div>

          <Campo
            etiqueta="Días para pagar"
            value={String(form.diasPago)}
            onChange={cambiar('diasPago')}
            type="number"
            inputMode="numeric"
            ayuda="0 si paga al contado. 30 si paga a treinta días."
          />

          <PieModal onCancelar={() => setAbierto(false)} />
        </form>
      </Modal>
    </>
  )
}
