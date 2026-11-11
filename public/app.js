import { sb, confirmed } from './supa.js';
import { createPoints } from './markers.js';
import { rulesForm, normalize, DEFAULTS } from './rules.js';
import { getPts, toLL, pip, offsetOf, randomArea, areaLabel, previewSvg, openAreaEditor, openShapeModal } from './area.js';

const $ = (i) => document.getElementById(i);
const MET = { run: 9.8, walk: 3.8, ride: 7.5 };
let uid, myName = 'Player', gid, game, players = {}, tags = {}, mode = 'run', skew = 0, poll, chan;
let started = false;
let map, zone, me, pts, watchId = null, follow = true, firstFix = true, lastGpsErr = 0, dist = 0, lastPos, lastSend = 0, loop, finished = false, outT = 0, pendingShown = '', lastPing = '', startedMap = false;
let releasingPing = false, lastPingFetch = 0;

/* ---------- helpers ---------- */
const toast = (m) => { const e = $('toast'); e.textContent = m; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2600); };
const show = (id) => { document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === id)); document.body.classList.toggle('ingame', id === 'game'); };
const pos = () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { timeout: 10000, maximumAge: 60000 }));
const pad = (n) => String(n).padStart(2, '0');
const mmss = (s) => { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const sheet = (build) => { const s = $('sheetIn'); s.replaceChildren(); build(s); $('sheet').classList.add('on'); };
const closeSheet = () => $('sheet').classList.remove('on');
const hiders = () => Object.values(players).filter((p) => p.role === 'hider');
const freeHiders = () => hiders().filter((p) => p.status !== 'tagged');
const nowMs = () => Date.now() + skew;
const rl = () => normalize(game.rules || {});
const startMs = () => Date.parse(game.started_at);
const isPaused = () => !!(game && game.paused_at);
const elapsed = () => ((game.paused_at ? Date.parse(game.paused_at) : nowMs()) - startMs()) / 1000;
const myRole = () => players[uid] && players[uid].role;
const amTagged = () => players[uid] && players[uid].status === 'tagged';
const fail = (e, m) => { console.error(e); toast(m || 'Something went wrong. Try again.'); };

/* ---------- sign-in guard + profile ---------- */
const { data: { session } } = await sb.auth.getSession();
if (!session || !confirmed(session.user)) { location.replace('auth.html'); await new Promise(() => {}); }
uid = session.user.id;
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('auth.html'); });
const { data: prof } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
myName = (prof && prof.display_name) || 'Player';
$('name').value = myName;
homeCards(prof);

async function homeCards(p) {
  const box = $('hstats');
  if (p) {
    const c = el('div', 'card'); c.id = 'mystats';
    c.appendChild(el('div', 'mu', 'YOUR STATS')).style.cssText = 'font-size:11px;letter-spacing:.12em;margin-bottom:10px';
    const r = el('div', 'row');
    [[p.games_played, 'GAMES'], [p.wins, 'WINS'], [Math.round(p.distance_m / 100) / 10 + ' km', 'DISTANCE'], [Math.round(p.calories), 'KCAL']].forEach(([v, l]) => { const s = el('div', 'st'); s.appendChild(el('b', '', String(v))); s.appendChild(el('span', '', l)); r.appendChild(s); });
    c.appendChild(r); box.appendChild(c);
  }
  const { data: top } = await sb.from('profiles').select('display_name,wins,distance_m').gt('games_played', 0).order('wins', { ascending: false }).order('distance_m', { ascending: false }).limit(5);
  if (top && top.length) {
    const c = el('div', 'card'); c.appendChild(el('div', 'mu', 'TOP PLAYERS')).style.cssText = 'font-size:11px;letter-spacing:.12em;margin-bottom:6px';
    top.forEach((t, i) => { const r = el('div', 'er'); r.appendChild(el('span', '', (i + 1) + '. ' + t.display_name)); r.appendChild(el('span', 'yl', t.wins + ' wins')); c.appendChild(r); });
    box.appendChild(c);
  }
}

$('so').onclick = () => sb.auth.signOut().then(() => location.replace('auth.html'));
const qc = new URLSearchParams(location.search).get('code');
if (qc) $('code').value = qc.slice(0, 6).toUpperCase();
$('sheet').onclick = (e) => { if (e.target === $('sheet') && !$('sheet').dataset.lock) closeSheet(); };
document.querySelectorAll('[data-m]').forEach((c) => (c.onclick = () => { mode = c.dataset.m; document.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('a', x === c)); }));

