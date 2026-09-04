import { describe, expect, it } from 'vitest'
import { euros, aEuros } from '../../dinero'
import { calcularTotales, LineaFactura } from '../factura-calc'
import { calcularModelo303 } from '../modelo-303'
import { calcularModelo130, minoracionPorRendimiento } from '../modelo-130'
import { validarNif, tipoIdentificador } from '../nif'
import { calcularHuella, construirCadenaHuella, verificarCadena, RegistroFacturacion } from '../verifactu'
import { trimestreDe, plazoPresentacion } from '../periodos'
import { Factura, Gasto } from '../../tipos'

const linea = (over: Partial<LineaFactura> = {}): LineaFactura => ({
  descripcion: 'AOVE 5L',
  cantidad: 1,
  precioUnitario: euros(30),
  tipoIva: 4,
  ...over,
})

describe('cálculo de factura', () => {
  it('aplica el 4% al aceite de oliva', () => {
    const t = calcularTotales([linea({ cantidad: 10 })], { regimenCliente: 'general' })
    expect(aEuros(t.baseImponible)).toBe(300)
    expect(aEuros(t.totalIva)).toBe(12)
    expect(aEuros(t.total)).toBe(312)
  })

  it('agrupa por tipo de IVA en lugar de sumar línea a línea', () => {
    const t = calcularTotales(
      [
        linea({ precioUnitario: euros(10.33), cantidad: 3, tipoIva: 4 }),
        linea({ precioUnitario: euros(10.33), cantidad: 3, tipoIva: 4 }),
        linea({ descripcion: 'Portes', precioUnitario: euros(15), tipoIva: 21 }),
      ],
      { regimenCliente: 'general' }
    )
    // Dos bases de 30,99 agrupadas = 61,98 → 4% = 2,48 (no 1,24 + 1,24 por separado)
    const bloque4 = t.desglose.find((d) => d.tipoIva === 4)!
    expect(aEuros(bloque4.base)).toBe(61.98)
    expect(aEuros(bloque4.cuotaIva)).toBe(2.48)
    expect(t.desglose).toHaveLength(2)
    expect(aEuros(t.total)).toBe(61.98 + 2.48 + 15 + 3.15)
  })

  it('repercute recargo de equivalencia del 0,5% sobre aceite de oliva', () => {
    const t = calcularTotales([linea({ cantidad: 10 })], {
      regimenCliente: 'recargo_equivalencia',
    })
    expect(aEuros(t.totalIva)).toBe(12)
    expect(aEuros(t.totalRecargo)).toBe(1.5)
    expect(aEuros(t.total)).toBe(313.5)
  })

  it('no repercute IVA en entregas intracomunitarias pero conserva la base', () => {
    const t = calcularTotales([linea({ cantidad: 10 })], {
      regimenCliente: 'intracomunitario',
    })
    expect(aEuros(t.baseImponible)).toBe(300)
    expect(t.totalIva).toBe(0)
    expect(aEuros(t.total)).toBe(300)
  })

  it('resta la retención de IRPF del total', () => {
    const t = calcularTotales([linea({ cantidad: 10, tipoIva: 21 })], {
      regimenCliente: 'general',
      tipoRetencion: 15,
    })
    expect(aEuros(t.totalRetencion)).toBe(45)
    expect(aEuros(t.total)).toBe(300 + 63 - 45)
  })

  it('aplica descuento por línea antes del IVA', () => {
    const t = calcularTotales([linea({ cantidad: 10, descuento: 10 })], {
      regimenCliente: 'general',
    })
    expect(aEuros(t.baseImponible)).toBe(270)
    expect(aEuros(t.totalIva)).toBe(10.8)
  })
})

const factura = (over: Partial<Factura> = {}): Factura => {
  const totales = calcularTotales([linea({ cantidad: 10 })], { regimenCliente: 'general' })
  return {
    id: '1',
    serie: 'A',
    numero: 1,
    numeroCompleto: 'A/2026/0001',
    tipoFactura: 'F1',
    clienteId: 'c1',
    fecha: '2026-02-15',
    fechaVencimiento: '2026-03-15',
    lineas: [],
    ...totales,
    estado: 'emitida',
    huella: '',
    huellaAnterior: '',
    fechaHoraGeneracion: '2026-02-15T10:00:00+01:00',
    creadoEn: '2026-02-15T10:00:00+01:00',
    ...over,
  }
}

