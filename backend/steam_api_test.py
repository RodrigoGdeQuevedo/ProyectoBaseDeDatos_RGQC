import requests
import json
import re
import time
import os
from bs4 import BeautifulSoup

STEAM_PARAMS = "?cc=us&l=english"


# ===============================
# API STEAM
# ===============================

def obtener_juego_steam(app_id):
    url = f"https://store.steampowered.com/api/appdetails{STEAM_PARAMS}&appids={app_id}"

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()

    if app_id not in data or not data[app_id]["success"]:
        raise ValueError("Steam no devolvió datos válidos para este AppID")

    return data[app_id]["data"]


def obtener_dlc_basico(dlc_app_id):
    url = f"https://store.steampowered.com/api/appdetails{STEAM_PARAMS}&appids={dlc_app_id}"

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()

    if dlc_app_id not in data or not data[dlc_app_id]["success"]:
        return None

    dlc = data[dlc_app_id]["data"]

    price = None
    if "price_overview" in dlc:
        p = dlc["price_overview"]
        price = {
            "currency": p.get("currency"),   # USD
            "initial": p.get("initial", 0) / 100,
            "final": p.get("final", 0) / 100,
            "discount_percent": p.get("discount_percent", 0)
        }

    return {
        "appid": dlc_app_id,
        "name": dlc.get("name"),
        "type": dlc.get("type"),
        "is_free": dlc.get("is_free", False),
        "release_date": dlc.get("release_date", {}).get("date"),
        "price": price
    }


def procesar_dlcs(game_data, limite=20):
    dlc_ids = game_data.get("dlc", [])
    dlcs_info = []

    for dlc_id in dlc_ids[:limite]:
        dlc_info = obtener_dlc_basico(str(dlc_id))
        if dlc_info:
            dlcs_info.append(dlc_info)

        time.sleep(0.25)

    if dlcs_info:
        game_data["dlcs"] = dlcs_info

    game_data.pop("dlc", None)
    return game_data


# ===============================
# LIMPIEZA
# ===============================

def limpiar_imagenes(game_data):
    for campo in [
        "header_image",
        "background",
        "background_raw",
        "capsule_image",
        "capsule_imagev5",
        "screenshots",
        "movies"
    ]:
        game_data.pop(campo, None)

    return game_data


def limpiar_html(texto):
    if not texto:
        return texto

    soup = BeautifulSoup(texto, "html.parser")
    texto_limpio = soup.get_text(separator="\n")

    lineas = [l.strip() for l in texto_limpio.splitlines()]
    return "\n".join(l for l in lineas if l)


def limpiar_textos_html(game_data):
    for campo in [
        "detailed_description",
        "about_the_game",
        "short_description",
        "supported_languages",
        "legal_notice"
    ]:
        if campo in game_data:
            game_data[campo] = limpiar_html(game_data[campo])

    for req in ["pc_requirements", "mac_requirements", "linux_requirements"]:
        if req in game_data:
            for nivel in ["minimum", "recommended"]:
                if nivel in game_data[req]:
                    game_data[req][nivel] = limpiar_html(game_data[req][nivel])

    return game_data


# ===============================
# ARCHIVOS
# ===============================

def nombre_archivo_desde_juego(nombre_juego):
    nombre = nombre_juego.lower()
    nombre = re.sub(r"[^\w\s-]", "", nombre)
    nombre = re.sub(r"\s+", "_", nombre)
    return f"steam_{nombre}.json"


def guardar_json_en_carpeta(nombre_archivo, datos):
    carpeta = "Archivos JSON"
    os.makedirs(carpeta, exist_ok=True)

    ruta = os.path.join(carpeta, nombre_archivo)

    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=2, ensure_ascii=False)

    return ruta


# ===============================
# MAIN
# ===============================

if __name__ == "__main__":
    app_id = input("Ingresa el AppID del juego de Steam: ").strip()

    try:
        juego = obtener_juego_steam(app_id)
        juego = procesar_dlcs(juego, limite=20)
        juego = limpiar_imagenes(juego)
        juego = limpiar_textos_html(juego)

        archivo = nombre_archivo_desde_juego(juego["name"])
        ruta = guardar_json_en_carpeta(archivo, juego)

        print(f"JSON generado correctamente en: \n{ruta}")

    except Exception as e:
        print(f"Error: {e}")