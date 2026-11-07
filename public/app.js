import { sb, confirmed } from './supa.js';

const $ = (i) => document.getElementById(i);
const MET = { run: 9.8, walk: 3.8, ride: 7.5 };
const DEFAULTS = { roundMin: 45, pingMin: 5, headMin: 3, zoneM: 840, finalM: 200, shrink: true };
let uid, myName = 'Player', gid, game, players = {}, tags = {}, mode = 'run', skew = 0, poll, chan;
let map, zone, me, myMarker, others = [], dist = 0, lastPos, lastSend = 0, loop, finished = false, outT = 0, pendingShown = '', lastPing = '', startedMap = false;

/* ---------- helpers ---------- */
const toast = (m) => { const e = $('toast'); e.textContent = m; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2600); };
const show = (id) => document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === id));
const pos = () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: true }));
const pad = (n) => String(n).padStart(2, '0');
const mmss = (s) => { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }; // textContent only: names are never parsed as HTML
const sheet = (build) => { const s = $('sheetIn'); s.replaceChildren(); build(s); $('sheet').classList.add('on'); };
const closeSheet = () => $('sheet').classList.remove('on');
const hiders = () => Object.values(players).filter((p) => p.role === 'hider');
const freeHiders = () => hiders().filter((p) => p.status !== 'tagged');
const nowMs = () => Date.now() + skew; // server-corrected clock
const rl = () => ({ ...DEFAULTS, ...(game.rules || {}) });
const startMs = () => Date.parse(game.started_at);
const elapsed = () => (nowMs() - startMs()) / 1000;
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
  const anchor = $('create');
  if (p) {
    const c = el('div', 'card'); c.id = 'mystats';
    c.appendChild(el('div', 'mu', 'YOUR STATS')).style.cssText = 'font-size:11px;letter-spacing:.12em;margin-bottom:10px';
    const r = el('div', 'row');
    [[p.games_played, 'GAMES'], [p.wins, 'WINS'], [Math.round(p.distance_m / 100) / 10 + ' km', 'DISTANCE'], [Math.round(p.calories), 'KCAL']].forEach(([v, l]) => { const s = el('div', 'st'); s.appendChild(el('b', '', String(v))); s.appendChild(el('span', '', l)); r.appendChild(s); });
    c.appendChild(r); anchor.before(c);
  }
  const { data: top } = await sb.from('profiles').select('display_name,wins,distance_m').gt('games_played', 0).order('wins', { ascending: false }).order('distance_m', { ascending: false }).limit(5);
  if (top && top.length) {
    const c = el('div', 'card'); c.appendChild(el('div', 'mu', 'TOP PLAYERS')).style.cssText = 'font-size:11px;letter-spacing:.12em;margin-bottom:6px';
    top.forEach((t, i) => { const r = el('div', 'er'); r.appendChild(el('span', '', (i + 1) + '. ' + t.display_name)); r.appendChild(el('span', 'yl', t.wins + ' wins')); c.appendChild(r); });
    anchor.before(c);
  }
}

