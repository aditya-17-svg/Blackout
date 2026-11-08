// Solid round map points for players.
// They glide smoothly between GPS fixes and open a small info card when tapped. Needs Leaflet (global L).
export const COLOR = { seeker: '#D4621A', hider: '#F4AE52' };

const icon = (color, cls) => L.divIcon({
  className: 'ptw', html: '<i class="pt ' + cls + '" style="--c:' + color + '"></i>',
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
});

// move a marker smoothly from where it is to a new place
export function glide(marker, to, ms) {
  cancelAnimationFrame(marker._raf);
  const from = marker.getLatLng();
  if (!from || (from.lat === to[0] && from.lng === to[1])) return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    marker.setLatLng([from.lat + (to[0] - from.lat) * k, from.lng + (to[1] - from.lng) * k]);
    if (k < 1) marker._raf = requestAnimationFrame(step);
  };
  marker._raf = requestAnimationFrame(step);
}

// the little card shown when a point is tapped (built with textContent so names are never treated as HTML)
function card(info) {
  const d = document.createElement('div'); d.className = 'pcard';
  const n = document.createElement('b'); n.textContent = info.title;
  const r = document.createElement('span'); r.className = 'pr ' + info.role; r.textContent = String(info.role).toUpperCase();
  const p = document.createElement('p'); p.textContent = info.note;
  d.append(n, r, p); return d;
}

export function createPoints(map, opts = {}) {
  const now = opts.now || Date.now;
  const S = { me: null, acc: null, accV: 0, meInfo: { name: 'You', role: 'hider' }, live: new Map(), pings: [], pingAt: 0 };
  const away = (ll) => (S.me ? Math.round(map.distance(S.me.getLatLng(), ll)) : null);
  const ago = (ms) => (ms < 5000 ? 'just now' : Math.round(ms / 1000) + ' s ago');
  const bind = (marker, info) => {
    marker.bindPopup(card(info()), { closeButton: false, className: 'ppop' });
    marker.on('popupopen', () => marker.setPopupContent(card(info())));
  };
  return {
    // your own position, from the phone's GPS
    setMe(lat, lng, acc, role, name) {
      S.meInfo = { name, role }; S.accV = acc || 0;
      if (!S.me) {
        S.me = L.marker([lat, lng], { icon: icon(COLOR[role], 'me'), zIndexOffset: 1000 }).addTo(map);
        S.acc = L.circle([lat, lng], { radius: 0, color: COLOR[role], weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        S.me.on('move', (e) => S.acc.setLatLng(e.latlng));
        bind(S.me, () => ({ title: S.meInfo.name + ' (you)', role: S.meInfo.role, note: 'Your GPS position' + (S.accV ? ' · accuracy ±' + Math.round(S.accV) + ' m' : '') }));
      } else glide(S.me, [lat, lng], 900);
      S.acc.setRadius(Math.min(S.accV, 150));
    },
    // seekers who are visible live (everyone in the game can see them)
    syncLive(rows, who, myId) {
      const seen = new Set();
      rows.forEach((r) => {
        if (r.user_id === myId) return;
        seen.add(r.user_id);
        const to = [r.lat, r.lng]; let m = S.live.get(r.user_id);
        if (!m) {
          const w = who(r.user_id);
          m = L.marker(to, { icon: icon(COLOR[w.role] || COLOR.seeker, ''), riseOnHover: true }).addTo(map);
          bind(m, () => { const x = who(r.user_id), d = away(m.getLatLng()); return { title: x.name, role: x.role, note: 'Live · updated ' + ago(now() - m._t) + (d != null ? ' · ' + d + ' m from you' : '') }; });
          S.live.set(r.user_id, m);
        } else glide(m, to, 3500);
        m._t = Date.parse(r.updated_at) || now();
      });
      S.live.forEach((m, id) => { if (!seen.has(id)) { cancelAnimationFrame(m._raf); m.remove(); S.live.delete(id); } });
    },
    // hiders, only at the moment of a ping
    showPings(hiders, takenAt) {
      S.pings.forEach((m) => m.remove()); S.pings = []; S.pingAt = takenAt;
      hiders.forEach((h, i) => {
        const m = L.marker([h.lat, h.lng], { icon: icon(COLOR.hider, 'ping') }).addTo(map);
        bind(m, () => { const d = away(m.getLatLng()); return { title: 'Hider ' + (i + 1), role: 'hider', note: 'Ping · seen ' + ago(now() - S.pingAt) + (d != null ? ' · ' + d + ' m from you' : '') }; });
        S.pings.push(m);
      });
    },
    // old pings and silent players fade out
    fade() {
      const t = now(), o = Math.max(0.35, 1 - (t - S.pingAt) / 90000);
      S.pings.forEach((m) => m.setOpacity(o));
      S.live.forEach((m) => m.setOpacity(t - m._t > 60000 ? 0.45 : 1));
    },
    mePos() { return S.me ? S.me.getLatLng() : null; },
    destroy() { [S.me, ...S.live.values(), ...S.pings].forEach((m) => { if (m) { cancelAnimationFrame(m._raf); m.remove(); } }); if (S.acc) S.acc.remove(); S.me = null; S.live.clear(); S.pings = []; },
  };
}
