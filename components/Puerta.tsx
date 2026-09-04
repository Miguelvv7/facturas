'use client'

import { useState } from 'react'
import { useSesion } from '@/lib/estado/sesion'
import { Cargando } from './ui'

/**
 * Envuelve la aplicación: si hace falta cuenta y no hay sesión, muestra la
 * pantalla de entrada en lugar del contenido.
 */
export function Puerta({ children }: { children: React.ReactNode }) {
  const { comprobando, requiereLogin } = useSesion()

  if (comprobando) return <Cargando />
  if (requiereLogin) return <PantallaEntrada />
  return <>{children}</>
}

/**
 * Monograma MV. Las dos letras comparten el trazo diagonal central: la última
 * pata de la M es la primera de la V, así que se leen como una sola marca.
 * `pathLength="1"` normaliza la longitud para poder animar el dibujado.
 */
function Monograma({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} fill="none" aria-label="MV" role="img">
      <path
        d="M8 68 V12 L34 56 L60 12 V68"
        pathLength={1}
        className="traza"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDelay: '0.25s' }}
      />
      <path
        d="M60 12 L86 68 L112 12"
        pathLength={1}
        className="traza"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDelay: '0.85s' }}
      />
    </svg>
  )
}

function PantallaEntrada() {
  const { entrar } = useSesion()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEntrando(true)
    try {
      await entrar(email, clave)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido entrar.')
      setEntrando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---- Panel de marca ------------------------------------------- */}
      <section className="grano relative flex min-h-[38vh] shrink-0 flex-col justify-between overflow-hidden bg-[#20281a] px-8 py-10 text-[#e9ecd9] lg:min-h-screen lg:w-[46%] lg:px-14 lg:py-14">
        {/* Manchas de aceite a la deriva. Desfasadas para que nunca se repita. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="mancha absolute -left-[15%] top-[-10%] h-[70%] w-[80%] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #7f8f4b 0%, transparent 68%)', opacity: 0.5 }}
          />
          <div
            className="mancha absolute bottom-[-18%] right-[-12%] h-[75%] w-[75%] rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, #b7c28c 0%, transparent 66%)',
              opacity: 0.28,
              animationDelay: '-9s',
              animationDuration: '34s',
            }}
          />
          <div
            className="mancha absolute left-[28%] top-[38%] h-[48%] w-[52%] rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, #4d5c31 0%, transparent 70%)',
              opacity: 0.55,
              animationDelay: '-17s',
              animationDuration: '29s',
            }}
          />
        </div>

        <header className="relative flex items-center gap-4">
          <Monograma className="h-11 w-auto text-[#d4dab6]" />
          <span className="h-8 w-px bg-[#d4dab6]/25" />
          <span className="entra text-[11px] uppercase tracking-[0.28em] text-[#d4dab6]/70" style={{ animationDelay: '1.1s' }}>
            Miguel Victorio
          </span>
        </header>

        <div className="relative mt-10 max-w-md lg:mt-0">
          <h1
            className="serif entra text-[2.1rem] leading-[1.12] tracking-[-0.02em] lg:text-[3.1rem]"
            style={{ animationDelay: '0.5s' }}
          >
            Tu negocio,
            <br />
            <span className="italic text-[#c6d09a]">cuadrado</span> al céntimo.
          </h1>

          <p
            className="entra mt-5 max-w-sm text-[15px] leading-relaxed text-[#d4dab6]/75"
            style={{ animationDelay: '0.68s' }}
          >
            Facturas, ventas y lo que toca apartar para Hacienda. Sin gestoría y sin hojas de
            cálculo.
          </p>
        </div>

        <footer
          className="entra relative mt-10 hidden text-[11px] uppercase tracking-[0.2em] text-[#d4dab6]/45 lg:block"
          style={{ animationDelay: '1.25s' }}
        >
          Hecho a mano · {new Date().getFullYear()}
        </footer>
      </section>

      {/* ---- Formulario ------------------------------------------------ */}
      <section className="flex flex-1 items-center justify-center bg-piedra-50 px-6 py-12 lg:px-14">
        <div className="w-full max-w-[22rem]">
          <div className="entra" style={{ animationDelay: '0.35s' }}>
            <h2 className="serif text-[1.75rem] tracking-[-0.01em] text-piedra-900">Entra</h2>
            <p className="mt-1.5 text-[15px] text-piedra-500">
              Con la cuenta que te han dado.
            </p>
          </div>

          <form onSubmit={enviar} className="mt-9 space-y-7">
            <div className="entra" style={{ animationDelay: '0.48s' }}>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium uppercase tracking-[0.16em] text-piedra-400"
              >
                Correo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                placeholder="tu@correo.es"
                className="campo-linea mt-2 w-full border-0 border-b border-piedra-300 bg-transparent px-0 pb-2 text-[17px] text-piedra-900 placeholder:text-piedra-300 focus:border-piedra-300 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="entra" style={{ animationDelay: '0.6s' }}>
              <label
                htmlFor="clave"
                className="block text-[11px] font-medium uppercase tracking-[0.16em] text-piedra-400"
              >
                Contraseña
              </label>
              <input
                id="clave"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="campo-linea mt-2 w-full border-0 border-b border-piedra-300 bg-transparent px-0 pb-2 text-[17px] text-piedra-900 placeholder:text-piedra-300 focus:border-piedra-300 focus:outline-none focus:ring-0"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="entra border-l-2 border-error pl-3 text-sm leading-relaxed text-error"
              >
                {error}
              </p>
            )}

            <div className="entra pt-1" style={{ animationDelay: '0.72s' }}>
              <button
                type="submit"
                disabled={entrando}
                className="group relative w-full overflow-hidden rounded-full bg-[#20281a] px-6 py-4 text-[15px] font-medium tracking-wide text-[#e9ecd9] transition-transform duration-200 hover:bg-[#2b3623] active:scale-[0.985] disabled:opacity-60"
              >
                <span className="relative z-10">
                  {entrando ? 'Entrando…' : 'Entrar'}
                </span>
                {/* Barrido de luz al pasar por encima. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 z-0 w-1/3 bg-white/12 opacity-0 group-hover:opacity-100"
                  style={{ animation: 'brillo 1.1s ease-in-out infinite' }}
                />
              </button>
            </div>
          </form>

          <div
            className="entra mt-10 flex items-center gap-3 text-[12px] text-piedra-400"
            style={{ animationDelay: '0.9s' }}
          >
            <Monograma className="h-4 w-auto text-piedra-400" />
            <span className="h-3 w-px bg-piedra-300" />
            <span>Diseñado y construido por Miguel Victorio</span>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-piedra-400">
            ¿Sin cuenta o se te ha olvidado la contraseña? Pídesela a quien te pasó la aplicación.
          </p>
        </div>
      </section>
    </div>
  )
}
