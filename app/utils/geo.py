import requests

def geolocalizar_ciudad(localidad: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": localidad + ", Argentina", "format": "json", "limit": 1}
    headers = {"User-Agent": "clima-app"}
    res = requests.get(url, params=params, headers=headers)
    if res.ok and res.json():
        datos = res.json()[0]
        return float(datos["lat"]), float(datos["lon"])
    return None, None