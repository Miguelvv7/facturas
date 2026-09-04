-- Esquema inicial. Pégalo entero en Supabase → SQL Editor → New query → Run.
--
-- Todos los importes se guardan en céntimos (bigint), nunca en decimales de
-- coma flotante: una factura que no cuadra al céntimo es una factura que
-- Hacienda puede rechazar.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Datos fiscales del negocio. Uno por usuario.
-- ---------------------------------------------------------------------------
create table negocio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  nombre_completo text not null,
  nombre_comercial text,
  nif text not null,
  direccion text not null default '',
  codigo_postal text not null default '',
  ciudad text not null default '',
  provincia text not null default '',
  telefono text,
  email text,
  epigrafe_iae text,
  -- Solo determina qué categorías se sugieren al crear productos.
  sector text not null default 'general'
    check (sector in ('aceite', 'alimentacion', 'servicios', 'general')),
  regimen_irpf text not null default 'estimacion_directa_simplificada'
    check (regimen_irpf in ('estimacion_directa_simplificada', 'estimacion_directa_normal')),
  aplica_retencion boolean not null default false,
  tipo_retencion numeric(5,2) not null default 0,
  fecha_alta date,
  cuota_autonomos bigint,
  rendimiento_neto_anterior bigint,
  iban text,
  -- Logo, color, serie y textos de la factura.
  factura jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  -- Sin NIF no se puede emitir factura completa, pero sí ticket a particular.
  nif text,
  regimen text not null default 'general'
    check (regimen in ('general', 'recargo_equivalencia', 'intracomunitario', 'exportacion')),
  email text,
  telefono text,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  pais text not null default 'ES',
  dias_pago integer not null default 0,
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index on clientes (user_id, nombre);

-- ---------------------------------------------------------------------------
-- Catálogo de productos
-- ---------------------------------------------------------------------------
create table productos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  referencia text,
  -- Etiqueta libre: la app sirve para vender aceite y para cualquier otra cosa.
  categoria text not null default '',
  categoria_aceite text check (categoria_aceite in ('aove', 'avo', 'oliva', 'orujo')),
  tipo_iva smallint not null default 21 check (tipo_iva in (0, 4, 10, 21)),
  precio_venta bigint not null,
  precio_coste bigint,
  litros numeric(10,3),
  stock numeric(12,3) not null default 0,
  stock_minimo numeric(12,3),
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index on productos (user_id, activo);

-- ---------------------------------------------------------------------------
-- Lotes: trazabilidad alimentaria (Reglamento CE 178/2002, art. 18)
-- ---------------------------------------------------------------------------
create table lotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  codigo text not null,
  fecha_envasado date not null,
  fecha_consumo_preferente date not null,
  origen text not null default '',
  cantidad_inicial numeric(12,3) not null default 0,
  cantidad_actual numeric(12,3) not null default 0,
  acidez numeric(4,2),
  notas text,
  creado_en timestamptz not null default now(),
  unique (user_id, codigo)
);

-- ---------------------------------------------------------------------------
-- Facturas
-- ---------------------------------------------------------------------------
create table facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  serie text not null default 'A',
  numero integer not null default 0,
  numero_completo text not null default 'BORRADOR',
  tipo_factura text not null default 'F1'
    check (tipo_factura in ('F1','F2','F3','R1','R2','R3','R4','R5')),
  cliente_id uuid references clientes(id) on delete restrict,
  -- Fecha de expedición: la que manda a efectos de devengo.
  fecha date not null,
  fecha_vencimiento date not null,
  lineas jsonb not null default '[]'::jsonb,
  base_imponible bigint not null default 0,
  desglose jsonb not null default '[]'::jsonb,
  total_iva bigint not null default 0,
  total_recargo bigint not null default 0,
  tipo_retencion numeric(5,2) not null default 0,
  total_retencion bigint not null default 0,
  total bigint not null default 0,
  estado text not null default 'borrador'
    check (estado in ('borrador','emitida','cobrada','vencida','anulada')),
  fecha_cobro date,
  rectifica_a uuid references facturas(id),
  notas text,
  -- Verifactu
  huella text not null default '',
  huella_anterior text not null default '',
  fecha_hora_generacion text not null default '',
  creado_en timestamptz not null default now()
);
create index on facturas (user_id, fecha desc);
create index on facturas (user_id, estado);

-- La numeración debe ser correlativa y sin huecos dentro de cada serie.
-- Los borradores llevan numero = 0, así que se excluyen del índice único.
create unique index facturas_serie_numero
  on facturas (user_id, serie, numero)
  where estado <> 'borrador';

