"""Carga idempotente en MongoDB los juegos declarados en validos.json."""

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://admin:test1234@localhost:27017/?authSource=admin",
)


def clean_html(value):
    if not isinstance(value, str):
        return value
    text = BeautifulSoup(value, "html.parser").get_text(separator="\n")
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def fetch_game(app_id):
    response = requests.get(
        "https://store.steampowered.com/api/appdetails",
        params={"appids": app_id, "cc": "us", "l": "english"},
        timeout=20,
    )
    response.raise_for_status()
    result = response.json().get(str(app_id), {})
    if not result.get("success"):
        return None

    game = result["data"]
    if game.get("type") != "game":
        return None

    game["steam_appid"] = app_id
    for field in ("background", "background_raw", "screenshots", "movies", "capsule_image", "capsule_imagev5", "dlc"):
        game.pop(field, None)
    for field in ("detailed_description", "about_the_game", "short_description", "supported_languages", "legal_notice"):
        if field in game:
            game[field] = clean_html(game[field])
    for field in ("pc_requirements", "mac_requirements", "linux_requirements"):
        requirements = game.get(field)
        if isinstance(requirements, dict):
            for key in ("minimum", "recommended"):
                if key in requirements:
                    requirements[key] = clean_html(requirements[key])
    return game


def main():
    with (BASE_DIR / "validos.json").open(encoding="utf-8") as source:
        app_ids = [int(app_id) for app_id in json.load(source)]

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    collection = client["juegos"]["catalogo"]
    client.admin.command("ping")
    inserted = 0
    skipped = 0

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_game, app_id): app_id for app_id in app_ids}
        for future in as_completed(futures):
            app_id = futures[future]
            try:
                game = future.result()
                if not game:
                    skipped += 1
                    continue
                result = collection.update_one(
                    {"steam_appid": app_id},
                    {"$setOnInsert": game},
                    upsert=True,
                )
                inserted += int(result.upserted_id is not None)
                skipped += int(result.upserted_id is None)
                print(f"{game['name']}: {'agregado' if result.upserted_id else 'ya existía'}")
            except Exception as error:
                skipped += 1
                print(f"App ID {app_id}: no se pudo cargar ({error})")

    print(f"Carga terminada: {inserted} juegos agregados; {skipped} omitidos.")
    client.close()


if __name__ == "__main__":
    main()
