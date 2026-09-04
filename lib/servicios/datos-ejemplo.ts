/**
 * Rellena la aplicación con un negocio de prueba para poder verla en marcha.
 * Todo lo que genera es inventado y se borra con `vaciarTodo`.
 */

import { Repositorio } from '../data/repositorio'
import { euros, porcentaje } from '../domain/dinero'
import { hoy, sumarDias } from '../domain/fechas'
import { crearBorrador, emitirFactura, marcarCobrada } from './facturacion'
import { CategoriaGasto, LineaFacturaGuardada } from '../domain/tipos'
import { CATEGORIAS_GASTO } from '../domain/fiscal/categorias-gasto'
import { PERSONALIZACION_POR_DEFECTO } from '../domain/tipos'

const CLIENTES = [
  { nombre: 'Restaurante La Parra, S.L.', nif: 'B12345674', regimen: 'general', ciudad: 'Madrid', diasPago: 30 },
  { nombre: 'Ultramarinos Paqui', nif: '12345678Z', regimen: 'recargo_equivalencia', ciudad: 'Jaén', diasPago: 0 },
  { nombre: 'Bar Manolo', nif: 'B12345674', regimen: 'general', ciudad: 'Martos', diasPago: 15 },
  { nombre: 'Hotel Sierra Sur', nif: 'B12345674', regimen: 'general', ciudad: 'Alcaudete', diasPago: 60 },
] as const

const PRODUCTOS = [
  { nombre: 'AOVE Picual · Garrafa 5 L', categoria: 'Aceite de oliva', categoriaAceite: 'aove', tipoIva: 4, precio: 38.5, coste: 26, litros: 5, stock: 180, minimo: 40 },
  { nombre: 'AOVE Picual · Botella 500 ml', categoria: 'Aceite de oliva', categoriaAceite: 'aove', tipoIva: 4, precio: 6.9, coste: 4.1, litros: 0.5, stock: 420, minimo: 100 },
  { nombre: 'AOVE Arbequina · Botella 500 ml', categoria: 'Aceite de oliva', categoriaAceite: 'aove', tipoIva: 4, precio: 7.4, coste: 4.5, litros: 0.5, stock: 260, minimo: 100 },
  { nombre: 'Aceite de oliva suave · 1 L', categoria: 'Aceite de oliva', categoriaAceite: 'oliva', tipoIva: 4, precio: 5.2, coste: 3.4, litros: 1, stock: 300, minimo: 80 },
  { nombre: 'Aceite de girasol refinado · 5 L', categoria: 'Aceite de semillas', tipoIva: 10, precio: 11.2, coste: 8.3, litros: 5, stock: 24, minimo: 30 },
  { nombre: 'Garrafa vacía 5 L', categoria: 'Envases y material', tipoIva: 21, precio: 1.4, coste: 0.7, stock: 500 },
] as const

// Solo el importe: el tipo de IVA y el porcentaje deducible salen del dominio.
const GASTOS: { descripcion: string; proveedor: string; categoria: CategoriaGasto; base: number }[] = [
  { descripcion: 'Compra de aceite a granel', proveedor: 'Almazara San Isidro', categoria: 'mercaderias', base: 4200 },
  { descripcion: 'Garrafas y botellas', proveedor: 'Envases del Sur', categoria: 'envases_material', base: 380 },
  { descripcion: 'Gasolina furgoneta', proveedor: 'Repsol', categoria: 'combustible', base: 210 },
  { descripcion: 'Cuota de autónomos', proveedor: 'Seguridad Social', categoria: 'cuota_autonomos', base: 87.61 },
  { descripcion: 'Móvil e internet', proveedor: 'Movistar', categoria: 'telefonia_internet', base: 45 },
  { descripcion: 'Etiquetas y diseño', proveedor: 'Imprenta Molina', categoria: 'publicidad', base: 320 },
]

