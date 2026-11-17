#!/usr/bin/env python3
"""Validate and refresh recent earthquake records from the SGC ArcGIS service."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sismos.geojson"
METADATA_PATH = ROOT / "data" / "metadatos.json"
SERVICE_URL = (
    "https://srvags.sgc.gov.co/arcgis/rest/services/"
    "catalogo_sismos/catalogo_de_sismos_2/FeatureServer/0/query"
)
SOURCE_URL = SERVICE_URL.rsplit("/query", 1)[0]
WINDOW_DAYS = 30
MAX_RECORDS = 1000
COLOMBIA_TIME = ZoneInfo("America/Bogota")
COLOMBIA_EXTENT = (-84.0, -5.0, -66.0, 15.0)


class SourceError(RuntimeError):
    pass


def request_json(params: dict[str, str]) -> dict:
    url = f"{SERVICE_URL}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": "ORION-data-refresh/1.0"})
    try:
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except Exception as error:
        raise SourceError(f"No se pudo consultar el servicio del SGC: {error}") from error

    if not isinstance(payload, dict) or "error" in payload:
        details = payload.get("error", {}) if isinstance(payload, dict) else {}
        raise SourceError(f"El servicio del SGC devolvió un error: {details}")
    return payload


def get_latest_timestamp() -> int:
    statistics = json.dumps(
        [
            {
                "statisticType": "max",
                "onStatisticField": "ESP_FECHA_LONG",
                "outStatisticFieldName": "max_timestamp",
            }
        ],
        separators=(",", ":"),
    )
    payload = request_json(
        {"where": "1=1", "outStatistics": statistics, "f": "json"}
    )
    features = payload.get("features", [])
    if not features:
        raise SourceError("El catálogo del SGC no informó su fecha de evento más reciente.")

    value = features[0].get("attributes", {}).get("MAX_TIMESTAMP")
    try:
        timestamp = int(value)
    except (TypeError, ValueError) as error:
        raise SourceError("La fecha más reciente del catálogo del SGC no es válida.") from error
    return timestamp


def merge_geojson_features(data: dict, refreshed_features: list[dict]) -> None:
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection":
        raise SourceError("data/sismos.geojson no es una colección GeoJSON válida.")
    if not isinstance(data.get("features"), list):
        raise SourceError("data/sismos.geojson no contiene una lista de eventos.")

    curated_features = [
        feature
        for feature in data["features"]
        if not feature.get("properties", {}).get("actualizacion_automatica")
    ]
    data["features"] = curated_features + refreshed_features


def fetch_recent_features(cutoff_ms: int, now_ms: int) -> list[dict]:
    payload = request_json(
        {
            "where": f"ESP_FECHA_LONG >= {cutoff_ms}",
            "outFields": (
                "OBJECTID,ESP_ID_EVENTO_TXT,ESP_FECHA_LONG,ESP_MAGNITUD,"
                "ESP_PROFUNDIDAD,ESP_LATITUD,ESP_LONGITUD"
            ),
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "json",
        }
    )
    features = payload.get("features")
    if not isinstance(features, list):
        raise SourceError("La respuesta del SGC no contiene una lista de eventos.")
    if payload.get("exceededTransferLimit") or len(features) >= MAX_RECORDS:
        raise SourceError(
            f"El SGC devolvió {len(features)} registros o más; "
            "se cancela la actualización para evitar publicar datos incompletos."
        )
    if not features:
        raise SourceError(
            "El SGC reporta datos recientes, pero no devolvió eventos para el período consultado."
        )

    for feature in features:
        attributes = feature.get("attributes", {})
        try:
            timestamp = int(attributes["ESP_FECHA_LONG"])
            magnitude = float(attributes["ESP_MAGNITUD"])
            geometry = feature["geometry"]
            longitude = float(geometry["x"])
            latitude = float(geometry["y"])
        except (KeyError, TypeError, ValueError) as error:
            raise SourceError("El SGC devolvió un evento incompleto o inválido.") from error

        if timestamp < cutoff_ms or timestamp > now_ms + 5 * 60 * 1000:
            raise SourceError("El SGC devolvió un evento fuera del período validado.")
        if not 0 <= magnitude <= 10:
            raise SourceError("El SGC devolvió una magnitud fuera del rango esperado.")
        west, south, east, north = COLOMBIA_EXTENT
        if not west <= longitude <= east or not south <= latitude <= north:
            raise SourceError("El SGC devolvió un punto fuera del área de cobertura de ORION.")

    return features


def format_event_date(timestamp_ms: int) -> tuple[str, str]:
    event_time = datetime.fromtimestamp(timestamp_ms / 1000, timezone.utc).astimezone(
        COLOMBIA_TIME
    )
    months = (
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    )
    label = (
        f"{event_time.day} de {months[event_time.month - 1]} de {event_time.year}, "
        f"{event_time:%H:%M} (hora Colombia)"
    )
    return label, event_time.strftime("%Y%m%dT%H%M")


def to_geojson_feature(feature: dict) -> dict:
    attributes = feature["attributes"]
    geometry = feature["geometry"]
    timestamp = int(attributes["ESP_FECHA_LONG"])
    magnitude = round(float(attributes["ESP_MAGNITUD"]), 2)
    longitude = float(geometry["x"])
    latitude = float(geometry["y"])
    event_id = attributes.get("ESP_ID_EVENTO_TXT") or attributes["OBJECTID"]
    date_label, sortable_date = format_event_date(timestamp)

    return {
        "type": "Feature",
        "id": f"SGC-{event_id}",
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
        "properties": {
            "id_sgc": str(event_id),
            "actualizacion_automatica": True,
            "nombre": f"Sismo SGC {sortable_date} · ID {event_id}",
            "fecha": date_label,
            "magnitud": magnitude,
            "ubicacion": f"Lat. {latitude:.3f}, lon. {longitude:.3f}",
            "profundidad": f"{float(attributes['ESP_PROFUNDIDAD']):g} km"
            if attributes.get("ESP_PROFUNDIDAD") is not None
            else "No informada",
            "victimas": "No reportadas por el servicio consultado.",
            "descripcion": (
                "Evento sísmico del catálogo del Servicio Geológico Colombiano. "
                "Consulte la fuente oficial para información complementaria."
            ),
            "impacto": "No informado por el servicio consultado.",
            "tipo_falla": "No informado",
            "foto": "",
            "fuente": "Servicio Geológico Colombiano (SGC)",
        },
    }


def read_json(path: Path) -> dict | list:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SourceError(f"No se pudo leer {path.relative_to(ROOT)}: {error}") from error


def write_json_atomic(path: Path, payload: dict | list) -> None:
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(payload, temporary_file, ensure_ascii=False, indent=2)
            temporary_file.write("\n")
        temporary_path.replace(path)
    except OSError as error:
        raise SourceError(f"No se pudo guardar {path.relative_to(ROOT)}: {error}") from error
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def write_summary(message: str, warning: bool = False) -> None:
    print(f"::{'warning' if warning else 'notice'}::{message}")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(f"## Actualización de sismos SGC\n\n{message}\n")


def main() -> int:
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    cutoff_ms = int((now - timedelta(days=WINDOW_DAYS)).timestamp() * 1000)

    try:
        latest_ms = get_latest_timestamp()
        if latest_ms > now_ms + 5 * 60 * 1000:
            raise SourceError("La fecha más reciente del catálogo del SGC está en el futuro.")
        latest_date = datetime.fromtimestamp(latest_ms / 1000, timezone.utc)
        if latest_ms < cutoff_ms:
            write_summary(
                "No se actualizaron los datos: el catálogo consultado del SGC "
                f"llega hasta {latest_date:%Y-%m-%d}, fuera de la ventana de "
                f"{WINDOW_DAYS} días. Se conservaron los datos existentes. "
                f"Fuente: {SOURCE_URL}",
                warning=True,
            )
            return 0

        source_features = fetch_recent_features(cutoff_ms, now_ms)
        refreshed_features = [to_geojson_feature(feature) for feature in source_features]
        data = read_json(DATA_PATH)
        merge_geojson_features(data, refreshed_features)

        metadata = read_json(METADATA_PATH)
        if not isinstance(metadata, list):
            raise SourceError("data/metadatos.json no contiene una lista válida.")
        sismos_metadata = next(
            (item for item in metadata if item.get("id") == "sismos"), None
        )
        if sismos_metadata is None:
            raise SourceError("No se encontró la entrada de metadatos para sismos.")
        sismos_metadata["actualizacion"] = now.date().isoformat()
        sismos_metadata["url"] = SOURCE_URL

        write_json_atomic(DATA_PATH, data)
        write_json_atomic(METADATA_PATH, metadata)
        write_summary(
            f"Actualización exitosa: se publicaron {len(refreshed_features)} "
            f"eventos recientes del SGC. Fecha más reciente del catálogo: "
            f"{latest_date:%Y-%m-%d}. Fuente: {SOURCE_URL}"
        )
        return 0
    except SourceError as error:
        print(f"::error::{error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
