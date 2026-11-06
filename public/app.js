import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = (i) => document.getElementById(i);
const MET = { run: 9.8, walk: 3.8, ride: 7.5 };
const DEFAULTS = { roundMin: 45, pingMin: 5, headMin: 3, zoneM: 840, finalM: 200, shrink: true };
let uid, myName = 'Player', gid, game, players = {}, tags = {}, mode = 'run';
let map, zone, me, myMarker, others = [], dist = 0, lastPos, lastSend = 0, loop, finished = false, outT = 0, route = [], routeLine, pendingShown = '';

/* ---------- helpers ---------- */
const toast = (m) => { const e = $('toast'); e.textContent = m; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2600); };
const show = (id) => document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === id));
const pos = () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: true }));
const gref = (...p) => doc(db, 'games', gid, ...p);
const pad = (n) => String(n).padStart(2, '0');
const mmss = (s) => { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }; // textContent only: names are never parsed as HTML
const sheet = (build) => { const s = $('sheetIn'); s.replaceChildren(); build(s); $('sheet').classList.add('on'); };
const closeSheet = () => $('sheet').classList.remove('on');
const hiders = () => Object.entries(players).filter(([, p]) => p.role === 'hider');
const freeHiders = () => hiders().filter(([, p]) => p.status !== 'tagged');

onAuthStateChanged(auth, (u) => {
  const ok = u && (u.emailVerified || u.providerData.some((p) => p.providerId === 'google.com'));
  if (!ok) return location.replace('auth.html');
  uid = u.uid; myName = (u.displayName || 'Player').slice(0, 14);
  $('name').value = myName;
  if (!$('so')) { const b = el('button', 'o', 'Sign out'); b.id = 'so'; b.onclick = () => signOut(auth).then(() => location.replace('auth.html')); $('home').appendChild(b); }
});
const qc = new URLSearchParams(location.search).get('code');
if (qc) { $('code').value = qc.slice(0, 6).toUpperCase(); }
$('sheet').onclick = (e) => { if (e.target === $('sheet') && !$('sheet').dataset.lock) closeSheet(); };
document.querySelectorAll('[data-m]').forEach((c) => (c.onclick = () => { mode = c.dataset.m; document.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('a', x === c)); }));

/* ---------- create / join ---------- */
$('create').onclick = async () => {
  try {
    const p = await pos();
    gid = Math.random().toString(36).slice(2, 10);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await setDoc(gref(), { host: uid, code, status: 'lobby', center: p, rules: DEFAULTS, nextPingAt: 0 });
    await enter();
  } catch (e) { toast('Allow location to create a game'); }
};
$('join').onclick = async () => {
  const q = await getDocs(query(collection(db, 'games'), where('code', '==', $('code').value.trim().toUpperCase())));
  if (q.empty) return toast('No game with that code');
  gid = q.docs[0].id; await enter();
};
async function enter() {
  await setDoc(gref('players', uid), { name: ($('name').value || myName).slice(0, 14), role: 'hider', status: 'free', joinedAt: Date.now() }).catch(() => {});
  show('lobby');
  onSnapshot(gref('players'), (s) => { players = {}; s.forEach((d) => (players[d.id] = d.data())); renderLobby(); });
  onSnapshot(collection(db, 'games', gid, 'tags'), (s) => { tags = {}; s.forEach((d) => (tags[d.id] = d.data())); onTags(); });
  onSnapshot(gref(), (s) => { game = s.data(); renderLobby(); if (game.status === 'live' && !loop && !finished) startGame(); if (game.status === 'over' && loop) finish(game.winner); });
}
$('share').onclick = async () => {
  const url = location.origin + '/play.html?code=' + game.code;
  try { if (navigator.share) await navigator.share({ title: 'Join my Manhunt game', text: 'Code ' + game.code, url }); else { await navigator.clipboard.writeText(url); toast('Invite link copied'); } } catch (e) {}
};

