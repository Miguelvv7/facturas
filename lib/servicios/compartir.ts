/**
 * Enviar la factura al cliente.
 *
 * En España esto se hace por WhatsApp más que por correo, así que la app
 * intenta primero compartir el PDF con el sistema (que ofrece WhatsApp, Mail,
 * AirDrop…) y solo si no puede cae en descargar y abrir el chat con el texto
 * escrito.
 */

import { Cliente, DatosNegocio, Factura } from '../domain/tipos'
import { formatearEuros } from '../domain/dinero'
import { formatearFecha } from '../domain/fechas'
import { generarFacturaPDF, nombreArchivo } from '../pdf/factura-pdf'

export interface DatosEnvio {
  factura: Factura
  cliente: Cliente
  negocio: DatosNegocio
}

const esTicket = (f: Factura) => f.tipoFactura === 'F2'

export function mensajeParaCliente({ factura, cliente, negocio }: DatosEnvio): string {
  const quien = negocio.nombreComercial || negocio.nombreCompleto
  const nombre = cliente.nombre.split(/[\s,]/)[0]
  const documento = esTicket(factura) ? 'el ticket' : `la factura ${factura.numeroCompleto}`

  const lineas = [
    `Hola ${nombre}, te paso ${documento} de ${formatearEuros(factura.total)}.`,
  ]

  if (!esTicket(factura) && factura.fechaVencimiento !== factura.fecha) {
    lineas.push(`Vence el ${formatearFecha(factura.fechaVencimiento, 'larga')}.`)
  }
  if (negocio.iban) {
    lineas.push(`Puedes pagarla por transferencia: ${negocio.iban}`)
  }

  lineas.push(`Gracias.\n${quien}`)
  return lineas.join('\n')
}

/** Quita todo lo que no sea dígito y antepone el prefijo de España si falta. */
export function normalizarTelefono(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length < 9) return null
  if (digitos.startsWith('34')) return digitos
  if (digitos.length === 9) return `34${digitos}`
  return digitos
}

export function enlaceWhatsApp(datos: DatosEnvio): string {
  const texto = encodeURIComponent(mensajeParaCliente(datos))
  const numero = datos.cliente.telefono ? normalizarTelefono(datos.cliente.telefono) : null
  // Sin número, WhatsApp abre el selector de contactos.
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`
}

export function enlaceCorreo(datos: DatosEnvio): string {
  const { factura, cliente, negocio } = datos
  const asunto = esTicket(factura)
    ? `Ticket de ${negocio.nombreComercial || negocio.nombreCompleto}`
    : `Factura ${factura.numeroCompleto}`
  return [
    `mailto:${cliente.email ?? ''}`,
    `?subject=${encodeURIComponent(asunto)}`,
    `&body=${encodeURIComponent(mensajeParaCliente(datos))}`,
  ].join('')
}

export type ResultadoEnvio = 'compartido' | 'cancelado' | 'descargado'

/**
 * Comparte el PDF con el sistema. Devuelve qué ha pasado para que la interfaz
 * pueda ofrecer WhatsApp o correo cuando no haya sido posible compartir.
 */
export async function compartirFactura(datos: DatosEnvio): Promise<ResultadoEnvio> {
  const doc = await generarFacturaPDF(datos)
  const blob = doc.output('blob') as Blob
  const archivo = new File([blob], nombreArchivo(datos.factura), { type: 'application/pdf' })

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({
        files: [archivo],
        title: datos.factura.numeroCompleto,
        text: mensajeParaCliente(datos),
      })
      return 'compartido'
    } catch (e) {
      // El usuario cerró el panel: no es un fallo, no hay que avisar de nada.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    }
  }

  doc.save(nombreArchivo(datos.factura))
  return 'descargado'
}
