from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List, Dict
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
import requests
import os
from pathlib import Path
from html import unescape
import re
import unicodedata
from fastapi import Request
from fastapi.responses import StreamingResponse
from bs4 import BeautifulSoup
import chromadb
import time

# ─────────────────────────────────────────────
#  CONEXIÓN A MONGODB
# ─────────────────────────────────────────────
DB_NAME = "juegos"
COLLECTION_NAME = "catalogo"

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://rodrigogdeq:xbox14life@localhost:27017"
)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
games_collection = db[COLLECTION_NAME]
users_collection = db["users"]

# Cache en memoria para multimedia de Steam (evita golpear la API en cada click)
media_cache: Dict[int, dict] = {}
CHROMA_DIR = str(Path(__file__).resolve().parent / "chromadb")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "documentos")
CHROMA_DIMENSION = int(os.getenv("CHROMA_DIMENSION", "384"))
chroma_collection = None

STEAM_PARAMS = "?cc=us&l=english"

# ─────────────────────────────────────────────
#  AUTH CONFIG
# ─────────────────────────────────────────────
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "cambia_esto_en_produccion")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ─────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Steam Games API",
    version="1.0.0",
    description="Bienvenido a la API de juegos de Steam. Esta API permite gestionar un catálogo de juegos, incluyendo autenticación de usuarios y operaciones CRUD protegidas para administradores."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
#  MODELOS
# ─────────────────────────────────────────────

class Price(BaseModel):
    currency: Optional[str] = None
    initial: Optional[float] = None
    final: Optional[float] = None
    discount_percent: Optional[int] = None


class DLC(BaseModel):
    appid: int
    name: Optional[str] = None
    type: Optional[str] = None
    is_free: Optional[bool] = None
    release_date: Optional[str] = None
    price: Optional[Price] = None


class Game(BaseModel):
    id: str
    type: Optional[str] = None
    name: str
    steam_appid: int
    header_image: Optional[str] = None

    required_age: Optional[int | str] = None
    is_free: Optional[bool] = None
    controller_support: Optional[str] = None

    detailed_description: Optional[str] = None
    about_the_game: Optional[str] = None
    short_description: Optional[str] = None
    supported_languages: Optional[str] = None
    website: Optional[str] = None
    release_date: Optional[dict] = None

    pc_requirements: Optional[dict] = None
    mac_requirements: Optional[dict] = None
    linux_requirements: Optional[dict] = None

    developers: Optional[list[str]] = None
    publishers: Optional[list[str]] = None

    categories: Optional[list[dict]] = None
    genres: Optional[list[dict]] = None

    price_overview: Optional[dict] = None
    metacritic: Optional[dict] = None
    platforms: Optional[dict] = None
    dlcs: Optional[List[DLC]] = None

    youtube_trailer_id: Optional[str] = None

# ─────────────────────────────────────────────
#  MODELOS AUTH
# ─────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GameCreate(BaseModel):
    steam_appid: int
    youtube_trailer_id: Optional[str] = None

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def parse_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except (InvalidId, Exception):
        raise HTTPException(status_code=404, detail="Juego no encontrado")


def normalize_requirements(game: dict):
    for key in ["pc_requirements", "mac_requirements", "linux_requirements"]:
        if isinstance(game.get(key), list):
            game[key] = None
    return game


def mongo_to_game(doc: dict) -> dict:
    doc = normalize_requirements(doc)
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc


class SimpleEmbeddingFunction:
    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def name(self) -> str:
        return f"simple_embedding_{self.dimension}"

    def _embed(self, texts: List[str]) -> List[List[float]]:
        embeddings: List[List[float]] = []

        for text in texts:
            vector = [0.0] * self.dimension
            for token in (text or "").lower().split():
                index = sum(ord(char) for char in token) % self.dimension
                vector[index] += 1.0

            norm = sum(value * value for value in vector) ** 0.5 or 1.0
            embeddings.append([value / norm for value in vector])

        return embeddings

    def embed_documents(self, input):
        if isinstance(input, str):
            input = [input]
        return self._embed(list(input))

    def embed_query(self, input):
        if isinstance(input, str):
            input = [input]
        return self._embed(list(input))

    __call__ = embed_documents


