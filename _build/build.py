#!/usr/bin/env python3
"""TIKABI Website-Baukasten.

Setzt jede Datei aus  _build/pages/*.html  in  _build/layout.html  ein
(gemeinsamer Kopf, Weltkarte, Fuß) und schreibt die fertigen Seiten in den
Ordner darüber. Links (Payhip, Brevo …) stehen in  _build/links.json.

Aufruf:  python3 _build/build.py
"""
import json, re, sys
from pathlib import Path

BUILD = Path(__file__).resolve().parent
OUT = BUILD.parent
layout = (BUILD / "layout.html").read_text(encoding="utf-8")
links = json.loads((BUILD / "links.json").read_text(encoding="utf-8"))


def parse(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    if not m:
        sys.exit(f"{path.name}: Kopfzeilen (--- … ---) fehlen")
    meta = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    return {k.strip(): v.strip() for k, v in meta.items()}, m.group(2).strip()


count = 0
for src in sorted((BUILD / "pages").glob("*.html")):
    meta, main = parse(src)
    for key, url in links.items():
        main = main.replace("{{" + key + "}}", url)
    html = (layout.replace("{{TITLE}}", meta["title"])
                  .replace("{{DESC}}", meta["description"])
                  .replace("{{PAGE}}", meta["page"])
                  .replace("{{WORLD}}", meta.get("world", "full"))
                  .replace("{{MAIN}}", main))
    page = meta["page"]

    def add_current(m):
        tag = m.group(0)
        tokens = m.group(1).split()
        if page in tokens and "aria-current" not in tag:
            tag = tag[:-1] + ' aria-current="page">'
        return tag
    html = re.sub(r'<a\b[^>]*\bdata-nav="([^"]*)"[^>]*>', add_current, html)

    (OUT / meta["file"]).write_text(html, encoding="utf-8")
    count += 1
    print("geschrieben:", meta["file"])
print(f"{count} Seite(n) gebaut.")