/** Generador con semilla: los datos de ejemplo salen iguales cada vez. */
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export async function cargarDatosEjemplo(repo: Repositorio) {
  const rnd = aleatorio(20260904)
  const hoyIso = hoy()

  await repo.negocio.guardar({
    nombreCompleto: 'Javier Ruiz Molina',
    nombreComercial: 'Aceites del Sur',
    nif: '12345678Z',
    direccion: 'Camino de la Almazara, 14',
    codigoPostal: '23600',
    ciudad: 'Martos',
    provincia: 'Jaén',
    telefono: '699 123 456',
    email: 'hola@aceitesdelsur.es',
    sector: 'aceite',
    regimenIrpf: 'estimacion_directa_simplificada',
    aplicaRetencion: false,
    tipoRetencion: 0,
    iban: 'ES91 2100 0418 4502 0005 1332',
    cuotaAutonomos: euros(87.61),
    factura: {
      ...PERSONALIZACION_POR_DEFECTO,
      textoPie: 'Gracias por su confianza. Aceite de la cosecha 2025/2026.',
      condicionesPago: 'Pago por transferencia en el plazo acordado.',
    },
  })

  const clientes = []
  for (const c of CLIENTES) {
    clientes.push(
      await repo.clientes.crear({
        nombre: c.nombre,
        nif: c.nif,
        regimen: c.regimen,
        ciudad: c.ciudad,
        provincia: 'Jaén',
        pais: 'ES',
        diasPago: c.diasPago,
        creadoEn: new Date().toISOString(),
      })
    )
  }

  const productos = []
  for (const p of PRODUCTOS) {
    productos.push(
      await repo.productos.crear({
        nombre: p.nombre,
        categoria: p.categoria,
        categoriaAceite: 'categoriaAceite' in p ? p.categoriaAceite : undefined,
        tipoIva: p.tipoIva,
        precioVenta: euros(p.precio),
        precioCoste: euros(p.coste),
        litros: 'litros' in p ? p.litros : undefined,
        stock: p.stock,
        stockMinimo: 'minimo' in p ? p.minimo : undefined,
        activo: true,
      })
    )
  }

  for (const g of GASTOS) {
    const cat = CATEGORIAS_GASTO[g.categoria]
    const base = euros(g.base)
    const cuotaIva = porcentaje(base, cat.ivaHabitual)
    await repo.gastos.crear({
      descripcion: g.descripcion,
      proveedor: g.proveedor,
      nifProveedor: 'B12345674',
      fecha: sumarDias(hoyIso, -Math.floor(rnd() * 70)),
      categoria: g.categoria,
      base,
      tipoIva: cat.ivaHabitual,
      cuotaIva,
      total: base + cuotaIva,
      porcentajeDeducibleIva: cat.deducibleIva,
      porcentajeDeducibleIrpf: 100,
      deducibleIrpf: true,
      creadoEn: new Date().toISOString(),
    })
  }

  // Ventas repartidas por los últimos ~75 días, más densas entre semana.
  const fechas: string[] = []
  for (let atras = 78; atras >= 0; atras--) {
    const fecha = sumarDias(hoyIso, -atras)
    const [a, m, d] = fecha.split('-').map(Number)
    const finde = [0, 6].includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay())
    const probabilidad = finde ? 0.12 : 0.55
    if (rnd() < probabilidad) {
      fechas.push(fecha)
      // Algún día suelto con dos ventas, para que el calendario tenga relieve.
      if (rnd() < 0.25) fechas.push(fecha)
    }
  }

  // Se emiten en orden cronológico para que la cadena de huellas sea coherente.
  for (const fecha of fechas) {
    const cliente = clientes[Math.floor(rnd() * clientes.length)]
    const numLineas = 1 + Math.floor(rnd() * 3)
    const lineas: LineaFacturaGuardada[] = []

    for (let i = 0; i < numLineas; i++) {
      const p = productos[Math.floor(rnd() * productos.length)]
      if (lineas.some((l) => l.productoId === p.id)) continue
      lineas.push({
        productoId: p.id,
        descripcion: p.nombre,
        cantidad: 1 + Math.floor(rnd() * 24),
        precioUnitario: p.precioVenta,
        tipoIva: p.tipoIva,
      })
    }
    if (lineas.length === 0) continue

    const borrador = await crearBorrador(repo, { clienteId: cliente.id, fecha, lineas })
    const { factura } = await emitirFactura(repo, borrador.id)

    // Las ya vencidas suelen estar cobradas; alguna queda a deber a propósito.
    if (factura.fechaVencimiento < hoyIso && rnd() < 0.8) {
      await marcarCobrada(repo, factura.id, factura.fechaVencimiento)
    } else if (rnd() < 0.3) {
      await marcarCobrada(repo, factura.id, fecha)
    }
  }
}

