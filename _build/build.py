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
NO_SITEMAP = {"404.html", "links.html", "check.html"}


ORG = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": SITE + "/#tikabi",
    "name": "TIKABI",
    "description": "Webdesign und digitale Helfer für selbstständige Frauen: PDF-Guides, Website-Check und individuelles Webdesign.",
    "url": SITE + "/",
    "email": "hello@tikabi.de",
    "image": SITE + "/assets/img/og-tikabi.jpg",
    "address": {"@type": "PostalAddress", "addressLocality": "Biedenkopf", "addressRegion": "Hessen", "addressCountry": "DE"},
    "areaServed": "DE",
    "founder": {"@type": "Person", "name": "Tiffany Katz", "jobTitle": "Webdesignerin"},
    "sameAs": ["https://www.instagram.com/tikabiwebdesign/", "https://de.pinterest.com/TIKABIwebdesign/"],
}

GUIDES = [
    ("7 Website-Fehler", "PDF-Guide: Erkenne, was deine Besucherinnen ausbremst.", "7.00", "PAYHIP_FEHLER", "assets/img/cover-fehler.webp"),
    ("Eine Startseite mit Klarheit", "PDF-Guide: Bringe dein Angebot in sieben Schritten auf den Punkt.", "9.00", "PAYHIP_STARTSEITE", "assets/img/cover-startseite.webp"),
    ("Der komplette Website-Guide", "PDF-Arbeitsbuch für Struktur und Texte deiner gesamten Website.", "47.00", "PAYHIP_KOMPLETT", "assets/img/cover-komplett.webp"),
]


def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).replace(" ,", ",").replace(" .", ".").strip()


