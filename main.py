# from fastapi import FastAPI, HTTPException, status
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel, Field
# from pymongo import MongoClient
# from bson import ObjectId
# from bson.errors import InvalidId
# from typing import Optional, List, Dict
# import os

# # ─────────────────────────────────────────────
# #  CONEXIÓN MONGODB
# # ─────────────────────────────────────────────
# DB_NAME = "juegos"
# COLLECTION_NAME = "catalogo"

# MONGO_URI = os.getenv(
#     "MONGO_URI",
#     "mongodb://rodrigogdeq:xbox14life@localhost:27017"
# )

# client = MongoClient(MONGO_URI)
# db = client[DB_NAME]
# games = db[COLLECTION_NAME]

# games.create_index("steam_appid", unique=True)

# # ─────────────────────────────────────────────
# #  APP
# # ─────────────────────────────────────────────
# app = FastAPI(
#     title="Steam Games API",
#     description="API REST para catálogo de videojuegos de Steam",
#     version="1.0.0"
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ─────────────────────────────────────────────
# #  MODELOS
# # ─────────────────────────────────────────────

# class PriceOverview(BaseModel):
#     currency: str
#     initial: float
#     final: float
#     discount_percent: int


# class Requirements(BaseModel):
#     minimum: Optional[str] = None
#     recommended: Optional[str] = None


# class DLC(BaseModel):
#     appid: str
#     name: str
#     type: str
#     is_free: bool
#     release_date: Optional[str]
#     price: Optional[PriceOverview]


# class GameOut(BaseModel):
#     id: str
#     steam_appid: int
#     type: str
#     name: str

#     about_the_game: Optional[str]
#     detailed_description: Optional[str]
#     short_description: Optional[str]
#     supported_languages: Optional[str]

#     developers: List[str] = []
#     publishers: List[str] = []

#     genres: List[Dict] = []
#     categories: List[Dict] = []

#     price_overview: Optional[PriceOverview]

#     platforms: Optional[Dict[str, bool]]

#     pc_requirements: Optional[Requirements]
#     mac_requirements: Optional[Requirements]
#     linux_requirements: Optional[Requirements]

#     release_date: Optional[Dict]
#     dlcs: List[DLC] = []

# # ─────────────────────────────────────────────
# #  HELPERS
# # ─────────────────────────────────────────────

# def parse_id(id_str: str) -> ObjectId:
#     try:
#         return ObjectId(id_str)
#     except (InvalidId, Exception):
#         raise HTTPException(status_code=404, detail="Juego no encontrado")


# def game_to_out(doc: dict) -> dict:
#     return {
#         "id": str(doc["_id"]),
#         "steam_appid": doc.get("steam_appid"),
#         "type": doc.get("type"),
#         "name": doc.get("name"),

#         "about_the_game": doc.get("about_the_game"),
#         "detailed_description": doc.get("detailed_description"),
#         "short_description": doc.get("short_description"),
#         "supported_languages": doc.get("supported_languages"),

#         "developers": doc.get("developers", []),
#         "publishers": doc.get("publishers", []),

#         "genres": doc.get("genres", []),
#         "categories": doc.get("categories", []),

#         "price_overview": doc.get("price_overview"),

#         "platforms": doc.get("platforms"),

#         "pc_requirements": doc.get("pc_requirements"),
#         "mac_requirements": doc.get("mac_requirements"),
#         "linux_requirements": doc.get("linux_requirements"),

#         "release_date": doc.get("release_date"),
#         "dlcs": doc.get("dlcs", []),
#     }

# # ─────────────────────────────────────────────
# #  ENDPOINTS
# # ─────────────────────────────────────────────

# @app.get("/health")
# def health():
#     client.admin.command("ping")
#     return {"status": "ok", "mongodb": "connected"}


# @app.get("/games", response_model=List[GameOut])
# def list_games(
#     genre: Optional[str] = None,
#     developer: Optional[str] = None,
#     publisher: Optional[str] = None,
# ):
#     """
#     Listar juegos con filtros opcionales:
#     /games?genre=Action
#     /games?developer=NEOWIZ
#     """
#     query = {}

#     if genre:
#         query["genres.description"] = genre
#     if developer:
#         query["developers"] = developer
#     if publisher:
#         query["publishers"] = publisher

#     docs = games.find(query).sort("name", 1)
#     return [game_to_out(d) for d in docs]


# @app.get("/games/{game_id}", response_model=GameOut)
# def get_game(game_id: str):
#     doc = games.find_one({"_id": parse_id(game_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Juego no encontrado")
#     return game_to_out(doc)


# @app.get("/games/steam/{appid}", response_model=GameOut)
# def get_game_by_appid(appid: int):
#     doc = games.find_one({"steam_appid": appid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Juego no encontrado")
#     return game_to_out(doc)
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
    description="API REST para catálogo de juegos de Steam"
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