/* ---------- create / join ---------- */
async function saveName() {
  const n = ($('name').value || myName).replace(/[<>]/g, '').trim().slice(0, 14);
  if (n.length >= 2 && n !== myName) { myName = n; await sb.from('profiles').update({ display_name: n }).eq('id', uid); }
  return myName;
}
const loading = (msg) => { $('loadMsg').textContent = msg || ''; $('loading').classList.toggle('on', !!msg); };
$('create').onclick = async () => {
  if ($('loading').classList.contains('on')) return;
  loading('Finding your location...');
  try {
    const p = await pos(); loading('Creating your game...'); await saveName();
    for (let i = 0; i < 4; i++) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data, error } = await sb.from('games').insert({ code, host: uid, center_lat: p.lat, center_lng: p.lng, rules: normalize(DEFAULTS) }).select().single();
      if (!error) { gid = data.id; await enter(); return; }
      if (error.code !== '23505') throw error;
    }
  } catch (e) { if (e && e.code === 1) toast('Allow location to create a game'); else if (e && e.code === 3) toast('Could not find your location. Check your GPS and try again.'); else fail(e); }
  finally { loading(''); }
};
$('join').onclick = async () => {
  if ($('loading').classList.contains('on')) return;
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 4) return toast('Type the join code');
  loading('Joining the game...');
  try {
    const { data, error } = await sb.from('games').select('id,status').eq('code', code).maybeSingle();
    if (error) return fail(error);
    if (!data) return toast('No game with that code');
    gid = data.id; await saveName(); await enter();
  } finally { loading(''); }
};

async function enter() {
  try {
    const t0 = Date.now(), { data: sn } = await sb.rpc('server_now');
    if (sn) skew = Date.parse(sn) - (t0 + Date.now()) / 2;
    await sb.from('game_players').upsert({ game_id: gid, user_id: uid, name: myName, role: 'hider' }, { onConflict: 'game_id,user_id', ignoreDuplicates: true });
    await loadPlayers();
    await Promise.all([loadGame(), loadTags()]);
    if (!started) show('lobby');
    renderLobby();

    const f = () => 'game_id=eq.' + gid;
    chan = sb.channel('g' + gid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.' + gid }, loadGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: f() }, loadPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: f() }, loadTags)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions', filter: f() }, loadLive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pings', filter: f() }, loadPings)
      .subscribe();
    poll = setInterval(() => { loadGame(); loadPlayers(); loadTags(); if (game && game.status === 'live') { loadLive(); loadPings(); } }, 2500);
  } catch (e) { fail(e); }
}

async function loadGame() {
  const { data } = await sb.from('games').select('*').eq('id', gid).maybeSingle(); if (!data) return;
  const prevRound = game ? game.round : null; game = data; if (prevRound !== null && game.round !== prevRound) restartLocal(); if (map && zoneKey && zoneKey !== keyOf()) drawZone(false); renderLobby();
  if (game.status === 'live' && !started && !finished && myRole()) startGame();
  if (game.status === 'over' && loop) finish(game.winner);
}
async function loadPlayers() { const { data } = await sb.from('game_players').select('*').eq('game_id', gid); if (!data) return; players = {}; data.forEach((p) => (players[p.user_id] = p)); renderLobby(); }
async function loadTags() { const { data } = await sb.from('tags').select('*').eq('game_id', gid); if (!data) return; tags = {}; data.forEach((t) => (tags[t.target] = t)); onTags(); }
$('share').onclick = async () => {
  const url = location.origin + '/play.html?code=' + game.code;
  try { if (navigator.share) await navigator.share({ title: 'Join my Blackout game', text: 'Code ' + game.code, url }); else { await navigator.clipboard.writeText(url); toast('Invite link copied'); } } catch (e) {}
};

/* ---------- lobby + host rules ---------- */
let rt, rulesInit = false;
const rf = rulesForm(DEFAULTS, { onChange: (r) => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (game && game.host === uid && game.status === 'lobby') sb.from('games').update({ rules: r }).eq('id', gid).then(() => {}); }, 450);
} });
$('rulesForm').appendChild(rf.el);

function renderLobby() {
  if (!game) return;
  const host = game.host === uid;
  $('lcode').textContent = game.code;
  const list = $('plist'); list.replaceChildren();
  Object.values(players).forEach((p) => {
    const row = el('div', 'pl'); row.appendChild(el('span', '', p.name));
    row.appendChild(el('span', p.role === 'seeker' ? 'or' : 'yl', p.role.toUpperCase()));
    if (host && p.role !== 'seeker' && game.status === 'lobby') { const b = el('button', '', 'Make seeker'); b.onclick = async () => { const { error } = await sb.rpc('set_role', { g: gid, u: p.user_id, r: 'seeker' }); if (error) fail(error); else loadPlayers(); }; row.appendChild(b); }
    list.appendChild(row);
  });
  $('start').style.display = host ? 'block' : 'none'; $('lhint').style.display = host ? 'none' : 'block';
  $('rulesBox').classList.toggle('ro', !host); rf.setReadonly(!host);
  if (host ? !rulesInit : true) { rf.set(game.rules || DEFAULTS); rulesInit = true; }
  renderArea(host);
}

