import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, getDocs, collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (i) => document.getElementById(i);
const MET = { run: 9.8, walk: 3.8, ride: 7.5 };
let uid, gid, game, players = {}, mode = 'run', map, zone, me, myMarker, others = [], dist = 0, lastPos, lastSend = 0, tick;

const toast = (m) => { const e = $('toast'); e.textContent = m; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2400); };
const show = (id) => document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === id));
const pos = () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: true }));
const gref = (...p) => doc(db, 'games', gid, ...p);

signInAnonymously(getAuth(app)).then((c) => { uid = c.user.uid; }).catch(() => toast('Sign-in failed. Check Firebase setup'));

document.querySelectorAll('[data-m]').forEach((c) => (c.onclick = () => {
  mode = c.dataset.m;
  document.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('a', x === c));
}));

$('create').onclick = async () => {
  try {
    const p = await pos();
    gid = Math.random().toString(36).slice(2, 10);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await setDoc(gref(), { host: uid, code, status: 'lobby', center: p, stages: [900, 600, 350, 150], stageSec: 180, shrinkSec: 30, pingSec: 300, nextPingAt: 0 });
    await enter();
  } catch (e) { toast('Allow location to create a game'); }
};

$('join').onclick = async () => {
  const q = await getDocs(query(collection(db, 'games'), where('code', '==', $('code').value.trim().toUpperCase())));
  if (q.empty) return toast('No game with that code');
  gid = q.docs[0].id;
  await enter();
};

async function enter() {
  await setDoc(gref('players', uid), { name: $('name').value || 'Player', role: 'hider', joinedAt: Date.now() }).catch(() => {});
  show('lobby');
  onSnapshot(gref('players'), (s) => { players = {}; s.forEach((d) => (players[d.id] = d.data())); renderLobby(); });
  onSnapshot(gref(), (s) => { game = s.data(); renderLobby(); if (game.status === 'live' && !tick) startGame(); });
}

function renderLobby() {
  if (!game) return;
  $('lcode').textContent = game.code;
  const host = game.host === uid;
  $('plist').innerHTML = '';
  Object.entries(players).forEach(([id, p]) => {
    const row = document.createElement('div');
    row.className = 'pl';
    row.innerHTML = `<span>${p.name}</span><span class="${p.role === 'seeker' ? 'or' : 'yl'}">${p.role.toUpperCase()}</span>`;
    if (host && p.role !== 'seeker') {
      const b = document.createElement('button');
      b.textContent = 'Make seeker';
      b.onclick = () => updateDoc(gref('players', id), { role: 'seeker' });
      row.appendChild(b);
    }
    $('plist').appendChild(row);
  });
  $('start').style.display = host ? 'block' : 'none';
  $('lhint').style.display = host ? 'none' : 'block';
}

$('start').onclick = () => {
  if (!Object.values(players).some((p) => p.role === 'seeker')) return toast('Pick a seeker first');
  updateDoc(gref(), { status: 'live', startedAt: Date.now(), nextPingAt: Date.now() + game.pingSec * 1000 });
};

// Shrinking circle, computed from the shared start time
function radius() {
  const t = (Date.now() - game.startedAt) / 1000, len = game.stageSec, S = game.stages;
  const i = Math.min(S.length - 1, Math.floor(t / len)), n = Math.min(S.length - 1, i + 1);
  const into = t - i * len, start = len - game.shrinkSec;
  if (into <= start || i === n) return S[i];
  return S[i] + (S[n] - S[i]) * Math.min(1, (into - start) / game.shrinkSec);
}

const dot = (ll, color) => L.circleMarker(ll, { radius: 9, color, fillColor: color, fillOpacity: 1, weight: 2 }).addTo(map);
const clear = () => { others.forEach((m) => m.remove()); others = []; };

function startGame() {
  show('game');
  const role = players[uid].role;
  $('role').textContent = role.toUpperCase();
  $('role').style.background = role === 'seeker' ? 'var(--or)' : 'var(--yl)';
  map = L.map('map', { zoomControl: false }).setView([game.center.lat, game.center.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  zone = L.circle([game.center.lat, game.center.lng], { radius: radius(), color: '#FF7A00', weight: 4, fillOpacity: 0.04 }).addTo(map);
  const fit = () => map.invalidateSize();
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 300));
  setTimeout(fit, 200);

  navigator.geolocation.watchPosition((p) => {
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!myMarker) myMarker = dot(me, role === 'seeker' ? '#FF7A00' : '#FFE135'); else myMarker.setLatLng(me);
    if (lastPos) dist += map.distance(lastPos, me);
    lastPos = me;
    if (Date.now() - lastSend > 4000) {
      lastSend = Date.now();
      setDoc(gref('loc', uid), { ...me, t: Date.now() });
      if (role === 'seeker') setDoc(gref('live', uid), { ...me, t: Date.now() });
    }
  }, () => toast('Location blocked'), { enableHighAccuracy: true });

  if (role === 'hider') {
    // hider sees the seeker live
    onSnapshot(collection(db, 'games', gid, 'live'), (s) => { clear(); s.forEach((d) => others.push(dot([d.data().lat, d.data().lng], '#FF7A00'))); });
  } else {
    // seeker sees hiders only when the server releases a ping
    onSnapshot(gref('pings', 'latest'), (s) => {
      if (!s.exists()) return;
      clear();
      s.data().hiders.forEach((h) => others.push(dot([h.lat, h.lng], '#FFE135')));
      toast('PING! Hiders located');
    });
  }

  tick = setInterval(() => {
    const r = radius(), t = Math.floor((Date.now() - game.startedAt) / 1000);
    zone.setRadius(r);
    const pad = (n) => String(n).padStart(2, '0');
    $('tm').textContent = pad(Math.floor(t / 60)) + ':' + pad(t % 60);
    $('kc').textContent = Math.round((MET[mode] * 70 * t) / 3600);
    $('ds').textContent = Math.round(dist);
    const out = me && map.distance([game.center.lat, game.center.lng], me) > r;
    const next = Math.max(0, Math.round((game.nextPingAt - Date.now()) / 1000));
    $('clock').textContent = Math.round(r) + ' m';
    $('info').innerHTML = (out ? '<span class="or">OUTSIDE THE CIRCLE! Get back in</span>' : role === 'seeker' ? `<span class="yl">NEXT PING</span> in ~${Math.floor(next / 60)}:${pad(next % 60)}` : '<span class="or">SEEKER LIVE</span> on your map');
  }, 1000);
}
