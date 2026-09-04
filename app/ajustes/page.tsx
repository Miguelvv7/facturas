'use client'

import { useEffect, useRef, useState } from 'react'
import { useDatos } from '@/lib/estado/datos'
import { useSesion } from '@/lib/estado/sesion'
import {
  DatosNegocio,
  PERSONALIZACION_POR_DEFECTO,
  PersonalizacionFactura,
} from '@/lib/domain/tipos'
import { SECTORES, Sector } from '@/lib/domain/sectores'
import { errorNif } from '@/lib/domain/fiscal/nif'
import { euros, aEuros } from '@/lib/domain/dinero'
import { prepararLogo } from '@/lib/servicios/imagen'
import { cargarDatosEjemplo } from '@/lib/servicios/datos-ejemplo'
import { facturaDeMuestra } from '@/lib/servicios/muestra'
import { Aviso, Boton, Campo, Cargando, Selector, Tarjeta, clases } from '@/components/ui'
import { CabeceraMovil } from '@/components/Navegacion'

const VACIO: DatosNegocio = {
  nombreCompleto: '',
  nombreComercial: '',
  nif: '',
  direccion: '',
  codigoPostal: '',
  ciudad: '',
  provincia: '',
  telefono: '',
  email: '',
  sector: 'aceite',
  regimenIrpf: 'estimacion_directa_simplificada',
  aplicaRetencion: false,
  tipoRetencion: 0,
  iban: '',
  factura: PERSONALIZACION_POR_DEFECTO,
}

const COLORES = [
  { valor: '#65783e', nombre: 'Oliva' },
  { valor: '#1f4d3d', nombre: 'Verde oscuro' },
  { valor: '#1e3a5f', nombre: 'Azul' },
  { valor: '#7c2d12', nombre: 'Tierra' },
  { valor: '#78350f', nombre: 'Ámbar' },
  { valor: '#44403c', nombre: 'Grafito' },
]

type Pestana = 'datos' | 'factura' | 'negocio' | 'pruebas'

const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: 'datos', etiqueta: 'Mis datos' },
  { valor: 'factura', etiqueta: 'Factura' },
  { valor: 'negocio', etiqueta: 'Negocio' },
  { valor: 'pruebas', etiqueta: 'Datos' },
]