function renderArea(host) {
  const r = normalize(game.rules || {}), A = game.area || { type: 'Circle' };
  $('areaPrev').replaceChildren(previewSvg(A, r.zoneM, r.shrink ? r.finalM : 0));
  $('areaName').textContent = areaLabel(A) + ' \u00B7 ' + r.zoneM + ' m';
  $('areaNote').textContent = A.type === 'Custom' ? 'Drawn by the host. It scales with the starting zone size.' : 'The host can choose a shape, let the map choose, or draw their own.';
  const bt = $('areaBtns'); bt.replaceChildren(); if (!host || game.status !== 'lobby') return;
  const pick = el('button', 'o', 'Choose shape'); pick.onclick = () => chooseShape(r, A);
  const a = el('button', 'o', 'Let map choose'); a.onclick = autoArea;
  const b = el('button', '', 'Draw on map'); b.onclick = editArea;
  bt.append(pick, a, b);
}

function chooseShape(r, A) {
  openShapeModal({
    current: A, D: r.zoneM, finalM: r.shrink ? r.finalM : 0,
    onSelect: async (newArea) => {
      const { error } = await sb.from('games').update({ area: newArea }).eq('id', gid);
      if (error) fail(error); else { await loadGame(); toast('Play area updated: ' + areaLabel(newArea)); }
    },
    onDraw: editArea
  });
}

async function findSpot(c) {
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 7000);
  const q = '[out:json][timeout:6];(way["leisure"~"^(park|playground|pitch|recreation_ground|garden)$"](<around:1200,' + c[0] + ',' + c[1] + '>);way["landuse"~"^(recreation_ground|grass|village_green)$"](<around:1200,' + c[0] + ',' + c[1] + '>););out center 20;';
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctrl.signal });
    const j = await res.json(), els = (j.elements || []).filter((e) => e.center); if (!els.length) return null;
    const e = els[Math.floor(Math.random() * els.length)]; return { lat: e.center.lat, lng: e.center.lon, name: e.tags && e.tags.name };
  } finally { clearTimeout(tm); }
}
async function autoArea() {
  loading('Finding a good spot...');
  try {
    const c = [game.center_lat, game.center_lng]; let spot = null;
    try { spot = await findSpot(c); } catch (e) { console.warn('Spot search failed, using your position', e); }
    const area = randomArea(), center = spot ? [spot.lat, spot.lng] : c;
    const { error } = await sb.from('games').update({ center_lat: center[0], center_lng: center[1], area }).eq('id', gid);
    if (error) throw error;
    await loadGame(); toast(areaLabel(area) + (spot ? ' near ' + (spot.name || 'an open space') : ' around you'));
  } catch (e) { fail(e); } finally { loading(''); }
}
function editArea() {
  const r = normalize(game.rules || {});
  openAreaEditor({ center: [game.center_lat, game.center_lng], area: game.area, D: r.zoneM, finalM: r.shrink ? r.finalM : 0, onSave: async (res) => {
    const next = normalize({ ...rf.get(), zoneM: res.zoneM });
    const { error } = await sb.from('games').update({ center_lat: res.center[0], center_lng: res.center[1], area: res.area, rules: next }).eq('id', gid);
    if (error) return fail(error);
    rf.set(next); await loadGame(); toast('Play area saved');
  } });
}
$('start').onclick = async () => {
  if (!Object.values(players).some((p) => p.role === 'seeker')) return toast('Pick a seeker first');
  if (hiders().length < 1) return toast('You need at least one hider');
  const { error } = await sb.rpc('start_game', { g: gid, r: rf.get() });
  if (error) fail(error, error.message.includes('seeker') ? 'Pick a seeker first' : undefined); else loadGame();
};

