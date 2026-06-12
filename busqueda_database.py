import re
import json
from pymongo import MongoClient

# ==========================
# CONFIGURACIÓN MONGODB
# ==========================
MONGO_URI = "mongodb://rodrigogdeq:xbox14life@localhost:27017"
DB_NAME = "juegos"
COLLECTION_NAME = "catalogo"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ==========================
# FUNCIÓN: OBTENER TIPO DE CAMPO (ANIDADO HASTA 4 NIVELES)
# ==========================
def obtener_tipo(documento, ruta, max_niveles=4):
    partes = ruta.split(".")
    if len(partes) > max_niveles:
        return None

    valor = documento
    for p in partes:
        if isinstance(valor, list):
            if not valor:
                return None
            valor = valor[0]

        if not isinstance(valor, dict) or p not in valor:
            return None

        valor = valor[p]

    return type(valor)

# ==========================
# DOCUMENTO DE REFERENCIA
# ==========================
ejemplo = collection.find_one()
if not ejemplo:
    print("La colección está vacía.")
    exit()

# ==========================
# BUCLE PRINCIPAL
# ==========================
while True:
    print("=" * 70)
    print("Bienvenido a la búsqueda de juegos")
    print("Ingresa las categorías que necesitas separadas por coma")
    print("(categoria1, categoria2, ...)")  
    print("Escribe 'salir' para terminar")

    entrada = input("\nCategorías: ").strip()

    if entrada.lower() == "salir":
        print("\nFin del programa.")
        break

    categorias = [c.strip() for c in entrada.split(",") if c.strip()]
    if not categorias:
        print("No ingresaste categorías.")
        continue

    condiciones = []
    error = False

    for categoria in categorias:
        valor = input(f"Valor para '{categoria}': ").strip()
        if valor == "":
            print("Valor vacío.")
            error = True
            break

        tipo = obtener_tipo(ejemplo, categoria)
        if tipo is None:
            print(f"Campo inválido o demasiado profundo: {categoria}")
            error = True
            break

        if tipo is bool:
            if valor.lower() not in ("true", "false"):
                print(f"Valor boolean inválido para {categoria}")
                error = True
                break
            condiciones.append({categoria: valor.lower() == "true"})

        elif tipo in (int, float):
            try:
                condiciones.append({categoria: tipo(valor)})
            except ValueError:
                print(f"Valor numérico inválido para {categoria}")
                error = True
                break

        else:
            regex = re.compile(valor, re.IGNORECASE)
            condiciones.append({categoria: {"$regex": regex}})

    if error:
        continue

    # ==========================
    # EJECUTAR CONSULTA
    # ==========================
    consulta = {"$and": condiciones}
    resultados = list(collection.find(consulta))

    if not resultados:
        print("\nNo se encontraron coincidencias.")
        continue

    print(f"\nSe encontraron {len(resultados)} juego(s):\n")

    for i, juego in enumerate(resultados, start=1):
        print("=" * 80)
        print(f"Juego #{i}")
        print("=" * 80)

        juego["_id"] = str(juego["_id"])
        print(json.dumps(juego, indent=2, ensure_ascii=False))

    print("\nPuedes hacer otra búsqueda o escribir 'salir'\n")