def jsonld(filename, main, meta=None):
    blocks = []
    if filename.startswith("ratgeber-") and meta:
        blocks.append({"@context": "https://schema.org", "@type": "BlogPosting", "headline": meta["title"].split(" | ")[0],
                       "description": meta["description"], "datePublished": meta.get("date", ""), "dateModified": meta.get("date", ""),
                       "inLanguage": "de-DE", "mainEntityOfPage": canonical(filename), "image": SITE + "/assets/img/og-tikabi.jpg",
                       "author": {"@type": "Person", "name": "Tiffany Katz", "url": SITE + "/ueber-mich"}, "publisher": {"@id": SITE + "/#tikabi"}})
    if filename == "index.html":
        blocks.append(ORG)
    if filename == "shop.html":
        for name, desc, price, link, img in GUIDES:
            # Digitale PDFs: Marke mit Namen, keine Rückgabe nach Download (siehe rueckerstattung.html), kein Versand
            blocks.append({"@context": "https://schema.org", "@type": "Product", "name": name, "description": desc,
                           "image": f"{SITE}/{img}", "brand": {"@type": "Brand", "name": "TIKABI"},
                           "offers": {"@type": "Offer", "price": price, "priceCurrency": "EUR", "availability": "https://schema.org/InStock", "url": links[link],
                                      "hasMerchantReturnPolicy": {"@type": "MerchantReturnPolicy", "applicableCountry": "DE",
                                                                  "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
                                                                  "url": SITE + "/rueckerstattung"},
                                      "shippingDetails": {"@type": "OfferShippingDetails",
                                                          "shippingRate": {"@type": "MonetaryAmount", "value": "0", "currency": "EUR"},
                                                          "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "DE"},
                                                          "deliveryTime": {"@type": "ShippingDeliveryTime",
                                                                           "handlingTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "DAY"},
                                                                           "transitTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "DAY"}}}}})
    faqs = re.findall(r'<details name="faq"[^>]*><summary>(.*?)</summary><div class="answer">(.*?)</div></details>', main, re.S)
    if faqs:
        blocks.append({"@context": "https://schema.org", "@type": "FAQPage",
                       "mainEntity": [{"@type": "Question", "name": strip_tags(q), "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}} for q, a in faqs]})
    return "\n".join('<script type="application/ld+json">' + json.dumps(b, ensure_ascii=False).replace("</", "<\\/") + "</script>" for b in blocks)


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


CAT_NAMES = {"botschaft": "Klarheit & Botschaft", "zielgruppe": "Ansprache & Zielgruppe", "struktur": "Struktur & Navigation",
             "texte": "Texte & Lesbarkeit", "cta": "Nächster Schritt & Kontakt", "vertrauen": "Vertrauen", "design": "Design & Bildsprache",
             "mobil": "Darstellung auf dem Handy", "technik": "Technik & Ladezeit", "seo": "Auffindbarkeit bei Google & KI"}


def lp_fill(main):
    """Füllt die Landingpage mit echten Ausschnitten aus einem Website-Check (_build/lp-report.json)."""
    if "{{LP_" not in main:
        return main
    f = BUILD / "lp-report.json"
    if not f.exists():
        sys.exit("check.html: _build/lp-report.json fehlt (Ausschnitte aus einem echten Website-Check)")
    r = json.loads(f.read_text(encoding="utf-8"))
    esc = lambda t: (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    bars = "".join(f'<li><span>{esc(CAT_NAMES.get(k["key"], k["key"]))}</span><span class="lp-bar"><i style="width:{int(k["note"]) * 10}%"></i></span><b>{int(k["note"])}</b></li>' for k in r["kategorien"])
    todos = "".join(f'<li><strong>{esc(t["titel"])}</strong><span>{esc(t["bereich"])}</span></li>' for t in r["todos"])
    return (main.replace("{{LP_NOTE}}", str(int(r["gesamtnote"]))).replace("{{LP_KERNSATZ}}", esc(r["kernsatz"]))
                .replace("{{LP_BARS}}", bars).replace("{{LP_TODOS}}", todos))


count = 0
files = []
for src in sorted((BUILD / "pages").glob("*.html")):
    meta, main = parse(src)
    for key, url in links.items():
        main = main.replace("{{" + key + "}}", url)
    main = lp_fill(main)
    html = (layout.replace("{{TITLE}}", meta["title"])
                  .replace("{{DESC}}", meta["description"])
                  .replace("{{CANONICAL}}", canonical(meta["file"]))
                  .replace("{{JSONLD}}", jsonld(meta["file"], main, meta))
                  .replace("{{PAGE}}", meta["page"])
                  .replace("{{WORLD}}", meta.get("world", "full"))
                  .replace("{{MAIN}}", main))
    if meta["file"] == "404.html":
        # Die Fehlerseite erscheint unter beliebigen Adressen: feste Basis für Links und Bilder, nicht indexieren.
        html = html.replace("<head>", '<head>\n<base href="/">\n<meta name="robots" content="noindex">', 1)
        html = re.sub(r'\n<link rel="canonical"[^>]*>', "", html)
    elif meta["file"] in NO_SITEMAP:
        # Link-Seite für Instagram: erreichbar, aber nicht in der Google-Suche
        html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex">', 1)
    if meta.get("layout") == "landing":
        # Landingpage (z. B. für Pinterest): ein Ziel, kein Menü, kein großer Footer. Rechtliche Links bleiben.
        html = re.sub(r'<nav class="main-nav".*?</nav>\s*<div class="header-tools">.*?</div>\s*', "", html, flags=re.S)
        html = re.sub(r'<nav class="rail"[^>]*></nav>', "", html)
        html = re.sub(r'<div class="footer-grid">.*?</div>\s*(?=<nav class="footer-legal")', "", html, flags=re.S)
        html = html.replace('<body data-page=', '<body data-layout="landing" data-page=', 1)
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
order = ["index.html", "webdesign.html", "shop.html", "website-check.html", "ueber-mich.html", "kontakt.html", "ratgeber.html", "ratgeber-startseite.html", "ratgeber-keine-anfragen.html"]
files.sort(key=lambda f: (order.index(f) if f in order else len(order), f))
urls = "\n".join(f"  <url><loc>{canonical(f)}</loc></url>" for f in files if f not in NO_SITEMAP)
(OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n', encoding="utf-8")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /_build/\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
print(f"{count} Seite(n) gebaut, sitemap.xml und robots.txt geschrieben.")
