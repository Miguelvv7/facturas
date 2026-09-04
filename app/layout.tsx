import type { Metadata, Viewport } from 'next'
import { ProveedorDatos } from '@/lib/estado/datos'
import { ProveedorSesion } from '@/lib/estado/sesion'
import { Puerta } from '@/components/Puerta'
import { BarraInferior, BarraLateral } from '@/components/Navegacion'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aceites · Ventas y facturas',
  description: 'Control de ventas y facturación para venta de aceites',
}

export const viewport: Viewport = {
  themeColor: '#65783e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ProveedorSesion>
          <Puerta>
            <ProveedorDatos>
              <BarraLateral />
              {/* pb-24 deja hueco para la barra inferior del móvil. */}
              <main className="min-h-screen pb-24 md:ml-60 md:pb-0">{children}</main>
              <BarraInferior />
            </ProveedorDatos>
          </Puerta>
        </ProveedorSesion>
      </body>
    </html>
  )
}
