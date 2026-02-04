# Fundación Te Apoyamos - Sistema de Unificación de RUT

Sistema de procesamiento asíncrono para la unificación automática de contactos y empresas duplicadas en HubSpot basándose en el RUT chileno.

## 📋 Descripción

Este proyecto implementa una solución de integración con HubSpot que detecta y unifica automáticamente contactos y empresas duplicadas que comparten el mismo RUT. Utiliza webhooks de HubSpot para recibir notificaciones en tiempo real y un sistema de colas con RabbitMQ para procesar los cambios de manera asíncrona.

### Características Principales

- ✅ **Unificación de Contactos**: Detecta y unifica contactos duplicados por RUT
- ✅ **Unificación de Empresas**: Detecta y unifica empresas duplicadas por RUT
- ✅ **Normalización de RUT**: Formatea y normaliza RUTs chilenos automáticamente
- ✅ **Procesamiento Asíncrono**: Sistema de colas con RabbitMQ para alta disponibilidad
- ✅ **Dashboard de Monitoreo**: Interfaz web para visualizar el estado de las operaciones
- ✅ **Webhooks de HubSpot**: Integración en tiempo real con eventos de HubSpot
- ✅ **Reintentos Inteligentes**: Sistema de reintentos con espera de indexación
- ✅ **Persistencia de Logs**: Almacenamiento de todas las operaciones en MySQL

## 🏗️ Arquitectura

```
┌─────────────────┐
│    HubSpot      │
│   (Webhooks)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Queue Service  │◄────►│  RabbitMQ    │
│   (NestJS)      │      │              │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Core Service   │◄────►│    MySQL     │
│   (NestJS)      │      │   (Logs)     │
└────────┬────────┘      └──────────────┘
         │
         ▼
   ┌─────────────┐
   │   HubSpot   │
   │ (API Merge) │
   └─────────────┘
```

### Flujo de Procesamiento

1. **Webhook**: HubSpot envía un webhook cuando se actualiza un contacto/empresa
2. **Validación**: El Queue Service valida la firma HMAC-SHA256 del webhook
3. **Encolamiento**: Se envían mensajes a RabbitMQ (2 colas: procesamiento y unificación)
4. **Normalización**: Core Service normaliza el RUT y actualiza `rut_formateado`
5. **Búsqueda**: Busca duplicados en HubSpot con reintentos para esperar indexación
6. **Unificación**: Merge automático manteniendo el registro más antiguo como principal
7. **Logging**: Todas las operaciones se registran en MySQL

## 🚀 Tecnologías

### Backend

- **NestJS 9+**: Framework principal para microservicios
- **RabbitMQ**: Sistema de mensajería asíncrona
- **MySQL 5.7**: Base de datos para logs y persistencia
- **Docker & Docker Compose**: Containerización y orquestación

### Frontend

- **Quasar Framework**: Framework Vue 3 con SSR
- **Vue 3**: Framework progresivo de JavaScript
- **Axios**: Cliente HTTP

### Integraciones

- **HubSpot API v3**: CRUD de contactos/empresas y merge
- **HubSpot Webhooks**: Eventos en tiempo real

## 📦 Requisitos Previos

- Docker Desktop (Windows/Mac) o Docker Engine (Linux)
- Docker Compose
- Node.js 20+ (para desarrollo local sin Docker)
- Cuenta de HubSpot con Private App creada

## 🔧 Instalación

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd fundacion-te-apoyamos
```

### 2. Configurar Variables de Entorno

#### Archivo `.env` (raíz del proyecto)

```bash
cp .env.example .env
```

Edita `.env` y configura:

```env
# HubSpot - Obtener desde Settings > Integrations > Private Apps
HUBSPOT_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# MySQL
MYSQL_PASSWORD=tu_password_seguro
MYSQL_ROOT_PASSWORD=tu_root_password_seguro

# JWT Secret (genera uno nuevo)
JWT_SECRET=tu_jwt_secret_super_seguro
```

#### Archivo `core/.env`

```bash
cp core/.env.example core/.env
```

Configura las mismas credenciales de HubSpot.

### 3. Configurar HubSpot Private App

En HubSpot, ve a **Settings > Integrations > Private Apps** y crea una nueva app con los siguientes scopes:

**Contacts:**

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.schemas.contacts.read`
- `crm.schemas.contacts.write`

**Companies:**

- `crm.objects.companies.read`
- `crm.objects.companies.write`
- `crm.schemas.companies.read`
- `crm.schemas.companies.write`

Copia el **Access Token** y el **Client Secret** a tus archivos `.env`.

### 4. Crear Propiedades Personalizadas en HubSpot

Crea las siguientes propiedades personalizadas:

**Para Contactos:**

- Nombre: `rut`
- Tipo: Single-line text
- Nombre interno: `rut`

- Nombre: `rut_formateado`
- Tipo: Single-line text
- Nombre interno: `rut_formateado`

**Para Empresas:**

- Nombre: `rut`
- Tipo: Single-line text
- Nombre interno: `rut`

- Nombre: `rut_formateado`
- Tipo: Single-line text
- Nombre interno: `rut_formateado`

### 5. Configurar Webhooks en HubSpot

Ve a **Settings > Integrations > Private Apps > [Tu App] > Webhooks** y configura:

**Webhook URL:** `https://tu-dominio.com/api/v1/hubspot/webhook/contacts`

**Eventos a suscribir:**

- `contact.propertyChange` (propiedad: `rut`)
- `company.propertyChange` (propiedad: `rut`)

