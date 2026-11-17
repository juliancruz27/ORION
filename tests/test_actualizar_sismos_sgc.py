import unittest

from scripts.actualizar_sismos_sgc import (
    SourceError,
    format_event_date,
    merge_geojson_features,
    to_geojson_feature,
)


class UpdateSgcEarthquakesTests(unittest.TestCase):
    def test_merge_preserves_curated_events_and_replaces_generated_events(self):
        data = {
            "type": "FeatureCollection",
            "features": [
                {"properties": {"nombre": "Evento curado"}},
                {"properties": {"actualizacion_automatica": True, "id_sgc": "old"}},
            ],
        }
        refreshed = [{"properties": {"actualizacion_automatica": True, "id_sgc": "new"}}]

        merge_geojson_features(data, refreshed)

        self.assertEqual(len(data["features"]), 2)
        self.assertEqual(data["features"][0]["properties"]["nombre"], "Evento curado")
        self.assertEqual(data["features"][1]["properties"]["id_sgc"], "new")

    def test_merge_rejects_non_feature_collection(self):
        with self.assertRaises(SourceError):
            merge_geojson_features([], [])

    def test_sgc_feature_is_mapped_to_orion_properties(self):
        source = {
            "attributes": {
                "OBJECTID": 17,
                "ESP_ID_EVENTO_TXT": 42,
                "ESP_FECHA_LONG": 1794900000000,
                "ESP_MAGNITUD": 4.26,
                "ESP_PROFUNDIDAD": 12.5,
            },
            "geometry": {"x": -76.6, "y": 2.4},
        }

        result = to_geojson_feature(source)

        self.assertEqual(result["id"], "SGC-42")
        self.assertEqual(result["geometry"]["coordinates"], [-76.6, 2.4])
        self.assertEqual(result["properties"]["magnitud"], 4.26)
        self.assertTrue(result["properties"]["actualizacion_automatica"])
        self.assertEqual(result["properties"]["fuente"], "Servicio Geológico Colombiano (SGC)")

    def test_event_date_uses_colombian_timezone_and_spanish_month(self):
        label, sortable = format_event_date(1794900000000)

        self.assertIn("de ", label)
        self.assertIn("(hora Colombia)", label)
        self.assertRegex(sortable, r"^\d{8}T\d{4}$")


if __name__ == "__main__":
    unittest.main()
