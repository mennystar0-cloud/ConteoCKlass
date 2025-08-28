# Conteo CKLASS — Módulo Cíclicos (PWA + Firebase)

> Versión base lista para publicar en **GitHub Pages** o **Firebase Hosting**. Frontend (PWA) + Cloud Functions (carga de catálogo CSV / folios consecutivos) + Reglas de Firestore + Índices.

## Estructura
```
ConteoCKlass/
├─ index.html           # UI completa
├─ app.js               # Lógica de app (Auth, Firestore, escáner, reportes, impresión)
├─ manifest.webmanifest # PWA
├─ service-worker.js    # Cache offline
├─ icons/
│  ├─ icon-192.png
│  └─ icon-512.png
├─ static/
│  └─ catalogo-master.csv   # opcional para pruebas locales
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json
├─ functions/
│  ├─ index.js
│  └─ package.json
└─ .github/workflows/pages.yml  # Deploy automático a GitHub Pages (rama main)
```

---

## PASO A PASO — GitHub → Firebase → Google Sheets/Drive → Pruebas

### 1) GitHub
1. Crea un repositorio **público o privado** (por ejemplo, `ConteoCKlass`).
2. Sube el contenido de esta carpeta al repositorio (mantén la estructura).
3. Activa **GitHub Pages** en `Settings → Pages → Build and deployment: GitHub Actions` (ya incluido el workflow).
4. Si usarás dominio propio, agrega `CNAME` en la raíz y ajusta `start_url` y `scope` en `manifest.webmanifest`.

### 2) Firebase (Proyecto nuevo)
1. Ve a **console.firebase.google.com** y crea un proyecto.
2. Habilita **Authentication** (Email/Password) y **Firestore** (modo Production).
3. Crea una **App Web** y copia tus credenciales Firebase (apiKey, authDomain, etc.).
4. Pega esos datos en `index.html` dentro de `const firebaseConfig = { ... }`.
5. En la sección **Firestore Rules**, pega el contenido de `firestore.rules` y publica.
6. En **Indexes**, importa `firestore.indexes.json` (CLI o consola).

> Opcional Hosting Firebase: si prefieres Firebase Hosting en lugar de GitHub Pages, instala CLI (`npm i -g firebase-tools`), `firebase login`, `firebase init hosting`, y `firebase deploy`.

### 3) Cloud Functions
> Requiere Node 20 y `firebase-tools` instalado.
1. `cd functions`
2. `npm install`
3. `firebase init functions` (elige **JavaScript**, Node **20**). *Si te pregunta sobre sobrescribir, conserva `index.js` y `package.json` de este repo.*
4. Despliega: `firebase deploy --only functions`

Funciones incluidas:
- **loadCatalogFromCsv (HTTPS)**: carga un CSV público (Google Drive direct download o similar) al `collection('catalog')`.
  - Ejemplo: `https://us-central1-TU_PROJECT.cloudfunctions.net/loadCatalogFromCsv?url=https://drive.google.com/uc?id=FILE_ID&export=download`
  - Campos esperados por columna: `model,color,talla,code,teorico` (se aceptan equivalentes: MODELO, COLOR, TALLA, CODIGO/CODIGO_BARRAS, TEORICO).
- **getNextFolio (HTTPS)**: devuelve el siguiente folio consecutivo por prefijo y fecha `C-YYYYMMDD-###`.
  - Ejemplo: `https://us-central1-TU_PROJECT.cloudfunctions.net/getNextFolio?prefix=C`

> **Roles:** Agrega reclamos personalizados con callable `setRole` (no expuesto en UI). Usa el **Admin SDK** o panel de Firebase para crear usuarios. Ejecuta `setRole` desde un cliente admin o usa una función temporal.

### 4) Google Sheets / Drive (Catálogo)
Tienes dos opciones:
- **A. Drive CSV → Cloud Function:** desde Google Drive, consigue un link **directo de descarga** (formato `uc?id=...&export=download`) y pásalo como parámetro `?url=` a `loadCatalogFromCsv`.
- **B. Google Sheets API → CSV:** desde Sheets exporta como CSV y usa el URL público de exportación.

> **Recomendado:** Opción A por simplicidad. El dataset reportado (20 MB ~170k filas) es soportado por la función (usa `bulkWriter`).

### 5) Configurar la App (Frontend)
- En `index.html`, actualiza:
  - `firebaseConfig` con tus credenciales.
  - `window.__APP_SETTINGS__.GITHUB_PAGES_BASE` con la base (por ejemplo `"/ConteoCKlass/"` en GitHub Pages) para rutas relativas del SW.
  - `CATALOG_VERSION` (por ejemplo `"24/08/2025"`).

### 6) Pruebas
1. Despliega Functions y carga el catálogo: llama a `loadCatalogFromCsv` con tu URL.
2. Inicia sesión en la app. Crea un **Nuevo folio** (elige prefijo y captura Almacén/Sucursal).
3. Usa la **cámara** o captura manual para registrar códigos. Une dos dispositivos al mismo **folio** para flujo multi‑equipo.
4. Revisa **Conciliación** y **Historial**. Usa los botones **Imprimir** (Todo, Faltantes, Sobrantes, Compensados).

---

## Notas clave & Checklist
- [ ] **NO** usar Storage para catálogo (cumplido). Catálogo vive en **Firestore** (`collection('catalog')`).
- [ ] Folio **multi‑dispositivo** por código compartido (cumplido).
- [ ] **Escáner** por cámara (BarcodeDetector) y **captura manual** (cumplido).
- [ ] **Reportes** con filtros y **impresión profesional** con encabezados (cumplido).
- [ ] **Folio consecutivo** por prefijo (Cloud Function) (cumplido).
- [ ] **Roles** con reglas de Firestore (cumplido). (UI básica; asignación de roles por función callable).

## Campos de catálogo sugeridos
- `model` (ej. "060-79")
- `color` (ej. "NEGRO")
- `talla` (ej. "240")
- `code`  (código de barras)
- `teorico` (existencia teórica)

> Si tu CSV tiene encabezados distintos, la función intenta mapearlos (MODELO, COLOR, TALLA, CODIGO/CODIGO_BARRAS, TEORICO).

---

## Problemas comunes
- **CORS al llamar funciones**: usa la URL HTTPS de Cloud Functions. Si usas GitHub Pages, el front puede llamar directo a la URL pública.
- **Sin permisos**: asegúrate que el usuario esté autenticado y tenga rol adecuado según `firestore.rules`.
- **BarcodeDetector no disponible**: en algunos navegadores Android antiguos; usa la captura manual (ya incluida).
