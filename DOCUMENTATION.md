# 📚 GEOFAL CRM - Documentación Técnica Completa

> **Última actualización:** 24 de Enero de 2026  
> **Versión:** 2.0.0  
> **Autor:** Equipo de Desarrollo GEOFAL

---

## 📋 Tabla de Contenidos

1. [Visión General del Sistema](#-visión-general-del-sistema)
2. [Arquitectura](#-arquitectura)
3. [Repositorios y Estructura](#-repositorios-y-estructura)
4. [API Backend (api-geofal-crm)](#-api-backend-api-geofal-crm)
5. [CRM Frontend (crm-geofal)](#-crm-frontend-crm-geofal)
6. [Cotizador Web (cotizador-web)](#-cotizador-web)
7. [Base de Datos](#-base-de-datos)
8. [Autenticación y Seguridad](#-autenticación-y-seguridad)
9. [Despliegue](#-despliegue)
10. [Guía de Desarrollo](#-guía-de-desarrollo)
11. [Troubleshooting](#-troubleshooting)

---

## 🎯 Visión General del Sistema

GEOFAL CRM es un sistema de gestión de relaciones con clientes especializado para laboratorios de ensayos geotécnicos. Permite:

- **Gestión de Clientes**: CRUD completo con soft-delete, seguimiento de estados
- **Gestión de Proyectos**: Pipeline de ventas, seguimiento de cotizaciones
- **Generación de Cotizaciones**: Exportación a XLSX con plantillas personalizadas
- **Auditoría**: Registro de todas las acciones del sistema
- **Gestión de Usuarios**: Roles (admin, vendor, manager)

### Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend CRM | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Cotizador Web | Vite, React 18, TypeScript, Tailwind CSS |
| API Backend | FastAPI (Python 3.11), psycopg2, openpyxl |
| Base de Datos | PostgreSQL 15 (Supabase) |
| Storage | Supabase Storage |
| Autenticación | Supabase Auth |
| Despliegue | Coolify (Docker) |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIOS                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   crm-geofal  │   │ cotizador-web │   │  API Externa  │
│   (Next.js)   │   │    (Vite)     │   │   (Futura)    │
│   :3000       │   │    :5173      │   │               │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   api-geofal-crm      │
                │      (FastAPI)        │
                │       :8000           │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   PostgreSQL  │   │   Supabase    │   │   Supabase    │
│   (Database)  │   │    Auth       │   │   Storage     │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Flujo de Datos

1. **Login**: Usuario → CRM → Supabase Auth → JWT → CRM (sesión)
2. **Crear Cotización**: CRM → API Backend → Genera XLSX → Supabase Storage + DB
3. **Descargar Cotización**: CRM → Supabase Storage (via object_key)

---

## 📁 Repositorios y Estructura

### Repositorios GitHub

| Repositorio | URL | Descripción |
|-------------|-----|-------------|
| crm-geofal | `keviskibidi33-png/crmgeofal-next-new.git` | Frontend Next.js principal |
| api-geofal-crm | `keviskibidi33-png/api-geofal-crm.git` | API de cotizaciones FastAPI |
| cotizador-web | (submodule) | Constructor de cotizaciones standalone |

### Estructura Local Unificada

```
crmnew/
├── api-geofal-crm/          # API Backend Python
│   ├── app/
│   │   ├── main.py          # Endpoints FastAPI
│   │   ├── database.py      # Conexión SQLAlchemy
│   │   ├── xlsx_direct.py   # Exportador XLSX legacy
│   │   └── xlsx_direct_v2.py # Exportador XLSX XML
│   ├── cotizaciones/        # Archivos generados (local)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── crm-geofal/              # Frontend Next.js
│   ├── app/
│   │   ├── page.tsx         # Dashboard principal
│   │   ├── layout.tsx       # Root layout
│   │   ├── login/           # Página de login
│   │   ├── dashboard/       # (reservado)
│   │   └── actions/         # Server Actions
│   │       ├── auth-actions.ts
│   │       ├── audit-actions.ts
│   │       └── delete-actions.ts
│   ├── components/
│   │   ├── dashboard/       # Módulos del CRM
│   │   │   ├── clientes-module.tsx
│   │   │   ├── proyectos-module.tsx
│   │   │   ├── cotizadora-module.tsx
│   │   │   ├── usuarios-module.tsx
│   │   │   ├── auditoria-module.tsx
│   │   │   └── configuracion-module.tsx
│   │   └── ui/              # shadcn components
│   ├── hooks/
│   │   ├── use-auth.ts      # Hook de autenticación
│   │   ├── use-toast.ts
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   └── utils.ts
│   └── package.json
│
├── cotizador-web/           # Cotizador Standalone
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── QuoteBuilderPage.tsx
│   │   │   └── QuotesListPage.tsx
│   │   ├── components/ui/
│   │   └── data/
│   │       └── ensayos-data.ts
│   └── package.json
│
├── migrations/              # SQL Migrations
│   ├── 002_contactos_table.sql
│   └── 003_add_object_key_to_cotizaciones.sql
│
├── Ensayos/                 # CSVs de catálogo de ensayos
│   ├── CEMENTO.csv
│   ├── ENSAYO AGREGADO.csv
│   └── ...
│
└── db_schema.txt            # Esquema de referencia
```

---

## 🔌 API Backend (api-geofal-crm)

### Configuración

Variables de entorno requeridas:

```env
# Base de datos PostgreSQL
QUOTES_DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# CORS
QUOTES_CORS_ORIGINS=https://crm.geofal.com.pe,http://localhost:3000

# Opcional
QUOTES_DISABLE_DB=false
```

### Endpoints

#### 📊 Health & Debug

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Health check básico |
| GET | `/health` | Estado del servicio |
| GET | `/debug-db` | Diagnóstico de conexión DB |

#### 📝 Cotizaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/export` | Genera y exporta cotización XLSX |
| POST | `/export/xlsx` | Alias de `/export` |
| GET | `/quotes` | Lista cotizaciones |
| GET | `/quotes/{id}/download` | Descarga archivo por ID |
| DELETE | `/quotes/{id}` | Elimina cotización |
| POST | `/quote/next-number` | Obtiene siguiente número secuencial |

#### 👥 Clientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/clientes` | Lista clientes (soporta `?search=`) |
| POST | `/clientes` | Crea nuevo cliente |

#### 📁 Proyectos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/proyectos` | Lista proyectos (soporta `?cliente_id=` y `?search=`) |
| POST | `/proyectos` | Crea nuevo proyecto |

#### 👤 Usuario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/user/me` | Obtiene perfil del usuario autenticado |

### Modelo de Request: Exportar Cotización

```typescript
interface QuoteExportRequest {
  cotizacion_numero?: string;      // Auto-generado si no se provee
  fecha_emision?: string;          // YYYY-MM-DD
  fecha_solicitud?: string;
  cliente?: string;
  ruc?: string;
  contacto?: string;
  telefono_contacto?: string;
  correo?: string;
  proyecto?: string;
  ubicacion?: string;
  personal_comercial?: string;
  telefono_comercial?: string;
  include_igv: boolean;            // Default: true
  igv_rate: number;                // Default: 0.18
  items: QuoteItem[];
  template_id?: string;            // V1-V8
  user_id?: string;
  proyecto_id?: string;
}

interface QuoteItem {
  codigo: string;
  descripcion: string;
  norma?: string;
  acreditado?: string;             // "SI" | "NO"
  costo_unitario: number;
  cantidad: number;
}
```

### Plantillas de Cotización

| ID | Nombre | Uso |
|----|--------|-----|
| V1 | Muestra de Suelo y Agregado | Default |
| V2 | Probetas | Ensayos de concreto |
| V3 | Densidad de Campo y Muestreo | Estudios de suelo |
| V4 | Extracción de Diamantina | Concreto existente |
| V5 | Diamantina para Pases | Instalaciones |
| V6 | Albañilería | Materiales de construcción |
| V7 | Viga Beckelman | Pavimentos |
| V8 | Control de Calidad de Concreto | QC en obra |

### Flujo de Generación de Cotización

```
1. POST /export recibe payload
2. _export_xlsx() carga plantilla y genera XLSX via XML
3. _save_quote_to_folder() guarda copia local
4. _upload_to_supabase_storage() sube a bucket "cotizaciones"
5. _register_quote_in_db() inserta/actualiza en tabla cotizaciones
6. Response: archivo XLSX binario
```

---

## 💻 CRM Frontend (crm-geofal)

### Módulos Principales

#### 1. Clientes (`clientes-module.tsx`)

**Funcionalidades:**
- Vista grid/lista configurable
- Búsqueda por nombre, empresa, RUC, email
- Filtrado por estado (activo, prospecto, inactivo)
- Paginación persistente (localStorage)
- CRUD completo con soft-delete
- Gestión de contactos por cliente
- Estadísticas: cotizaciones, proyectos, valor total

**Estructura de datos:**
```typescript
interface Client {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ruc?: string;
  direccion?: string;
  estado: "activo" | "inactivo" | "prospecto";
  sector: string;
  cotizaciones: number;
  proyectos: number;
  valorTotal: number;
}
```

#### 2. Proyectos (`proyectos-module.tsx`)

**Funcionalidades:**
- Pipeline visual (Kanban) y vista tabla
- Estados: prospecto → en_negociacion → propuesta_enviada → venta_ganada/perdida
- Arrastre entre etapas
- Filtrado por vendedor, cliente, fecha
- Cierre de proyecto con motivo
- Vinculación de cotizaciones

**Estados del proyecto:**
- `prospecto`: Lead inicial
- `en_negociacion`: En conversaciones
- `propuesta_enviada`: Cotización enviada
- `venta_ganada`: Proyecto cerrado exitosamente
- `venta_perdida`: Proyecto no concretado
- `en_ejecucion`: Trabajo en progreso
- `completado`: Proyecto finalizado
- `archivado`: Histórico

#### 3. Cotizadora (`cotizadora-module.tsx`)

**Funcionalidades:**
- Listado con filtros avanzados (fecha, estado, cliente, vendedor)
- Vista previa de cotización
- Cambio de estado (pendiente, aprobada, rechazada)
- Descarga de XLSX desde Supabase Storage
- Eliminación (soft-delete via visibilidad)
- Estadísticas: total, aprobadas, pendientes, montos

**Flujo de descarga:**
```typescript
// object_key almacena la ruta en Storage
// Ejemplo: "2026/COT-2026-001-ClienteNombre.xlsx"
const { data } = await supabase.storage
  .from("cotizaciones")
  .download(quote.objectKey);
```

#### 4. Usuarios (`usuarios-module.tsx`)

**Funcionalidades (Solo Admin):**
- Crear usuarios con Supabase Auth Admin API
- Asignar roles: admin, vendor, manager
- Editar información de perfil
- Eliminar usuarios (cascade a vendedores)
- Sincronización automática auth ↔ vendedores

#### 5. Auditoría (`auditoria-module.tsx`)

**Funcionalidades (Solo Admin):**
- Registro de todas las acciones
- Filtrado por fecha, usuario, módulo
- Paginación
- Purga de logs antiguos

**Estructura de log:**
```typescript
interface AuditLog {
  user_id: string;
  user_name: string;
  action: string;         // Descripción de la acción
  module: string;         // CLIENTES, PROYECTOS, COTIZADORA, etc.
  details?: object;       // Metadata adicional
  severity: "info" | "warning" | "error";
  created_at: timestamp;
}
```

### Server Actions

#### `auth-actions.ts`

```typescript
// Crear usuario con Admin API (bypassa email verification)
createUserAction({ email, password, nombre, phone, role })

// Actualizar usuario
updateUserAction({ userId, nombre, email, password, phone, role })

// Eliminar usuario
deleteUserAction(userId)
```

#### `audit-actions.ts`

```typescript
// Registrar acción
logAction({ user_id, user_name, action, module, details, severity })

// Obtener logs
getAuditLogs({ startDate, endDate, userId, page, pageSize })

// Purgar logs antiguos
purgeLogsAction(days)
```

#### `delete-actions.ts`

```typescript
// Soft-delete cliente
deleteClientAction(clientId)

// Soft-delete proyecto
deleteProjectAction(projectId)
```

### Hook de Autenticación (`use-auth.ts`)

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "vendor" | "manager";
  avatar?: string;
}

// Uso
const { user, loading, signOut, refreshUser } = useAuth();

// Reset de caché (útil después de login)
import { resetAuthCache } from "@/hooks/use-auth";
resetAuthCache();
```

**Características:**
- Caché a nivel de módulo (persiste entre re-renders)
- Auto-refresh en auth state change
- Sign-out con limpieza de localStorage/sessionStorage

---

## 🌐 Cotizador Web

### Descripción

Aplicación standalone para construcción de cotizaciones. Puede usarse:
- Embedida en iframe desde el CRM
- Como aplicación independiente con parámetros URL

### Parámetros URL

```
/quote?user_id=xxx&email=user@email.com&name=Juan&phone=999999999&access_token=eyJ...
```

| Parámetro | Descripción |
|-----------|-------------|
| user_id | ID del vendedor |
| email | Email del vendedor |
| name | Nombre para "Personal Comercial" |
| phone | Teléfono para "Teléfono Comercial" |
| access_token | Token JWT para API |

### Flujo de Uso

1. Usuario busca cliente (autocomplete desde API)
2. Selecciona o crea proyecto
3. Agrega items de ensayo (catálogo precargado)
4. Selecciona plantilla (V1-V8)
5. Genera cotización → API genera XLSX
6. Archivo se descarga automáticamente

### Catálogo de Ensayos

Los ensayos se cargan desde CSVs procesados a TypeScript:

```typescript
// ensayos-data.ts
export interface EnsayoItem {
  codigo: string;
  descripcion: string;
  norma?: string;
  acreditado: "SI" | "NO";
  precio: number;
  categoria: string;
}
```

**Categorías disponibles:**
- Cemento
- Agregados
- Albañilería
- Concreto de Campo
- Concreto
- Suelo Estándar
- Mezcla Asfáltica
- Pavimento
- Químico Agregado
- Químico Concreto
- Químico Suelo/Agua
- Roca
- Campo en Suelo
- Especiales Suelo
- Evaluaciones Estructurales
- Otros Servicios

---

## 🗄️ Base de Datos

### Tablas Principales

#### `clientes`

```sql
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  empresa text,
  ruc text,
  email text,
  telefono text,
  direccion text,
  sector text DEFAULT 'General',
  estado text DEFAULT 'prospecto',
  tipo_documento text DEFAULT 'RUC',
  vendedor_id uuid REFERENCES vendedores(id),
  
  -- Métricas calculadas
  cotizaciones integer DEFAULT 0,
  proyectos integer DEFAULT 0,
  proyectos_ganados integer DEFAULT 0,
  valor_total numeric DEFAULT 0,
  tasa_conversion numeric DEFAULT 0,
  
  -- Timestamps
  fecha_registro timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone  -- Soft delete
);
```

#### `proyectos`

```sql
CREATE TABLE proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  vendedor_id uuid REFERENCES vendedores(id),
  contacto_principal_id uuid REFERENCES contactos(id),
  ubicacion text,
  direccion text,
  
  estado text DEFAULT 'prospecto',
  etapa text DEFAULT 'pipeline',
  presupuesto numeric DEFAULT 0,
  progreso integer DEFAULT 0,
  
  fecha_inicio date,
  fecha_fin date,
  motivo_perdida text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);
```

#### `cotizaciones`

```sql
CREATE TABLE cotizaciones (
  id serial PRIMARY KEY,
  numero varchar(20) NOT NULL,
  year integer NOT NULL,
  
  -- Cliente
  cliente_nombre varchar(255),
  cliente_ruc varchar(20),
  cliente_contacto varchar(255),
  cliente_telefono varchar(50),
  cliente_email varchar(255),
  
  -- Proyecto
  proyecto varchar(255),
  proyecto_id uuid REFERENCES proyectos(id),
  ubicacion varchar(255),
  
  -- Comercial
  personal_comercial varchar(255),
  telefono_comercial varchar(50),
  vendedor_id uuid,
  vendedor_nombre varchar(255),
  user_created uuid,
  
  -- Fechas
  fecha_solicitud date,
  fecha_emision date,
  
  -- Montos
  subtotal decimal(12,2) DEFAULT 0,
  igv decimal(12,2) DEFAULT 0,
  total decimal(12,2) DEFAULT 0,
  include_igv boolean DEFAULT true,
  
  -- Metadata
  estado varchar(20) DEFAULT 'borrador',
  moneda varchar(10) DEFAULT 'PEN',
  visibilidad varchar(20) DEFAULT 'visible',
  template_id varchar(10),
  items_count integer,
  items_json jsonb,
  
  -- Archivos
  archivo_path varchar(500),
  object_key text,  -- Path en Supabase Storage
  
  -- Timestamps
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(year, numero)
);
```

#### `contactos`

```sql
CREATE TABLE contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text,
  telefono text,
  cargo text,
  es_principal boolean DEFAULT false,
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### `vendedores`

```sql
CREATE TABLE vendedores (
  id uuid PRIMARY KEY,  -- Mismo ID que auth.users
  full_name text,
  email text UNIQUE,
  phone text,
  role text DEFAULT 'vendor',
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);
```

#### `auditoria`

```sql
CREATE TABLE auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  module text,
  details jsonb,
  ip_address text,
  severity text DEFAULT 'info',
  created_at timestamp with time zone DEFAULT now()
);
```

#### `quote_sequences`

```sql
CREATE TABLE quote_sequences (
  year integer PRIMARY KEY,
  last_value integer NOT NULL
);
```

### Migraciones

Las migraciones se encuentran en `/migrations/`:

1. `002_contactos_table.sql` - Sistema de contactos múltiples por cliente
2. `003_add_object_key_to_cotizaciones.sql` - Campo para ruta en Storage

---

## 🔐 Autenticación y Seguridad

### Supabase Auth

- Autenticación via email/password
- JWT tokens con refresh automático
- Tabla `auth.users` sincronizada con `public.vendedores`

### Roles y Permisos

| Rol | Clientes | Proyectos | Cotizaciones | Usuarios | Auditoría |
|-----|----------|-----------|--------------|----------|-----------|
| admin | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| manager | ✅ Full | ✅ Full | ✅ Full | ❌ | 👁️ Ver |
| vendor | ✅ Full | ✅ Full | ✅ Full | ❌ | ❌ |

### Row Level Security (RLS)

Habilitado en todas las tablas principales. Políticas permiten:
- Lectura autenticada para la mayoría de tablas
- Escritura autenticada con validaciones
- Admin bypassa con Service Role Key

### Variables de Entorno Sensibles

```env
# NUNCA commitear estos valores
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
QUOTES_DATABASE_URL=postgresql://...
```

---

## 🚀 Despliegue

### Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────┐
│                 COOLIFY                          │
│  (Servidor Físico 192.168.18.250)               │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────┐  ┌─────────────┐              │
│  │  crm-geofal │  │ api-geofal  │              │
│  │  (Next.js)  │  │  (FastAPI)  │              │
│  │  Port 3000  │  │  Port 8000  │              │
│  └─────────────┘  └─────────────┘              │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │           PostgreSQL (Supabase)          │   │
│  │           Port 5432                      │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Dockerfiles

**api-geofal-crm/Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**crm-geofal/Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Variables de Entorno por Servicio

**crm-geofal:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_COTIZADOR_URL=https://cotizador.geofal.com.pe
```

**api-geofal-crm:**
```env
QUOTES_DATABASE_URL=postgresql://user:pass@host:5432/db
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
QUOTES_CORS_ORIGINS=https://crm.geofal.com.pe
```

---

## 👨‍💻 Guía de Desarrollo

### Setup Local

1. **Clonar repositorios:**
```bash
git clone https://github.com/keviskibidi33-png/crmgeofal-next-new.git crm-geofal
git clone https://github.com/keviskibidi33-png/api-geofal-crm.git api-geofal-crm
```

2. **Instalar dependencias:**
```bash
# CRM
cd crm-geofal && pnpm install

# API
cd api-geofal-crm && pip install -r requirements.txt
```

3. **Configurar variables de entorno:**
```bash
# crm-geofal/.env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# api-geofal-crm/.env
QUOTES_DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. **Ejecutar:**
```bash
# Terminal 1 - CRM
cd crm-geofal && pnpm dev

# Terminal 2 - API
cd api-geofal-crm && uvicorn app.main:app --reload --port 8000
```

### Convenciones de Código

- **TypeScript**: Strict mode, interfaces sobre types
- **React**: Functional components, hooks
- **Naming**: camelCase para funciones, PascalCase para componentes
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)

### Testing

```bash
# CRM
pnpm test

# API
pytest
```

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. Login requiere doble click

**Síntoma:** Primera vez que se loguea, la página recarga pero no entra.

**Solución aplicada:**
- Agregada función `resetAuthCache()` en `use-auth.ts`
- Login ahora usa `window.location.href` en vez de `router.push`
- Se llama `resetAuthCache()` antes de redirigir

#### 2. Cotizaciones muestran S/. 0.00

**Síntoma:** Items de cotización muestran precio unitario como 0.

**Causa:** Frontend buscaba `precio_unitario`, API guarda como `costo_unitario`.

**Solución:** Usar fallback:
```typescript
item.costo_unitario || item.precio_unitario || item.pu || 0
```

#### 3. Error al descargar cotización

**Síntoma:** "No se encontró el archivo de la cotización"

**Causa:** Campo `object_key` era NULL en base de datos.

**Solución:**
1. API ahora guarda `object_key` al crear cotización
2. Migración para generar `object_key` en registros existentes

#### 4. npm ci fails en deploy

**Síntoma:** "npm ci can only install packages when package.json and package-lock.json are in sync"

**Solución:**
```bash
npm install
git add package-lock.json
git commit -m "fix: sync package-lock.json"
git push
```

#### 5. CORS errors

**Síntoma:** Requests bloqueados por política CORS.

**Verificar:**
1. `QUOTES_CORS_ORIGINS` incluye el origen del frontend
2. No usar `*` si se necesitan credentials
3. Verificar que la API incluye todos los headers necesarios

### Logs y Debug

**API:**
```bash
# Ver logs de la API
docker logs api-geofal-crm -f

# Endpoint de debug
GET /debug-db
```

**CRM:**
```bash
# Build local para ver errores
pnpm build

# Logs en Coolify
# Dashboard → Service → Logs
```

---

## 📞 Contacto

Para soporte técnico o consultas sobre el desarrollo:

- **Repositorio**: github.com/keviskibidi33-png
- **Documentación**: Este archivo (`DOCUMENTATION.md`)

---

*Documentación generada el 24 de Enero de 2026*
