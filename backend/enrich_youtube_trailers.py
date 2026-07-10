import os
import time
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://rodrigogdeq:xbox14life@localhost:27017"
)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

if not YOUTUBE_API_KEY:
    raise SystemExit("Falta YOUTUBE_API_KEY en el archivo .env")

client = MongoClient(MONGO_URI)
db = client["juegos"]
games_collection = db["catalogo"]


def buscar_trailer_youtube(nombre_juego, max_reintentos=3):
    url = "https://www.googleapis.com/youtube/v3/search"

    params = {
        "part": "snippet",
        "q": f"{nombre_juego} official trailer",
        "type": "video",
        "maxResults": 1,
        "key": YOUTUBE_API_KEY,
    }

    for intento in range(1, max_reintentos + 1):

        try:

            response = requests.get(
                url,
                params=params,
                timeout=(5, 30)
            )

            response.raise_for_status()

            data = response.json()

            items = data.get("items", [])

            if not items:
                return None

            return items[0]["id"]["videoId"]

        except requests.exceptions.ReadTimeout:
            print(
                f"Timeout buscando '{nombre_juego}' "
                f"(Intento {intento}/{max_reintentos})"
            )

        except requests.exceptions.ConnectionError:
            print(
                f"Error de conexión con '{nombre_juego}' "
                f"(Intento {intento}/{max_reintentos})"
            )

        except requests.exceptions.HTTPError as e:

            codigo = e.response.status_code

            if codigo == 403:
                print("\nSe agotó la cuota diaria de la API de YouTube.")
                raise

            print(f"HTTP {codigo} con '{nombre_juego}'")
            return None

        except requests.exceptions.RequestException as e:
            print(f"Error con '{nombre_juego}': {e}")

        time.sleep(2)

    return None


def main():

    juegos = list(
        games_collection.find(
            {
                "youtube_trailer_id": {
                    "$exists": False
                }
            }
        )
    )

    total = len(juegos)

    print(f"\nJuegos pendientes: {total}\n")

    procesados = 0
    encontrados = 0

    for juego in juegos:

        nombre = juego.get("name", "Sin nombre")

        procesados += 1

        print(f"[{procesados}/{total}] Buscando: {nombre}")

        try:

            video_id = buscar_trailer_youtube(nombre)

            if video_id:

                games_collection.update_one(
                    {"_id": juego["_id"]},
                    {
                        "$set": {
                            "youtube_trailer_id": video_id
                        }
                    }
                )

                encontrados += 1

                print(f"   OK -> {video_id}")

            else:

                print("   Sin resultados")

        except KeyboardInterrupt:
            print("\nProceso detenido por el usuario.")
            break

        except requests.exceptions.HTTPError:
            break

        except Exception as e:
            print(f"   Error inesperado: {e}")

        time.sleep(0.5)

    print("\n==============================")
    print("Proceso terminado")
    print("==============================")
    print(f"Procesados: {procesados}")
    print(f"Trailers encontrados: {encontrados}")


if __name__ == "__main__":
    main()