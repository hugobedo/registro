# ACE-MED — Sistema de Registro y Control de Pacientes en Guardia Clínica

**ACE-MED** es una aplicación web profesional en español, adaptable a computadora, tableta y celular, diseñada para el registro, seguimiento, sincronización en tiempo real, redacción de mensajes de WhatsApp e informes PDF de guardia clínica.

> **Aviso clínico:** ACE-MED no diagnostica, no sugiere tratamientos ni inventa información médica; organiza, sincroniza y formatea únicamente la información capturada por el personal autorizado.

---

## Características principales

- **Base de datos compartida en la nube (Firebase Firestore) y sincronización en tiempo real:** Todos los dispositivos (computadoras, tabletas y teléfonos) consultan y actualizan la misma base de datos centralizada con control de concurrencia por versión para evitar sobrescrituras accidentales.
- **Autenticación segura con Google y control de personal (RBAC):** Cuenta administradora principal (`hugoac.bedo@gmail.com`) con panel para aprobar o revocar el acceso de otros integrantes del equipo.
- **Navegación clara entre «PACIENTES» y «FORMATO DE ENTRADA»:**
  - *Pacientes:* Listado completo en tiempo real ordenado de los más recientes a los anteriores (con opción de alternar por orden de ingreso), buscador instantáneo por nombre y apellidos sobre todos los registros, filtros por estado clínico y diferenciación clara entre pacientes activos y egresados.
  - *Formato de entrada:* Formulario completo accesible únicamente al seleccionar este apartado, optimizado para pantallas móviles y de escritorio.
- **Encargado de turno permanente:** **HUGO ALBERTO ACEBEDO CRUZ** permanece fijo en el sistema, la base de datos y los informes PDF, protegido contra borrado o modificación accidental.
- **Dictado por voz y transcripción (`es-MX`):** Botón de micrófono en los campos de ingreso y salida para dictar sin borrar el texto previo, con opción de pausar/reanudar y aviso automático si el navegador no es compatible.
- **Títulos automáticos al dar salida:** Genera automáticamente `DR.` / `DRA.` (con selector dedicado) y `ENF.` en mayúsculas sin duplicar abreviaturas previas.
- **Observaciones de salida independientes:** El campo de observaciones al registrar una salida inicia completamente vacío para cada paciente, sin textos predeterminados ni copia automática de observaciones anteriores.
- **Eliminación total protegida en el servidor:** Validación de contraseña en el servidor (`DELETE_RECORDS_PASSWORD`) mediante hash con sal (`scrypt`) y comparación segura en tiempo constante, límite de intentos, segunda confirmación obligatoria y registro en bitácora inmutable de auditoría (`audit_logs`).
- **Mensajes de WhatsApp (12 h, sin asteriscos `*`):** Encabezado `REGISTRO DE USUARIO`, acceso directo al grupo configurado y opción de omitir campos vacíos.
- **Rectificador local de escritura y ortografía:** Comparación Original vs. Propuesta con confirmación explícita antes de aplicar cambios.
- **Informe PDF compacto (A4) y respaldos JSON:** Reporte con 6 contadores superiores, fichas compactas cronológicas, pendientes sin salida al final, y exportación/restauración de respaldos JSON.

---

## Estructura completa del proyecto