const gasto = (over: Partial<Gasto> = {}): Gasto => ({
  id: 'g1',
  descripcion: 'Compra de aceite a granel',
  proveedor: 'Almazara SL',
  nifProveedor: 'B12345674',
  fecha: '2026-02-10',
  categoria: 'mercaderias',
  base: euros(1000),
  tipoIva: 4,
  cuotaIva: euros(40),
  total: euros(1040),
  porcentajeDeducibleIva: 100,
  porcentajeDeducibleIrpf: 100,
  deducibleIrpf: true,
  justificanteUrl: 'x.pdf',
  creadoEn: '2026-02-10T10:00:00+01:00',
  ...over,
})

describe('modelo 303', () => {
  it('declara por devengo, no por cobro', () => {
    // Emitida en febrero (1T) pero cobrada en julio (3T): debe ir al 1T.
    const f = factura({ estado: 'emitida', fechaCobro: '2026-07-01' })
    const r = calcularModelo303([f], [], { ejercicio: 2026, trimestre: 1 })
    expect(aEuros(r.totalDevengado)).toBe(12)

    const t3 = calcularModelo303([f], [], { ejercicio: 2026, trimestre: 3 })
    expect(t3.totalDevengado).toBe(0)
  })

  it('excluye borradores y facturas anuladas', () => {
    const r = calcularModelo303(
      [factura({ estado: 'borrador' }), factura({ id: '2', estado: 'anulada' })],
      [],
      { ejercicio: 2026, trimestre: 1 }
    )
    expect(r.totalDevengado).toBe(0)
    expect(r.avisos.some((a) => a.includes('borrador'))).toBe(true)
  })

  it('resta el IVA soportado deducible', () => {
    const r = calcularModelo303([factura()], [gasto()], { ejercicio: 2026, trimestre: 1 })
    expect(aEuros(r.totalDevengado)).toBe(12)
    expect(aEuros(r.cuotaDeducible)).toBe(40)
    expect(aEuros(r.resultado)).toBe(-28)
    expect(aEuros(r.aCompensar)).toBe(28)
    expect(r.aIngresar).toBe(0)
  })

  it('prorratea el IVA de un gasto de uso mixto', () => {
    const movil = gasto({
      id: 'g2',
      descripcion: 'Móvil',
      base: euros(100),
      tipoIva: 21,
      cuotaIva: euros(21),
      total: euros(121),
      porcentajeDeducibleIva: 50,
    })
    const r = calcularModelo303([], [movil], { ejercicio: 2026, trimestre: 1 })
    expect(aEuros(r.cuotaDeducible)).toBe(10.5)
  })

  it('avisa de gastos sin NIF de proveedor', () => {
    const r = calcularModelo303([], [gasto({ nifProveedor: undefined })], {
      ejercicio: 2026,
      trimestre: 1,
    })
    expect(r.avisos.some((a) => a.includes('NIF'))).toBe(true)
  })

  it('separa el recargo de equivalencia del IVA', () => {
    const totales = calcularTotales([linea({ cantidad: 10 })], {
      regimenCliente: 'recargo_equivalencia',
    })
    const r = calcularModelo303([factura({ ...totales })], [], { ejercicio: 2026, trimestre: 1 })
    expect(aEuros(r.recargoEquivalencia[0].cuota)).toBe(1.5)
    expect(aEuros(r.totalDevengado)).toBe(13.5)
  })
})

describe('modelo 130', () => {
  it('acumula desde enero, no solo el trimestre', () => {
    const facturas = [
      factura({ id: '1', fecha: '2026-02-15' }),
      factura({ id: '2', fecha: '2026-05-15' }),
    ]
    const t2 = calcularModelo130(facturas, [], { ejercicio: 2026, trimestre: 2 })
    expect(aEuros(t2.ingresos)).toBe(600)
  })

  it('calcula el 20% del rendimiento neto', () => {
    const r = calcularModelo130([factura()], [gasto({ base: euros(100), cuotaIva: euros(4) })], {
      ejercicio: 2026,
      trimestre: 1,
    })
    expect(aEuros(r.rendimientoNeto)).toBe(200)
    expect(aEuros(r.pagoFraccionado)).toBe(40)
  })

  it('descuenta pagos de trimestres anteriores', () => {
    const r = calcularModelo130([factura()], [], { ejercicio: 2026, trimestre: 2 }, {
      pagosAnteriores: euros(20),
    })
    expect(aEuros(r.pagoFraccionado)).toBe(60)
    expect(aEuros(r.aIngresar)).toBe(40)
  })

  it('nunca sale a devolver', () => {
    const r = calcularModelo130([factura()], [gasto({ base: euros(5000) })], {
      ejercicio: 2026,
      trimestre: 1,
    })
    expect(r.aIngresar).toBe(0)
  })

  it('aplica la minoración por rendimientos bajos', () => {
    expect(aEuros(minoracionPorRendimiento(euros(8000)))).toBe(100)
    expect(aEuros(minoracionPorRendimiento(euros(9500)))).toBe(75)
    expect(aEuros(minoracionPorRendimiento(euros(10500)))).toBe(50)
    expect(aEuros(minoracionPorRendimiento(euros(11500)))).toBe(25)
    expect(minoracionPorRendimiento(euros(20000))).toBe(0)
  })
})

