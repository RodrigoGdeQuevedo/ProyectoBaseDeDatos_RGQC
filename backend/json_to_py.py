import os
import json
from pymongo import MongoClient

# ==========================
# RUTA A LOS JSON
# ==========================
CARPETA_JSONS = r"C:\Users\rdgal\OneDrive\Documentos\Ing. en Programación de Videojuegos\4to Semestre\Base de Datos 2\Archivos JSON"

# ==========================
# MONGODB (Docker)
# ==========================
MONGO_URI = "mongodb://rodrigogdeq:xbox14life@localhost:27017"

client = MongoClient(
    MONGO_URI,
    authSource="admin"
)

db = client["juegos"]
catalogo = db["catalogo"]

# ==========================
# LEER JSON
# ==========================
documentos = []

for archivo in os.listdir(CARPETA_JSONS):
    if not archivo.endswith(".json"):
        continue

    ruta = os.path.join(CARPETA_JSONS, archivo)

    try:
        with open(ruta, "r", encoding="utf-8") as f:
            data = json.load(f)

            data["_archivo_origen"] = archivo
            documentos.append(data)

        print(f"{archivo} cargado")

    except Exception as e:
        print(f"Error en {archivo}: {e}")

# ==========================
# INSERTAR EN MONGODB
# ==========================
if documentos:
    catalogo.insert_many(documentos)
    print(f"\n{len(documentos)} documentos insertados en MongoDB")
else:
    print("\nNo se inserto ningun documento")