def clean_text(text: str | None) -> str:
    if not text or not isinstance(text, str):
        return "No disponible"

    text = unescape(text)
    text = re.sub(r"<.*?>", "", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def normalize_for_match(text: str | None) -> str:
    if not text:
        return ""

    normalized = unicodedata.normalize("NFKD", str(text))
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def name_match_bucket(game_name: str | None, query: str) -> int:
    normalized_name = normalize_for_match(game_name)
    normalized_query = normalize_for_match(query)

    if not normalized_name or not normalized_query:
        return 5

    if normalized_name == normalized_query:
        return 0

    if normalized_name.startswith(normalized_query):
        return 1

    if f" {normalized_query} " in f" {normalized_name} ":
        return 2

    query_tokens = normalized_query.split()
    name_tokens = set(normalized_name.split())
    if query_tokens and all(token in name_tokens for token in query_tokens):
        return 3

    if normalized_query in normalized_name:
        return 4

    return 5


def clean_list(value) -> list[str]:
    if isinstance(value, list) and len(value) > 0:
        return [str(v) for v in value]
    return ["No disponible"]


def build_chroma_document(game: dict) -> str:
    name = game.get("name", "Sin nombre")
    about = clean_text(game.get("about_the_game", ""))
    detailed = clean_text(game.get("detailed_description", ""))
    developers = ", ".join(clean_list(game.get("developers")))
    publishers = ", ".join(clean_list(game.get("publishers")))
    genres = ", ".join(clean_list(game.get("genres")))

    return f"""
{name}

---- ACERCA DEL JUEGO ----:
{about}

---- DESCRIPCIÓN DETALLADA ----:
{detailed}

---- DESARROLLADORES ----:
{developers}

---- PUBLICADORES ----:
{publishers}

---- GÉNEROS ----:
{genres}
"""


def chroma_metadata_for(game: dict) -> dict:
    return {
        "name": game.get("name", "Sin nombre"),
        "developers": clean_list(game.get("developers")),
        "publishers": clean_list(game.get("publishers")),
        "categories": clean_list(game.get("categories")),
        "genres": clean_list(game.get("genres")),
    }


def chroma_add_game(mongo_id: str, game: dict) -> None:
    if chroma_collection is None:
        return

    try:
        chroma_collection.add(
            documents=[build_chroma_document(game)],
            metadatas=[chroma_metadata_for(game)],
            ids=[mongo_id],
        )
    except Exception as exc:
        print(f"No se pudo indexar en ChromaDB: {exc}")


def chroma_update_game(mongo_id: str, game: dict) -> None:
    if chroma_collection is None:
        return

    try:
        chroma_collection.delete(ids=[mongo_id])
    except Exception:
        pass

    chroma_add_game(mongo_id, game)


def chroma_delete_game(mongo_id: str) -> None:
    if chroma_collection is None:
        return

    try:
        chroma_collection.delete(ids=[mongo_id])
    except Exception as exc:
        print(f"No se pudo eliminar de ChromaDB: {exc}")


def bootstrap_chroma_collection() -> None:
    if chroma_collection is None:
        return

    if chroma_collection.count() > 0:
        return

    documents: list[str] = []
    metadatas: list[dict] = []
    ids: list[str] = []

    for game in games_collection.find():
        game_id = str(game["_id"])
        documents.append(build_chroma_document(game))
        ids.append(game_id)
        metadatas.append(chroma_metadata_for(game))

    if documents:
        chroma_collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )


def load_chroma_collection():
    try:
        chroma_client = chromadb.Client(
            chromadb.config.Settings(persist_directory=CHROMA_DIR)
        )
        return chroma_client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            embedding_function=SimpleEmbeddingFunction(CHROMA_DIMENSION),
        )
    except Exception as exc:
        print(f"ChromaDB no disponible: {exc}")
        return None


chroma_collection = load_chroma_collection()
bootstrap_chroma_collection()


