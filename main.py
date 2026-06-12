from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List, Dict, Any
import os

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

# ─────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Steam Games API",
    version="1.0.0",
    description="API REST para catalogo de juegos de Steam"
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

    pc_requirements: Optional[dict] = None
    mac_requirements: Optional[dict] = None
    linux_requirements: Optional[dict] = None

    developers: Optional[list[str]] = None
    publishers: Optional[list[str]] = None

    categories: Optional[list[dict]] = None
    genres: Optional[list[dict]] = None

    price_overview: Optional[dict] = None
    platforms: Optional[dict] = None
    
    dlcs: Optional[List[DLC]] = None

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def parse_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except (InvalidId, Exception):
        raise HTTPException(status_code=404, detail="Juego no encontrado")


def normalize_requirements(game: dict):
    """
    Convierte [] → None para evitar errores de validación
    """
    for key in ["pc_requirements", "mac_requirements", "linux_requirements"]:
        if isinstance(game.get(key), list):
            game[key] = None
    return game


def mongo_to_game(doc: dict) -> dict:
    doc = normalize_requirements(doc)
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc


# ─────────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    try:
        client.admin.command("ping")
        return {"status": "ok", "mongodb": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/games", response_model=List[Game])
def list_games(limit: int = 100):
    """
    Lista juegos.
    """
    docs = games_collection.find().limit(limit)
    return [mongo_to_game(d) for d in docs]


@app.get("/games/mongo_id/{mongo_id}", response_model=Game)
def get_game_by_mongo_id(mongo_id: str):
    """
    Obtiene un juego por MongoID.
    """
    doc = games_collection.find_one({"_id": parse_id(mongo_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")
    return mongo_to_game(doc)


@app.get("/games/steam_appid/{steam_appid}", response_model=Game)
def get_game_by_steam_appid(steam_appid: int):
    """
    Obtiene un juego por steam_appid.
    """
    doc = games_collection.find_one({"steam_appid": steam_appid})
    if not doc:
        raise HTTPException(status_code=404, detail="Juego no encontrado")
    return mongo_to_game(doc)