## 🐳 Ejecución con Docker

### Desarrollo

```bash
# Levantar todos los servicios
docker-compose -f docker-compose-queue.yml up -d
docker-compose up -d

# Ver logs en tiempo real
docker logs -f rmq_app_queue          # Queue service
docker logs -f fundacion-te-apoyamos_app  # Core service

# Detener servicios
docker-compose down
docker-compose -f docker-compose-queue.yml down
```

### Reconstruir después de cambios

```bash
# Reconstruir Queue Service
docker-compose -f docker-compose-queue.yml down
docker-compose -f docker-compose-queue.yml up -d --build

# Reconstruir Core Service
docker-compose down
docker build -t fundacion-te-apoyamos-app ./core
docker-compose up -d
```

## 🌐 Acceso a Servicios

Una vez levantados los servicios:

- **Frontend (Dashboard)**: http://localhost:9010
- **Queue API**: http://localhost:3000/api/v1
- **Core API**: http://localhost:3001/api/v1
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 📂 Estructura del Proyecto

```
fundacion-te-apoyamos/
├── config/
│   └── queues.json              # Configuración de colas RabbitMQ
├── core/                        # Microservicio Core (Procesamiento)
│   ├── src/
│   │   ├── hubspot/            # Servicios de HubSpot API
│   │   │   ├── company.service.ts
│   │   │   ├── contact.service.ts
│   │   │   └── utils/
│   │   │       └── rut-formatter.util.ts
│   │   ├── queue/              # Procesadores de RabbitMQ
│   │   │   ├── company-rut.service.ts
│   │   │   ├── company.processor.ts
│   │   │   ├── queue.processor.ts
│   │   │   └── queue.service.ts
│   │   └── utils/              # Configuraciones y utilidades
│   ├── Dockerfile
│   └── package.json
├── queue/                       # Microservicio Queue (Webhooks)
│   ├── client/                 # Frontend Quasar
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── UnificadorContactosPage.vue
│   │   │   │   └── UnificadorEmpresasPage.vue
│   │   │   └── router/
│   │   └── package.json
│   ├── src/
│   │   ├── auth/               # Autenticación (JWT, API Keys)
│   │   └── manager/            # Controladores y servicios
│   │       ├── app.controller.ts
│   │       └── queue.service.ts
│   └── Dockerfile
├── docker-compose.yml           # Core service
├── docker-compose-queue.yml     # Queue, MySQL, RabbitMQ
└── README.md
```

## 🔐 Autenticación

El sistema utiliza dos métodos de autenticación:

### 1. JWT (Frontend)

Tokens firmados para acceso al dashboard web.

### 2. API Keys (Servicios externos)

Para llamadas programáticas, genera una API Key:

```bash
# Acceder al contenedor
docker exec -it rmq_app_queue sh

# Generar API Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego registra la key en la base de datos o usa el endpoint de registro.

## 📊 Monitoreo

### Dashboard Web

Accede a http://localhost:9010 para visualizar:

- Estado de colas
- Logs de procesamiento
- Estadísticas de unificaciones
- Contactos y empresas procesados

### RabbitMQ Management

Accede a http://localhost:15672 para:

- Monitorear colas en tiempo real
- Ver mensajes pendientes
- Analizar throughput

### Logs MySQL

Todas las operaciones se guardan en:

- `contacts_queue_logs`
- `companies_queue_logs`
- `rut_unified_queue_logs`
- `companies_rut_unified_queue_logs`

## 🧪 Pruebas

### Probar Unificación de Contactos

1. Crea 2 contactos en HubSpot con el mismo RUT (ej: `12.345.678-9`)
2. Observa los logs: `docker logs -f fundacion-te-apoyamos_app`
3. Verifica en HubSpot que se unificaron (quedará solo el más antiguo)

### Probar Unificación de Empresas

1. Crea 2 empresas en HubSpot con el mismo RUT (ej: `12.345.678-1`)
2. Observa los logs del Core service
3. Verifica en HubSpot el merge exitoso

## 🛠️ Desarrollo

### Instalar dependencias localmente

```bash
# Core service
cd core
npm install

# Queue service
cd queue
npm install

# Frontend
cd queue/client
npm install
```

### Ejecutar en modo desarrollo (sin Docker)

Requiere RabbitMQ y MySQL corriendo localmente o en Docker.

```bash
# Core
cd core
npm run start:dev

# Queue
cd queue
npm run start:dev

# Frontend
cd queue/client
quasar dev
```

## 🐛 Troubleshooting

### Los webhooks no llegan

1. Verifica que la URL del webhook sea accesible públicamente
2. Usa ngrok o Cloudflare Tunnel para exponer localhost
3. Verifica la firma HMAC-SHA256 con el Client Secret correcto

### Error 403 al hacer merge

- Verifica que el token de HubSpot tenga todos los scopes necesarios
- Regenera el token si es necesario

### No encuentra duplicados

- El sistema espera hasta 10 intentos (80 segundos) para que HubSpot indexe
- Verifica que ambos registros tengan `rut_formateado` actualizado
- Revisa los logs con `docker logs -f fundacion-te-apoyamos_app`

### Contenedores no inician

```bash
# Ver logs de errores
docker-compose logs

# Limpiar volúmenes y reintentar
docker-compose down -v
docker-compose up -d
```

## 📝 Licencia

[Especifica tu licencia aquí]

## 👥 Contribución

[Instrucciones para contribuir al proyecto]

## 📧 Contacto

[Información de contacto o soporte]