/* ---------- map ---------- */
const ES = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const esri = (svc, o = {}) => [ES + svc + '/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 19, maxZoom: 20, attribution: 'Tiles &copy; Esri', ...o }];
const BASES = {
  Streets: { bg: '#E9E7E1', sw: 'linear-gradient(135deg,#F4F1EA 50%,#FFFFFF 50%)', layers: [esri('World_Street_Map')] },
  Light: { bg: '#EFEFEF', sw: '#E4E4E4', layers: [esri('Canvas/World_Light_Gray_Base', { maxNativeZoom: 16 }), esri('Canvas/World_Light_Gray_Reference', { maxNativeZoom: 16 })] },
  Dark: { bg: '#1C1C1E', sw: '#2B2B2E', layers: [esri('Canvas/World_Dark_Gray_Base', { maxNativeZoom: 16 }), esri('Canvas/World_Dark_Gray_Reference', { maxNativeZoom: 16 })] },
  Satellite: { bg: '#222', sw: 'linear-gradient(135deg,#2F4A2B,#6E5E3C)', layers: [esri('World_Imagery', { attribution: 'Imagery &copy; Esri' })] },
  Hybrid: { bg: '#222', sw: 'linear-gradient(135deg,#2F4A2B 50%,#D4621A 50%)', layers: [esri('World_Imagery', { attribution: 'Imagery &copy; Esri' }), esri('Reference/World_Boundaries_and_Places')] },
  Terrain: { bg: '#E8E4D5', sw: 'linear-gradient(135deg,#D9E3C3,#E8D9B5)', layers: [esri('World_Topo_Map')] },
  OpenStreetMap: { bg: '#E9E7E1', sw: 'linear-gradient(135deg,#C9E2B4 50%,#F2EFE9 50%)', layers: [['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }]] },
};
const LEGACY = { Standard: 'Streets' };
const who = (id) => { const p = players[id]; return { name: p ? p.name : 'Player', role: p ? p.role : 'seeker' }; };
const gc = () => [game.center_lat, game.center_lng];

let areaPts = null, finals = [], zoneKey = '';
const keyOf = () => JSON.stringify([game.rules, game.area, game.center_lat, game.center_lng]);
function drawZone(fit) {
  if (!map || !game) return;
  finals.forEach((l) => l.remove()); finals = []; if (zone) { zone.remove(); zone = null; }
  const r = rl(), c = gc(), fk = Math.min(r.finalM, r.zoneM) / r.zoneM;
  areaPts = getPts(game.area, r.zoneM);
  if (r.shrink) {
    const casing = { color: '#2A1A0E', weight: 5, opacity: 0.45, fillOpacity: 0, interactive: false }, dash = { color: '#F4AE52', weight: 3, dashArray: '8 8', fillOpacity: 0, interactive: false };
    finals = areaPts ? [L.polygon(toLL(c, areaPts, fk), casing), L.polygon(toLL(c, areaPts, fk), dash)] : [L.circle(c, { radius: (r.zoneM * fk) / 2, ...casing }), L.circle(c, { radius: (r.zoneM * fk) / 2, ...dash })];
    finals.forEach((l) => l.addTo(map));
  }
  const zs = { color: '#D4621A', weight: 4, fillOpacity: 0.04 };
  zone = (areaPts ? L.polygon(toLL(c, areaPts, (radius() * 2) / r.zoneM), zs) : L.circle(c, { radius: radius(), ...zs })).addTo(map);
  zoneKey = keyOf();
  if (fit) map.fitBounds(zone.getBounds(), { padding: [70, 70], maxZoom: 18 });
}
function updateZone(rad) { if (!zone) return; if (areaPts) zone.setLatLngs(toLL(gc(), areaPts, (rad * 2) / rl().zoneM)); else zone.setRadius(rad); }
function insideZone(rad) {
  if (!me) return true;
  if (!areaPts) return map.distance(gc(), me) <= rad;
  const k = (rad * 2) / rl().zoneM; return pip(offsetOf(gc(), [me.lat, me.lng]), areaPts.map(([x, y]) => [x * k, y * k]));
}
function buildMap() {
  map = L.map('map', { zoomControl: false }).setView(gc(), 15);
  const names = Object.keys(BASES); let cur = 'Streets', tiles = [];
  try { const sv = localStorage.getItem('mf_map'); const m = LEGACY[sv] || sv; if (BASES[m]) cur = m; } catch (e) {}
  const setBase = (n) => {
    cur = n; tiles.forEach((l) => l.remove());
    tiles = BASES[n].layers.map((l) => L.tileLayer(l[0], l[1]).addTo(map)); tiles[0].bringToBack();
    map.getContainer().style.background = BASES[n].bg; try { localStorage.setItem('mf_map', n); } catch (e) {}
  };
  setBase(cur);

  const ctl = L.control({ position: 'topright' });
  ctl.onAdd = () => {
    const box = L.DomUtil.create('div', 'mapmenu');
    const b = L.DomUtil.create('button', 'mapbtn', box); b.type = 'button'; b.setAttribute('aria-label', 'Map style'); b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>';
    const menu = L.DomUtil.create('div', 'mmenu', box); menu.hidden = true; menu.setAttribute('role', 'menu');
    menu.appendChild(el('p', '', 'MAP STYLE'));
    const items = {};
    const paintMenu = () => names.forEach((n) => { items[n].classList.toggle('on', n === cur); items[n].setAttribute('aria-checked', n === cur); items[n].querySelector('.ck').textContent = n === cur ? '\u2713' : ''; });
    const close = () => { menu.hidden = true; b.setAttribute('aria-expanded', 'false'); };
    names.forEach((n) => {
      const it = L.DomUtil.create('button', 'mi', menu); it.type = 'button'; it.setAttribute('role', 'menuitemradio');
      const sw = document.createElement('i'); sw.style.background = BASES[n].sw; it.appendChild(sw); it.appendChild(document.createTextNode(n));
      const ck = document.createElement('span'); ck.className = 'ck'; it.appendChild(ck);
      it.onclick = () => { setBase(n); paintMenu(); close(); toast(n + ' map'); }; items[n] = it;
    });
    b.onclick = () => { if (menu.hidden) { menu.hidden = false; b.setAttribute('aria-expanded', 'true'); paintMenu(); } else close(); };
    L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
    map.on('click', close); document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return box;
  };
  ctl.addTo(map);
  pts = createPoints(map, { now: nowMs });

  const lc = L.control({ position: 'topright' });
  lc.onAdd = () => {
    const b = L.DomUtil.create('button', 'locbtn on'); b.type = 'button'; b.setAttribute('aria-label', 'Follow my position');
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
    L.DomEvent.disableClickPropagation(b);
    b.onclick = () => { follow = true; b.classList.add('on'); const p = pts.mePos(); if (p) map.setView(p, Math.max(map.getZoom(), 16)); };
    map.on('dragstart', () => { follow = false; b.classList.remove('on'); });
    return b;
  };
  lc.addTo(map);
  const lg = L.control({ position: 'bottomleft' });
  lg.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<span><i style="background:#D4621A"></i>Seekers</span><span><i style="background:#F4AE52"></i>Hiders</span>'; return d; };
  lg.addTo(map);
  const fit = () => map.invalidateSize(); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300)); setTimeout(fit, 200);
  const zc = L.control({ position: 'topleft' }); zc.onAdd = () => { const d = L.DomUtil.create('div', 'zpill'); d.id = 'zpill'; return d; }; zc.addTo(map);
  drawZone(true);
}

function radius() {
  const r = rl(); if (!r.shrink) return r.zoneM / 2;
  const hs = r.headMin * 60, seg = (r.roundMin * 60 - hs) / 4, tt = Math.max(0, elapsed() - hs);
  const rad = [0, 1, 2, 3].map((i) => (r.zoneM + (Math.min(r.finalM, r.zoneM) - r.zoneM) * (i / 3)) / 2);
  const i = Math.min(3, Math.floor(tt / seg)), n = Math.min(3, i + 1), into = tt - i * seg, sh = Math.min(30, seg / 2), st = seg - sh;
  if (into <= st || i === n) return rad[i];
  return rad[i] + (rad[n] - rad[i]) * Math.min(1, (into - st) / sh);
}

/* ---------- live game + instant ping sync ---------- */
async function loadLive() {
  if (!map || !pts) return;
  const { data } = await sb.from('live_positions').select('user_id,lat,lng,updated_at').eq('game_id', gid); if (!data) return;
  pts.syncLive(data, who, uid);
}

async function loadPings() {
  if (!map || !pts || myRole() !== 'seeker') return;
  const { data } = await sb.from('pings').select('taken_at,hiders').eq('game_id', gid).maybeSingle();
  if (!data || data.taken_at === lastPing) return;
  const first = lastPing === ''; lastPing = data.taken_at;
  pts.showPings(data.hiders || [], Date.parse(data.taken_at));
  if (!first || nowMs() - Date.parse(data.taken_at) < 25000) {
    toast('PING! Hiders located');
    if (navigator.vibrate) try { navigator.vibrate([70, 50, 70]); } catch (e) {}
  }
}

// Releases a fresh ping instantly on timer expiry without lag
async function releasePing() {
  if (releasingPing || !game || game.status !== 'live' || isPaused()) return;
  releasingPing = true;
  try {
    const r = rl();
    const now = nowMs();
    const nowIso = new Date(now).toISOString();

    const { error: rpcErr } = await sb.rpc('release_ping', { g: gid });
    if (rpcErr) {
      const { data: locs } = await sb.from('locations').select('user_id,lat,lng,updated_at').eq('game_id', gid);
      const free = new Set(freeHiders().map((p) => p.user_id));
      const pingHiders = (locs || []).filter((l) => free.has(l.user_id)).map((l) => ({ lat: l.lat, lng: l.lng, user_id: l.user_id }));

      await sb.from('pings').upsert({ game_id: gid, taken_at: nowIso, hiders: pingHiders }, { onConflict: 'game_id' });
      const nextAtIso = new Date(now + r.pingSec * 1000).toISOString();
      await sb.from('games').update({ next_ping_at: nextAtIso }).eq('id', gid);
      if (game) game.next_ping_at = nextAtIso;
    }
    await loadPings();
    loadGame();
  } catch (e) {
    console.warn('Ping release error:', e);
  } finally {
    releasingPing = false;
  }
}

function startGame() {
  started = true; show('game'); finished = false; setDock(false);
  const role = myRole();
  $('role').textContent = role.toUpperCase(); $('role').style.background = role === 'seeker' ? 'var(--or)' : 'var(--yl)';
  try { if (!window.L) throw new Error('Leaflet is missing'); buildMap(); } catch (e) { console.error('Map failed to start', e); map = null; zone = null; pts = null; toast('The map could not load. Check your connection and refresh.'); }
  firstFix = true; follow = true;
  watchId = navigator.geolocation.watchPosition((p) => {
    if (finished) return;
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!map || !pts) return;
    pts.setMe(me.lat, me.lng, p.coords.accuracy, role, myName);
    if (firstFix) { firstFix = false; map.setView([me.lat, me.lng], Math.max(map.getZoom(), 16)); }
    else if (follow) map.panTo([me.lat, me.lng], { animate: true, duration: 0.9 });
    if (lastPos) { const d = map.distance(lastPos, me); if (d > 2 && p.coords.accuracy <= 60) dist += d; }
    lastPos = me;
    if (!amTagged() && !isPaused() && Date.now() - lastSend > 3500) {
      lastSend = Date.now(); const row = { game_id: gid, user_id: uid, lat: me.lat, lng: me.lng, updated_at: new Date().toISOString() };
      sb.from('locations').upsert(row).then(() => {});
      if (role === 'seeker') sb.from('live_positions').upsert(row).then(() => {});
    }
  }, (err) => { const n = Date.now(); if (n - lastGpsErr > 20000) { lastGpsErr = n; toast(err && err.code === 1 ? 'Location blocked. Allow location to play' : 'GPS signal is weak'); } }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  loadLive(); loadPings();
  $('tagBtn').style.display = role === 'seeker' ? 'block' : 'none';
  loop = setInterval(tick, 1000); tick();
}

function setBanner(txt, yellow) { const b = $('banner'); b.textContent = txt || ''; b.classList.toggle('on', !!txt); b.classList.toggle('y', !!yellow); }

function tick() {
  const r = rl(), t = elapsed(), hs = r.headMin * 60, end = r.roundMin * 60, role = myRole(), rad = radius();
  updateZone(rad);
  const w = hiders().length && freeHiders().length === 0 ? 'seekers' : t >= end ? 'hiders' : null;
  if (w) { if (game.host === uid && game.status !== 'over') sb.rpc('finish_game', { g: gid, w }).then(() => {}); return finish(w); }
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('tm').textContent = mmss(t); $('kc').textContent = kc; $('ds').textContent = Math.round(dist); $('clock').textContent = mmss(end - t);
  const out = me && map && !insideZone(rad);
  if (role === 'hider' && !amTagged() && t > hs && !isPaused()) {
    outT = out ? outT + 1 : Math.max(0, outT - 1);
    if (outT >= 120) { sb.rpc('tag_self', { g: gid }).then(() => loadPlayers()); toast('You stayed outside the zone: counted as tagged'); outT = 0; }
  }
  let banner = '';
  if (isPaused()) banner = 'Game paused. Waiting for the host to resume.';
  else if (t < hs) banner = role === 'seeker' ? 'Hold still: hiders are hiding. ' + mmss(hs - t) : 'Head start: go hide! ' + mmss(hs - t);
  else if (amTagged()) banner = 'You are tagged. You can watch the rest of the round.';
  else if (out) banner = role === 'hider' ? 'Outside the zone! Back in ' + Math.max(0, 120 - outT) + ' s or you are tagged' : 'You are outside the zone';
  setBanner(banner, t < hs);

  // Accurate ping timing check
  const np = game.next_ping_at ? Date.parse(game.next_ping_at) : null;
  const next = np ? Math.max(0, Math.round((np - nowMs()) / 1000)) : 0;
  if (t >= hs && r.pingSec > 0 && !isPaused()) {
    const isDue = np ? nowMs() >= np : (t >= hs && !lastPing);
    if (isDue) {
      const isHost = game.host === uid;
      const isFallback = !isHost && np && (nowMs() - np > 2000);
      if (isHost || isFallback) releasePing();
    }
  }

  // Pre-fetch pings as countdown reaches 0
  if (role === 'seeker' && t >= hs && next <= 1 && Date.now() - lastPingFetch > 1000) {
    lastPingFetch = Date.now();
    loadPings();
  }

  const free = freeHiders().length;
  if (role === 'seeker') $('info').innerHTML = (np ? '<span class="yl">NEXT PING</span> in ' + mmss(Math.max(next, t < hs ? hs - t : 0)) : '<span class="yl">PINGS OFF</span>') + ' · hiders free ' + free;
  else $('info').innerHTML = '<span class="or">SEEKER LIVE</span> on your map · hiders free ' + free;
  const pz = isPaused(); $('tagBtn').disabled = t < hs || pz;
  $('pauseOv').hidden = !pz; $('pauseTxt').textContent = game.host === uid ? 'The clock, zone and pings are stopped. Press Resume when everyone is ready.' : 'The host stopped the game. The clock, zone and pings are on hold.';
  $('hostBar').hidden = game.host !== uid; $('pauseBtn').textContent = pz ? 'Resume game' : 'Pause game';
  if (pz && game.host === uid && !pausedOpened) { pausedOpened = true; setDock(true); } if (!pz) pausedOpened = false;
  $('rulesBtn').disabled = !pz; $('rulesBtn').textContent = pz ? 'Edit rules' : 'Edit rules (pause first)';
  if (pts) pts.fade();

  const zp = $('zpill');
  if (zp) {
    const seg = (end - hs) / 4, sh = Math.min(30, seg / 2), tt = t - hs, i = Math.floor(tt / seg), into = tt - i * seg, st = seg - sh;
    let cls = 'zpill', html;
    if (!r.shrink) html = '<small>ZONE</small><b>FIXED SIZE</b>';
    else if (t < hs) html = '<small>HEAD START ENDS IN</small><b>' + mmss(hs - t) + '</b>';
    else if (i >= 3) html = '<small>FINAL ZONE</small><b>Stay inside the dotted ring</b>';
    else if (into < st) { html = '<small>ZONE SHRINKS IN</small><b>' + mmss(st - into) + '</b>'; if (st - into <= 10) cls += ' warn'; }
    else { cls += ' go'; html = '<small>ZONE CLOSING</small><b>' + mmss(seg - into) + '</b><i style="width:' + Math.round(((into - st) / sh) * 100) + '%"></i>'; }
    zp.className = cls; zp.innerHTML = html;
  }
}

/* ---------- slide-up panel ---------- */
const dock = $('dock'); let dockOpen = false, pausedOpened = false;
const peekPx = () => parseFloat(getComputedStyle($('game')).getPropertyValue('--peek')) || 82;
function setDock(v) { dockOpen = v; dock.classList.toggle('open', v); dock.style.transform = ''; dock.style.transition = ''; $('grab').setAttribute('aria-expanded', String(v)); }
{
  const g = $('grab'); let y0 = null, base = 0, moved = 0;
  g.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = 0; base = dockOpen ? 0 : dock.offsetHeight - peekPx(); g.setPointerCapture(e.pointerId); dock.style.transition = 'none'; });
  g.addEventListener('pointermove', (e) => { if (y0 === null) return; moved = e.clientY - y0; dock.style.transform = 'translateY(' + Math.max(0, Math.min(dock.offsetHeight - peekPx(), base + moved)) + 'px)'; });
  g.addEventListener('pointerup', () => { if (y0 === null) return; const m = moved; y0 = null; if (Math.abs(m) < 8) setDock(!dockOpen); else setDock(m < 0); });
  g.addEventListener('pointercancel', () => { y0 = null; setDock(dockOpen); });
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDock(!dockOpen); } });
}