-- ---------------------------------------------------------------------------
-- Inalterabilidad (RD 1007/2023): una factura emitida no se toca.
--
-- Es una regla POR CAMPO, no por estado: emitir una factura y marcarla como
-- cobrada son actualizaciones legítimas sobre una factura que ya no es
-- borrador. Lo que no puede cambiar nunca son los importes y la identidad.
-- Debe coincidir con CAMPOS_CONGELADOS en lib/domain/factura-inalterable.ts.
-- ---------------------------------------------------------------------------
create or replace function impedir_modificar_factura_emitida()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'borrador' then
    return new;
  end if;

  if new.base_imponible  is distinct from old.base_imponible
  or new.total           is distinct from old.total
  or new.total_iva       is distinct from old.total_iva
  or new.total_recargo   is distinct from old.total_recargo
  or new.total_retencion is distinct from old.total_retencion
  or new.desglose        is distinct from old.desglose
  or new.lineas          is distinct from old.lineas
  or new.fecha           is distinct from old.fecha
  or new.numero          is distinct from old.numero
  or new.serie           is distinct from old.serie
  or new.numero_completo is distinct from old.numero_completo
  or new.cliente_id      is distinct from old.cliente_id
  or new.huella          is distinct from old.huella
  or new.huella_anterior is distinct from old.huella_anterior then
    raise exception
      'Una factura emitida no se puede modificar. Emite una factura rectificativa.';
  end if;

  return new;
end;
$$;

create trigger factura_inalterable
  before update on facturas
  for each row execute function impedir_modificar_factura_emitida();

create or replace function impedir_borrar_factura_emitida()
returns trigger
language plpgsql
as $$
begin
  if old.estado <> 'borrador' then
    raise exception
      'Una factura emitida no se puede borrar. Anúlala mediante una rectificativa.';
  end if;
  return old;
end;
$$;

create trigger factura_no_borrable
  before delete on facturas
  for each row execute function impedir_borrar_factura_emitida();

-- ---------------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------------
create table gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descripcion text not null,
  proveedor text not null default '',
  nif_proveedor text,
  numero_factura text,
  fecha date not null,
  categoria text not null default 'otros',
  base bigint not null default 0,
  tipo_iva smallint not null default 21 check (tipo_iva in (0, 4, 10, 21)),
  cuota_iva bigint not null default 0,
  total bigint not null default 0,
  -- Un gasto de móvil de uso mixto no se deduce al 100%. Separado del importe
  -- para no falsear el modelo 303.
  porcentaje_deducible_iva numeric(5,2) not null default 100,
  porcentaje_deducible_irpf numeric(5,2) not null default 100,
  deducible_irpf boolean not null default true,
  justificante_url text,
  notas text,
  creado_en timestamptz not null default now()
);
create index on gastos (user_id, fecha desc);

-- ---------------------------------------------------------------------------
-- Modelos ya presentados. El 130 es acumulativo: necesita saber qué se pagó.
-- ---------------------------------------------------------------------------
create table presentaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modelo text not null check (modelo in ('303','130','390','349','347','111','115')),
  ejercicio integer not null,
  trimestre smallint check (trimestre between 1 and 4),
  importe bigint not null default 0,
  fecha_presentacion date,
  justificante_url text,
  notas text,
  creado_en timestamptz not null default now(),
  unique (user_id, modelo, ejercicio, trimestre)
);

-- ---------------------------------------------------------------------------
-- Registro de eventos del reglamento antifraude. Solo se inserta.
-- ---------------------------------------------------------------------------
create table eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  detalle text,
  fecha_hora text not null,
  creado_en timestamptz not null default now()
);
create index on eventos (user_id, creado_en desc);

create rule eventos_sin_update as on update to eventos do instead nothing;
create rule eventos_sin_delete as on delete to eventos do instead nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario ve solo lo suyo.
-- Sin esto, la clave pública del navegador daría acceso a todo.
-- ---------------------------------------------------------------------------
alter table negocio        enable row level security;
alter table clientes       enable row level security;
alter table productos      enable row level security;
alter table lotes          enable row level security;
alter table facturas       enable row level security;
alter table gastos         enable row level security;
alter table presentaciones enable row level security;
alter table eventos        enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'negocio','clientes','productos','lotes','facturas','gastos','presentaciones','eventos'
  ] loop
    execute format(
      'create policy %I_propietario on %I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- El user_id se rellena solo: así el cliente no puede escribir el de otro.
create or replace function fijar_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'negocio','clientes','productos','lotes','facturas','gastos','presentaciones','eventos'
  ] loop
    execute format(
      'create trigger %I_user_id before insert on %I
         for each row execute function fijar_user_id()', t, t);
  end loop;
end $$;
