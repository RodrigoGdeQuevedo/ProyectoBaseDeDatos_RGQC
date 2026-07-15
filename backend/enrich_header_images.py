import os
import time
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://rodrigogdeq:xbox14life@localhost:27017")

client = MongoClient(MONGO_URI)
db = client["juegos"]
games_collection = db["catalogo"]


def obtener_header_image(steam_appid):
    url = f"https://store.steampowered.com/api/appdetails?cc=us&l=english&appids={steam_appid}"
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    data = response.json()

    key = str(steam_appid)
    if key not in data or not data[key]["success"]:
        return None

    return data[key]["data"].get("header_image")


def main():
    juegos = list(games_collection.find({"header_image": {"$exists": False}}))
    print(f"Juegos sin header_image: {len(juegos)}")

    for juego in juegos:
        nombre = juego.get("name")
        steam_appid = juego.get("steam_appid")

        try:
            header_image = obtener_header_image(steam_appid)

            if header_image:
                games_collection.update_one(
                    {"_id": juego["_id"]},
                    {"$set": {"header_image": header_image}}
                )
                print(f"OK: {nombre} -> imagen agregada")
            else:
                print(f"Sin header_image para: {nombre}")

        except requests.RequestException as e:
            print(f"Error de red con {nombre}, se reintentará después: {e}")
            time.sleep(3)
            continue

        time.sleep(0.3)


if __name__ == "__main__":
    main()