/* ---------- host controls ---------- */
$('pauseBtn').onclick = async () => { const { error } = await sb.rpc(isPaused() ? 'resume_game' : 'pause_game', { g: gid }); if (error) fail(error); else { await loadGame(); toast(isPaused() ? 'Game paused for everyone' : 'Game resumed'); } };
$('rulesBtn').onclick = () => {
  if (!isPaused()) return toast('Pause the game first to change the rules');
  sheet((s) => {
    s.appendChild(el('h2', '', 'Game rules')); s.appendChild(el('p', '', 'Changes take effect when you resume.'));
    const f = rulesForm(game.rules || DEFAULTS); s.appendChild(f.el);
    const save = el('button', '', 'Save rules'); save.onclick = async () => { const { error } = await sb.rpc('update_rules', { g: gid, r: f.get() }); closeSheet(); if (error) fail(error); else { await loadGame(); toast('Rules saved. Press Resume when ready.'); } };
    const cancel = el('button', 'o', 'Cancel'); cancel.style.marginTop = '8px'; cancel.onclick = closeSheet; s.appendChild(save); s.appendChild(cancel);
  });
};
$('restartBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'Restart the round?')); s.appendChild(el('p', '', 'The timer and zone start again from the beginning, every hider is free again and all tags are cleared. Roles and rules stay.'));
  const y = el('button', '', 'Yes, restart'); y.onclick = async () => { closeSheet(); const { error } = await sb.rpc('restart_game', { g: gid }); if (error) fail(error); else { await loadGame(); toast('Round restarted'); } };
  const n = el('button', 'o', 'Cancel'); n.style.marginTop = '8px'; n.onclick = closeSheet; s.appendChild(y); s.appendChild(n);
});
$('endBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'End the game?')); s.appendChild(el('p', '', 'This ends the round for everyone. There is no winner.'));
  const y = el('button', '', 'Yes, end the game'); y.onclick = async () => { closeSheet(); const { error } = await sb.rpc('end_game', { g: gid }); if (error) fail(error); else loadGame(); };
  const n = el('button', 'o', 'Keep playing'); n.style.marginTop = '8px'; n.onclick = closeSheet; s.appendChild(y); s.appendChild(n);
});