if (!$('so')) { const b = el('button', 'o', 'Sign out'); b.id = 'so'; b.onclick = () => sb.auth.signOut().then(() => location.replace('auth.html')); $('home').appendChild(b); }
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
$('create').onclick = async () => {
  try {
    const p = await pos(); await saveName();
    for (let i = 0; i < 4; i++) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data, error } = await sb.from('games').insert({ code, host: uid, center_lat: p.lat, center_lng: p.lng, rules: DEFAULTS }).select().single();
      if (!error) { gid = data.id; return enter(); }
      if (error.code !== '23505') throw error; // 23505 = code already used, try another
    }
  } catch (e) { if (e && e.code === 1) toast('Allow location to create a game'); else fail(e); }
};
$('join').onclick = async () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 4) return toast('Type the join code');
  const { data, error } = await sb.from('games').select('id,status').eq('code', code).maybeSingle();
  if (error) return fail(error);
  if (!data) return toast('No game with that code');
  gid = data.id; await saveName(); enter();
};
async function enter() {
  try {
    const t0 = Date.now(), { data: sn } = await sb.rpc('server_now');
    if (sn) skew = Date.parse(sn) - (t0 + Date.now()) / 2;
    await sb.from('game_players').upsert({ game_id: gid, user_id: uid, name: myName, role: 'hider' }, { onConflict: 'game_id,user_id', ignoreDuplicates: true });
    show('lobby');
    await Promise.all([loadGame(), loadPlayers(), loadTags()]);
    // live updates; the 3 second refresh below is a safety net if Realtime is not enabled
    const f = (t) => 'game_id=eq.' + gid;
    chan = sb.channel('g' + gid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.' + gid }, loadGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: f() }, loadPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: f() }, loadTags)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions', filter: f() }, loadLive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pings', filter: f() }, loadPings)
      .subscribe();
    poll = setInterval(() => { loadGame(); loadPlayers(); loadTags(); if (game && game.status === 'live') { loadLive(); loadPings(); } }, 3000);
  } catch (e) { fail(e); }
}
async function loadGame() {
  const { data } = await sb.from('games').select('*').eq('id', gid).maybeSingle(); if (!data) return;
  const was = game && game.status; game = data; renderLobby();
  if (game.status === 'live' && !loop && !finished) startGame();
  if (game.status === 'over' && loop) finish(game.winner);
}
async function loadPlayers() { const { data } = await sb.from('game_players').select('*').eq('game_id', gid); if (!data) return; players = {}; data.forEach((p) => (players[p.user_id] = p)); renderLobby(); }
async function loadTags() { const { data } = await sb.from('tags').select('*').eq('game_id', gid); if (!data) return; tags = {}; data.forEach((t) => (tags[t.target] = t)); onTags(); }
$('share').onclick = async () => {
  const url = location.origin + '/play.html?code=' + game.code;
  try { if (navigator.share) await navigator.share({ title: 'Join my Blackout game', text: 'Code ' + game.code, url }); else { await navigator.clipboard.writeText(url); toast('Invite link copied'); } } catch (e) {}
};

/* ---------- lobby + host rules ---------- */
function readRules() { return { roundMin: +$('r-round').value, pingMin: +$('r-ping').value, headMin: +$('r-head').value, zoneM: +$('r-zone').value, finalM: Math.min(+$('r-final').value, +$('r-zone').value), shrink: $('r-shrink').checked }; }
function paintRules(r) {
  $('v-round').textContent = r.roundMin < 60 ? r.roundMin + ' min' : Math.floor(r.roundMin / 60) + ' h ' + (r.roundMin % 60 ? r.roundMin % 60 + ' min' : '');
  $('v-ping').textContent = r.pingMin ? r.pingMin + ' min' : 'Off';
  $('v-head').textContent = r.headMin ? r.headMin + ' min' : 'None';
  $('v-zone').textContent = r.zoneM >= 1000 ? (r.zoneM / 1000).toFixed(1) + ' km' : r.zoneM + ' m';
  $('v-final').textContent = r.finalM + ' m';
  $('finalRow').style.display = r.shrink ? 'block' : 'none';
  $('pOut').setAttribute('r', (r.zoneM / 3000) * 92 + 4); $('pIn').setAttribute('r', r.shrink ? Math.max(3, (r.finalM / 3000) * 92) : 0);
}
function setInputs(r) { $('r-round').value = r.roundMin; $('r-ping').value = r.pingMin; $('r-head').value = r.headMin; $('r-zone').value = r.zoneM; $('r-final').value = r.finalM; $('r-shrink').checked = r.shrink; }
let rt, rulesInit = false;
['r-round', 'r-ping', 'r-head', 'r-zone', 'r-final', 'r-shrink'].forEach((id) => ($(id).oninput = () => {
  const r = readRules(); paintRules(r);
  clearTimeout(rt); rt = setTimeout(() => { if (game && game.host === uid) sb.from('games').update({ rules: r }).eq('id', gid).then(() => {}); }, 450);
}));
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
  $('rulesBox').classList.toggle('ro', !host);
  const r = { ...DEFAULTS, ...(game.rules || {}) };
  if (host ? !rulesInit : true) { setInputs(r); rulesInit = true; }
  paintRules(host ? readRules() : r);
}
$('start').onclick = async () => {
  if (!Object.values(players).some((p) => p.role === 'seeker')) return toast('Pick a seeker first');
  if (hiders().length < 1) return toast('You need at least one hider');
  const { error } = await sb.rpc('start_game', { g: gid, r: readRules() });
  if (error) fail(error, error.message.includes('seeker') ? 'Pick a seeker first' : undefined); else loadGame();
};

