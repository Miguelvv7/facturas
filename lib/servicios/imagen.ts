/**
 * Preparación del logo para la factura.
 *
 * Se reescala antes de guardarlo: una foto de móvil son varios megas, y el
 * logo va incrustado en cada PDF y guardado con los datos del negocio.
 */

const LADO_MAXIMO = 400

export async function prepararLogo(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Eso no es una imagen. Sube un PNG o un JPG.')
  }

  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se ha podido leer la imagen.'))
      el.src = url
    })

    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
    const ancho = Math.round(img.width * escala)
    const alto = Math.round(img.height * escala)

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto

    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('No se ha podido procesar la imagen.')

    // Fondo blanco: un PNG transparente se vería negro sobre el PDF.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)

    return lienzo.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Proporción del logo, para colocarlo en el PDF sin deformarlo. */
export function medirLogo(dataUrl: string): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ ancho: img.width, alto: img.height })
    img.onerror = () => resolve({ ancho: 1, alto: 1 })
    img.src = dataUrl
  })
}
