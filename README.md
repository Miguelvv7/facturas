# Facturas

Control de ventas y facturación para autónomos en España. Hecho para que alguien
que acaba de darse de alta pueda facturar bien sin saber nada de fiscalidad.

La idea de fondo: **la complejidad la come el código, no el usuario.** La app
calcula el IVA, el recargo de equivalencia y lo que hay que apartar para
Hacienda, pero en pantalla solo aparecen frases como «aparta 412 € antes del 20
de octubre». Nunca se ve la palabra «modelo 303».

## Puesta en marcha

```bash
npm install
npm run dev
```

Sin configuración, los datos se guardan en el navegador y se puede trastear sin
cuenta. Para usarla de verdad hace falta un proyecto de Supabase:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Y ejecutar `supabase/migrations/0001_esquema_inicial.sql` en el SQL Editor. Las
cuentas se crean a mano desde Authentication → Users, con *Auto Confirm User*
marcado.

```bash
npm test          # 65 tests del motor fiscal y de negocio
npx tsc --noEmit  # comprobación de tipos
npm run build
```

## Cómo está montado

```
lib/domain/      Reglas de negocio puras, sin dependencias. El corazón.
lib/servicios/   Operaciones: emitir factura, análisis, datos de ejemplo.
lib/data/        Persistencia tras una interfaz común (navegador o Supabase).
lib/pdf/         Generación del PDF de la factura.
app/ components/ Interfaz.
```

La interfaz habla siempre con `Repositorio`, nunca con Supabase ni con
`localStorage` directamente. Por eso se puede cambiar el almacenamiento sin
tocar una sola pantalla.

## Decisiones que conviene conocer

**El dinero son céntimos enteros.** Nunca decimales de coma flotante. Una
factura que no cuadra al céntimo es una factura que Hacienda puede rechazar.

**Las fechas solo se tocan en `lib/domain/fechas.ts`.** `new Date(iso).toISOString()`
construye la fecha a medianoche local y la imprime en UTC: en España el día
retrocede uno, y un vencimiento a 30 días acababa cayendo a 29.

**El IVA se agrupa por tipo, no se suma línea a línea.** Con tres tipos
conviviendo (4 % aceite de oliva, 10 % semillas, 21 % portes) las diferencias de
redondeo se acumulan.

**Se declara por devengo.** Cuenta la fecha de expedición de la factura, no la
de cobro. Una factura emitida en marzo y cobrada en julio va al primer
trimestre.

**Una factura emitida no se modifica ni se borra.** La regla se enuncia una vez
en `lib/domain/factura-inalterable.ts` y la aplican tanto el repositorio como un
trigger de Postgres, campo por campo. Para corregir hay que emitir una
rectificativa.

**Verifactu desde el primer día.** El encadenado SHA-256 de los registros de
facturación (RD 1007/2023) está implementado aunque no sea obligatorio para
autónomos hasta julio de 2027: la cadena de huellas no se puede reconstruir
hacia atrás. El envío a la AEAT queda pendiente.

**El sector solo sugiere.** Hay categorías preparadas para aceite, alimentación
y servicios, pero el tipo de IVA lo elige siempre el usuario. La app avisa
cuando algo contradice la ley, no lo impide.

## Estado

Funciona: alta de negocio, clientes, productos, gastos, emisión de facturas con
numeración correlativa y huella encadenada, PDF personalizable con logo y color,
calendario de ventas, informes de margen y clientes, y cuentas separadas por
usuario con RLS.

Pendiente: envío de registros a la AEAT, lotes y trazabilidad alimentaria,
exportación a Excel y recordatorios de cobro.
