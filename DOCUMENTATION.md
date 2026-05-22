# Documentación del Proyecto: GymPay

## 1. Visión General
**GymPay** es una aplicación web moderna y ligera diseñada específicamente para la gestión administrativa de gimnasios locales. Permite registrar clientes, procesar pagos de mensualidades, llevar un control de vencimientos y visualizar analíticas financieras, todo con soporte multidispositivo y persistencia en la nube.

## 2. Arquitectura Tecnológica
El proyecto se construió siguiendo un enfoque "Vanilla" complementado con herramientas modernas de construcción y servicios Backend as a Service (BaaS):

- **Frontend Core:** HTML5, CSS3 (Vanilla, variables CSS, Flexbox/Grid) y JavaScript (ES6+ Modules).
- **Bundler y Entorno de Desarrollo:** [Vite](https://vitejs.dev/) (Rápido empaquetado y HMR).
- **Backend y Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL en la nube). Proporciona sincronización de datos en tiempo real entre múltiples dispositivos.
- **Gráficos y Reportes:** Chart.js para visualización de ingresos mensuales y métodos de pago.
- **Despliegue (Hosting):** [Vercel](https://vercel.com/) (Conexión continua con GitHub).

## 3. Funcionalidades Principales
- **Dashboard Analítico:** Resumen de ingresos mensuales (Bs y USD equivalentes calculados dinámicamente con la tasa BCV), miembros activos, y pagos por vencer.
- **Directorio de Miembros:** Panel con buscador en tiempo real, filtros por estado (Activo, Por Vencer, Vencido) y atajos rápidos para contactar por WhatsApp.
- **Procesamiento de Pagos:** Flujo optimizado que permite seleccionar planes predefinidos (30 días, 15 días) o personalizados, registrando el método de pago (Pago Móvil / Efectivo). Incluye opción de pago inicial exprés al crear un usuario nuevo.
- **Integración WhatsApp:** Generación de enlaces con mensajes pre-diseñados (y variables como {nombre}, {fecha}) para cobrar mensualidades con 1 clic.
- **Automatización Monetaria:** Conexión con API venezolana (dolarapi.com) para obtener y cachear la tasa oficial del Banco Central de Venezuela (BCV), con fallback a tasa manual.
- **Seguridad UI:** Pantalla de Login (usuario: admin / clave: 1234) que restringe el acceso al enrutador SPA.

## 4. Estructura de la Base de Datos (Supabase PostgreSQL)

### Tabla `members`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | int8 | Clave primaria autoincremental |
| `nombre` | text | Nombre del cliente |
| `apellido` | text | Apellido del cliente |
| `cedula` | text | Identificación (Unique) |
| `telefono` | text | Número de teléfono para WhatsApp |
| `estado` | text | 'activo' o 'inactivo' |
| `fechaInscripcion` | date | Fecha de alta en el sistema |

### Tabla `payments`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | int8 | Clave primaria |
| `memberId` | int8 | Llave foránea hacia `members(id)` |
| `montoBs` | numeric | Monto pagado en Bolívares |
| `tasaUsd` | numeric | Tasa de cambio al momento del pago |
| `fechaPago` | date | Fecha de la transacción |
| `fechaVencimiento`| date | Fecha donde expira la mensualidad |
| `metodoPago` | text | 'pagoMovil' o 'efectivo' |
| `referencia` | text | Últimos 4 dígitos si fue digital |

### Tabla `settings`
Almacena configuración dinámica en formato Clave-Valor (ej. `precioMensual`, `nombreGym`, `mensajeWhatsApp`).

## 5. Estructura de Carpetas del Proyecto
\`\`\`
gym-pay/
├── index.html            # Punto de entrada HTML
├── package.json          # Dependencias (Vite, Supabase-js, Chart.js)
├── schema.sql            # Script DDL para construir tablas en Supabase
├── src/
│   ├── main.js           # Orquestador inicial e inicializador del router
│   ├── router.js         # Lógica SPA (Hash Router) y guardia de sesión
│   ├── index.css         # Reset y utilidades
│   ├── style.css         # Design System (Variables, Componentes UI)
│   ├── components/       # UI Reutilizable (Modales, Toasts, Sidebar)
│   ├── db/               # Lógica de abstracción para consultas (Supabase)
│   ├── pages/            # Vistas (Dashboard, Members, Settings, etc.)
│   ├── services/         # Clientes externos (Supabase Client, API de Dólar)
│   └── utils/            # Funciones puras (Formateo fechas, monedas)
\`\`\`

## 6. Mantenimiento y Extensibilidad
- **Actualización Visual:** Al basarse completamente en Variables CSS nativas (\`src/style.css\`), cambiar el esquema de colores de toda la aplicación a un tema oscuro o corporativo específico solo requiere modificar las variables root.
- **Nuevos Reportes:** La capa de abstracción en \`src/db/payments.js\` agrupa pagos por fechas; ideal para exportar a CSV/Excel fácilmente a futuro si se integra una librería como SheetJS.
- **Control de Acceso Avanzado:** Para convertir la aplicación de un uso monousuario a multi-empleado, se recomienda sustituir el bloqueo UI actual (\`localStorage\`) por la autenticación nativa de Supabase (Supabase Auth) combinada con políticas RLS (Row Level Security).