export default function Ajustes() {
  const { negocio, repo, recargar, cargando } = useDatos()
  const { email, salir } = useSesion()
  const [pestana, setPestana] = useState<Pestana>('datos')
  const [form, setForm] = useState<DatosNegocio>(VACIO)
  const [guardado, setGuardado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorLogo, setErrorLogo] = useState<string | null>(null)
  const inputLogo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (negocio) {
      setForm({
        ...VACIO,
        ...negocio,
        factura: { ...PERSONALIZACION_POR_DEFECTO, ...negocio.factura },
      })
    }
  }, [negocio])

  const cambiar = (campo: keyof DatosNegocio) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }))
    setGuardado(false)
  }

  const cambiarFactura = <K extends keyof PersonalizacionFactura>(
    campo: K,
    valor: PersonalizacionFactura[K]
  ) => {
    setForm((f) => ({ ...f, factura: { ...f.factura, [campo]: valor } }))
    setGuardado(false)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevos: Record<string, string> = {}

    if (!form.nombreCompleto.trim()) nuevos.nombreCompleto = 'Hace falta tu nombre.'
    const errNif = errorNif(form.nif)
    if (errNif) nuevos.nif = errNif
    if (!form.direccion.trim()) nuevos.direccion = 'La dirección es obligatoria en la factura.'
    if (!form.ciudad.trim()) nuevos.ciudad = 'Indica la localidad.'

    setErrores(nuevos)
    if (Object.keys(nuevos).length) {
      setPestana('datos')
      return
    }

    await repo.negocio.guardar(form)
    await recargar()
    setGuardado(true)
  }

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setErrorLogo(null)
    try {
      cambiarFactura('logo', await prepararLogo(archivo))
    } catch (err) {
      setErrorLogo(err instanceof Error ? err.message : 'No se ha podido cargar el logo.')
    }
  }

  const verEjemplo = async () => {
    setOcupado(true)
    try {
      const doc = await facturaDeMuestra(form)
      doc.output('dataurlnewwindow', { filename: 'ejemplo.pdf' })
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) return <Cargando />

  return (
    <>
      <CabeceraMovil titulo="Ajustes" />
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="hidden text-2xl font-semibold md:block">Ajustes</h1>

        {!negocio && (
          <div className="mt-5">
            <Aviso tono="info">
              Rellena tus datos antes de facturar. Sin nombre, NIF y dirección, una factura no es
              válida.
            </Aviso>
          </div>
        )}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {PESTANAS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPestana(p.valor)}
              aria-pressed={pestana === p.valor}
              className={clases(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                pestana === p.valor
                  ? 'bg-oliva-600 text-white'
                  : 'border border-piedra-300 bg-white text-piedra-600 hover:bg-piedra-50'
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <form onSubmit={guardar} className="mt-5 space-y-6">
          {pestana === 'datos' && (
            <>
              <Tarjeta className="space-y-4 p-5">
                <div>
                  <h2 className="font-semibold">Tus datos</h2>
                  <p className="mt-1 text-sm text-piedra-500">
                    Salen impresos en todas tus facturas.
                  </p>
                </div>

                <Campo
                  etiqueta="Nombre y apellidos"
                  value={form.nombreCompleto}
                  onChange={cambiar('nombreCompleto')}
                  error={errores.nombreCompleto}
                  placeholder="Javier Ruiz Molina"
                  autoComplete="name"
                />
                <Campo
                  etiqueta="Nombre comercial"
                  value={form.nombreComercial ?? ''}
                  onChange={cambiar('nombreComercial')}
                  ayuda="Opcional. Si lo pones, aparece destacado en la factura."
                  placeholder="Aceites del Sur"
                />
                <Campo
                  etiqueta="NIF"
                  value={form.nif}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, nif: e.target.value.toUpperCase() }))
                    setGuardado(false)
                  }}
                  error={errores.nif}
                  placeholder="12345678Z"
                />
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">Dirección</h2>
                <Campo
                  etiqueta="Calle y número"
                  value={form.direccion}
                  onChange={cambiar('direccion')}
                  error={errores.direccion}
                  autoComplete="street-address"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo
                    etiqueta="Código postal"
                    value={form.codigoPostal}
                    onChange={cambiar('codigoPostal')}
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                  <Campo
                    etiqueta="Localidad"
                    value={form.ciudad}
                    onChange={cambiar('ciudad')}
                    error={errores.ciudad}
                    className="sm:col-span-2"
                  />
                </div>
                <Campo etiqueta="Provincia" value={form.provincia} onChange={cambiar('provincia')} />
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">Contacto y cobro</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Teléfono"
                    value={form.telefono ?? ''}
                    onChange={cambiar('telefono')}
                    type="tel"
                    autoComplete="tel"
                  />
                  <Campo
                    etiqueta="Correo"
                    value={form.email ?? ''}
                    onChange={cambiar('email')}
                    type="email"
                    autoComplete="email"
                  />
                </div>
                <Campo
                  etiqueta="IBAN"
                  value={form.iban ?? ''}
                  onChange={cambiar('iban')}
                  ayuda="Aparece en la factura para que te paguen por transferencia."
                  placeholder="ES91 2100 0418 4502 0005 1332"
                />
              </Tarjeta>
            </>
          )}

          {pestana === 'factura' && (
            <>
              <Tarjeta className="space-y-4 p-5">
                <div>
                  <h2 className="font-semibold">Tu logo</h2>
                  <p className="mt-1 text-sm text-piedra-500">
                    Aparece arriba del todo. Se reduce solo, sube la imagen que tengas.
                  </p>
                </div>

                {form.factura.logo ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.factura.logo}
                      alt="Tu logo"
                      className="h-20 w-20 rounded-xl border border-piedra-200 object-contain p-1"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Boton
                        type="button"
                        variante="secundario"
                        tamano="sm"
                        onClick={() => inputLogo.current?.click()}
                      >
                        Cambiar
                      </Boton>
                      <Boton
                        type="button"
                        variante="peligro"
                        tamano="sm"
                        onClick={() => cambiarFactura('logo', undefined)}
                      >
                        Quitar
                      </Boton>
                    </div>
                  </div>
                ) : (
                  <Boton
                    type="button"
                    variante="secundario"
                    onClick={() => inputLogo.current?.click()}
                  >
                    Subir logo
                  </Boton>
                )}

                <input
                  ref={inputLogo}
                  type="file"
                  accept="image/*"
                  onChange={subirLogo}
                  className="hidden"
                />
                {errorLogo && <Aviso tono="error">{errorLogo}</Aviso>}
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <div>
                  <h2 className="font-semibold">Color</h2>
                  <p className="mt-1 text-sm text-piedra-500">
                    Se usa en la cabecera de la tabla y en el total.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {COLORES.map((c) => (
                    <button
                      key={c.valor}
                      type="button"
                      onClick={() => cambiarFactura('colorAcento', c.valor)}
                      aria-label={c.nombre}
                      aria-pressed={form.factura.colorAcento === c.valor}
                      className={clases(
                        'h-10 w-10 rounded-full',
                        form.factura.colorAcento === c.valor &&
                          'ring-2 ring-piedra-900 ring-offset-2'
                      )}
                      style={{ backgroundColor: c.valor }}
                    />
                  ))}

                  <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-piedra-300 px-3 text-sm">
                    <input
                      type="color"
                      value={form.factura.colorAcento}
                      onChange={(e) => cambiarFactura('colorAcento', e.target.value)}
                      className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                    />
                    Otro
                  </label>
                </div>
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">Numeración y textos</h2>

                <Campo
                  etiqueta="Serie"
                  value={form.factura.serie}
                  onChange={(e) =>
                    cambiarFactura('serie', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  }
                  ayuda={`Tus facturas se numerarán ${form.factura.serie || 'A'}/${new Date().getFullYear()}/0001, 0002…`}
                  placeholder="A"
                />

                <Campo
                  etiqueta="Condiciones de pago"
                  value={form.factura.condicionesPago ?? ''}
                  onChange={(e) => cambiarFactura('condicionesPago', e.target.value)}
                  placeholder="Pago a 30 días por transferencia"
                  ayuda="Se imprime debajo del total."
                />

                <Campo
                  etiqueta="Texto del pie"
                  value={form.factura.textoPie ?? ''}
                  onChange={(e) => cambiarFactura('textoPie', e.target.value)}
                  placeholder="Gracias por su confianza."
                  ayuda="Sale en todas las facturas, al final."
                />
              </Tarjeta>

              <Tarjeta className="space-y-3 p-5">
                <h2 className="font-semibold">Opciones</h2>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.factura.mostrarQR}
                    onChange={(e) => cambiarFactura('mostrarQR', e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Mostrar el QR de verificación</span>
                    <span className="block text-piedra-500">
                      Permite comprobar la factura. Será obligatorio en julio de 2027.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.factura.mostrarDescuentos}
                    onChange={(e) => cambiarFactura('mostrarDescuentos', e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Columna de descuento siempre visible</span>
                    <span className="block text-piedra-500">
                      Aunque esa factura no lleve ninguno.
                    </span>
                  </span>
                </label>
              </Tarjeta>

              <Boton type="button" variante="secundario" onClick={verEjemplo} disabled={ocupado}>
                {ocupado ? 'Generando…' : 'Ver cómo queda'}
              </Boton>
            </>
          )}

          {pestana === 'negocio' && (
            <>
              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">A qué te dedicas</h2>

                <Selector
                  etiqueta="Tipo de negocio"
                  value={form.sector}
                  onChange={(e) => {
                    const sector = e.target.value as Sector
                    setForm((f) => ({
                      ...f,
                      sector,
                      tipoRetencion: SECTORES[sector].retencionPorDefecto,
                      aplicaRetencion: SECTORES[sector].retencionPorDefecto > 0,
                    }))
                    setGuardado(false)
                  }}
                  ayuda={SECTORES[form.sector].descripcion}
                >
                  {Object.entries(SECTORES).map(([valor, def]) => (
                    <option key={valor} value={valor}>
                      {def.etiqueta}
                    </option>
                  ))}
                </Selector>

                <p className="text-sm text-piedra-500">
                  Solo cambia las categorías que te sugiere al crear productos. El IVA puedes
                  elegirlo tú siempre.
                </p>
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">Retención de IRPF</h2>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.aplicaRetencion}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        aplicaRetencion: e.target.checked,
                        tipoRetencion: e.target.checked ? f.tipoRetencion || 15 : 0,
                      }))
                      setGuardado(false)
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Aplicar retención en mis facturas</span>
                    <span className="block text-piedra-500">
                      Solo si eres profesional y facturas a empresas. Vendiendo mercancía,
                      normalmente no.
                    </span>
                  </span>
                </label>

                {form.aplicaRetencion && (
                  <Campo
                    etiqueta="Porcentaje"
                    value={String(form.tipoRetencion)}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, tipoRetencion: Number(e.target.value) || 0 }))
                      setGuardado(false)
                    }}
                    type="number"
                    inputMode="decimal"
                    ayuda="15% lo normal. 7% durante los tres primeros años de alta."
                  />
                )}
              </Tarjeta>

              <Tarjeta className="space-y-4 p-5">
                <h2 className="font-semibold">Para calcular lo de Hacienda</h2>

                <Campo
                  etiqueta="Cuota mensual de autónomos"
                  value={form.cuotaAutonomos ? String(aEuros(form.cuotaAutonomos)) : ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setForm((f) => ({
                      ...f,
                      cuotaAutonomos:
                        e.target.value === '' || !Number.isFinite(n) ? undefined : euros(n),
                    }))
                    setGuardado(false)
                  }}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  ayuda="Lo que pagas a la Seguridad Social. Cuenta como gasto."
                  placeholder="87.61"
                />

                <Campo
                  etiqueta="Beneficio del año pasado"
                  value={
                    form.rendimientoNetoAnterior ? String(aEuros(form.rendimientoNetoAnterior)) : ''
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setForm((f) => ({
                      ...f,
                      rendimientoNetoAnterior:
                        e.target.value === '' || !Number.isFinite(n) ? undefined : euros(n),
                    }))
                    setGuardado(false)
                  }}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  ayuda="Si fue menos de 12.000 €, Hacienda te descuenta hasta 100 € cada trimestre. Déjalo vacío si es tu primer año."
                />
              </Tarjeta>
            </>
          )}

          {pestana === 'pruebas' && (
            <>
            {email && (
              <Tarjeta className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <h2 className="font-semibold">Tu cuenta</h2>
                  <p className="mt-1 truncate text-sm text-piedra-500">{email}</p>
                </div>
                <Boton type="button" variante="secundario" onClick={() => void salir()}>
                  Cerrar sesión
                </Boton>
              </Tarjeta>
            )}

            <Tarjeta className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">Datos de prueba</h2>
                <p className="mt-1 text-sm text-piedra-500">
                  Rellena la app con un negocio inventado y unos meses de ventas, para verla
                  funcionando sin teclear nada.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Boton
                  type="button"
                  variante="secundario"
                  disabled={ocupado}
                  onClick={async () => {
                    setOcupado(true)
                    await cargarDatosEjemplo(repo)
                    await recargar()
                    setOcupado(false)
                  }}
                >
                  {ocupado ? 'Generando…' : 'Cargar datos de ejemplo'}
                </Boton>

                <Boton
                  type="button"
                  variante="peligro"
                  disabled={ocupado}
                  onClick={async () => {
                    if (!confirm('Se borra todo: facturas, clientes, productos y gastos. ¿Seguro?'))
                      return
                    setOcupado(true)
                    await repo.vaciarTodo()
                    setForm(VACIO)
                    await recargar()
                    setOcupado(false)
                  }}
                >
                  Borrar todo
                </Boton>
              </div>
            </Tarjeta>
            </>
          )}

          <div className="sticky bottom-24 flex items-center gap-3 md:bottom-6">
            <Boton type="submit" tamano="lg" className="shadow-media">
              Guardar
            </Boton>
            {guardado && <span className="text-sm text-exito">Guardado</span>}
          </div>
        </form>
      </div>
    </>
  )
}
