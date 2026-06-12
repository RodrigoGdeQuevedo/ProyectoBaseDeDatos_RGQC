import os
import re
from html import unescape
from pymongo import MongoClient
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from tqdm import tqdm

# ======================
# CONFIGURACIÓN MONGODB Y CHROMADB
# ======================
load_dotenv()

# Conexión y nombres de trabajo para MongoDB y ChromaDB.
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://rodrigogdeq:xbox14life@localhost:27017"
)
MONGO_DB = os.getenv("MONGO_DB", "juegos")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "catalogo")

CHROMA_DIR = "chromadb"
CHROMA_COLLECTION = "documentos"

# ======================
# LIMPIEZA DE TEXTO
# ======================

def clean_text(text):
    # Normaliza el texto para evitar HTML, saltos raros y valores vacíos.
    if not text or not isinstance(text, str):
        return "No disponible"

    text = unescape(text)
    text = re.sub(r"<.*?>", "", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()

def clean_list(value):
    # Asegura que los campos de lista siempre tengan contenido legible.
    if isinstance(value, list) and len(value) > 0:
        return [str(v) for v in value]
    return ["No disponible"]

# ======================
# MONGODB
# ======================

# Se leen todos los juegos desde la colección de MongoDB.
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
collection_mongo = db[MONGO_COLLECTION]

games = list(collection_mongo.find())
print(f"Documentos en MongoDB: {len(games)}")

if not games:
    raise SystemExit("No hay datos en MongoDB")

# ======================
# CHROMADB
# ======================

# ChromaDB usará embeddings para buscar por significado, no solo por texto exacto.
embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Cliente persistente: guarda los datos en la carpeta local chromadb.
chroma_client = chromadb.Client(
    chromadb.config.Settings(
        persist_directory=CHROMA_DIR
    )
)

chroma_collection = chroma_client.get_or_create_collection(
    name=CHROMA_COLLECTION,
    embedding_function=embedding_function
)

# Limpia la colección antes de insertar
if chroma_collection.count() > 0:
    chroma_collection.delete(where={})

# ======================
# INSERCIÓN
# ======================

# Estas listas guardan los datos que se insertarán en ChromaDB.
documents = []
metadatas = []
ids = []

for game in tqdm(games, desc="Insertando en ChromaDB"):
    # Se prepara cada juego como un documento de texto con su información principal.
    game_id = str(game["_id"])
    name = game.get("name", "Sin nombre")

    about = clean_text(game.get("about_the_game", ""))
    detailed = clean_text(game.get("detailed_description", ""))

    developers = clean_list(game.get("developers"))
    publishers = clean_list(game.get("publishers"))
    categories = clean_list(game.get("categories"))
    genres = clean_list(game.get("genres"))

    combined_text = f"""
{name}

ABOUT THE GAME:
{about}

DETAILED DESCRIPTION:
{detailed}
"""

    documents.append(combined_text)
    ids.append(game_id)

    metadatas.append({
        "name": name,
        "developers": developers,
        "publishers": publishers,
        "categories": categories,
        "genres": genres
    })

chroma_collection.add(
    documents=documents,
    metadatas=metadatas,
    ids=ids
)

print("Inserción completada correctamente")

# ======================
# SIMPLE SEARCH
# ======================

# Mensaje inicial para que el usuario sepa cómo usar el buscador.
print("\n" + "=" * 70)
print("---- BUSCADOR DE VIDEOJUEGOS ----")
print("=" * 70)
print("Puedes buscar por:")
print("- Nombre del juego")
print("- Género (ej. horror, rpg, strategy)")
print("- Descripción o temática (ej. zombies, space, lego)")
print("- Desarrollador o publisher")
print("\nPresiona ENTER sin escribir nada para salir.")
print("=" * 70)

while True:
    # Si el usuario presiona ENTER, se sale del programa.
    query = input("\nEscribe tu búsqueda o presiona ENTER para salir: ").strip()

    if not query:
        print("\nSaliendo del buscador...")
        break

    results = chroma_collection.query(
        query_texts=[query],
        n_results=3
    )

    if not results["ids"][0]:
        # Mensaje cuando no hay coincidencias suficientes.
        print("\nNo se encontraron resultados similares.")
        continue

    print(f"\nResultados más relevantes para: '{query}'")

    for i in range(len(results["ids"][0])):
        # Se muestran los datos guardados junto con el texto del juego.
        md = results["metadatas"][0][i]
        doc = results["documents"][0][i]

        print("\n" + "=" * 80)
        print(f"{i+1}. {md['name']}")
        print("=" * 80)

        print("\nInformación del juego:\n")
        print(doc)

        print("\nDevelopers:", ", ".join(md["developers"]))
        print("Publishers:", ", ".join(md["publishers"]))
        print("Categories:", ", ".join(md["categories"]))
        print("Genres:", ", ".join(md["genres"]))
        print("=" * 80)