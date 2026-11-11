// Play-area shapes (circle, oval, square, triangle ...), the draw-your-own editor, and helpers.
// Sizes: every shape has the same AREA as a circle of the chosen diameter, so shapes are fair to compare.
// Points are in metres from the centre: [east, north]. Needs Leaflet (global L) for the editor.
const TAU = Math.PI * 2, MLAT = 110540;
export const SHAPES = ['Circle', 'Oval', 'Square', 'Rectangle', 'Triangle', 'Diamond', 'Pentagon', 'Hexagon', 'Octagon'];
export const STRETCHABLE = new Set(['Oval', 'Rectangle', 'Diamond']);
const ngon = (n, r0 = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [Math.cos(r0 + (TAU * i) / n), Math.sin(r0 + (TAU * i) / n)]);
const BASE = { Oval: () => ngon(48, 0), Square: () => ngon(4, Math.PI / 4), Rectangle: () => ngon(4, Math.PI / 4), Triangle: () => ngon(3), Diamond: () => ngon(4, 0), Pentagon: () => ngon(5), Hexagon: () => ngon(6, 0), Octagon: () => ngon(8, Math.PI / 8) };

export const polyArea = (p) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
export function centroid(p) {
  let a = 0, cx = 0, cy = 0;
  p.forEach((q, i) => { const r = p[(i + 1) % p.length], f = q[0] * r[1] - r[0] * q[1]; a += f; cx += (q[0] + r[0]) * f; cy += (q[1] + r[1]) * f; });
  return a ? [cx / (3 * a), cy / (3 * a)] : [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
}
export const equivDiameter = (p) => 2 * Math.sqrt(polyArea(p) / Math.PI);

// vertices in metres for a shape at a given size (null means a true circle)
export function getPts(a, D) {
  if (!a || a.type === 'Circle') return null;
  if (a.type === 'Custom') { if (!a.pts || a.pts.length < 3) return null; const k = D / equivDiameter(a.pts); return a.pts.map(([x, y]) => [x * k, y * k]); }
  if (!BASE[a.type]) return null;
  const s = Math.max(1, +a.stretch || 1), rot = ((+a.rot || 0) * Math.PI) / 180, c = Math.cos(rot), n = Math.sin(rot);
  let u = BASE[a.type]().map(([x, y]) => [x * s, y / s]).map(([x, y]) => [x * c - y * n, x * n + y * c]);
  const k = Math.sqrt(Math.PI / polyArea(u)) * (D / 2); // same area as a circle of diameter D
  return u.map(([x, y]) => [x * k, y * k]);
}
export function pip(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
export const mlng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
export const toLL = (center, pts, k = 1) => pts.map(([x, y]) => [center[0] + (y * k) / MLAT, center[1] + (x * k) / mlng(center[0])]);
export const offsetOf = (center, ll) => [(ll[1] - center[1]) * mlng(center[0]), (ll[0] - center[0]) * MLAT];
export function randomArea() {
  const t = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { type: t, rot: Math.round(Math.random() * 180), stretch: STRETCHABLE.has(t) ? +(1.3 + Math.random() * 0.9).toFixed(2) : 1 };
}
export const areaLabel = (a) => (a && a.type ? (a.type === 'Custom' ? 'Hand-drawn' : a.type) : 'Circle');

// small picture of a shape (for the lobby)
export function previewSvg(a, D, finalM) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-60 -60 120 120'); svg.setAttribute('class', 'aprev'); svg.setAttribute('aria-hidden', 'true');
  const pts = getPts(a, D), sc = 48 / (D / 2) * (pts ? 0.82 : 1);
  const mk = (el, at) => { const e = document.createElementNS(NS, el); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); svg.appendChild(e); };
  const st = 'fill:color-mix(in srgb,var(--B) 14%,transparent);stroke:var(--B);stroke-width:2.2';
  if (!pts) mk('circle', { cx: 0, cy: 0, r: 48, style: st }); else mk('polygon', { points: pts.map(([x, y]) => (x * sc).toFixed(1) + ',' + (-y * sc).toFixed(1)).join(' '), style: st, 'stroke-linejoin': 'round' });
  const fk = Math.min(1, (finalM || 0) / D);
  if (fk > 0) { if (!pts) mk('circle', { cx: 0, cy: 0, r: 48 * fk, style: 'fill:none;stroke:var(--A);stroke-width:1.6;stroke-dasharray:4 3' }); else mk('polygon', { points: pts.map(([x, y]) => (x * sc * fk).toFixed(1) + ',' + (-y * sc * fk).toFixed(1)).join(' '), style: 'fill:none;stroke:var(--A);stroke-width:1.6;stroke-dasharray:4 3' }); }
  return svg;
}

