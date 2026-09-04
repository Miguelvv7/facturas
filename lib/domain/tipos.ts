import { Centimos } from './dinero'
import { CodigoAceiteOliva, TipoIva } from './fiscal/tipos-iva'
import { Sector } from './sectores'
import { DesgloseIva, RegimenCliente } from './fiscal/factura-calc'
import { TipoFactura } from './fiscal/verifactu'

export interface Cliente {
  id: string
  nombre: string
  /** Opcional: en venta a particulares con ticket no se exige. */
  nif?: string
  regimen: RegimenCliente
  email?: string
  telefono?: string
  direccion?: string
  codigoPostal?: string
  ciudad?: string
  provincia?: string
  pais: string
  /** Días de plazo de pago acordados. Para vencimientos y control de morosidad. */
  diasPago: number
  notas?: string
  creadoEn: string
}

export interface Producto {
  id: string
  nombre: string
  referencia?: string
  /**
   * Etiqueta libre. El sector sugiere unas cuantas con su IVA, pero el usuario
   * puede escribir la suya: la app sirve para vender aceite y para cualquier
   * otra cosa.
   */
  categoria: string
  /** Solo en el sector del aceite: determina el etiquetado obligatorio. */
  categoriaAceite?: CodigoAceiteOliva
  /** Siempre elegible a mano, aunque la categoría sugiera otro. */
  tipoIva: TipoIva
  precioVenta: Centimos
  /** Lo que le cuesta a él. Da el margen y valora las existencias. */
  precioCoste?: Centimos
  /** Litros o unidad de medida por envase. Permite calcular precio por litro. */
  litros?: number
  stock: number
  stockMinimo?: number
  notas?: string
  activo: boolean
}

/**
 * Lote de producción. La trazabilidad es obligatoria para alimentos
 * (Reglamento CE 178/2002, art. 18): hay que poder reconstruir de dónde
 * vino cada botella y a quién se vendió.
 */
export interface Lote {
  id: string
  productoId: string
  codigo: string
  fechaEnvasado: string
  fechaConsumoPreferente: string
  /** Almazara, cooperativa o proveedor de origen. */
  origen: string
  cantidadInicial: number
  cantidadActual: number
  acidez?: number
  notas?: string
}

export type EstadoFactura = 'borrador' | 'emitida' | 'cobrada' | 'vencida' | 'anulada'

export interface LineaFacturaGuardada {
  productoId?: string
  loteId?: string
  descripcion: string
  cantidad: number
  precioUnitario: Centimos
  tipoIva: TipoIva
  descuento?: number
}

export interface Factura {
  id: string
  serie: string
  numero: number
  /** Serie y número tal como se imprime: "A/2026/0001". */
  numeroCompleto: string
  tipoFactura: TipoFactura
  clienteId: string
  /** Fecha de expedición. Es la que manda a efectos de devengo. */
  fecha: string
  fechaVencimiento: string
  lineas: LineaFacturaGuardada[]
  baseImponible: Centimos
  desglose: DesgloseIva[]
  totalIva: Centimos
  totalRecargo: Centimos
  tipoRetencion: number
  totalRetencion: Centimos
  total: Centimos
  estado: EstadoFactura
  fechaCobro?: string
  /** Factura que rectifica, si tipoFactura empieza por R. */
  rectificaA?: string
  notas?: string
  // --- Verifactu ---
  huella: string
  huellaAnterior: string
  fechaHoraGeneracion: string
  creadoEn: string
}

export type CategoriaGasto =
  | 'mercaderias'
  | 'envases_material'
  | 'suministros'
  | 'combustible'
  | 'vehiculo'
  | 'alquiler'
  | 'telefonia_internet'
  | 'servicios_profesionales'
  | 'seguros'
  | 'material_oficina'
  | 'publicidad'
  | 'transporte'
  | 'dietas'
  | 'cuota_autonomos'
  | 'financieros'
  | 'otros'

export interface Gasto {
  id: string
  descripcion: string
  proveedor: string
  /** NIF del proveedor. Obligatorio para deducir el IVA. */
  nifProveedor?: string
  numeroFactura?: string
  fecha: string
  categoria: CategoriaGasto
  base: Centimos
  tipoIva: TipoIva
  cuotaIva: Centimos
  total: Centimos
  /**
   * Porcentaje de IVA deducible (0-100). Un gasto de móvil de uso mixto
   * no se deduce al 100%, y el combustible del coche particular tiene
   * limitaciones. Separado del gasto para no falsear el 303.
   */
  porcentajeDeducibleIva: number
  /** Porcentaje deducible en IRPF. No siempre coincide con el de IVA. */
  porcentajeDeducibleIrpf: number
  /** Cuotas de autónomos y similares no llevan IVA pero sí son gasto. */
  deducibleIrpf: boolean
  /** Ruta al justificante escaneado. Sin factura no hay deducción. */
  justificanteUrl?: string
  notas?: string
  creadoEn: string
}

export type RegimenIrpf = 'estimacion_directa_simplificada' | 'estimacion_directa_normal'

/**
 * Aspecto de la factura. Es lo que ven sus clientes, así que conviene que
 * pueda parecerse a su negocio y no a una plantilla genérica.
 */
export interface PersonalizacionFactura {
  /** Imagen en base64. Se incrusta en el PDF. */
  logo?: string
  /** Color de la cabecera y los totales, en hexadecimal. */
  colorAcento: string
  /** Prefijo de la serie: "A", "FAC", "2026"… */
  serie: string
  /** Texto fijo al pie de todas las facturas. */
  textoPie?: string
  /** Condiciones de pago que se imprimen bajo el total. */
  condicionesPago?: string
  /** Mostrar el QR de verificación. Obligatorio con Verifactu desde 2027. */
  mostrarQR: boolean
  /** Mostrar la columna de descuento aunque no haya ninguno. */
  mostrarDescuentos: boolean
}

export const PERSONALIZACION_POR_DEFECTO: PersonalizacionFactura = {
  colorAcento: '#65783e',
  serie: 'A',
  mostrarQR: true,
  mostrarDescuentos: false,
}

export interface DatosNegocio {
  nombreCompleto: string
  nombreComercial?: string
  nif: string
  direccion: string
  codigoPostal: string
  ciudad: string
  provincia: string
  telefono?: string
  email?: string
  /** Epígrafe del IAE. Para aceites suele ser 613.4 (mayor) o 644.x (menor). */
  epigrafeIae?: string
  /** A qué se dedica. Solo determina qué categorías se le sugieren. */
  sector: Sector
  regimenIrpf: RegimenIrpf
  /** Si retiene IRPF en sus facturas. En venta de mercancía normalmente no. */
  aplicaRetencion: boolean
  tipoRetencion: number
  fechaAlta?: string
  /** Cuota mensual de autónomos, para previsión de gastos. */
  cuotaAutonomos?: Centimos
  /** Rendimiento neto del año anterior. Determina la minoración del modelo 130. */
  rendimientoNetoAnterior?: Centimos
  iban?: string
  factura: PersonalizacionFactura
}
