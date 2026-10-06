# Steam Catalog

Aplicación web para explorar un catálogo de juegos de Steam, buscar juegos por contenido, guardar favoritos y crear listas personales. Los usuarios pueden publicar una calificación y un comentario por juego. Los administradores pueden importar juegos y mantener el catálogo.

## Requisitos

- Docker Desktop con Docker Compose.
- Python 3.12 o superior.
- Node.js compatible con Vite 8 y npm.

## Cómo iniciar el proyecto paso a paso

Los siguientes pasos están escritos para **Windows PowerShell**. Mantén abiertas
dos terminales: una para el backend y otra para el frontend. Antes de empezar,
abre Docker Desktop y espera a que indique que está funcionando.

### 1. Abrir la carpeta del proyecto

En PowerShell, sitúate en la carpeta raíz del repositorio:

```powershell
cd "C:\Users\carlo\OneDrive\Escritorio\proyecto_UX\ProyectoBaseDeDatos_RGQC"
```

### 2. Iniciar MongoDB y ChromaDB

Desde la carpeta raíz, ejecuta:

```powershell
docker compose up -d
docker compose ps
```

Los servicios deben aparecer como `running`. MongoDB queda disponible en
`localhost:27017` y ChromaDB en `localhost:8000`. Los datos se conservan en
volúmenes de Docker. Para detenerlos al terminar:

```powershell
docker compose down
```

### 3. Preparar e iniciar el backend

En la primera terminal, ejecuta:

```powershell
cd "C:\Users\carlo\OneDrive\Escritorio\proyecto_UX\ProyectoBaseDeDatos_RGQC\backend"
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
$env:MONGO_URI = "mongodb://admin:test1234@localhost:27017/juegos?authSource=admin"
$env:JWT_SECRET_KEY = "clave-local-para-desarrollo"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Si PowerShell bloquea la activación del entorno virtual, ejecuta una vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Después repite la activación con `.\.venv\Scripts\Activate.ps1`. La API queda
disponible en `http://localhost:8080`, y su documentación en
`http://localhost:8080/docs`. Comprueba el estado en
`http://localhost:8080/health`; debe mostrar MongoDB como `connected`.

Si el catálogo está vacío, detén el backend con `Ctrl+C` y, desde la carpeta
`backend`, carga los juegos iniciales:

```powershell
$env:MONGO_URI = "mongodb://admin:test1234@localhost:27017/juegos?authSource=admin"
python cargar_catalogo_inicial.py
```

Cuando termine, inicia nuevamente el backend con el comando anterior.

### 4. Preparar e iniciar el frontend

En una segunda terminal, ejecuta:

```powershell
cd "C:\Users\carlo\OneDrive\Escritorio\proyecto_UX\ProyectoBaseDeDatos_RGQC\frontend"
npm ci
npm run dev -- --host 0.0.0.0
```

Abre `http://localhost:5173` en el navegador. Vite también mostrará la URL
local y las URLs de red disponibles.

### 5. Detener la aplicación

En cada terminal presiona `Ctrl+C` para detener el backend y el frontend.
Después, si ya no necesitas las bases de datos, ejecuta desde la carpeta raíz:

```powershell
docker compose down
```

### Solución rápida de problemas

- Si `docker compose` falla, abre Docker Desktop y vuelve a ejecutar el paso 2.
- Si el puerto `8080` está ocupado, detén el proceso que lo usa o cambia
  `--port 8080` por otro puerto y actualiza la URL de la API en el frontend.
- Si el puerto `5173` está ocupado, Vite elegirá otro puerto; abre la URL que
  aparezca en la terminal.
- Si faltan paquetes del backend, activa `.venv` y ejecuta nuevamente
  `python -m pip install -e .`.

## Uso paso a paso

1. Regístrate desde **Registrarse** e inicia sesión. El catálogo requiere autenticación.
2. Explora el catálogo, busca juegos por nombre, género, desarrollador o descripción y filtra por precio y género.
3. Usa **Agregar a favoritos** para guardarlos en tu perfil.
4. En **Mis listas personalizadas**, crea una lista con un nombre. En cada tarjeta selecciona una lista y pulsa **Agregar a lista**. Abre el nombre de la lista para ver sus juegos.
5. Abre una tarjeta para ver los detalles, capturas, videos y ficha del juego. En **Reseñas de la comunidad**, elige una calificación de 1 a 5 y escribe un comentario. Cada cuenta puede actualizar su propia reseña; el promedio y las reseñas son visibles en la página del juego.
6. Las cuentas con rol `admin` pueden importar juegos por su Steam App ID desde el panel del catálogo y editar o eliminar juegos.

## Cómo funciona

- **Frontend:** React 19 y Vite. `src/pages` contiene las páginas y `src/components` los componentes visuales. `src/services` llama a la API con Axios; el token JWT guardado durante el inicio de sesión se envía automáticamente en cada solicitud.
- **Backend:** FastAPI valida usuarios y protege las operaciones con JWT. La documentación de rutas se genera en `/docs`.
- **MongoDB:** la base `juegos` guarda el catálogo (`catalogo`), usuarios, sus favoritos y listas personalizadas (`users`) y reseñas (`reviews`). Las listas guardan identificadores de juegos; las reseñas guardan calificación y comentario por usuario y juego.
- **ChromaDB:** mantiene un índice semántico del contenido del catálogo para atender búsquedas por significado, además de coincidencias por nombre.
- **Steam:** la importación administrativa obtiene datos del juego desde Steam y las páginas de detalle consultan multimedia bajo demanda.

## Configuración

El backend permite configurar `MONGO_URI`, `JWT_SECRET_KEY`, `CHROMA_COLLECTION_NAME` y `CHROMA_DIMENSION` mediante variables de entorno. `MONGO_URI` debe coincidir con las credenciales configuradas en `docker-compose.yml`. Cambia las credenciales y el secreto JWT antes de exponer el servicio fuera de desarrollo local.

## Comprobaciones útiles

- Estado de API y MongoDB: `http://localhost:8080/health`
- Documentación interactiva: `http://localhost:8080/docs`
- Compilar frontend: desde `frontend`, ejecuta `npm run build`.
