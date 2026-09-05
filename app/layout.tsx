import type { Metadata, Viewport } from 'next'
import { ProveedorDatos } from '@/lib/estado/datos'
import { ProveedorSesion } from '@/lib/estado/sesion'
import { Puerta } from '@/components/Puerta'
import { BarraInferior, BarraLateral } from '@/components/Navegacion'
import './globals.css'

export const metadata: Metadata = {
  title: 'Facturas',
  description: 'Control de ventas y facturación para autónomos',
  manifest: '/manifest.webmanifest',
  // Sin esto iOS abre la app en Safari en vez de a pantalla completa.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Facturas' },
  icons: { icon: '/icono-192.png', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#20281a',
  width: 'device-width',
  initialScale: 1,
  // Evita el zoom accidental al tocar dos veces, que en un formulario molesta.
  maximumScale: 1,
  viewportFit: 'cover',
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