// ---------- the editor: pick a shape or draw your own ----------
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
export function openAreaEditor(o) {
  const st = { center: o.center.slice(), area: o.area && o.area.type ? JSON.parse(JSON.stringify(o.area)) : { type: 'Circle' }, D: o.D, mode: 'shape', draw: [] };
  if (st.area.type === 'Custom') { st.mode = 'shape'; }
  const root = h('div', 'aedit'), mapEl = h('div', 'aemap'), top = h('div', 'aetop'), dock = h('div', 'aedock');
  const title = h('b', '', 'Play area'), close = h('button', 'aex', '\u00D7'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
  top.append(title, close);
  const hint = h('p', 'aehint', 'Tap the map to move the centre.');
  const chips = h('div', 'aechips');
  const ctl = h('div', 'aectl');
  const mkRange = (label, min, max, step) => { const w = h('label', 'aer'); const sp = h('span', '', label); const v = h('b'); const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; sp.appendChild(v); w.append(sp, r); ctl.appendChild(w); return { w, r, v }; };
  const rot = mkRange('Rotation ', 0, 180, 5), str = mkRange('Stretch ', 1, 2.5, 0.05), siz = mkRange('Size (diameter) ', 50, 4000, 10);
  const btns = h('div', 'aebtns'), undo = h('button', 'o', 'Undo point'), clr = h('button', 'o', 'Clear'), save = h('button', '', 'Use this area');
  [undo, clr, save].forEach((b) => (b.type = 'button')); btns.append(undo, clr, save);
  dock.append(hint, chips, ctl, btns); root.append(mapEl, top, dock); document.body.appendChild(root); document.body.classList.add('editing');

  const map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(st.center, 16);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' }).addTo(map);
  let layers = [], dots = [];
  const centerMk = L.marker(st.center, { draggable: true, icon: L.divIcon({ className: 'ptw', html: '<i class="pt me" style="--c:#D4621A"></i>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map);
  centerMk.on('drag', (e) => { st.center = [e.latlng.lat, e.latlng.lng]; redraw(true); });
  map.on('click', (e) => { if (st.mode === 'draw') { st.draw.push([e.latlng.lat, e.latlng.lng]); redraw(); } else { st.center = [e.latlng.lat, e.latlng.lng]; centerMk.setLatLng(st.center); redraw(true); } });

  const drawPts = () => { const c = [st.draw.reduce((s, p) => s + p[0], 0) / st.draw.length, st.draw.reduce((s, p) => s + p[1], 0) / st.draw.length]; return { c, pts: st.draw.map((p) => offsetOf(c, p)) }; };
  function redraw(keepView) {
    layers.forEach((l) => l.remove()); layers = []; dots.forEach((d) => d.remove()); dots = [];
    const sty = { color: '#D4621A', weight: 3, fillColor: '#D4621A', fillOpacity: 0.14 }, fin = { color: '#2A1A0E', weight: 2, dashArray: '6 6', fillOpacity: 0 };
    const fk = Math.min(1, (o.finalM || 0) / st.D);
    if (st.mode === 'draw') {
      centerMk.setOpacity(0);
      st.draw.forEach((p) => dots.push(L.circleMarker(p, { radius: 6, color: '#fff', weight: 2, fillColor: '#D4621A', fillOpacity: 1 }).addTo(map)));
      if (st.draw.length >= 3) layers.push(L.polygon(st.draw, sty).addTo(map)); else if (st.draw.length === 2) layers.push(L.polyline(st.draw, { color: '#D4621A', weight: 3 }).addTo(map));
    } else {
      centerMk.setOpacity(1); centerMk.setLatLng(st.center);
      const pts = getPts(st.area, st.D);
      if (!pts) { layers.push(L.circle(st.center, { radius: st.D / 2, ...sty }).addTo(map)); if (fk > 0) layers.push(L.circle(st.center, { radius: (st.D / 2) * fk, ...fin }).addTo(map)); }
      else { layers.push(L.polygon(toLL(st.center, pts), sty).addTo(map)); if (fk > 0) layers.push(L.polygon(toLL(st.center, pts, fk), fin).addTo(map)); }
      if (!keepView && layers[0]) map.fitBounds(layers[0].getBounds(), { padding: [50, 50], maxZoom: 18 });
    }
    paint();
  }
  function paint() {
    const a = st.area, draw = st.mode === 'draw';
    [...chips.children].forEach((c) => c.classList.toggle('a', draw ? c.dataset.t === 'Draw' : c.dataset.t === (a.type === 'Custom' ? 'Draw' : a.type)));
    rot.w.hidden = draw || !BASE[a.type] || a.type === 'Oval'; str.w.hidden = draw || !STRETCHABLE.has(a.type) || a.type === 'Custom'; siz.w.hidden = draw;
    rot.r.value = a.rot || 0; rot.v.textContent = (a.rot || 0) + '\u00B0'; str.r.value = a.stretch || 1; str.v.textContent = '\u00D7' + (a.stretch || 1); siz.r.value = Math.min(4000, st.D); siz.v.textContent = Math.round(st.D) + ' m';
    undo.hidden = clr.hidden = !draw; hint.textContent = draw ? 'Tap the map to add corners (3 or more). Tap Undo to remove the last one.' : 'Tap the map or drag the orange point to move the centre.';
    save.disabled = draw && st.draw.length < 3;
  }
  [...SHAPES, 'Draw', 'Random'].forEach((t) => {
    const b = h('button', 'chip', t === 'Random' ? '\uD83C\uDFB2 Random' : t); b.type = 'button'; b.dataset.t = t;
    b.onclick = () => {
      if (t === 'Draw') { st.mode = 'draw'; st.draw = []; }
      else if (t === 'Random') { st.mode = 'shape'; st.area = randomArea(); }
      else { st.mode = 'shape'; st.area = { type: t, rot: st.area.rot || 0, stretch: STRETCHABLE.has(t) ? (st.area.stretch > 1 ? st.area.stretch : t === 'Rectangle' ? 1.6 : 1.4) : 1 }; }
      redraw();
    };
    chips.appendChild(b);
  });
  rot.r.oninput = () => { st.area.rot = +rot.r.value; redraw(true); }; str.r.oninput = () => { st.area.stretch = +str.r.value; redraw(true); }; siz.r.oninput = () => { st.D = +siz.r.value; redraw(true); };
  undo.onclick = () => { st.draw.pop(); redraw(); }; clr.onclick = () => { st.draw = []; redraw(); };
  const shut = () => { map.remove(); root.remove(); document.body.classList.remove('editing'); };
  close.onclick = shut;
  save.onclick = () => {
    let out;
    if (st.mode === 'draw') { const { c, pts } = drawPts(), cc = centroid(pts); const rel = pts.map(([x, y]) => [Math.round((x - cc[0]) * 10) / 10, Math.round((y - cc[1]) * 10) / 10]); out = { center: c, area: { type: 'Custom', pts: rel }, zoneM: Math.max(50, Math.min(10000, Math.round(equivDiameter(rel)))) }; }
    else out = { center: st.center, area: st.area.type === 'Circle' ? { type: 'Circle' } : st.area, zoneM: Math.round(st.D) };
    shut(); o.onSave(out);
  };
  redraw();
  return { close: shut };
}