def fetch_games_by_ids(game_ids: List[str]) -> List[dict]:
    object_ids = []
    for game_id in game_ids:
        try:
            object_ids.append(ObjectId(game_id))
        except Exception:
            continue

    if not object_ids:
        return []

    docs = list(games_collection.find({"_id": {"$in": object_ids}}))
    docs_by_id = {str(doc["_id"]): doc for doc in docs}

    ordered_docs = []
    for game_id in game_ids:
        doc = docs_by_id.get(game_id)
        if doc:
            ordered_docs.append(mongo_to_game(doc))

    return ordered_docs


def get_user_favorite_ids(user_doc: dict) -> list[str]:
    favorites = user_doc.get("favorites", [])
    return [favorite_id for favorite_id in favorites if isinstance(favorite_id, str)]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain, hashed) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401)

    return user


def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Acceso restringido a administradores"
        )
    return current_user


def obtener_media_steam(steam_appid: int):
    url = f"https://store.steampowered.com/api/appdetails?cc=us&l=english&appids={steam_appid}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()

    key = str(steam_appid)
    if key not in data or not data[key]["success"]:
        return None

    d = data[key]["data"]

    def mejor_resolucion(formato_dict):
        if not formato_dict:
            return None
        if "max" in formato_dict:
            return formato_dict["max"]
        valores = list(formato_dict.values())
        return valores[0] if valores else None

    screenshots = [
        {
            "id": s.get("id"),
            "thumbnail": s.get("path_thumbnail"),
            "full": s.get("path_full"),
        }
        for s in d.get("screenshots", [])
    ]

    movies = []
    for m in d.get("movies", []):
        mp4 = mejor_resolucion(m.get("mp4"))
        webm = mejor_resolucion(m.get("webm"))

        if mp4 or webm:
            movies.append({
                "id": m.get("id"),
                "name": m.get("name"),
                "thumbnail": m.get("thumbnail"),
                "webm": webm,
                "mp4": mp4,
            })

    return {
        "header_image": d.get("header_image"),
        "background": d.get("background_raw") or d.get("background"),
        "screenshots": screenshots,
        "movies": movies,
    }


# ─────────────────────────────────────────────
#  IMPORTACIÓN AUTOMÁTICA DESDE STEAM (para /games)
# ─────────────────────────────────────────────

def obtener_juego_steam_completo(app_id: int, intentos: int = 3) -> dict:
    url = f"https://store.steampowered.com/api/appdetails{STEAM_PARAMS}&appids={app_id}"

    ultimo_error = None
    for intento in range(1, intentos + 1):
        try:
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            data = response.json()

            key = str(app_id)
            if key not in data or not data[key]["success"]:
                raise HTTPException(status_code=502, detail="Steam no devolvió datos válidos para este AppID")

            return data[key]["data"]

        except requests.exceptions.RequestException as exc:
            ultimo_error = exc
            if intento < intentos:
                time.sleep(2 * intento)  # espera 2s, luego 4s antes de reintentar
            continue

    raise HTTPException(
        status_code=502,
        detail=f"No se pudo conectar con Steam después de {intentos} intentos: {ultimo_error}"
    )


def limpiar_html_texto(texto):
    if not texto:
        return texto

    soup = BeautifulSoup(texto, "html.parser")
    texto_limpio = soup.get_text(separator="\n")
    lineas = [l.strip() for l in texto_limpio.splitlines()]
    return "\n".join(l for l in lineas if l)


def limpiar_textos_html_juego(game_data: dict) -> dict:
    for campo in ["detailed_description", "about_the_game", "short_description", "supported_languages", "legal_notice"]:
        if campo in game_data:
            game_data[campo] = limpiar_html_texto(game_data[campo])

    for req in ["pc_requirements", "mac_requirements", "linux_requirements"]:
        if req in game_data and isinstance(game_data[req], dict):
            for nivel in ["minimum", "recommended"]:
                if nivel in game_data[req]:
                    game_data[req][nivel] = limpiar_html_texto(game_data[req][nivel])

    return game_data


def limpiar_imagenes_juego(game_data: dict) -> dict:
    for campo in ["background", "background_raw", "capsule_image", "capsule_imagev5", "screenshots", "movies"]:
        game_data.pop(campo, None)
    return game_data