describe('NIF', () => {
  it('valida DNI, NIE y CIF correctos', () => {
    expect(validarNif('12345678Z')).toBe(true)
    expect(validarNif('X1234567L')).toBe(true)
    expect(validarNif('B12345674')).toBe(true)
  })

  it('rechaza letras de control incorrectas', () => {
    expect(validarNif('12345678A')).toBe(false)
    expect(validarNif('B12345678')).toBe(false)
  })

  it('detecta el tipo', () => {
    expect(tipoIdentificador('12345678Z')).toBe('dni')
    expect(tipoIdentificador('X1234567L')).toBe('nie')
    expect(tipoIdentificador('B12345674')).toBe('cif')
    expect(tipoIdentificador('hola')).toBe('desconocido')
  })
})

describe('verifactu', () => {
  const registro = (over: Partial<RegistroFacturacion> = {}): RegistroFacturacion => ({
    tipoRegistro: 'alta',
    idEmisor: '12345678Z',
    numSerieFactura: 'A/2026/0001',
    fechaExpedicion: '15-02-2026',
    tipoFactura: 'F1',
    cuotaTotal: euros(12),
    importeTotal: euros(312),
    huellaAnterior: '',
    fechaHoraGeneracion: '2026-02-15T10:00:00+01:00',
    ...over,
  })

  it('construye la cadena en el orden que exige la AEAT', () => {
    expect(construirCadenaHuella(registro())).toBe(
      'IDEmisorFactura=12345678Z&NumSerieFactura=A/2026/0001&FechaExpedicionFactura=15-02-2026' +
        '&TipoFactura=F1&CuotaTotal=12.00&ImporteTotal=312.00&Huella=' +
        '&FechaHoraHusoGenRegistro=2026-02-15T10:00:00+01:00'
    )
  })

  it('produce SHA-256 en hexadecimal mayúsculas', async () => {
    const h = await calcularHuella(registro())
    expect(h).toMatch(/^[0-9A-F]{64}$/)
  })

  it('es determinista', async () => {
    expect(await calcularHuella(registro())).toBe(await calcularHuella(registro()))
  })

  it('cambia si cambia el importe', async () => {
    const a = await calcularHuella(registro())
    const b = await calcularHuella(registro({ importeTotal: euros(312.01) }))
    expect(a).not.toBe(b)
  })

  it('detecta una factura manipulada en mitad de la cadena', async () => {
    const r1 = registro()
    const h1 = await calcularHuella(r1)
    const r2 = registro({ numSerieFactura: 'A/2026/0002', huellaAnterior: h1 })
    const h2 = await calcularHuella(r2)

    const cadena = [
      { ...r1, huella: h1 },
      { ...r2, huella: h2 },
    ]
    expect(await verificarCadena(cadena)).toBeNull()

    cadena[0].importeTotal = euros(999)
    expect(await verificarCadena(cadena)).toBe(0)
  })
})

describe('periodos', () => {
  it('asigna trimestre por mes', () => {
    expect(trimestreDe('2026-01-15')).toBe(1)
    expect(trimestreDe('2026-03-31')).toBe(1)
    expect(trimestreDe('2026-04-01')).toBe(2)
    expect(trimestreDe('2026-12-31')).toBe(4)
  })

  it('el 4T vence el 30 de enero del año siguiente', () => {
    expect(plazoPresentacion({ ejercicio: 2026, trimestre: 4 }, '303')).toEqual({
      desde: '2027-01-01',
      hasta: '2027-01-30',
    })
    expect(plazoPresentacion({ ejercicio: 2026, trimestre: 1 }, '303')).toEqual({
      desde: '2026-04-01',
      hasta: '2026-04-20',
    })
  })
})