```text
ace-med/
├── .github/workflows/deploy-pages.yml   # Flujo de publicación en GitHub Pages
├── .env.example                         # Variables de entorno requeridas (sin secretos)
├── .gitignore                           # Exclusiones para Git/GitHub
├── eslint.config.mjs                    # Validación ESLint para reglas de Firestore
├── firebase-applet-config.json          # Configuración cliente de Firebase Web
├── firebase-blueprint.json              # Esquema estructurado de colecciones Firestore
├── firebase.json                        # Configuración de Firebase CLI para firestore.rules
├── firestore.rules                      # Reglas endurecidas de seguridad en Firestore
├── index.html                           # Documento HTML principal en español
├── metadata.json                        # Metadatos del proyecto
├── package.json                         # Scripts y dependencias
├── README.md                            # Documentación del proyecto
├── security_spec.md                     # Especificación de invariantes de seguridad
├── server.ts                            # Servidor Express + Vite y validación segura de borrado
├── tsconfig.json                        # Configuración TypeScript
├── vite.config.ts                       # Configuración de Vite
└── src/
    ├── App.tsx                          # Aplicación principal, auth y sincronización
    ├── firebase.ts                      # Inicialización Firebase Auth y Firestore
    ├── index.css                        # Estilos globales Tailwind CSS v4
    ├── main.tsx                         # Punto de entrada React con ErrorBoundary
    ├── config/
    │   └── labels.ts                    # Constantes clínicas, etiquetas y sugerencias
    ├── hooks/
    │   └── useVoiceDictation.ts         # Hook de reconocimiento de voz Web Speech API
    ├── services/
    │   └── cloudShiftService.ts         # Operaciones Firestore, concurrencia, auditoría y API
    ├── types/
    │   └── patient.ts                   # Tipos TypeScript del dominio clínico
    ├── utils/
    │   ├── firestoreError.ts            # Manejo estructurado de errores de Firestore
    │   ├── messages.ts                  # Generación de mensajes WhatsApp (12 h, sin *)
    │   ├── pdfReport.ts                 # Generación de informe A4 compacto con jsPDF
    │   ├── spellcheck.ts                # Rectificador local de ortografía y formato
    │   ├── storage.ts                   # Migración desde localStorage y respaldos JSON
    │   ├── time.ts                      # Utilidades de horario de 12 horas y fechas
    │   └── titles.ts                    # Prefijos automáticos DR., DRA. y ENF.
    └── components/
        ├── AuthGate.tsx                 # Inicio de sesión Google y sala de autorización
        ├── ClearShiftModal.tsx          # Borrado total con contraseña en servidor y 2ª confirmación
        ├── DischargeModal.tsx           # Registro de salida con títulos automáticos y voz
        ├── ErrorBoundary.tsx            # Recuperación segura ante errores de interfaz
        ├── Header.tsx                   # Barra superior institucional
        ├── HistoryAndSecurityPanel.tsx  # Auditoría, respaldos JSON, personal y descarga ZIP
        ├── PatientForm.tsx              # Formulario completo de entrada con dictado por voz
        ├── PatientList.tsx              # Listado compartido con buscador y filtros
        ├── ReportModal.tsx              # Vista previa de informe, PDF y grupo WhatsApp
        ├── SpellCheckModal.tsx          # Confirmación de rectificación ortográfica
        ├── TimeInput12h.tsx             # Selector accesible de hora en formato 12 horas
        ├── VoiceMicButton.tsx           # Botón táctil de micrófono con estado activo
        └── WhatsAppModal.tsx            # Vista previa, edición y envío a WhatsApp
```

---

## Instalación y ejecución local

### Requisitos
- Node.js 20 o superior
- `npm`

### Pasos
1. Crea un archivo `.env` a partir de `.env.example` y configura la contraseña de autorización del servidor:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y define:
   ```env
   DELETE_RECORDS_PASSWORD=1197
   ```
   *(Nunca subas el archivo `.env` a GitHub; ya está protegido por `.gitignore`.)*

2. Instala dependencias e inicia el sistema completo (frontend + servidor Express):
   ```bash
   npm install
   npm run dev
   ```
3. Abre `http://localhost:3000`.

### Producción (servidor Node.js completo)
Para conservar la validación en servidor de la contraseña de eliminación total (`/api/delete-auth/*`), publica en un entorno Node.js (Cloud Run, Render, Railway o VPS):
```bash
npm install
npm run build
NODE_ENV=production DELETE_RECORDS_PASSWORD=1197 npm start
```

### Publicar en GitHub
```bash
git init
git add .
git commit -m "ACE-MED sistema clínico completo con sincronización en la nube"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/ace-med.git
git push -u origin main
```

### Desplegar reglas de Firestore con Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```