/* ---------- map ---------- */
const BASES = {
  Standard: ['https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap &copy; CARTO' }, '#E9E7E1'],
  Dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap &copy; CARTO' }, '#1C1C1E'],
  Satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri' }, '#222'],
};
const dot = (ll, color) => L.marker(ll, { icon: L.divIcon({ className: 'puck', html: '<i style="background:' + color + '"></i>', iconSize: [24, 24] }) }).addTo(map);
const clear = () => { others.forEach((m) => m.remove()); others = []; };
const gc = () => [game.center_lat, game.center_lng];
function buildMap() {
  map = L.map('map', { zoomControl: false }).setView(gc(), 15);
  const names = Object.keys(BASES); let cur = 'Standard', layer;
  try { const sv = localStorage.getItem('mf_map'); if (BASES[sv]) cur = sv; } catch (e) {}
  const setBase = (n) => { cur = n; if (layer) layer.remove(); layer = L.tileLayer(BASES[n][0], BASES[n][1]).addTo(map); layer.bringToBack(); map.getContainer().style.background = BASES[n][2]; try { localStorage.setItem('mf_map', n); } catch (e) {} };
  setBase(cur);
  const ctl = L.control({ position: 'topright' });
  ctl.onAdd = () => { const b = L.DomUtil.create('button', 'mapbtn'); b.type = 'button'; b.setAttribute('aria-label', 'Change map style'); b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>'; L.DomEvent.disableClickPropagation(b); b.onclick = () => { const n = names[(names.indexOf(cur) + 1) % names.length]; setBase(n); toast(n + ' map'); }; return b; };
  ctl.addTo(map);
  const fit = () => map.invalidateSize(); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300)); setTimeout(fit, 200);
  const zc = L.control({ position: 'topleft' }); zc.onAdd = () => { const d = L.DomUtil.create('div', 'zpill'); d.id = 'zpill'; return d; }; zc.addTo(map);
  if (rl().shrink) { const fr = Math.min(rl().finalM, rl().zoneM); // the final safe zone stays fixed on the map
    L.circle(gc(), { radius: fr, color: '#2A1A0E', weight: 5, opacity: 0.45, fillOpacity: 0, interactive: false }).addTo(map);
    L.circle(gc(), { radius: fr, color: '#F4AE52', weight: 3, dashArray: '8 8', fillOpacity: 0, interactive: false }).addTo(map); }
  zone = L.circle(gc(), { radius: radius(), color: '#D4621A', weight: 4, fillOpacity: 0.04 }).addTo(map);
}
function radius() {
  const r = rl(); if (!r.shrink) return r.zoneM;
  const hs = r.headMin * 60, seg = (r.roundMin * 60 - hs) / 4, tt = Math.max(0, elapsed() - hs);
  const rad = [0, 1, 2, 3].map((i) => r.zoneM + (Math.min(r.finalM, r.zoneM) - r.zoneM) * (i / 3));
  const i = Math.min(3, Math.floor(tt / seg)), n = Math.min(3, i + 1), into = tt - i * seg, sh = Math.min(30, seg / 2), st = seg - sh;
  if (into <= st || i === n) return rad[i];
  return rad[i] + (rad[n] - rad[i]) * Math.min(1, (into - st) / sh);
}

