#!/usr/bin/env python3
"""Baut aus seiten-kopf.html / seiten-fuss.html das importierbare Elementor-Template.

Aufruf:  python3 build_template.py
Ergebnis: elementor-template.json
(Nach Änderungen an den HTML-Dateien einfach neu ausführen.)
"""
import json, pathlib

here = pathlib.Path(__file__).parent
kopf = (here / "seiten-kopf.html").read_text(encoding="utf-8")
fuss = (here / "seiten-fuss.html").read_text(encoding="utf-8")

def html_widget(wid, code):
    return {"id": wid, "elType": "widget",
            "settings": {"html": code, "_css_classes": "stg-w"},
            "elements": [], "widgetType": "html"}

amelia = {"id": "a3e1c07", "elType": "widget",
          "settings": {"shortcode": "[ameliabooking]", "_css_classes": "stg-w stg-form"},
          "elements": [], "widgetType": "shortcode"}

root = {"id": "9c4d2b1", "elType": "container",
        "settings": {
            "content_width": "full",
            "flex_direction": "column",
            "flex_align_items": "center",
            "flex_gap": {"unit": "px", "size": 0, "column": "0", "row": "0", "isLinked": True},
            "padding": {"unit": "px", "top": "0", "right": "16", "bottom": "0", "left": "16", "isLinked": False},
            "background_background": "classic",
            "background_color": "#F7F1EA",
            "min_height": {"unit": "vh", "size": 100, "sizes": []},
        },
        "elements": [html_widget("5b8f3a2", kopf), amelia, html_widget("d72e6c9", fuss)],
        "isInner": False}

template = {
    "version": "0.4",
    "title": "Google Buchungsseite (Amelia)",
    "type": "page",
    "content": [root],
    "page_settings": {"template": "elementor_canvas"},
}
(here / "elementor-template.json").write_text(
    json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")
print("elementor-template.json geschrieben")
