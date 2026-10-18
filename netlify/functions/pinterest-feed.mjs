// RSS-Feeds für Pinterest ("Automatisch veröffentlichen"): /pins/tipps.xml, /pins/texte.xml, /pins/google.xml
// Jeder Feed enthält nur Pins, deren Datum (deutsche Zeit) erreicht ist. Pinterest prüft den Feed
// täglich und erstellt aus neuen Einträgen automatisch Pins. Neue Pins: _build/pins.json ergänzen.
import data from '../../_build/pins.json' with { type: 'json' }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default async (req) => {
  const board = new URL(req.url).pathname.split('/').pop().replace(/\.xml$/, '')
  if (!data.boards[board]) return new Response('Feed nicht gefunden', { status: 404 })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date())
  const pins = data.pins.filter((p) => p.board === board && p.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1))
  const items = pins
    .map((p) => {
      const pub = new Date(`${p.date}T07:00:00+02:00`).toUTCString()
      return `<item>
  <title>${esc(p.title)}</title>
  <link>${esc(p.link)}</link>
  <guid isPermaLink="false">${esc(p.id)}</guid>
  <pubDate>${pub}</pubDate>
  <description><![CDATA[<p><img src="${p.image}" alt="${esc(p.alt)}"></p><p>${esc(p.description)}</p>]]></description>
  <enclosure url="${esc(p.image)}" type="image/jpeg" length="0"/>
  <media:content url="${esc(p.image)}" medium="image" type="image/jpeg"/>
</item>`
    })
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>TIKABI: ${esc(data.boards[board])}</title>
  <link>https://tikabi.de/</link>
  <atom:link href="https://tikabi.de/pins/${board}.xml" rel="self" type="application/rss+xml"/>
  <description>Website-Tipps für selbstständige Frauen von TIKABI</description>
  <language>de-de</language>
${items}
</channel>
</rss>`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } })
}

export const config = { path: '/pins/*' }
