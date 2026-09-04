/**
 * Factura de mentira para que el usuario vea cómo queda su personalización
 * antes de mandarle nada a un cliente.
 */

import { euros } from '../domain/dinero'
import { hoy, sumarDias } from '../domain/fechas'
import { Cliente, DatosNegocio, Factura } from '../domain/tipos'
import { calcularTotales, LineaFactura } from '../domain/fiscal/factura-calc'
import { generarFacturaPDF } from '../pdf/factura-pdf'

const CLIENTE: Cliente = {
  id: 'muestra',
  nombre: 'Cliente de ejemplo, S.L.',
  nif: 'B12345674',
  regimen: 'general',
  direccion: 'Calle Mayor, 8',
  codigoPostal: '28013',
  ciudad: 'Madrid',
  provincia: 'Madrid',
  pais: 'ES',
  diasPago: 30,
  creadoEn: '',
}

const LINEAS: LineaFactura[] = [
  { descripcion: 'Primer producto o servicio', cantidad: 12, precioUnitario: euros(24.5), tipoIva: 21 },
  { descripcion: 'Segundo concepto, con descuento', cantidad: 4, precioUnitario: euros(58), tipoIva: 21, descuento: 10 },
  { descripcion: 'Portes', cantidad: 1, precioUnitario: euros(35), tipoIva: 21 },
]

export async function facturaDeMuestra(negocio: DatosNegocio) {
  const fecha = hoy()
  const totales = calcularTotales(LINEAS, {
    regimenCliente: 'general',
    tipoRetencion: negocio.aplicaRetencion ? negocio.tipoRetencion : 0,
  })

  const factura: Factura = {
    id: 'muestra',
    serie: negocio.factura.serie || 'A',
    numero: 1,
    numeroCompleto: `${negocio.factura.serie || 'A'}/${fecha.slice(0, 4)}/0001`,
    tipoFactura: 'F1',
    clienteId: CLIENTE.id,
    fecha,
    fechaVencimiento: sumarDias(fecha, 30),
    lineas: LINEAS,
    ...totales,
    estado: 'emitida',
    notas: 'Esto es un ejemplo. No corresponde a ninguna venta real.',
    // Huella inventada: solo sirve para que se vea el pie con el QR.
    huella: 'EJEMPLO0000000000000000000000000000000000000000000000000000MUESTRA',
    huellaAnterior: '',
    fechaHoraGeneracion: '',
    creadoEn: '',
  }

  return generarFacturaPDF({ factura, cliente: CLIENTE, negocio })
}