/* ---------- lobby + host rules ---------- */
const R = { round: 'roundMin', ping: 'pingMin', head: 'headMin', zone: 'zoneM', final: 'finalM' };
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
let rt;
['r-round', 'r-ping', 'r-head', 'r-zone', 'r-final', 'r-shrink'].forEach((id) => ($(id).oninput = () => {
  const r = readRules(); paintRules(r);
  clearTimeout(rt); rt = setTimeout(() => { if (game && game.host === uid) updateDoc(gref(), { rules: r }); }, 400);
}));
let rulesInit = false;
function renderLobby() {
  if (!game) return;
  const host = game.host === uid;
  $('lcode').textContent = game.code;
  const list = $('plist'); list.replaceChildren();
  Object.entries(players).forEach(([id, p]) => {
    const row = el('div', 'pl'); row.appendChild(el('span', '', p.name));
    row.appendChild(el('span', p.role === 'seeker' ? 'or' : 'yl', p.role.toUpperCase()));
    if (host && p.role !== 'seeker') { const b = el('button', '', 'Make seeker'); b.onclick = () => updateDoc(gref('players', id), { role: 'seeker' }); row.appendChild(b); }
    list.appendChild(row);
  });
  $('start').style.display = host ? 'block' : 'none'; $('lhint').style.display = host ? 'none' : 'block';
  $('rulesBox').classList.toggle('ro', !host);
  const r = { ...DEFAULTS, ...(game.rules || {}) };
  if (host ? !rulesInit : true) { setInputs(r); rulesInit = true; }
  paintRules(host ? readRules() : r);
}
$('start').onclick = () => {
  if (!Object.values(players).some((p) => p.role === 'seeker')) return toast('Pick a seeker first');
  if (hiders().length < 1) return toast('You need at least one runner');
  const r = readRules(), now = Date.now(), pingSec = r.pingMin * 60;
  updateDoc(gref(), { rules: r, status: 'live', startedAt: now, pingSec, nextPingAt: pingSec ? now + r.headMin * 60000 + pingSec * 1000 : 9e15 });
};

/* ---------- rules maths ---------- */
const rl = () => ({ ...DEFAULTS, ...game.rules });
const elapsed = () => (Date.now() - game.startedAt) / 1000;
function radius() {
  const r = rl(); if (!r.shrink) return r.zoneM;
  const hs = r.headMin * 60, seg = (r.roundMin * 60 - hs) / 4, tt = Math.max(0, elapsed() - hs);
  const rad = [0, 1, 2, 3].map((i) => r.zoneM + (Math.min(r.finalM, r.zoneM) - r.zoneM) * (i / 3));
  const i = Math.min(3, Math.floor(tt / seg)), n = Math.min(3, i + 1), into = tt - i * seg, sh = Math.min(30, seg / 2), st = seg - sh;
  if (into <= st || i === n) return rad[i];
  return rad[i] + (rad[n] - rad[i]) * Math.min(1, (into - st) / sh);
}

/* ---------- map ---------- */
const BASES = {
  Standard: ['https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap &copy; CARTO' }, '#E9E7E1'],
  Dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap &copy; CARTO' }, '#1C1C1E'],
  Satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri' }, '#222'],
};
const dot = (ll, color) => L.marker(ll, { icon: L.divIcon({ className: 'puck', html: '<i style="background:' + color + '"></i>', iconSize: [24, 24] }) }).addTo(map);
const clear = () => { others.forEach((m) => m.remove()); others = []; };
function buildMap() {
  map = L.map('map', { zoomControl: false }).setView([game.center.lat, game.center.lng], 15);
  const names = Object.keys(BASES); let cur = 'Standard', layer;
  try { const sv = localStorage.getItem('mf_map'); if (BASES[sv]) cur = sv; } catch (e) {}
  const setBase = (n) => { cur = n; if (layer) layer.remove(); layer = L.tileLayer(BASES[n][0], BASES[n][1]).addTo(map); layer.bringToBack(); map.getContainer().style.background = BASES[n][2]; try { localStorage.setItem('mf_map', n); } catch (e) {} };
  setBase(cur);
  const ctl = L.control({ position: 'topright' });
  ctl.onAdd = () => { const b = L.DomUtil.create('button', 'mapbtn'); b.type = 'button'; b.setAttribute('aria-label', 'Change map style'); b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>'; L.DomEvent.disableClickPropagation(b); b.onclick = () => { const n = names[(names.indexOf(cur) + 1) % names.length]; setBase(n); toast(n + ' map'); }; return b; };
  ctl.addTo(map);
  const fit = () => map.invalidateSize(); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300)); setTimeout(fit, 200);
  zone = L.circle([game.center.lat, game.center.lng], { radius: radius(), color: '#FF7A00', weight: 4, fillOpacity: 0.04 }).addTo(map);
}

