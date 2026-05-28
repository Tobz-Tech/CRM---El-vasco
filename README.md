# MP Cobranzas

App interna para detectar pagos que entran a una cuenta de Mercado Pago y asignarlos a clientes de un CRM propio. Pensada para un negocio de reparto familiar.

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Auth + Postgres) + Vercel**.

---

## Tabla de contenidos

1. [Qué hace la app](#qué-hace-la-app)
2. [Lo que necesitás antes de empezar](#lo-que-necesitás-antes-de-empezar)
3. [Paso 1 — Crear el proyecto en Supabase](#paso-1--crear-el-proyecto-en-supabase)
4. [Paso 2 — Correr la migración SQL](#paso-2--correr-la-migración-sql)
5. [Paso 3 — Crear los usuarios (vos y tu papá)](#paso-3--crear-los-usuarios-vos-y-tu-papá)
6. [Paso 4 — Configurar el proyecto local](#paso-4--configurar-el-proyecto-local)
7. [Paso 5 — Probar local con `npm run dev`](#paso-5--probar-local-con-npm-run-dev)
8. [Paso 6 — Deploy a Vercel](#paso-6--deploy-a-vercel)
9. [Paso 7 — Cron de sincronización (Vercel o Supabase)](#paso-7--cron-de-sincronización-vercel-o-supabase)
10. [Cómo funciona la sincronización por dentro](#cómo-funciona-la-sincronización-por-dentro)
11. [Tareas comunes](#tareas-comunes)
12. [Troubleshooting](#troubleshooting)
13. [Estructura del proyecto](#estructura-del-proyecto)

---

## Qué hace la app

Tres cosas:

1. **Sincroniza pagos de Mercado Pago** cada pocos minutos: pega contra la API de MP, trae los movimientos nuevos y los guarda en tu base de datos.
2. **CRM básico de clientes**: alta, edición, listado y búsqueda. Cada cliente tiene nombre, CUIT, teléfono, dirección, etc.
3. **Asignación de movimientos a clientes**: cada pago entrante puede asignarse a un cliente. Si el pagador tiene CUIT y matchea con un cliente existente, lo asigna automáticamente.

Tiene 4 pantallas: **Cobranzas**, **Clientes**, **Perfil del cliente** y **Configuración**.

---

## Lo que necesitás antes de empezar

- Node.js 20 o superior. Para chequear: `node -v`.
- Una cuenta gratis de [Supabase](https://supabase.com).
- Una cuenta gratis de [Vercel](https://vercel.com).
- El **Access Token de producción** de la cuenta de Mercado Pago que querés vigilar. Si ya lo tenés, perfecto. Si no, instrucciones más abajo en la sección "Obtener el Access Token de Mercado Pago".
- `git` para clonar este repo (opcional, si lo descomprimís a mano no hace falta).

> **Importante**: el Access Token tiene que ser de la **misma cuenta** donde llegan los pagos. Si tu papá tiene la cuenta y vos otra, el token lo genera él.

---

## Paso 1 — Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) e iniciá sesión.
2. Click en **New project**.
3. Datos:
   - **Name**: `mp-cobranzas` (o el que quieras).
   - **Database Password**: una contraseña fuerte. **Anotala** porque te puede servir después.
   - **Region**: la más cercana a Argentina (ej. *South America (São Paulo)*).
   - **Pricing plan**: Free está perfecto para empezar.
4. Esperá 1-2 minutos a que termine de crearse.

Una vez creado, **anotá** estos tres datos (los vas a usar al final). Los encontrás en **Project Settings → API**:

- `Project URL` → va a `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` → va a `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → va a `SUPABASE_SERVICE_ROLE_KEY` (¡es secreta, no la pongas en el frontend!)

---

## Paso 2 — Correr la migración SQL

La migración crea las tablas (`clientes`, `movimientos`, `config`, `sync_logs`), índices, triggers, RLS y un par de funciones.

1. En el dashboard de Supabase, andá a **SQL Editor** (ícono de consola a la izquierda).
2. Click en **New query**.
3. Abrí el archivo `supabase/migrations/20260528000000_initial_schema.sql` de este repo, copiá **todo** el contenido y pegalo en el editor.
4. Click en **Run** (botón verde abajo a la derecha, o `Ctrl+Enter`).
5. Tiene que decir "Success. No rows returned." o similar. Si tira error, copiá el error y pasámelo.

Para verificar, andá a **Table Editor** y deberían aparecer las tablas `clientes`, `movimientos`, `config` y `sync_logs`, y una vista `clientes_con_totales`.

---

## Paso 3 — Crear los usuarios (vos y tu papá)

La app **no tiene signup público**. Los usuarios los creás a mano desde Supabase.

1. En el dashboard de Supabase, andá a **Authentication → Users**.
2. Click en **Add user → Create new user**.
3. Marcá la opción **"Auto Confirm User"** (importante, si no quedan en pending).
4. Cargá email y contraseña.
5. Repetí para cada persona que vaya a usar la app.

> Si más adelante alguien se olvida la contraseña, podés mandarle un magic link desde la misma pantalla.

---

## Paso 4 — Configurar el proyecto local

```bash
# 1) Descomprimir / clonar el repo y entrar
cd mp-cobranzas

# 2) Instalar dependencias
npm install

# 3) Copiar el .env.example a .env.local y completar
cp .env.example .env.local
```

Abrí `.env.local` con un editor y completá:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co   # del paso 1
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...             # del paso 1
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...                 # del paso 1

MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxx                       # tu token de MP
MP_COLLECTOR_ID=                                         # opcional, se autodetecta

ENCRYPTION_KEY=...                                       # generala con: openssl rand -base64 32
CRON_SECRET=...                                          # generala con: openssl rand -base64 32
```

Para generar las claves aleatorias:

```bash
openssl rand -base64 32
```

(corré el comando dos veces, una para cada clave)

### Obtener el Access Token de Mercado Pago

(Si ya lo tenés, saltate esta sección.)

1. Entrá a [https://www.mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app) con la cuenta de tu papá.
2. Click en **Crear aplicación** (o usá una existente). Tipo: "Pagos online".
3. Una vez creada, andá a **Credenciales de producción** (no las de prueba).
4. Copiá el **Access Token** (empieza con `APP_USR-`).
5. **Importante**: ese token da acceso completo a la cuenta. Tratalo como una contraseña.

---

## Paso 5 — Probar local con `npm run dev`

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Te tira a `/login`.

1. Logueate con el usuario que creaste en el paso 3.
2. Te deja en `/cobranzas`. La primera vez está vacío.
3. Andá a **Configuración** y opcionalmente pegá el Access Token de MP ahí (queda encriptado en la DB). Si lo dejás vacío, usa el del `.env`.
4. Volvé a **Cobranzas** y dale **Sincronizar ahora**.
5. La primera sincronización trae los últimos **7 días** de pagos. Después solo trae los nuevos (con un solapamiento de 10 min para no perder ninguno).
6. Los movimientos entrantes aparecen marcados en naranja ("Sin asignar"). Apretá **Asignar** para vincularlos a un cliente.

> Si todavía no creaste clientes, podés crearlos desde la pantalla Clientes o directamente desde el modal de asignación (botón "Crear cliente nuevo").

---

## Paso 6 — Deploy a Vercel

### 6.1 Subir el código a GitHub (recomendado)

Si no tenés repo todavía:

```bash
git init
git add .
git commit -m "Primera versión"
gh repo create mp-cobranzas --private --source=. --remote=origin --push
# o equivalente desde la web de GitHub
```

### 6.2 Importar el repo en Vercel

1. Entrá a [vercel.com](https://vercel.com) y logueate (te recomiendo con GitHub para que vea tus repos automáticamente).
2. Click en **Add New → Project**.
3. Buscá tu repo `mp-cobranzas` y click en **Import**.
4. Vercel detecta solo que es Next.js. Dejá todo por defecto.
5. En **Environment Variables**, agregá las mismas que pusiste en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MP_ACCESS_TOKEN` (opcional si lo guardás vía pantalla Configuración)
   - `MP_COLLECTOR_ID` (opcional)
   - `ENCRYPTION_KEY` (¡la misma que en local! si la cambiás, no podés desencriptar el token guardado)
   - `CRON_SECRET`
6. Click en **Deploy**.

En 1-2 minutos te queda algo tipo `https://mp-cobranzas.vercel.app`.

> **Pro tip**: agregá tu dominio propio en *Project → Settings → Domains* si querés.

### 6.3 Configurar las URLs de redirect en Supabase

1. En Supabase, andá a **Authentication → URL Configuration**.
2. En **Site URL** poné: `https://tu-dominio-vercel.vercel.app` (o tu dominio).
3. En **Redirect URLs** agregá: `https://tu-dominio-vercel.vercel.app/**`.
4. Guardá.

---

## Paso 7 — Cron de sincronización (Vercel o Supabase)

Tenés **dos opciones** para que la sincronización corra sola. Elegí UNA.

### Opción A — Cron de Vercel (más fácil)

Ya viene configurado en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/sync", "schedule": "*/5 * * * *" }
  ]
}
```

Esto hace que Vercel llame a `/api/sync` cada 5 minutos. Funciona automáticamente apenas hacés deploy. **No hace falta tocar nada más.**

> **Nota de Vercel Free**: en el plan Free, los crons corren máximo cada hora o más espaciado dependiendo del momento. Si querés realmente cada 5 minutos, usá la Opción B (Supabase) o pasate al plan Pro.

### Opción B — Edge Function de Supabase + pg_cron (gratis y cada 5 min sí o sí)

Esta opción te da control fino sobre la frecuencia y es gratis.

#### B.1 Instalar el CLI de Supabase

```bash
npm install -g supabase
supabase login
```

#### B.2 Linkear este proyecto al de Supabase

```bash
cd mp-cobranzas
supabase link --project-ref <project-ref-de-supabase>
```

El `project-ref` lo sacás de la URL del dashboard de Supabase (`https://supabase.com/dashboard/project/<aca>`).

#### B.3 Setear los secrets de la Edge Function

```bash
supabase secrets set ENCRYPTION_KEY="la-misma-encryption-key-de-tu-env"
# Si vas a usar el token de .env en vez del de la pantalla Configuración:
supabase secrets set MP_ACCESS_TOKEN="APP_USR-xxxxxxxxxx"
```

#### B.4 Deployar la Edge Function

```bash
supabase functions deploy sync-mp --no-verify-jwt
```

> `--no-verify-jwt` permite que el cron llame a la función sin un JWT. La función se protege a sí misma porque solo lee config interno.

Probá la función a mano:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-mp \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

Debería devolver `{"ok": true, "movimientos_nuevos": N, ...}`.

#### B.5 Configurar pg_cron para que la llame cada 5 minutos

En el **SQL Editor** de Supabase, corré:

```sql
-- Habilitar extensiones de cron
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Programar el job cada 5 minutos
select cron.schedule(
  'sync-mp-cada-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<TU-PROJECT-REF>.supabase.co/functions/v1/sync-mp',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<SUPABASE_ANON_KEY>')
  );
  $$
);
```

Reemplazá `<TU-PROJECT-REF>` y `<SUPABASE_ANON_KEY>`.

Para ver los jobs programados:

```sql
select * from cron.job;
```

Para borrar el job (si lo querés sacar):

```sql
select cron.unschedule('sync-mp-cada-5-min');
```

> Si elegís la Opción B, **borrá** o comentá el `crons` de `vercel.json` para no duplicar.

---

## Cómo funciona la sincronización por dentro

1. Lee `config.ultima_sincronizacion`.
2. Pide a la API de MP los pagos entre `(ultima_sincronizacion - 10min)` y `ahora`. Si nunca corrió, agarra los últimos 7 días.
3. Pagina hasta tener todos los resultados.
4. **Filtra**:
   - Tipo `partition_transfer` (movimientos internos entre "sobres" de la misma cuenta): se descartan.
   - `collector_id` distinto al de la cuenta del negocio: se descartan.
5. **Upsert** por `mp_payment_id` (único), así nunca duplica.
6. Para movimientos **nuevos entrantes** que tengan `pagador_doc_numero` y matcheen con un cliente existente: los asigna automáticamente y marca `asignado_automaticamente=true`. Para movimientos ya existentes, **nunca** pisa la asignación manual del usuario.
7. Actualiza `config.ultima_sincronizacion` al final.
8. Loggea todo en `sync_logs`.

El solapamiento de 10 minutos asegura que si un movimiento aparece en MP con un poco de delay, no se nos escape. La unicidad por `mp_payment_id` hace que el solapamiento no genere duplicados.

---

## Tareas comunes

### Sincronizar a mano
- Pantalla **Cobranzas** → botón **Sincronizar ahora**.
- O `curl -X POST https://tu-dominio.vercel.app/api/sync -H "Authorization: Bearer $CRON_SECRET"`.

### Cambiar el token de MP
- Pantalla **Configuración** → pegar nuevo token → Guardar. Se valida contra MP antes de guardarse.

### Crear un cliente nuevo
- Pantalla **Clientes** → **Nuevo cliente**.
- O directamente desde el modal **Asignar** de un movimiento (con datos pre-cargados del pagador).

### Ver historial de un cliente
- Pantalla **Clientes** → click en el nombre.

### Desasignar un movimiento
- Modal **Asignar** del movimiento → botón **Desasignar**.
- O desde el perfil del cliente, en cada fila del historial.

### Ver logs de sincronización
- Pantalla **Configuración** → tabla "Últimas sincronizaciones".

---

## Troubleshooting

**"No autenticado" al guardar cosas**
La sesión expiró. Hacé refresh, te tira a login, volvés a entrar.

**"Token rechazado por Mercado Pago (HTTP 401)"**
El token está mal o expiró. Generá uno nuevo desde el panel de MP y cargalo.

**El cron de Vercel no corre cada 5 min**
En el plan Free de Vercel los crons son menos frecuentes. Usá la Opción B (Supabase) si necesitás precisión.

**"No pude desencriptar el token guardado"**
Cambiaste `ENCRYPTION_KEY` después de haber guardado el token. Solución: andá a Configuración y volvé a pegar el token, así se re-encripta con la clave nueva.

**Veo pagos duplicados**
No debería pasar (unicidad por `mp_payment_id`). Si pasa, mandame el caso.

**Sincronizo y no aparecen pagos pero sé que entraron**
- Chequeá que `collector_id` de la pantalla Configuración coincida con el de tu cuenta de MP.
- Chequeá la tabla `sync_logs` por errores.
- Probá pegar este curl con tu token para ver qué devuelve MP directamente:
  ```bash
  curl "https://api.mercadopago.com/v1/payments/search?range=date_created&begin_date=2026-05-01T00:00:00Z&end_date=2026-05-28T23:59:59Z" \
    -H "Authorization: Bearer APP_USR-..."
  ```

**Quiero borrar TODOS los movimientos y volver a sincronizar**
En el SQL Editor:
```sql
delete from movimientos;
update config set ultima_sincronizacion = null where singleton = true;
```
Después dale Sincronizar ahora.

---

## Estructura del proyecto

```
mp-cobranzas/
├── README.md
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── vercel.json                  # Cron de Vercel (Opción A)
├── middleware.ts                # Protección de rutas con Supabase Auth
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx             # Redirige a /cobranzas
│   │   ├── login/page.tsx       # Login con email + password
│   │   ├── auth/signout/route.ts
│   │   ├── api/
│   │   │   ├── sync/route.ts    # POST /api/sync — sincroniza con MP
│   │   │   └── clientes/route.ts # POST /api/clientes — crea cliente desde modal
│   │   └── (dashboard)/         # Layout con sidebar
│   │       ├── layout.tsx
│   │       ├── cobranzas/       # Lista de movimientos + asignación
│   │       ├── clientes/        # Lista, alta, perfil
│   │       └── configuracion/   # Token MP, frecuencia, logs
│   ├── components/
│   │   ├── ui/                  # Componentes base (shadcn-style)
│   │   ├── sidebar.tsx
│   │   ├── cliente-form.tsx
│   │   ├── asignar-cliente-modal.tsx
│   │   └── desasignar-boton.tsx
│   ├── lib/
│   │   ├── utils.ts             # Formateo, helpers
│   │   ├── encryption.ts        # AES-256-GCM para el token de MP
│   │   ├── mercadopago.ts       # Cliente de la API de MP
│   │   ├── mp-sync.ts           # Lógica de sincronización
│   │   ├── supabase/
│   │   │   ├── client.ts        # Cliente browser
│   │   │   ├── server.ts        # Cliente servidor + admin
│   │   │   └── middleware.ts    # Refresco de sesión
│   │   └── actions/             # Server Actions
│   │       ├── clientes.ts
│   │       ├── movimientos.ts
│   │       ├── config.ts
│   │       └── sync.ts
│   └── types/database.ts        # Tipos TS del schema
└── supabase/
    ├── migrations/
    │   └── 20260528000000_initial_schema.sql
    └── functions/sync-mp/       # Edge Function (Opción B)
        ├── index.ts
        ├── deno.json
        └── .env.example
```

---

## ¿Algo no anda o querés agregar algo?

Anotá lo que sea (qué hiciste, qué error te dio, captura si podés) y pasámelo. Lo iteramos.