/* ---------- live game ---------- */
async function loadLive() { // hiders see the seekers live
  if (!map || myRole() !== 'hider') return;
  const { data } = await sb.from('live_positions').select('lat,lng').eq('game_id', gid); if (!data) return;
  clear(); data.forEach((d) => others.push(dot([d.lat, d.lng], '#D4621A')));
}
async function loadPings() { // seekers only see hiders when the server releases a ping
  if (!map || myRole() !== 'seeker') return;
  const { data } = await sb.from('pings').select('taken_at,hiders').eq('game_id', gid).maybeSingle();
  if (!data || data.taken_at === lastPing) return;
  const first = lastPing === ''; lastPing = data.taken_at;
  clear(); (data.hiders || []).forEach((h) => others.push(dot([h.lat, h.lng], '#F4AE52')));
  if (!first || nowMs() - Date.parse(data.taken_at) < 20000) toast('PING! Hiders located');
}
function startGame() {
  show('game'); finished = false;
  const role = myRole();
  $('role').textContent = role.toUpperCase(); $('role').style.background = role === 'seeker' ? 'var(--or)' : 'var(--yl)';
  buildMap();
  navigator.geolocation.watchPosition((p) => {
    if (finished) return;
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!myMarker) myMarker = dot(me, role === 'seeker' ? '#D4621A' : '#F4AE52'); else myMarker.setLatLng(me);
    if (lastPos) { const d = map.distance(lastPos, me); if (d > 2) dist += d; }
    lastPos = me;
    if (!amTagged() && Date.now() - lastSend > 4000) { // location sharing stops once you are tagged
      lastSend = Date.now(); const row = { game_id: gid, user_id: uid, lat: me.lat, lng: me.lng, updated_at: new Date().toISOString() };
      sb.from('locations').upsert(row).then(() => {});
      if (role === 'seeker') sb.from('live_positions').upsert(row).then(() => {});
    }
  }, () => toast('Location blocked'), { enableHighAccuracy: true });
  loadLive(); loadPings();
  $('tagBtn').style.display = role === 'seeker' ? 'block' : 'none';
  loop = setInterval(tick, 1000); tick();
}
function setBanner(txt, yellow) { const b = $('banner'); b.textContent = txt || ''; b.classList.toggle('on', !!txt); b.classList.toggle('y', !!yellow); }
function tick() {
  const r = rl(), t = elapsed(), hs = r.headMin * 60, end = r.roundMin * 60, role = myRole(), rad = radius();
  zone.setRadius(rad);
  const w = hiders().length && freeHiders().length === 0 ? 'seekers' : t >= end ? 'hiders' : null;
  if (w) { if (game.host === uid && game.status !== 'over') sb.rpc('finish_game', { g: gid, w }).then(() => {}); return finish(w); }
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('tm').textContent = mmss(t); $('kc').textContent = kc; $('ds').textContent = Math.round(dist); $('clock').textContent = mmss(end - t);
  const out = me && map.distance(gc(), me) > rad;
  if (role === 'hider' && !amTagged() && t > hs) { // zone penalty: warn, then count as tagged
    outT = out ? outT + 1 : Math.max(0, outT - 1);
    if (outT >= 120) { sb.rpc('tag_self', { g: gid }).then(() => loadPlayers()); toast('You stayed outside the zone: counted as tagged'); outT = 0; }
  }
  let banner = '';
  if (t < hs) banner = role === 'seeker' ? 'Hold still: hiders are hiding. ' + mmss(hs - t) : 'Head start: go hide! ' + mmss(hs - t);
  else if (amTagged()) banner = 'You are tagged. You can watch the rest of the round.';
  else if (out) banner = role === 'hider' ? 'Outside the zone! Back in ' + Math.max(0, 120 - outT) + ' s or you are tagged' : 'You are outside the zone';
  setBanner(banner, t < hs);
  const free = freeHiders().length, np = game.next_ping_at ? Date.parse(game.next_ping_at) : null, next = np ? Math.max(0, Math.round((np - nowMs()) / 1000)) : 0;
  if (role === 'seeker') $('info').innerHTML = (np ? '<span class="yl">NEXT PING</span> in ' + mmss(Math.max(next, t < hs ? hs - t : 0)) : '<span class="yl">PINGS OFF</span>') + ' · hiders free ' + free;
  else $('info').innerHTML = '<span class="or">SEEKER LIVE</span> on your map · hiders free ' + free;
  $('tagBtn').disabled = t < hs;
  const zp = $('zpill'); // PUBG-style zone timer
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

/* ---------- tagging: seeker claims, hider confirms ---------- */
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

/* ---------- results (saved to the player database) ---------- */
async function finish(winner) {
  if (finished) return; finished = true; clearInterval(loop); loop = null; clearInterval(poll); closeSheet();
  const role = myRole(), won = (winner === 'seekers') === (role === 'seeker');
  const t = Math.min(elapsed(), rl().roundMin * 60);
  $('eTitle').textContent = winner === 'seekers' ? 'Seekers win!' : 'Hiders win!';
  $('eSub').textContent = won ? 'Your side won this round.' : 'Better luck next round.';
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