def procesar_dlcs_juego(game_data: dict, limite: int = 10) -> dict:
    dlc_ids = game_data.get("dlc", [])
    dlcs_info = []

    for dlc_id in dlc_ids[:limite]:
        try:
            dlc_url = f"https://store.steampowered.com/api/appdetails{STEAM_PARAMS}&appids={dlc_id}"
            dlc_resp = requests.get(dlc_url, timeout=20)
            dlc_resp.raise_for_status()
            dlc_data = dlc_resp.json()

            key = str(dlc_id)
            if key not in dlc_data or not dlc_data[key]["success"]:
                continue

            dlc = dlc_data[key]["data"]
            price = None
            if "price_overview" in dlc:
                p = dlc["price_overview"]
                price = {
                    "currency": p.get("currency"),
                    "initial": p.get("initial", 0) / 100,
                    "final": p.get("final", 0) / 100,
                    "discount_percent": p.get("discount_percent", 0),
                }

            dlcs_info.append({
                "appid": dlc_id,
                "name": dlc.get("name"),
                "type": dlc.get("type"),
                "is_free": dlc.get("is_free", False),
                "release_date": dlc.get("release_date", {}).get("date"),
                "price": price,
            })
        except requests.RequestException:
            continue

    if dlcs_info:
        game_data["dlcs"] = dlcs_info

    game_data.pop("dlc", None)
    return game_data


def importar_juego_desde_steam(steam_appid: int, youtube_trailer_id: Optional[str] = None) -> dict:
    juego = obtener_juego_steam_completo(steam_appid)
    juego = procesar_dlcs_juego(juego, limite=10)
    juego = limpiar_imagenes_juego(juego)
    juego = limpiar_textos_html_juego(juego)

    juego["steam_appid"] = steam_appid

    if youtube_trailer_id:
        juego["youtube_trailer_id"] = youtube_trailer_id

    return juego

