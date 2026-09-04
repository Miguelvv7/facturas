/**
 * Validación de identificadores fiscales españoles.
 * Una factura con un NIF mal escrito es una factura que el cliente no puede
 * deducir, y que aparece descuadrada en el modelo 347.
 */

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

export type TipoIdentificador = 'dni' | 'nie' | 'cif' | 'desconocido'

const normalizar = (valor: string) => valor.toUpperCase().replace(/[\s-]/g, '')

export function tipoIdentificador(valor: string): TipoIdentificador {
  const v = normalizar(valor)
  if (/^\d{8}[A-Z]$/.test(v)) return 'dni'
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) return 'nie'
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) return 'cif'
  return 'desconocido'
}

const letraDni = (numero: number) => LETRAS_DNI[numero % 23]

function validarDni(v: string): boolean {
  return letraDni(Number(v.slice(0, 8))) === v[8]
}

function validarNie(v: string): boolean {
  const prefijo = { X: '0', Y: '1', Z: '2' }[v[0] as 'X' | 'Y' | 'Z']
  return letraDni(Number(prefijo + v.slice(1, 8))) === v[8]
}

function validarCif(v: string): boolean {
  const digitos = v.slice(1, 8)
  let pares = 0
  let impares = 0

  for (let i = 0; i < digitos.length; i++) {
    const n = Number(digitos[i])
    // Posiciones impares (1ª, 3ª...) se duplican y se suman sus cifras.
    if (i % 2 === 0) {
      const doble = n * 2
      impares += doble > 9 ? doble - 9 : doble
    } else {
      pares += n
    }
  }

  const suma = pares + impares
  const digitoControl = (10 - (suma % 10)) % 10
  const control = v[8]

  // Algunas formas jurídicas llevan letra de control, otras número, y unas
  // pocas admiten cualquiera de las dos.
  const soloLetra = 'PQRSNW'.includes(v[0])
  const soloNumero = 'ABEH'.includes(v[0])

  if (soloLetra) return control === 'JABCDEFGHI'[digitoControl]
  if (soloNumero) return control === String(digitoControl)
  return control === String(digitoControl) || control === 'JABCDEFGHI'[digitoControl]
}

export function validarNif(valor: string): boolean {
  const v = normalizar(valor)
  switch (tipoIdentificador(v)) {
    case 'dni':
      return validarDni(v)
    case 'nie':
      return validarNie(v)
    case 'cif':
      return validarCif(v)
    default:
      return false
  }
}

/** Devuelve un mensaje de error, o null si el identificador es válido. */
export function errorNif(valor: string): string | null {
  const v = normalizar(valor)
  if (!v) return 'El NIF es obligatorio para emitir una factura completa.'
  if (tipoIdentificador(v) === 'desconocido') return 'El formato no corresponde a un DNI, NIE ni CIF.'
  if (!validarNif(v)) return 'La letra de control no es correcta. Revisa el número.'
  return null
}