/* ---------- live game ---------- */
const myRole = () => players[uid] && players[uid].role;
const amTagged = () => players[uid] && players[uid].status === 'tagged';
function startGame() {
  show('game'); finished = false;
  const role = myRole();
  $('role').textContent = role.toUpperCase(); $('role').style.background = role === 'seeker' ? 'var(--or)' : 'var(--yl)';
  buildMap();
  navigator.geolocation.watchPosition((p) => {
    if (finished) return;
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!myMarker) myMarker = dot(me, role === 'seeker' ? '#FF7A00' : '#FFE135'); else myMarker.setLatLng(me);
    if (lastPos) { const d = map.distance(lastPos, me); if (d > 2) { dist += d; route.push([me.lat, me.lng]); } } else route.push([me.lat, me.lng]);
    lastPos = me;
    if (!amTagged() && Date.now() - lastSend > 4000) { // location sharing stops once you are tagged
      lastSend = Date.now(); setDoc(gref('loc', uid), { ...me, t: Date.now() });
      if (role === 'seeker') setDoc(gref('live', uid), { ...me, t: Date.now() });
    }
  }, () => toast('Location blocked'), { enableHighAccuracy: true });
  if (role === 'hider') onSnapshot(collection(db, 'games', gid, 'live'), (s) => { clear(); s.forEach((d) => others.push(dot([d.data().lat, d.data().lng], '#FF7A00'))); });
  else onSnapshot(gref('pings', 'latest'), (s) => { if (!s.exists()) return; clear(); s.data().hiders.forEach((h) => others.push(dot([h.lat, h.lng], '#FFE135'))); toast('PING! Runners located'); });
  $('tagBtn').style.display = role === 'seeker' ? 'block' : 'none';
  loop = setInterval(tick, 1000); tick();
}
function setBanner(txt, yellow) { const b = $('banner'); b.textContent = txt || ''; b.classList.toggle('on', !!txt); b.classList.toggle('y', !!yellow); }
function tick() {
  const r = rl(), t = elapsed(), hs = r.headMin * 60, end = r.roundMin * 60, role = myRole(), rad = radius();
  zone.setRadius(rad);
  // winner checks
  const hs0 = hiders();
  const w = hs0.length && freeHiders().length === 0 ? 'seekers' : t >= end ? 'hiders' : null;
  if (w) { if (game.host === uid && game.status !== 'over') updateDoc(gref(), { status: 'over', winner: w }); return finish(w); }
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('tm').textContent = mmss(t); $('kc').textContent = kc; $('ds').textContent = Math.round(dist);
  $('clock').textContent = mmss(end - t);
  // zone penalty for runners: warn, then count as tagged
  const out = me && map.distance([game.center.lat, game.center.lng], me) > rad;
  if (role === 'hider' && !amTagged() && t > hs) {
    outT = out ? outT + 1 : Math.max(0, outT - 1);
    if (outT >= 120) { updateDoc(gref('players', uid), { status: 'tagged' }); toast('You stayed outside the zone: counted as tagged'); outT = 0; }
  }
  let banner = '';
  if (t < hs) banner = role === 'seeker' ? 'Hold still: runners are hiding. ' + mmss(hs - t) : 'Head start: go hide! ' + mmss(hs - t);
  else if (amTagged()) banner = 'You are tagged. You can watch the rest of the round.';
  else if (out) banner = role === 'hider' ? 'Outside the zone! Back in ' + Math.max(0, 120 - outT) + ' s or you are tagged' : 'You are outside the zone';
  setBanner(banner, t < hs);
  const free = freeHiders().length;
  const next = Math.max(0, Math.round((game.nextPingAt - Date.now()) / 1000));
  if (role === 'seeker') $('info').innerHTML = (r.pingMin ? '<span class="yl">NEXT PING</span> in ' + mmss(Math.max(next, t < hs ? hs - t : 0)) : '<span class="yl">PINGS OFF</span>') + ' · runners free ' + free;
  else $('info').innerHTML = '<span class="or">SEEKER LIVE</span> on your map · runners free ' + free;
  $('tagBtn').disabled = t < hs;
}

