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
SITE = "https://tikabi.de"
# Seiten, die nicht in die Sitemap sollen (Rechtstexte bleiben drin, sie schaden nicht).
NO_SITEMAP = set()


def canonical(filename):
    # Netlify liefert jede Seite auch ohne .html aus. Die Adresse ohne Endung ist die "richtige".
    return SITE + "/" if filename == "index.html" else f"{SITE}/{filename[:-5]}"



def parse(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    if not m:
        sys.exit(f"{path.name}: Kopfzeilen (--- … ---) fehlen")
    meta = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    return {k.strip(): v.strip() for k, v in meta.items()}, m.group(2).strip()


count = 0
files = []
for src in sorted((BUILD / "pages").glob("*.html")):
    meta, main = parse(src)
    for key, url in links.items():
        main = main.replace("{{" + key + "}}", url)
    html = (layout.replace("{{TITLE}}", meta["title"])
                  .replace("{{DESC}}", meta["description"])
                  .replace("{{CANONICAL}}", canonical(meta["file"]))
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
    files.append(meta["file"])
    print("geschrieben:", meta["file"])

# Sitemap und robots.txt für Suchmaschinen
order = ["index.html", "webdesign.html", "shop.html", "tools.html", "ueber-mich.html", "kontakt.html"]
files.sort(key=lambda f: (order.index(f) if f in order else len(order), f))
urls = "\n".join(f"  <url><loc>{canonical(f)}</loc></url>" for f in files if f not in NO_SITEMAP)
(OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n', encoding="utf-8")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /_build/\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
print(f"{count} Seite(n) gebaut, sitemap.xml und robots.txt geschrieben.")
