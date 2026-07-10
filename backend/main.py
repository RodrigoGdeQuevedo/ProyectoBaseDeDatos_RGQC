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
from fastapi import Request
from fastapi.responses import StreamingResponse

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
    name: str
    steam_appid: int
    type: Optional[str] = "game"
    is_free: Optional[bool] = False

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
def list_games(limit: int = 100, current_user=Depends(get_current_user)):
    docs = games_collection.find().limit(limit)
    return [mongo_to_game(d) for d in docs]


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

    result = games_collection.insert_one(game.dict())

    return {
        "message": "Juego agregado correctamente",
        "id": str(result.inserted_id)
    }
    
@app.put("/games/{mongo_id}")
def update_game(
    mongo_id: str,
    game: Dict,
    admin=Depends(require_admin)
):
    result = games_collection.update_one(
        {"_id": parse_id(mongo_id)},
        {"$set": game}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Juego no encontrado")

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