/* ---------- tagging: seeker claims, runner confirms ---------- */
$('tagBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'Who did you tag?')); s.appendChild(el('p', '', 'The runner has to confirm on their phone.'));
  const f = freeHiders(); if (!f.length) s.appendChild(el('p', '', 'No free runners left.'));
  f.forEach(([id, p]) => { const b = el('button', 'o', p.name); b.style.marginBottom = '8px'; b.onclick = async () => { closeSheet(); await deleteDoc(gref('tags', id)).catch(() => {}); await setDoc(gref('tags', id), { by: uid, byName: myName, t: Date.now(), status: 'pending' }); toast('Waiting for ' + p.name + ' to confirm'); }; s.appendChild(b); });
});
function onTags() {
  const mine = tags[uid];
  if (mine && mine.status === 'pending' && myRole() === 'hider' && !amTagged() && pendingShown !== mine.t) {
    pendingShown = mine.t; $('sheet').dataset.lock = '1';
    sheet((s) => {
      s.appendChild(el('h2', '', 'Were you tagged?')); s.appendChild(el('p', '', mine.byName + ' says they tagged you.'));
      const y = el('button', '', 'Yes, I am tagged'); y.onclick = async () => { delete $('sheet').dataset.lock; closeSheet(); await updateDoc(gref('tags', uid), { status: 'confirmed' }); await updateDoc(gref('players', uid), { status: 'tagged' }); };
      const n = el('button', 'o', 'No, dispute it'); n.style.marginTop = '8px'; n.onclick = async () => { delete $('sheet').dataset.lock; closeSheet(); await updateDoc(gref('tags', uid), { status: 'disputed' }); };
      s.appendChild(y); s.appendChild(n);
    });
  }
  Object.entries(tags).forEach(([id, t]) => {
    if (t.by === uid && !t.seen && (t.status === 'confirmed' || t.status === 'disputed')) { t.seen = 1; toast(t.status === 'confirmed' ? 'Tag confirmed: ' + (players[id] ? players[id].name : 'runner') : 'Tag disputed by ' + (players[id] ? players[id].name : 'runner')); }
  });
}

/* ---------- results ---------- */
function finish(winner) {
  if (finished) return; finished = true; clearInterval(loop); loop = null; closeSheet();
  const role = myRole(), won = (winner === 'seekers') === (role === 'seeker');
  const t = Math.min(elapsed(), rl().roundMin * 60);
  $('eTitle').textContent = winner === 'seekers' ? 'Seekers win!' : 'Runners win!';
  $('eSub').textContent = won ? 'Your side won this round.' : 'Better luck next round.';
  $('eTag').textContent = won ? 'VICTORY' : 'ROUND OVER';
  $('eD').textContent = Math.round(dist); $('eK').textContent = Math.round((MET[mode] * 70 * t) / 3600); $('eT').textContent = Math.round(t / 60);
  $('eP').textContent = dist > 50 ? Math.floor(t / (dist / 1000) / 60) + "'" + pad(Math.floor((t / (dist / 1000)) % 60)) + '"' : '--';
  const tagged = hiders().filter(([, p]) => p.status === 'tagged'); $('eF').textContent = tagged.length;
  const l = $('eList'); l.replaceChildren();
  hiders().forEach(([, p]) => { const r = el('div', 'er'); r.appendChild(el('span', '', p.name)); r.appendChild(el('span', p.status === 'tagged' ? 'or' : 'yl', p.status === 'tagged' ? 'Tagged' : 'Survived')); l.appendChild(r); });
  show('end');
}
$('again').onclick = () => location.replace('play.html');