# ─────────────────────────────────────────────
#  AUTH ENDPOINTS
# ─────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
def register(user: UserRegister):
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(400, "Usuario ya existe")

    users_collection.insert_one({
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password),
        "role": "user",
        "is_active": True,
        "favorites": [],
        "created_at": datetime.utcnow(),
        "last_login": None
    })

    return {"message": "Usuario registrado correctamente"}


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db_user = users_collection.find_one({"username": form_data.username})

    if not db_user or not verify_password(form_data.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_access_token({
        "sub": db_user["username"],
        "role": db_user["role"]
    })

    users_collection.update_one(
        {"_id": db_user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }

# ─────────────────────────────────────────────
#  ENDPOINTS EXISTENTES (PROTEGIDOS)
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    client.admin.command("ping")
    return {"status": "ok", "mongodb": "connected"}


@app.get("/games", response_model=List[Game])
def list_games(limit: int = 1000, current_user=Depends(get_current_user)):
    docs = games_collection.find().sort("name", 1).limit(limit)
    return [mongo_to_game(d) for d in docs]


@app.get("/games/search", response_model=List[Game])
def search_games(q: str, limit: int = 12, current_user=Depends(get_current_user)):
    query = q.strip()
    if not query:
        return list_games(limit=limit, current_user=current_user)

    if chroma_collection is None:
        raise HTTPException(status_code=503, detail="El buscador semántico no está disponible")

    limit = max(1, min(limit, 50))
    candidate_count = min(max(limit * 5, 40), 200)

    results = chroma_collection.query(
        query_texts=[query],
        n_results=candidate_count
    )

    game_ids = results.get("ids", [[]])[0]
    games = fetch_games_by_ids(game_ids)
    semantic_position = {game_id: index for index, game_id in enumerate(game_ids)}

    games.sort(
        key=lambda game: (
            name_match_bucket(game.get("name"), query),
            semantic_position.get(game.get("id", ""), 10_000),
            (game.get("name") or "").lower(),
        )
    )

    return games[:limit]


@app.get("/games/mongo_id/{mongo_id}", response_model=Game)
def get_game_by_mongo_id(mongo_id: str, current_user=Depends(get_current_user)):
    doc = games_collection.find_one({"_id": parse_id(mongo_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")
    return mongo_to_game(doc)


@app.get("/games/steam_appid/{steam_appid}", response_model=Game)
def get_game_by_steam_appid(steam_appid: int, current_user=Depends(get_current_user)):
    doc = games_collection.find_one({"steam_appid": steam_appid})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")
    return mongo_to_game(doc)


@app.get("/games/{mongo_id}/media")
def get_game_media(mongo_id: str, current_user=Depends(get_current_user)):
    doc = games_collection.find_one({"_id": parse_id(mongo_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")

    steam_appid = doc.get("steam_appid")

    if steam_appid in media_cache:
        return media_cache[steam_appid]

    media = obtener_media_steam(steam_appid)
    if not media:
        raise HTTPException(status_code=502, detail="No se pudo obtener multimedia desde Steam")

    media_cache[steam_appid] = media
    return media


@app.get("/users/me/favorites", response_model=List[Game])
def get_my_favorites(current_user=Depends(get_current_user)):
    favorite_ids = get_user_favorite_ids(current_user)
    games = fetch_games_by_ids(favorite_ids)
    return sorted(games, key=lambda g: (g.get("name") or "").lower())


@app.post("/users/me/favorites/{mongo_id}")
def add_to_favorites(mongo_id: str, current_user=Depends(get_current_user)):
    doc = games_collection.find_one({"_id": parse_id(mongo_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"favorites": mongo_id}}
    )

    return {"message": "Juego agregado a favoritos"}


@app.delete("/users/me/favorites/{mongo_id}")
def remove_from_favorites(mongo_id: str, current_user=Depends(get_current_user)):
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"favorites": mongo_id}}
    )

    return {"message": "Juego eliminado de favoritos"}

ALLOWED_VIDEO_SUFFIXES = (
    ".akamaihd.net",
    ".steamstatic.com",
    ".steamcontent.com",
    "steampowered.com",
)

@app.get("/media/video-proxy")
def proxy_video(url: str, request: Request):
    from urllib.parse import urlparse

    hostname = urlparse(url).hostname or ""
    if not any(hostname.endswith(suffix) for suffix in ALLOWED_VIDEO_SUFFIXES):
        raise HTTPException(status_code=400, detail="Host no permitido")

    headers = {
        "Referer": "https://store.steampowered.com/",
        "User-Agent": "Mozilla/5.0",
    }
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    upstream = requests.get(url, headers=headers, stream=True, timeout=15)

    resp_headers = {}
    for h in ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]:
        if h in upstream.headers:
            resp_headers[h] = upstream.headers[h]

    def iter_content():
        for chunk in upstream.iter_content(chunk_size=8192):
            yield chunk

    return StreamingResponse(
        iter_content(),
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("Content-Type", "video/mp4"),
    )

# ─────────────────────────────────────────────
#  ENDPOINTS CRUD (PROTEGIDOS, SOLO ADMIN)
# ─────────────────────────────────────────────

@app.post("/games", status_code=201)
def create_game(
    game: GameCreate,
    admin=Depends(require_admin)
):
    if games_collection.find_one({"steam_appid": game.steam_appid}):
        raise HTTPException(400, "Juego ya existe")

    juego_data = importar_juego_desde_steam(game.steam_appid, game.youtube_trailer_id)

    result = games_collection.insert_one(juego_data)
    juego_data["_id"] = result.inserted_id

    chroma_add_game(str(result.inserted_id), juego_data)

    return {
        "message": "Juego importado correctamente desde Steam",
        "id": str(result.inserted_id)
    }


@app.put("/games/{mongo_id}")
def update_game(
    mongo_id: str,
    game: Dict,
    admin=Depends(require_admin)
):
    payload = {key: value for key, value in game.items() if value is not None}
    result = games_collection.update_one(
        {"_id": parse_id(mongo_id)},
        {"$set": payload}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Juego no encontrado")

    updated_doc = games_collection.find_one({"_id": parse_id(mongo_id)})
    if updated_doc:
        chroma_update_game(mongo_id, updated_doc)

    return {"message": "Juego actualizado correctamente"}


@app.delete("/games/{mongo_id}", status_code=204)
def delete_game(
    mongo_id: str,
    admin=Depends(require_admin)
):
    result = games_collection.delete_one(
        {"_id": parse_id(mongo_id)}
    )

    if result.deleted_count == 0:
        raise HTTPException(404, "Juego no encontrado")

    chroma_delete_game(mongo_id)