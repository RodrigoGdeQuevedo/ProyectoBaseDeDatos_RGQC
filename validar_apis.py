import requests
import json
import time

APP_IDS = [
    250900, 1817070, 1817190, 2651270, 377160, 1245620, 1097150, 431960,
    489830, 2767030, 2357570, 1237970, 782330, 219150, 1850570, 1810700,
    3017860, 311690, 271590, 976730, 367520, 1032730, 517630, 249130,
    21000, 213330, 313690, 920210, 1627720, 307780, 238320, 239030,
    3045800, 400, 620, 504230, 814380, 2215430, 213670, 488790,
    1172380, 413150, 40800, 113200, 391540, 553420, 553850, 243470,
    960990, 253230, 250320, 1827100, 683320, 1721470, 1790600,
    1593500, 324850, 1151640, 1174180, 1810690, 2290650, 686060,
    2748230, 1091500, 292030, 1086940, 374320, 570940, 2050650,
    1196590, 588650, 1145360, 646570, 105600, 427520, 294100,
    242760, 1326470, 264710, 892970, 275850, 945360, 268910,
    424840, 860510, 261570, 1057090, 1703340, 632470, 1092790,
    381210, 739630, 1966720, 730, 1172470, 252490, 218620,
    305620, 460950, 257850
]

URL = "https://store.steampowered.com/api/appdetails"

validos = {}
invalidos = []

for app_id in APP_IDS:
    try:
        response = requests.get(
            URL,
            params={"appids": app_id, "l": "spanish"},
            timeout=10
        )
        data = response.json()

        if str(app_id) in data and data[str(app_id)].get("success"):
            validos[app_id] = data[str(app_id)]["data"]["name"]
            print(f"{app_id} - OK")
        else:
            invalidos.append(app_id)
            print(f"{app_id} - NO EXISTE")

    except Exception as e:
        invalidos.append(app_id)
        print(f"{app_id} - ERROR ({e})")

    time.sleep(0.8)  # importante para no ser rate-limited

# Guardar resultados
with open("validos.json", "w", encoding="utf-8") as f:
    json.dump(validos, f, indent=4, ensure_ascii=False)

with open("invalidos.json", "w", encoding="utf-8") as f:
    json.dump(invalidos, f, indent=4)

print("\nProceso terminado.")
print(f"Validos: {len(validos)}")
print(f"Invalidos: {len(invalidos)}")