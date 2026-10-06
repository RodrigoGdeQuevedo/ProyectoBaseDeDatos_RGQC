# Steam Catalog

Aplicación web para explorar un catálogo de juegos de Steam, buscar juegos por contenido, guardar favoritos y crear listas personales. Los usuarios pueden publicar una calificación y un comentario por juego. Los administradores pueden importar juegos y mantener el catálogo.

## Requisitos

- Docker Desktop con Docker Compose.
- Python 3.12 o superior.
- Node.js compatible con Vite 8 y npm.

## Cómo iniciar el proyecto

Abre tres terminales desde la carpeta raíz del repositorio.

### 1. Iniciar las bases de datos

```powershell
docker compose up -d
```

Esto inicia MongoDB en `localhost:27017` y ChromaDB en `localhost:8000`. Para detenerlos: `docker compose down`. Los datos se conservan en volúmenes de Docker.

### 2. Instalar e iniciar el backend

En la primera terminal:

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install fastapi "uvicorn[standard]" pymongo chromadb requests "passlib[bcrypt]" "bcrypt<4.1" "python-jose[cryptography]" email-validator python-multipart beautifulsoup4
$env:MONGO_URI = "mongodb://admin:test1234@localhost:27017/?authSource=admin"
$env:JWT_SECRET_KEY = "clave-local-para-desarrollo"
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

La API queda disponible en `http://localhost:8080`; la documentación interactiva está en `http://localhost:8080/docs`. La primera ejecución de ChromaDB puede tardar mientras crea el índice semántico.

Si el catálogo está vacío, con el backend detenido ejecuta desde `backend` para cargar en MongoDB los juegos de `validos.json` usando sus fichas públicas de Steam. Después vuelve a iniciar el backend para indexarlos en ChromaDB:

```powershell
$env:MONGO_URI = "mongodb://admin:test1234@localhost:27017/?authSource=admin"
python cargar_catalogo_inicial.py
```

### 3. Instalar e iniciar el frontend

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abre la dirección que Vite muestra en la terminal, normalmente `http://localhost:5173`.

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