function restartLocal() {
  dist = 0; outT = 0; lastPing = ''; pendingShown = ''; lastSend = 0; tags = {}; seenTag.clear();
  if (pts) pts.showPings([], nowMs());
  toast('The host restarted the round');
}

/* ---------- tagging ---------- */
$('tagBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'Who did you tag?')); s.appendChild(el('p', '', 'The hider has to confirm on their phone.'));
  const f = freeHiders(); if (!f.length) s.appendChild(el('p', '', 'No free hiders left.'));
  f.forEach((p) => { const b = el('button', 'o', p.name); b.style.marginBottom = '8px'; b.onclick = async () => { closeSheet(); const { error } = await sb.rpc('claim_tag', { g: gid, t: p.user_id }); if (error) fail(error); else toast('Waiting for ' + p.name + ' to confirm'); }; s.appendChild(b); });
});
const seenTag = new Set();
function onTags() {
  const mine = tags[uid];
  if (mine && mine.status === 'pending' && myRole() === 'hider' && !amTagged() && pendingShown !== mine.created_at) {
    pendingShown = mine.created_at; $('sheet').dataset.lock = '1';
    sheet((s) => {
      s.appendChild(el('h2', '', 'Were you tagged?')); s.appendChild(el('p', '', mine.by_name + ' says they tagged you.'));
      const answer = async (accept) => { delete $('sheet').dataset.lock; closeSheet(); const { error } = await sb.rpc('answer_tag', { g: gid, accept }); if (error) fail(error); loadPlayers(); loadTags(); };
      const y = el('button', '', 'Yes, I am tagged'); y.onclick = () => answer(true);
      const n = el('button', 'o', 'No, dispute it'); n.style.marginTop = '8px'; n.onclick = () => answer(false);
      s.appendChild(y); s.appendChild(n);
    });
  }
  Object.entries(tags).forEach(([id, t]) => {
    const key = id + t.created_at + t.status;
    if (t.by_user === uid && (t.status === 'confirmed' || t.status === 'disputed') && !seenTag.has(key)) { seenTag.add(key); const n = players[id] ? players[id].name : 'hider'; toast(t.status === 'confirmed' ? 'Tag confirmed: ' + n : 'Tag disputed by ' + n); }
  });
}

