/* ==========================================================================
   TIKABI — Verhalten (Vanilla JS, keine Abhängigkeiten)
   Welt: Sternenfeld (Warp beim Scrollen) + Licht-Orbs, läuft über alle Seiten
   weiter. Seitenwechsel sind „Reisen“: kurzer Warp-Schub, dann blendet die
   nächste Seite ein — die Welt bleibt dieselbe.
   Ohne JS bleibt alles lesbar; bei reduzierter Bewegung steht das Feld still.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement, body = doc.body;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var isFile = location.protocol === "file:";
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  root.classList.add("js");

  var S = { dvb: 0, y: window.scrollY, lastY: window.scrollY, vy: 0, boost: 0, boostT: 0, mx: 0, my: 0, tx: 0, ty: 0, vw: innerWidth, vh: innerHeight };
  var page = { dp: -1, diveTop: 0, diveTotal: 1, sticky: false, hero: null, parallax: [], routes: [], trail: [], stops: [], io: null, activeStop: -1 };

  /* ---------- Welt: Sternenfeld ------------------------------------------ */
  var cv = $("#stars"), ctx = cv && cv.getContext("2d"), stars = [], DPR = 1, W = 0, H = 0;
  var orbs = $$(".orb");

  function makeStar(fresh) {
    var c = Math.random();
    return {
      a: Math.random() * 6.2832, r: fresh ? Math.random() : Math.random() * 0.08,
      s: 0.5 + Math.random() * 0.9,
      k: c < 0.72 ? "255,255,255" : c < 0.9 ? "255,139,208" : "243,227,208",
      al: 0.3 + Math.random() * 0.5, tw: Math.random() * 6.28
    };
  }
  function resizeWorld() {
    S.vw = innerWidth; S.vh = innerHeight;
    if (!cv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var n = W < 800 ? 90 : 180;
    stars = []; for (var i = 0; i < n; i++) stars.push(makeStar(true));
    if (reduceMQ.matches) drawStars(0, 0, 0);
  }
  function drawStars(dt, t, flow) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var calm = body.dataset.world === "calm";
    var cx = W * 0.6 - S.mx * W * 0.035, cy = H * 0.44 - S.my * H * 0.035, R = Math.hypot(W, H) * 0.6; /* Mausbewegung verschiebt das Sternenfeld (Tiefe) */
    var streak = !calm && Math.abs(flow) > 0.09, sign = flow >= 0 ? 1 : -1;
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      st.r += flow * dt * (0.22 + st.r * 1.3) * st.s;
      if (st.r > 1.12) { st.r = Math.random() * 0.06; st.a = Math.random() * 6.2832; }
      else if (st.r < 0) { st.r = 1.05; st.a = Math.random() * 6.2832; }
      var cos = Math.cos(st.a), sin = Math.sin(st.a), d = st.r * R;
      var x = cx + cos * d, y = cy + sin * d * 0.86;
      var fade = Math.min(1, st.r * 3.2) * Math.min(1, (1.12 - st.r) * 6);
      var a = st.al * fade * (0.8 + 0.2 * Math.sin(t * 0.9 + st.tw));
      if (a < 0.01) continue;
      var size = 0.5 + st.r * 1.5 * st.s;
      var col = "rgba(" + st.k + "," + a.toFixed(3) + ")";
      if (streak) {
        var len = Math.min(70, Math.abs(flow) * d * 0.09);
        ctx.strokeStyle = col; ctx.lineWidth = size; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - cos * len * sign, y - sin * len * 0.86 * sign); ctx.stroke();
      } else {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, size, 0, 6.2832); ctx.fill();
      }
    }
  }
  var orbK = [0.0011, 0.0008, 0.0006];
  function updateOrbs(y) {
    for (var i = 0; i < orbs.length; i++) {
      var x = Math.sin(y * orbK[i] + i * 2.1) * S.vw * 0.05;
      var yy = Math.cos(y * orbK[i] * 1.2 + i) * S.vh * 0.1;
      orbs[i].style.transform = "translate3d(" + x.toFixed(1) + "px," + yy.toFixed(1) + "px,0)";
    }
  }

  /* ---------- Scroll-gebundene Updates ------------------------------------ */
  var progressEl = $("#progress"), headerEl = $(".site-header"), lastOrbY = -1, scrolled = null;

  /* Der rote Faden: eine durchgehende, geschwungene Route (wie die Weltkarte),
     läuft von Station zu Station ([data-stop]) hinter dem Inhalt entlang.
     Technisch NICHT eine einzige riesige SVG (das war zu teuer neu zu zeichnen
     und hinkte beim schnellen Scrollen sichtbar hinterher) — sondern viele
     kleine Abschnitte, einer pro Sektionsübergang. So muss der Browser pro
     Frame immer nur den kleinen Abschnitt neu zeichnen, der gerade "wandert";
     alle anderen sind längst fertig gefüllt oder noch leer und bleiben ruhig. */
  var SVGNS = "http://www.w3.org/2000/svg";
  function buildTrail() {
    var wrap = $("#trail"); if (!wrap) { page.trail = []; return; }
    if (!page.stops.length) { page.trail = []; return; }
    var y0 = window.scrollY;
    var mainAbsTop = wrap.getBoundingClientRect().top + y0;
    var lane = [0.02, 0.98]; /* Route pendelt ganz am äußeren Rand (im Seitenabstand), bleibt so unter breiten Karten/Bildern sichtbar */
    var W = Math.max(280, wrap.clientWidth || wrap.parentElement.clientWidth);
    var waveH = 360; /* Abstand einer halben Schlängel-Welle, damit es auch in hohen Sektionen durchgehend windet */
    function otherLane(x) { return Math.abs(x - W * lane[0]) < Math.abs(x - W * lane[1]) ? W * lane[1] : W * lane[0]; }

    var anchors = page.stops.map(function (s, i) {
      var r = s.el.getBoundingClientRect();
      return { x: W * lane[i % 2], y: r.top + y0 + Math.min(140, r.height * 0.14) };
    });

    /* Nur neu aufbauen, wenn sich Breite oder echte Sektionspositionen verändert haben
       (nicht bei jedem Mini-Reflow) — vermeidet unnötige, teure DOM-Neuaufbauten. */
    var sig = W + "|" + anchors.map(function (a) { return Math.round(a.y); }).join(",");
    if (wrap._trailSig === sig) return;
    wrap._trailSig = sig;

    wrap.innerHTML = "";

    /* Startpunkt: kleiner, statischer Punkt bei der ersten Station */
    var startPin = doc.createElement("div");
    startPin.className = "trail-pin-start";
    startPin.style.left = anchors[0].x + "px";
    startPin.style.top = (anchors[0].y - mainAbsTop) + "px";
    wrap.appendChild(startPin);

    var segs = [];
    for (var i = 1; i < anchors.length; i++) {
      var a0 = anchors[i - 1], a1 = anchors[i], segTop = a0.y, segH = Math.max(1, a1.y - a0.y);

      /* Zwischenpunkte einfügen, damit die Linie auch in sehr hohen Sektionen sichtbar schlängelt */
      var n = Math.max(1, Math.round(segH / waveH));
      var pts = [{ x: a0.x, y: 0 }], curX = a0.x;
      for (var s = 1; s <= n; s++) {
        var y = (segH * s) / n;
        var x = s === n ? a1.x : otherLane(curX);
        pts.push({ x: x, y: y }); curX = x;
      }

      var d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
      for (var j = 1; j < pts.length; j++) {
        var p0 = pts[j - 1], p1 = pts[j], dy = p1.y - p0.y;
        d += " C" + p0.x.toFixed(1) + "," + (p0.y + dy * 0.42).toFixed(1) + " " + p1.x.toFixed(1) + "," + (p0.y + dy * 0.58).toFixed(1) + " " + p1.x.toFixed(1) + "," + p1.y.toFixed(1);
      }

      var segEl = doc.createElement("div");
      segEl.className = "trail-seg";
      segEl.style.top = (segTop - mainAbsTop) + "px"; segEl.style.height = segH + "px";
      var svg = doc.createElementNS(SVGNS, "svg");
      svg.setAttribute("class", "trail-svg"); svg.setAttribute("viewBox", "0 0 " + W + " " + segH);
      var track = doc.createElementNS(SVGNS, "path");
      track.setAttribute("class", "trail-track"); track.setAttribute("d", d);
      var fill = doc.createElementNS(SVGNS, "path");
      fill.setAttribute("class", "trail-fill"); fill.setAttribute("pathLength", "1"); fill.setAttribute("d", d);
      var pin = doc.createElementNS(SVGNS, "circle");
      pin.setAttribute("class", "trail-pin"); pin.setAttribute("r", "6");
      pin.setAttribute("cx", a1.x.toFixed(1)); pin.setAttribute("cy", segH.toFixed(1));
      svg.appendChild(track); svg.appendChild(fill); svg.appendChild(pin);
      segEl.appendChild(svg);
      wrap.appendChild(segEl);

      segs.push({ el: segEl, fill: fill, pin: pin, height: segH, ratio: -1 });
    }
    page.trail = segs;
  }

  function measure() {
    S.vw = innerWidth; S.vh = innerHeight;
    var y = window.scrollY;
    page.parallax.forEach(function (p) {
      p.el.style.setProperty("--py", "0px");
      var r = p.el.getBoundingClientRect();
      p.cy = r.top + y + r.height / 2;
    });
    page.stops.forEach(function (s) { s.top = s.el.getBoundingClientRect().top + y; });
    if (page.hero) {
      var st = page.hero.querySelector(".dive-sticky");
      page.sticky = !!st && getComputedStyle(st).position === "sticky";
      page.diveTop = page.hero.getBoundingClientRect().top + y;
      page.diveTotal = Math.max(1, page.sticky ? page.hero.offsetHeight - S.vh : page.hero.offsetHeight * 0.9);
      page.hero.classList.toggle("is-static", !page.sticky);
      page.hero.style.setProperty("--dz", page.sticky ? "1.8" : "0.45");
      page.hero.style.setProperty("--df", page.sticky ? "2.3" : "0");
      page.hero.style.setProperty("--zr", page.sticky ? "1" : "0.15");
      page.dp = -1;
    }
    page.routes.forEach(function (rt) {
      var st = rt.nodes; if (st.length < 2) { rt.trackH = 1; return; }
      rt.trackH = Math.max(1, st[st.length - 1].stop.offsetTop - st[0].stop.offsetTop);
      rt.el.style.setProperty("--track-h", rt.trackH + "px");
      rt.ratio = -1;
    });
    buildTrail();
  }

  function updateScroll(y) {
    var docH = Math.max(1, doc.documentElement.scrollHeight - S.vh);
    if (progressEl) progressEl.style.transform = "scaleX(" + clamp(y / docH, 0, 1).toFixed(4) + ")";
    var sc = y > 8;
    if (sc !== scrolled && headerEl) { scrolled = sc; headerEl.classList.toggle("is-scrolled", sc); }
    if (Math.abs(y - lastOrbY) > 1) { lastOrbY = y; updateOrbs(y); }

    /* Hero: Eintauchen (dp 0…1) + Maus-Tiefe */
    var h = page.hero;
    if (h && !reduceMQ.matches) {
      var dp = clamp((y - page.diveTop) / page.diveTotal, 0, 1);
      if (Math.abs(dp - page.dp) > 0.0004) { page.dp = dp; h.style.setProperty("--dp", dp.toFixed(4)); }
      S.dvb = page.sticky ? Math.sin(Math.PI * clamp((dp - 0.04) / 0.92, 0, 1)) * 0.32 : 0;
      if (y < h.offsetHeight) { h.style.setProperty("--mx", S.mx.toFixed(3)); h.style.setProperty("--my", S.my.toFixed(3)); }
    } else { S.dvb = 0; }
    /* Parallax auf Bildkompositionen */
    if (!reduceMQ.matches) {
      for (var i = 0; i < page.parallax.length; i++) {
        var p = page.parallax[i], off = y + S.vh / 2 - p.cy;
        if (Math.abs(off) > S.vh * 1.4) continue;
        p.el.style.setProperty("--py", clamp(off * p.f, -90, 90).toFixed(1) + "px");
      }
    }
    /* Reiseroute: pinker Faden füllt sich */
    var mark = S.vh * 0.62;
    for (var j = 0; j < page.routes.length; j++) {
      var rt = page.routes[j], rr = rt.el.getBoundingClientRect();
      var trackTop = rr.top + 28, trackH = rt.trackH || 1;
      var ratio = clamp((mark - trackTop) / trackH, 0, 1);
      if (Math.abs(ratio - rt.ratio) > 0.002) {
        rt.ratio = ratio;
        rt.el.style.setProperty("--rp", ratio.toFixed(4));
        rt.el.style.setProperty("--rp-dot", ratio > 0.005 && ratio < 0.995 ? "1" : "0");
      }
      for (var n = 0; n < rt.nodes.length; n++) {
        var nb = rt.nodes[n].node.getBoundingClientRect();
        var lit = nb.top + nb.height / 2 < mark;
        if (lit !== rt.nodes[n].lit) { rt.nodes[n].lit = lit; rt.nodes[n].stop.classList.toggle("is-lit", lit); }
      }
    }
    /* Der rote Faden: pro Abschnitt einzeln, gleiches Prinzip wie oben. Abschnitte weit
       oberhalb (voll) oder unterhalb (leer) des Bildschirms ändern sich nicht mehr und
       werden dank der Toleranzprüfung gar nicht erst neu angefasst — nur der eine
       Abschnitt, der gerade "wandert", bekommt pro Frame ein Update. */
    for (var tI = 0; tI < page.trail.length; tI++) {
      var sg = page.trail[tI], sr = sg.el.getBoundingClientRect();
      var sratio = clamp((mark - sr.top) / sg.height, 0, 1);
      if (Math.abs(sratio - sg.ratio) > 0.003) {
        sg.ratio = sratio;
        sg.fill.style.strokeDashoffset = (1 - sratio).toFixed(4);
        sg.pin.classList.toggle("is-lit", sratio > 0.5);
      }
    }
    /* Rail: aktive Station */
    if (page.stops.length) {
      var idx = -1, line = y + S.vh * 0.4;
      for (var k = 0; k < page.stops.length; k++) if (page.stops[k].top <= line) idx = k;
      if (idx !== page.activeStop) {
        page.activeStop = idx;
        page.stops.forEach(function (s, q) { s.link.classList.toggle("is-active", q === idx); if (q === idx) s.link.setAttribute("aria-current", "true"); else s.link.removeAttribute("aria-current"); });
      }
    }
  }

  var lastT = performance.now(), running = false;
  function loop(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
    var y = window.scrollY;
    var raw = (y - S.lastY) / Math.max(dt, 0.001); S.lastY = y;
    S.vy += (raw - S.vy) * Math.min(1, dt * 6);
    S.boost += (S.boostT - S.boost) * Math.min(1, dt * 3.5);
    S.mx += (S.tx - S.mx) * Math.min(1, dt * 4);
    S.my += (S.ty - S.my) * Math.min(1, dt * 4);
    var mul = body.dataset.world === "calm" ? 0.45 : 1;
    var flow = 0.02 * mul + clamp(S.vy / 1000, -3, 3) * 0.07 * mul + S.boost * 0.35 + S.dvb;
    drawStars(dt, now / 1000, flow);
    updateScroll(y);
    requestAnimationFrame(loop);
  }
  function start() {
    if (running) return; running = true;
    if (reduceMQ.matches) {
      drawStars(0, 0, 0);
      window.addEventListener("scroll", function () { updateScroll(window.scrollY); }, { passive: true });
      updateScroll(window.scrollY);
    } else {
      requestAnimationFrame(loop);
    }
  }

  window.addEventListener("resize", function () { resizeWorld(); measure(); }, { passive: true });
  if (finePointer) window.addEventListener("pointermove", function (e) { S.tx = (e.clientX / S.vw - 0.5) * 2; S.ty = (e.clientY / S.vh - 0.5) * 2; }, { passive: true });

  /* ---------- Seiten-Init (läuft bei jedem Seitenwechsel neu) -------------- */
  function initPage() {
    var stage = $("#stage");
    if (page.io) page.io.disconnect();
    page.hero = $(".hero", stage);
    page.activeStop = -1;

    /* Reveals */
    $$("[data-stagger]", stage).forEach(function (grp) {
      $$("[data-reveal]", grp).forEach(function (el, i) { el.style.setProperty("--rd", Math.min(i * 80, 400) + "ms"); });
    });
    var reveals = $$("[data-reveal]", stage);
    if (reduceMQ.matches || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      page.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); page.io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      reveals.forEach(function (el) { page.io.observe(el); });
    }

    /* Parallax-Ziele */
    page.parallax = $$("[data-parallax]", stage).map(function (el) { return { el: el, f: parseFloat(el.getAttribute("data-parallax")) || 0.08, cy: 0 }; });

    /* Routen */
    page.routes = $$("[data-route]", stage).map(function (el) {
      var fill = doc.createElement("span"); fill.className = "route-fill"; fill.setAttribute("aria-hidden", "true");
      el.insertBefore(fill, el.firstChild);
      return { el: el, ratio: -1, trackH: 1, nodes: $$(".stop", el).map(function (s) { return { stop: s, node: $(".stop-node", s), lit: null }; }) };
    });

    /* Rail (Stationen dieser Seite) */
    var rail = $("#rail"); page.stops = [];
    if (rail) {
      rail.innerHTML = "";
      var items = $$("[data-stop]", stage);
      if (items.length >= 3) {
        var ol = doc.createElement("ol");
        items.forEach(function (el, i) {
          if (!el.id) el.id = "station-" + (i + 1);
          var li = doc.createElement("li"), a = doc.createElement("a"), tip = doc.createElement("span");
          a.href = "#" + el.id; tip.className = "tip"; tip.textContent = el.getAttribute("data-stop");
          a.appendChild(tip); li.appendChild(a); ol.appendChild(li);
          page.stops.push({ el: el, link: a, top: 0 });
        });
        rail.appendChild(ol); rail.classList.add("has-stops");
      } else { rail.classList.remove("has-stops"); }
    }

    markCurrent();
    measure(); updateScroll(window.scrollY);
  }

  function markCurrent() {
    var cur = body.dataset.page;
    $$("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav").split(" ").indexOf(cur) > -1) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* ---------- Mobile-Navigation & Weltkarte (Overlays) -------------------- */
  var mobileNav = $("#mobile-nav"), burger = $("[data-nav-toggle]"), mapEl = $("#map"), lastFocus = null;

  function focusables(c) { return $$('a[href],button:not([disabled])', c).filter(function (e) { return e.offsetParent !== null || e === doc.activeElement; }); }
  function openOverlay(el, opener) {
    lastFocus = opener || doc.activeElement;
    el.classList.add("is-open"); el.removeAttribute("aria-hidden");
    body.style.overflow = "hidden";
    var f = focusables(el)[0]; if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeOverlay(el) {
    if (!el.classList.contains("is-open")) return;
    el.classList.remove("is-open"); el.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
    if (burger) burger.setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeAll() { if (mobileNav) closeOverlay(mobileNav); if (mapEl) closeOverlay(mapEl); }

  doc.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    if (!t) return;
    var openMap = t.closest("[data-map-open]");
    if (openMap && mapEl) { e.preventDefault(); if (mobileNav) closeOverlay(mobileNav); openOverlay(mapEl, openMap); return; }
    if (t.closest("[data-map-close]")) { closeOverlay(mapEl); return; }
    if (t === mapEl) { closeOverlay(mapEl); return; }
    var tg = t.closest("[data-nav-toggle]");
    if (tg && mobileNav) { var open = !mobileNav.classList.contains("is-open"); if (open) { tg.setAttribute("aria-expanded", "true"); openOverlay(mobileNav, tg); } else closeOverlay(mobileNav); return; }
    if (t.closest("[data-nav-close]")) { closeOverlay(mobileNav); return; }
    interceptLink(e, t.closest("a[href]"));
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeAll(); return; }
    if (e.key === "Tab") {
      var ov = [mapEl, mobileNav].filter(function (o) { return o && o.classList.contains("is-open"); })[0];
      if (!ov) return;
      var f = focusables(ov); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Reisen: Seitenwechsel im selben Weltraum -------------------- */
  var travelling = false;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function interceptLink(e, a) {
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.protocol !== location.protocol || u.host !== location.host) return;
    if (!/(\.html?|\/)$/.test(u.pathname)) return;
    if (u.pathname === location.pathname && u.search === location.search) return; /* Anker auf derselben Seite: normal scrollen */
    e.preventDefault();
    closeAll();
    travel(u.href, true);
  }

  async function travel(url, push) {
    if (travelling) return; travelling = true;
    var t0 = performance.now();
    root.classList.add("is-leaving"); S.boostT = 1.5;
    if (reduceMQ.matches) { location.href = url; return; }
    var html = null;
    try {
      if (!isFile) { var res = await fetch(url, { credentials: "same-origin" }); if (!res.ok) throw new Error(res.status); html = await res.text(); }
    } catch (err) { html = null; }
    await wait(Math.max(0, 440 - (performance.now() - t0)));
    var d = html ? new DOMParser().parseFromString(html, "text/html") : null;
    var ns = d && d.getElementById("stage");
    if (!ns) { try { sessionStorage.setItem("tikabi-travel", "1"); } catch (e) {} location.href = url; return; }

    $("#stage").innerHTML = ns.innerHTML;
    doc.title = d.title;
    var md = $('meta[name="description"]'), nd = d.querySelector('meta[name="description"]');
    if (md && nd) md.setAttribute("content", nd.getAttribute("content"));
    body.dataset.world = d.body.dataset.world || "full";
    body.dataset.page = d.body.dataset.page || "";
    if (push) history.pushState({}, "", url);
    var hash = new URL(url, location.href).hash;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    initPage();
    var target = hash && doc.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView();
    root.style.scrollBehavior = "";
    S.lastY = window.scrollY;
    root.classList.remove("is-leaving"); root.classList.add("is-arriving");
    S.boost = 1.3; S.boostT = 0;
    setTimeout(function () { root.classList.remove("is-arriving"); }, 800);
    travelling = false;
  }
  window.addEventListener("popstate", function () { if (!isFile) travel(location.href, false); else location.reload(); });

  /* ---------- Start ------------------------------------------------------- */
  try {
    resizeWorld();
    initPage();
    var arrived = false;
    try { arrived = sessionStorage.getItem("tikabi-travel") === "1"; sessionStorage.removeItem("tikabi-travel"); } catch (e) {}
    if (arrived && !reduceMQ.matches) { root.classList.add("is-arriving"); S.boost = 1.3; setTimeout(function () { root.classList.remove("is-arriving"); }, 800); }
    start();
    window.addEventListener("load", function () { measure(); updateScroll(window.scrollY); });
    if ("ResizeObserver" in window) new ResizeObserver(function () { measure(); }).observe(body);
  } catch (err) {
    root.classList.remove("js");
    if (window.console) console.error("TIKABI: Init-Fehler", err);
  }
})();