/* ---------- results ---------- */
async function finish(winner) {
  if (finished) return; finished = true; clearInterval(loop); loop = null; clearInterval(poll); closeSheet();
  if (watchId != null) navigator.geolocation.clearWatch(watchId); if (pts) { pts.destroy(); pts = null; }
  const role = myRole(), won = winner ? (winner === 'seekers') === (role === 'seeker') : false;
  const t = Math.min(elapsed(), rl().roundMin * 60);
  $('eTitle').textContent = !winner ? 'Game ended' : winner === 'seekers' ? 'Seekers win!' : 'Hiders win!';
  $('eSub').textContent = !winner ? 'The host ended the game.' : won ? 'Your side won this round.' : 'Better luck next round.';
  $('eTag').textContent = won ? 'VICTORY' : 'ROUND OVER';
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('eD').textContent = Math.round(dist); $('eK').textContent = kc; $('eT').textContent = Math.round(t / 60);
  $('eP').textContent = dist > 50 ? Math.floor(t / (dist / 1000) / 60) + "'" + pad(Math.floor((t / (dist / 1000)) % 60)) + '"' : '--';
  $('eF').textContent = hiders().filter((p) => p.status === 'tagged').length;
  const l = $('eList'); l.replaceChildren();
  hiders().forEach((p) => { const r = el('div', 'er'); r.appendChild(el('span', '', p.name)); r.appendChild(el('span', p.status === 'tagged' ? 'or' : 'yl', p.status === 'tagged' ? 'Tagged' : 'Survived')); l.appendChild(r); });
  show('end');
  const { error } = await sb.rpc('save_result', { g: gid, p_role: role, p_won: won, p_dist: Math.round(dist), p_cal: kc, p_secs: Math.round(t) });
  if (error) console.error('Could not save result', error);
}
$('again').onclick = () => location.replace('play.html');
