import { sb, confirmed } from './supa.js';
import { createPoints } from './markers.js';
import { rulesForm, normalize, DEFAULTS } from './rules.js';
import { getPts, toLL, pip, offsetOf, randomArea, areaLabel, previewSvg, openAreaEditor, openShapeModal, createRedZones } from './area.js';

const $ = (i) => document.getElementById(i);
const MET = { run: 9.8, walk: 3.8, ride: 7.5 };

// Official 48 Blackout High-Fidelity Avatars (24 Standard Unlocked + 24 Exclusive Locked)
export const AVATARS = [
  { id: 'avatars/avatar_01.png', name: 'Blitz', locked: false },
  { id: 'avatars/avatar_02.png', name: 'Kicks', locked: false },
  { id: 'avatars/avatar_03.png', name: 'Brawler', locked: false },
  { id: 'avatars/avatar_04.png', name: 'Cruiser', locked: false },
  { id: 'avatars/avatar_05.png', name: 'Aero', locked: false },
  { id: 'avatars/avatar_06.png', name: 'Chrono', locked: false },
  { id: 'avatars/avatar_07.png', name: 'Iron', locked: false },
  { id: 'avatars/avatar_08.png', name: 'Shark', locked: false },
  { id: 'avatars/avatar_09.png', name: 'Gator', locked: false },
  { id: 'avatars/avatar_10.png', name: 'Ape', locked: false },
  { id: 'avatars/avatar_11.png', name: 'Stag', locked: false },
  { id: 'avatars/avatar_12.png', name: 'Ram', locked: false },
  { id: 'avatars/avatar_13.png', name: 'Fox', locked: false },
  { id: 'avatars/avatar_14.png', name: 'Hare', locked: false },
  { id: 'avatars/avatar_15.png', name: 'Bear', locked: false },
  { id: 'avatars/avatar_16.png', name: 'Tigris', locked: false },
  { id: 'avatars/avatar_17.png', name: 'Falcon', locked: false },
  { id: 'avatars/avatar_18.png', name: 'Panther', locked: false },
  { id: 'avatars/avatar_19.png', name: 'Bandit', locked: false },
  { id: 'avatars/avatar_20.png', name: 'Taurus', locked: false },
  { id: 'avatars/avatar_21.png', name: 'Nocturne', locked: false },
  { id: 'avatars/avatar_22.png', name: 'Hooper', locked: false },
  { id: 'avatars/avatar_23.png', name: 'Striker', locked: false },
  { id: 'avatars/avatar_24.png', name: 'Ace', locked: false },
  // 24 Exclusive Locked Avatars (inaccessible to common users)
  { id: 'avatars/avatar_25.png', name: 'Solaris', locked: true },
  { id: 'avatars/avatar_26.png', name: 'Saber', locked: true },
  { id: 'avatars/avatar_27.png', name: 'Drakon', locked: true },
  { id: 'avatars/avatar_28.png', name: 'Monarch', locked: true },
  { id: 'avatars/avatar_29.png', name: 'Kraken', locked: true },
  { id: 'avatars/avatar_30.png', name: 'Shogun', locked: true },
  { id: 'avatars/avatar_31.png', name: 'Viper', locked: true },
  { id: 'avatars/avatar_32.png', name: 'Vanguard', locked: true },
  { id: 'avatars/avatar_33.png', name: 'Valkyrie', locked: true },
  { id: 'avatars/avatar_34.png', name: 'Imperium', locked: true },
  { id: 'avatars/avatar_35.png', name: 'Supernova', locked: true },
  { id: 'avatars/avatar_36.png', name: 'Ronin', locked: true },
  { id: 'avatars/avatar_37.png', name: 'Wingfoot', locked: true },
  { id: 'avatars/avatar_38.png', name: 'Titan', locked: true },
  { id: 'avatars/avatar_39.png', name: 'Thruster', locked: true },
  { id: 'avatars/avatar_40.png', name: 'Forge', locked: true },
  { id: 'avatars/avatar_41.png', name: 'Overclock', locked: true },
  { id: 'avatars/avatar_42.png', name: 'Golem', locked: true },
  { id: 'avatars/avatar_43.png', name: 'Champion', locked: true },
  { id: 'avatars/avatar_44.png', name: 'Eclipse', locked: true },
  { id: 'avatars/avatar_45.png', name: 'Bighorn', locked: true },
  { id: 'avatars/avatar_46.png', name: 'Buzzer', locked: true },
  { id: 'avatars/avatar_47.png', name: 'Zephyr', locked: true },
  { id: 'avatars/avatar_48.png', name: 'Wyvern', locked: true }
];

// Custom Vector Lock Emblem drawn in the exact same illustration style (#2A1A0E, #D4621A, #F4AE52, #FEF3E2)
const LOCK_BADGE_SVG = `<svg viewBox="0 0 36 36" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="18" cy="18" r="16.5" fill="#2A1A0E" stroke="#F4AE52" stroke-width="2.2"/><circle cx="18" cy="18" r="13.5" fill="#D4621A" stroke="#2A1A0E" stroke-width="1.8"/><path d="M12.5 16.2V12C12.5 8.8 14.9 6.5 18 6.5C21.1 6.5 23.5 8.8 23.5 12V16.2" fill="none" stroke="#2A1A0E" stroke-width="5.2" stroke-linecap="round"/><path d="M12.5 16.2V12C12.5 8.8 14.9 6.5 18 6.5C21.1 6.5 23.5 8.8 23.5 12V16.2" fill="none" stroke="#FEF3E2" stroke-width="2.4" stroke-linecap="round"/><polygon points="9.5,15.5 26.5,15.5 28,26.5 18,29.8 8,26.5" fill="#F4AE52" stroke="#2A1A0E" stroke-width="2.3" stroke-linejoin="round"/><polygon points="18,15.5 26.5,15.5 28,26.5 18,29.8" fill="#D4621A" opacity="0.55"/><polygon points="9.5,15.5 26.5,15.5 28,26.5 18,29.8 8,26.5" fill="none" stroke="#2A1A0E" stroke-width="2.3" stroke-linejoin="round"/><circle cx="18" cy="20.6" r="2.2" fill="#2A1A0E"/><polygon points="16.7,21.2 19.3,21.2 19.9,25.8 16.1,25.8" fill="#2A1A0E"/></svg>`;

// Dedicated Dev & Admin Separate Access IDs (Zero-PII Architecture)
export const DEV_IDENTITIES = {
  'BLK-DEV-01': {
    code: 'BLK-DEV-01',
    role: 'DEV',
    title: 'DEVELOPER CLEARANCE',
    uid: '00000000-0000-4000-d000-000000000001',
    defaultName: 'Dev_Lead',
    defaultAvatar: 'avatars/avatar_36.png',
    keys: ['BLACKOUT-2026', 'BLK-DEV-2026', 'DEV-2026', 'BLACKOUT']
  },
  'BLK-ADMIN-01': {
    code: 'BLK-ADMIN-01',
    role: 'ADMIN',
    title: 'ADMIN CLEARANCE',
    uid: '00000000-0000-4000-a000-000000000001',
    defaultName: 'Admin_HQ',
    defaultAvatar: 'avatars/avatar_48.png',
    keys: ['BLACKOUT-2026', 'BLK-ADMIN-2026', 'ADMIN-2026', 'BLACKOUT']
  }
};

let activeDevSession = null;
try {
  const savedDev = JSON.parse(localStorage.getItem('mf_dev_session') || 'null');
  if (savedDev && DEV_IDENTITIES[savedDev.code]) activeDevSession = DEV_IDENTITIES[savedDev.code];
} catch (e) {}

export const isDevOrAdmin = () => !!activeDevSession;
export const isLockedAvatar = (id) => !isDevOrAdmin() && AVATARS.some((a) => a.id === id && a.locked);

export function getAvatarFallback(name = 'Player') {
  const initial = ((name || 'P').trim()[0] || 'P').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4621A"/><stop offset="100%" stop-color="#F4AE52"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#1A110B" stroke="#D4621A" stroke-width="3"/><circle cx="50" cy="50" r="38" fill="url(#bg)" opacity="0.2"/><polygon points="50,16 78,28 78,54 50,82 22,54 22,28" fill="none" stroke="#F4AE52" stroke-width="2.5" stroke-linejoin="round"/><text x="50" y="58" text-anchor="middle" font-family="'Anton',Impact,sans-serif" font-weight="900" font-size="32" fill="#FEF3E2" letter-spacing="1">${initial}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function bindAvatarImg(imgEl, avatarId, fallbackName = 'Player') {
  if (!imgEl) return;
  const id = (avatarId && avatarId.startsWith('avatars/')) ? avatarId : 'avatars/avatar_01.png';
  if (typeof window !== 'undefined' && window.BLACKOUT_AVATAR_DATA && window.BLACKOUT_AVATAR_DATA[id]) {
    imgEl.src = window.BLACKOUT_AVATAR_DATA[id];
  } else {
    imgEl.src = id;
  }
  imgEl.onerror = () => {
    imgEl.onerror = null;
    if (typeof window !== 'undefined' && window.BLACKOUT_AVATAR_DATA && window.BLACKOUT_AVATAR_DATA[id]) {
      imgEl.src = window.BLACKOUT_AVATAR_DATA[id];
    } else {
      imgEl.src = getAvatarFallback(fallbackName);
    }
  };
}

let uid, myName = 'Player', myAvatar = 'avatars/avatar_01.png', gid, game, players = {}, tags = {}, mode = 'run', skew = 0, poll, chan;
let started = false;
let map, zone, redLayers = [], me, pts, watchId = null, follow = true, firstFix = true, lastGpsErr = 0, dist = 0, lastPos, lastSend = 0, loop, finished = false, outT = 0, pendingShown = '', lastPing = '', startedMap = false;
let releasingPing = false, lastPingFetch = 0;

/* ---------- 1. Friends & UID Live Search Engine ---------- */
let myFriends = [], pendingRequests = [], activeInvite = null, searchTimer = null;

async function loadFriends() {
  try {
    const { data: sent } = await sb.from('friendships').select('*').eq('user_id', uid);
    const { data: rcv } = await sb.from('friendships').select('*').eq('friend_id', uid);
    const friends = [], requests = [];
    (sent || []).forEach((f) => { if (f.status === 'accepted') friends.push({ id: f.friend_id, name: f.friend_name || 'Player', avatar: f.friend_avatar || 'avatars/avatar_01.png' }); });
    (rcv || []).forEach((f) => {
      if (f.status === 'accepted') friends.push({ id: f.user_id, name: f.user_name || 'Player', avatar: f.user_avatar || 'avatars/avatar_01.png' });
      else if (f.status === 'pending') requests.push({ id: f.id, from_id: f.user_id, name: f.user_name || 'Player', avatar: f.user_avatar || 'avatars/avatar_01.png' });
    });
    myFriends = friends; pendingRequests = requests;
  } catch (e) {
    myFriends = JSON.parse(localStorage.getItem('mf_friends_' + uid) || '[]');
    pendingRequests = JSON.parse(localStorage.getItem('mf_reqs_' + uid) || '[]');
  }
  renderFriendsUI();
}

function renderFriendsUI() {
  const badge = $('friendBadge'), hBadge = $('hdrBadge');
  const count = pendingRequests.length;
  badge.textContent = count; badge.hidden = count === 0;
  hBadge.textContent = count; hBadge.hidden = count === 0;
  $('frReqCount').textContent = count;
  $('frCount').textContent = myFriends.length;

  const reqList = $('frReqList'); reqList.replaceChildren();
  if (!pendingRequests.length) reqList.appendChild(el('p', 'mu', 'No pending requests'));
  pendingRequests.forEach((r) => {
    const it = el('div', 'fr-item');
    const info = el('div', 'fr-info');
    const av = el('img', 'av-mini'); bindAvatarImg(av, r.avatar, r.name);
    info.append(av, el('span', 'fr-name', r.name));
    const btns = el('div', 'row');
    const acc = el('button', 'btn-sm', 'Accept'); acc.onclick = () => answerFriend(r, true);
    const dec = el('button', 'btn-sm o', '✕'); dec.onclick = () => answerFriend(r, false);
    btns.append(acc, dec);
    it.append(info, btns);
    reqList.appendChild(it);
  });

  const fList = $('frList'); fList.replaceChildren();
  if (!myFriends.length) fList.appendChild(el('p', 'mu', 'No friends added yet'));
  myFriends.forEach((f) => {
    const it = el('div', 'fr-item');
    const info = el('div', 'fr-info');
    const av = el('img', 'av-mini'); bindAvatarImg(av, f.avatar, f.name);
    info.append(av, el('span', 'fr-name', f.name));
    it.appendChild(info);
    if (gid && game && game.status === 'lobby' && (game.host === uid || isDevOrAdmin())) {
      const inv = el('button', 'fr-btn', 'Invite to game');
      inv.onclick = () => sendGameInvite(f);
      it.appendChild(inv);
    }
    fList.appendChild(it);
  });
}

// Live Autocomplete dropdown search by Name or UID
$('frInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = $('frInput').value.trim();
  if (q.length < 2) { $('frDropdown').hidden = true; return; }
  searchTimer = setTimeout(() => searchPlayersDropdown(q), 250);
});

async function searchPlayersDropdown(query) {
  const dd = $('frDropdown'); dd.replaceChildren();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(query);

  try {
    let playersFound = [];
    if (isUuid) {
      const { data } = await sb.from('profiles').select('id,display_name,avatar').eq('id', query).limit(5);
      playersFound = data || [];
    } else {
      const { data } = await sb.from('profiles').select('id,display_name,avatar').ilike('display_name', `%${query}%`).neq('id', uid).limit(6);
      playersFound = data || [];
    }

    if (!playersFound.length) {
      dd.appendChild(el('div', 'fr-drop-item', 'No players found matching "' + query + '"'));
      dd.hidden = false;
      return;
    }

    playersFound.forEach((p) => {
      const it = el('div', 'fr-drop-item');
      const info = el('div', 'fr-drop-info');
      const av = el('img', 'av-mini'); bindAvatarImg(av, p.avatar, p.display_name || 'Player');
      info.appendChild(av);
      const textWrap = el('div');
      textWrap.appendChild(el('span', 'fr-drop-name', p.display_name || 'Player'));
      textWrap.appendChild(el('small', 'fr-drop-uid', 'UID: ' + p.id.slice(0, 8) + '...'));
      info.appendChild(textWrap);

      const addBtn = el('button', 'btn-sm', '+ Add');
      addBtn.onclick = (e) => {
        e.stopPropagation();
        addFriend(p.id, p.display_name, p.avatar);
        $('frInput').value = '';
        dd.hidden = true;
      };

      it.append(info, addBtn);
      it.onclick = () => { $('frInput').value = p.display_name; dd.hidden = true; };
      dd.appendChild(it);
    });
    dd.hidden = false;
  } catch (e) {
    dd.hidden = true;
  }
}

async function addFriend(targetIdOrName, directName = null, directAvatar = null) {
  const input = targetIdOrName.trim();
  if (!input || input === uid || input === myName) return toast('Type a valid player name or UID');

  try {
    let friendId = directName ? targetIdOrName : null;
    let friendName = directName;
    let friendAvatar = directAvatar || 'avatars/avatar_01.png';

    if (!friendId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(input);
      const query = isUuid ? sb.from('profiles').select('id,display_name,avatar').eq('id', input) : sb.from('profiles').select('id,display_name,avatar').ilike('display_name', input);
      const { data } = await query.maybeSingle();
      if (data) { friendId = data.id; friendName = data.display_name; friendAvatar = data.avatar || 'avatars/avatar_01.png'; }
      else { friendId = 'f_' + Math.random().toString(36).slice(2, 8); friendName = input; }
    }

    await sb.from('friendships').upsert({ user_id: uid, friend_id: friendId, user_name: myName, friend_name: friendName, user_avatar: myAvatar, friend_avatar: friendAvatar, status: 'pending' });
    toast('Friend request sent to ' + friendName);
  } catch (e) {
    myFriends.push({ id: 'f_' + Date.now(), name: directName || input, avatar: directAvatar || 'avatars/avatar_01.png' });
    localStorage.setItem('mf_friends_' + uid, JSON.stringify(myFriends));
    toast('Added to friends');
  }
  loadFriends();
}

async function answerFriend(r, accept) {
  try {
    if (accept) await sb.from('friendships').update({ status: 'accepted' }).eq('id', r.id);
    else await sb.from('friendships').delete().eq('id', r.id);
  } catch (e) {
    pendingRequests = pendingRequests.filter((x) => x.id !== r.id);
    if (accept) myFriends.push({ id: r.from_id, name: r.name, avatar: r.avatar || 'avatars/avatar_01.png' });
    localStorage.setItem('mf_reqs_' + uid, JSON.stringify(pendingRequests));
    localStorage.setItem('mf_friends_' + uid, JSON.stringify(myFriends));
  }
  loadFriends();
}

async function sendGameInvite(friend) {
  try {
    await sb.from('game_invites').insert({ game_id: gid, code: game.code, from_user: uid, from_name: myName, to_user: friend.id, status: 'pending' });
    toast('Game invite sent to ' + friend.name);
  } catch (e) {
    toast('Invite link copied for ' + friend.name);
    navigator.clipboard.writeText(location.origin + '/play.html?code=' + game.code);
  }
}

function listenInvites() {
  sb.channel('invites_' + uid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_invites', filter: 'to_user=eq.' + uid }, (p) => showInvite(p.new))
    .subscribe();
}

function showInvite(inv) {
  activeInvite = inv;
  $('invFrom').textContent = inv.from_name || 'A player';
  $('inviteBanner').hidden = false;
}
$('invAccept').onclick = () => { if (activeInvite) { $('code').value = activeInvite.code; $('inviteBanner').hidden = true; $('join').click(); } };
$('invDecline').onclick = () => { $('inviteBanner').hidden = true; activeInvite = null; };

$('copyUidBtn').onclick = () => {
  navigator.clipboard.writeText(uid);
  toast('Player UID copied to clipboard!');
};

/* ---------- 2. Mobile Game Inspired Settings & 48 HD Avatars ---------- */
function initAvatarGrid() {
  const grid = $('avatarGrid'); grid.replaceChildren();
  const devMode = isDevOrAdmin();
  const lbl = $('avGridLabel');
  if (lbl) lbl.textContent = devMode ? 'Select Agent Avatar (All 48 Crests Unlocked via Dev/Admin ID)' : 'Select Agent Avatar (24 Unlocked · 24 Exclusive Locked)';

  AVATARS.forEach((av) => {
    const isLocked = !!av.locked && !devMode;
    const isDevUnlocked = !!av.locked && devMode;
    const btn = el('button', 'avatar-opt' + (isLocked ? ' locked' : (isDevUnlocked ? ' dev-unlocked' : '')) + (myAvatar === av.id ? ' on' : ''));
    btn.type = 'button';
    btn.dataset.av = av.id;
    if (isLocked) btn.title = av.name + ' (Exclusive Locked Avatar)';
    else if (isDevUnlocked) btn.title = av.name + ' (Unlocked via Dev/Admin Clearance)';

    const holder = el('div', 'av-holder');
    const wrap = el('div', 'av-wrap');
    const img = el('img', 'av-img');
    img.alt = av.name;
    bindAvatarImg(img, av.id, av.name);
    wrap.appendChild(img);
    holder.appendChild(wrap);

    if (isLocked) {
      const lockBadge = el('span', 'av-lock-badge');
      lockBadge.innerHTML = LOCK_BADGE_SVG;
      holder.appendChild(lockBadge);
    } else if (isDevUnlocked) {
      const devBadge = el('span', 'av-dev-badge', activeDevSession ? activeDevSession.role : 'DEV');
      holder.appendChild(devBadge);
    }

    const name = el('small', '', av.name);
    btn.append(holder, name);

    btn.onclick = () => {
      if (isLocked) {
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        toast('Exclusive Crest — Locked for common users');
        return;
      }
      document.querySelectorAll('.avatar-opt').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      myAvatar = av.id;
    };
    grid.appendChild(btn);
  });
}

const openSettingsModal = () => {
  toggleSidebar(false);
  $('settingsModal').hidden = false;
  $('stNameInput').value = myName;
  initAvatarGrid();
  if (isDevOrAdmin()) {
    $('stEmail').textContent = activeDevSession.code + ' (Dedicated Clearance ID)';
    $('stProvider').textContent = 'Zero-PII Dev/Admin Gateway · User Private Data Redacted';
    $('stBadge').textContent = activeDevSession.role;
  } else if (session && session.user) {
    $('stEmail').textContent = session.user.email || 'Anonymous';
    $('stProvider').textContent = session.user.app_metadata.provider ? 'Signed in via ' + session.user.app_metadata.provider.toUpperCase() : 'Email Password';
    $('stBadge').textContent = 'LINKED';
  }
};

$('hdrSettings').onclick = openSettingsModal;
$('quickSettings').onclick = openSettingsModal;
$('sbSettingsBtn').onclick = openSettingsModal;
$('sbProfClick').onclick = openSettingsModal;
$('stClose').onclick = () => { $('settingsModal').hidden = true; };

document.querySelectorAll('#settingsModal .st-tab-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#settingsModal .st-tab-btn').forEach((b) => b.classList.remove('on'));
    document.querySelectorAll('#settingsModal .st-panel').forEach((p) => p.classList.remove('on'));
    btn.classList.add('on');
    const target = $('stab-' + btn.dataset.stab);
    if (target) target.classList.add('on');
  };
});

/* ---------- 2B. Dedicated Dev & Admin Separate ID Gateway & Console ---------- */
let devInfiniteAbilities = false, devTeleportMode = false;

function syncDevBadgesUI() {
  const dev = isDevOrAdmin();
  if ($('sbDevBadge')) {
    $('sbDevBadge').hidden = !dev;
    if (dev) $('sbDevBadge').textContent = activeDevSession.role;
  }
  if ($('hdrDevDot')) $('hdrDevDot').hidden = !dev;
  if ($('sbRole')) {
    $('sbRole').textContent = dev ? `${activeDevSession.title} (${activeDevSession.code})` : 'Agent Identity';
  }
}

function openDevModal() {
  toggleSidebar(false);
  $('settingsModal').hidden = true;
  $('devModal').hidden = false;
  renderDevModalState();
}

function renderDevModalState() {
  const dev = isDevOrAdmin();
  $('devGateView').hidden = dev;
  $('devConsoleView').hidden = !dev;
  $('devSubTitle').textContent = dev ? `${activeDevSession.title} · Zero-PII Mode` : 'Dedicated clearance ID gateway';
  if (dev) {
    $('devRoleLabel').textContent = `${activeDevSession.title} ACTIVE`;
    $('devActiveIdText').textContent = `${activeDevSession.code} · UID: ${uid}`;
    loadDevRooms();
    loadDevPlayers();
  }
}

if ($('hdrDev')) $('hdrDev').onclick = openDevModal;
if ($('sbDevBtn')) $('sbDevBtn').onclick = openDevModal;
if ($('quickDev')) $('quickDev').onclick = openDevModal;
if ($('stOpenDevBtn')) $('stOpenDevBtn').onclick = openDevModal;
if ($('devClose')) $('devClose').onclick = () => { $('devModal').hidden = true; };

if ($('fillDevIdBtn')) {
  $('fillDevIdBtn').onclick = () => {
    $('devIdInput').value = 'BLK-DEV-01';
    $('devKeyInput').value = 'BLACKOUT-2026';
  };
}
if ($('fillAdminIdBtn')) {
  $('fillAdminIdBtn').onclick = () => {
    $('devIdInput').value = 'BLK-ADMIN-01';
    $('devKeyInput').value = 'BLACKOUT-2026';
  };
}

document.querySelectorAll('#devModal [data-dtab]').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#devModal [data-dtab]').forEach((b) => b.classList.remove('on'));
    document.querySelectorAll('#devConsoleView .st-panel').forEach((p) => p.classList.remove('on'));
    btn.classList.add('on');
    const target = $('dtab-' + btn.dataset.dtab);
    if (target) target.classList.add('on');
    if (btn.dataset.dtab === 'rooms') loadDevRooms();
    if (btn.dataset.dtab === 'players') loadDevPlayers();
  };
});

if ($('devLoginBtn')) {
  $('devLoginBtn').onclick = async () => {
    const rawId = ($('devIdInput').value || '').trim().toUpperCase();
    const rawKey = ($('devKeyInput').value || '').trim().toUpperCase();
    const idAlias = (rawId === 'DEV' || rawId === 'DEV-01' || rawId === 'BLACKOUT-DEV') ? 'BLK-DEV-01'
      : (rawId === 'ADMIN' || rawId === 'ADMIN-01' || rawId === 'BLACKOUT-ADMIN') ? 'BLK-ADMIN-01' : rawId;
    const identity = DEV_IDENTITIES[idAlias];
    if (!identity) return toast('Invalid Dev / Admin ID (Use BLK-DEV-01 or BLK-ADMIN-01)');
    if (!identity.keys.includes(rawKey)) return toast('Invalid Clearance Passkey (Use BLACKOUT-2026)');

    activeDevSession = identity;
    localStorage.setItem('mf_dev_session', JSON.stringify({ code: identity.code, ts: Date.now() }));

    if (!session || !session.user) {
      uid = identity.uid;
    }
    if (!myName || myName === 'Player') myName = identity.defaultName;
    myAvatar = localStorage.getItem('mf_avatar_' + uid) || identity.defaultAvatar;
    $('name').value = myName;
    $('sbName').textContent = myName;
    bindAvatarImg($('sbAvatarImg'), myAvatar, myName);
    $('myUidText').textContent = uid;

    try {
      await sb.from('profiles').upsert({ id: uid, display_name: myName, avatar: myAvatar });
    } catch (e) {}

    syncDevBadgesUI();
    initAvatarGrid();
    renderLobby();
    if (started && $('hostBar')) $('hostBar').hidden = false;
    renderDevModalState();
    toast(`${identity.title} ACTIVATED! All game features & 48 avatars unlocked.`);
  };
}

if ($('devLogoutBtn')) {
  $('devLogoutBtn').onclick = () => {
    activeDevSession = null;
    devInfiniteAbilities = false;
    devTeleportMode = false;
    if ($('devInfAbChk')) $('devInfAbChk').checked = false;
    if ($('devTeleportChk')) $('devTeleportChk').checked = false;
    localStorage.removeItem('mf_dev_session');
    if (isLockedAvatar(myAvatar)) {
      myAvatar = 'avatars/avatar_01.png';
      bindAvatarImg($('sbAvatarImg'), myAvatar, myName);
    }
    syncDevBadgesUI();
    initAvatarGrid();
    renderLobby();
    if (started && $('hostBar')) $('hostBar').hidden = !(game && game.host === uid);
    renderDevModalState();
    toast('Exited Dev / Admin ID clearance');
    if (!session || !session.user) location.replace('auth.html');
  };
}

// Dev Console Live Overrides
if ($('devForcePingBtn')) {
  $('devForcePingBtn').onclick = async () => {
    if (!gid || !game) return toast('Join or create a game first');
    await releasePing();
    await loadPings();
    toast('📡 DEV OVERRIDE: Global radar ping broadcasted!');
  };
}

if ($('devSwitchRoleBtn')) {
  $('devSwitchRoleBtn').onclick = async () => {
    if (!gid || !game) return toast('Join or create a game first');
    const cur = myRole() || 'hider';
    const nextRole = cur === 'seeker' ? 'hider' : 'seeker';
    if (players[uid]) players[uid].role = nextRole;
    try {
      await sb.from('game_players').update({ role: nextRole }).eq('game_id', gid).eq('user_id', uid);
      await sb.rpc('set_role', { g: gid, u: uid, r: nextRole });
    } catch (e) {}
    if (started) {
      $('role').textContent = nextRole.toUpperCase();
      $('role').style.background = nextRole === 'seeker' ? 'var(--or)' : 'var(--yl)';
      $('tagBtn').style.display = nextRole === 'seeker' ? 'block' : 'none';
      initAbilitiesHUD();
    }
    await loadPlayers();
    toast('🔄 DEV OVERRIDE: Role switched to ' + nextRole.toUpperCase());
  };
}

if ($('devUntagSelfBtn')) {
  $('devUntagSelfBtn').onclick = async () => {
    if (!gid || !game) return toast('Join or create a game first');
    if (players[uid]) players[uid].status = 'alive';
    try {
      await sb.from('game_players').update({ status: null }).eq('game_id', gid).eq('user_id', uid);
      await sb.from('tags').delete().eq('game_id', gid).eq('target', uid);
    } catch (e) {}
    await loadPlayers();
    await loadTags();
    toast('🛡️ DEV OVERRIDE: Player revived & untagged!');
  };
}

if ($('devResetCdBtn')) {
  $('devResetCdBtn').onclick = () => {
    Object.values(abilities).forEach((a) => { a.cd = 0; });
    updateAbilitiesUI();
    toast('⚡ DEV OVERRIDE: All 4 ability cooldowns reset to 0s!');
  };
}

if ($('devSpawnRedBtn')) {
  $('devSpawnRedBtn').onclick = () => {
    if (!map || !game) return toast('Start a live match map first');
    redLayers.forEach((l) => l.remove()); redLayers = [];
    currentRedZones = createRedZones(gc(), radius(), 3);
    currentRedZones.forEach((rz) => {
      const redCirc = L.circle([rz.lat, rz.lng], { radius: rz.radius, color: '#B3261E', weight: 3, fillColor: '#B3261E', fillOpacity: 0.24, interactive: false }).addTo(map);
      redLayers.push(redCirc);
    });
    toast('☣️ DEV OVERRIDE: 3 Dynamic Red Hazard Zones spawned!');
  };
}

if ($('devClearRedBtn')) {
  $('devClearRedBtn').onclick = () => {
    redLayers.forEach((l) => l.remove()); redLayers = []; currentRedZones = [];
    toast('🧹 DEV OVERRIDE: All Red Hazard Zones cleared!');
  };
}

if ($('devInfAbChk')) {
  $('devInfAbChk').onchange = () => {
    devInfiniteAbilities = $('devInfAbChk').checked;
    if (devInfiniteAbilities) {
      Object.values(abilities).forEach((a) => { a.cd = 0; });
      updateAbilitiesUI();
    }
    toast(devInfiniteAbilities ? 'Infinite Abilities ON (0s Cooldown)' : 'Standard Ability Cooldowns restored');
  };
}

if ($('devTeleportChk')) {
  $('devTeleportChk').onchange = () => {
    devTeleportMode = $('devTeleportChk').checked;
    toast(devTeleportMode ? 'Map-Click Teleport ON: Click anywhere on map to move' : 'Map-Click Teleport OFF');
  };
}

async function loadDevRooms() {
  const box = $('devRoomsList');
  if (!box) return;
  box.replaceChildren(el('p', 'mu', 'Scanning active games...'));
  try {
    const { data } = await sb.from('games').select('id,code,status,round,created_at').order('created_at', { ascending: false }).limit(12);
    box.replaceChildren();
    if (!data || !data.length) {
      box.appendChild(el('p', 'mu', 'No active rooms found on server'));
      return;
    }
    data.forEach((g) => {
      const it = el('div', 'fr-item');
      const info = el('div', 'fr-info');
      const meta = el('div');
      meta.appendChild(el('b', 'fr-name', `Room ${g.code} · ${(g.status || 'lobby').toUpperCase()}`));
      meta.appendChild(el('div', 'mu', `Round ${g.round || 1} · ID: ${String(g.id).slice(0, 8)}...`));
      meta.lastChild.style.fontSize = '11px';
      info.appendChild(meta);
      const joinBtn = el('button', 'btn-sm', gid === g.id ? 'Current' : 'Join / Control');
      joinBtn.disabled = gid === g.id;
      joinBtn.onclick = async () => {
        $('devModal').hidden = true;
        $('code').value = g.code;
        gid = g.id;
        await enter();
        toast('Joined Room ' + g.code + ' with Dev/Admin Host Authority');
      };
      it.append(info, joinBtn);
      box.appendChild(it);
    });
  } catch (e) {
    box.replaceChildren(el('p', 'mu', 'Could not fetch rooms list'));
  }
}
if ($('devRefreshRoomsBtn')) $('devRefreshRoomsBtn').onclick = loadDevRooms;

// Privacy-Shielded Player Directory (Strictly excludes email, password, auth tokens, phone, IP)
async function loadDevPlayers() {
  const box = $('devPlayersList');
  if (!box) return;
  box.replaceChildren();

  const renderPlayerCard = (pObj, inCurrentMatch) => {
    const it = el('div', 'fr-item');
    it.style.flexDirection = 'column';
    it.style.alignItems = 'stretch';
    it.style.gap = '8px';

    const top = el('div', 'row');
    top.style.justifyContent = 'space-between';
    top.style.alignItems = 'center';

    const info = el('div', 'fr-info');
    const av = el('img', 'av-mini');
    bindAvatarImg(av, pObj.avatar || 'avatars/avatar_01.png', pObj.name);
    const txt = el('div');
    txt.appendChild(el('b', 'fr-name', pObj.name || 'Player'));
    const sub = el('div', 'mu', `Public UID: ${String(pObj.id).slice(0, 12)}...`);
    sub.style.fontSize = '11px';
    txt.appendChild(sub);
    info.append(av, txt);
    top.appendChild(info);

    if (inCurrentMatch) {
      const roleSpan = el('span', pObj.role === 'seeker' ? 'or' : 'yl', (pObj.role || 'hider').toUpperCase());
      roleSpan.style.fontWeight = '700';
      roleSpan.style.fontSize = '11px';
      top.appendChild(roleSpan);
    }
    it.appendChild(top);

    const privRow = el('div', 'row');
    privRow.style.justifyContent = 'space-between';
    privRow.style.alignItems = 'center';
    privRow.style.flexWrap = 'wrap';
    privRow.style.gap = '6px';
    const redact = el('span', 'redacted-tag', '🔒 Email / Password / Auth / IP: [REDACTED · PRIVATE]');
    privRow.appendChild(redact);

    if (inCurrentMatch && gid) {
      const nextR = pObj.role === 'seeker' ? 'hider' : 'seeker';
      const roleBtn = el('button', 'btn-sm o', 'Make ' + nextR);
      roleBtn.onclick = async () => {
        try {
          await sb.from('game_players').update({ role: nextR }).eq('game_id', gid).eq('user_id', pObj.id);
          await sb.rpc('set_role', { g: gid, u: pObj.id, r: nextR });
        } catch (e) {}
        await loadPlayers();
        loadDevPlayers();
        toast(`Set ${pObj.name} to ${nextR.toUpperCase()}`);
      };
      privRow.appendChild(roleBtn);
    }
    it.appendChild(privRow);
    box.appendChild(it);
  };

  const matchList = Object.values(players);
  if (matchList.length) {
    box.appendChild(el('div', 'mono', `CURRENT MATCH PLAYERS (${matchList.length})`));
    matchList.forEach((mp) => renderPlayerCard({ id: mp.user_id, name: mp.name, role: mp.role, avatar: 'avatars/avatar_01.png' }, true));
  }

  try {
    // Only public gameplay columns are queried — private user tables/columns are never accessed
    const { data } = await sb.from('profiles').select('id,display_name,avatar,games_played,wins').limit(15);
    if (data && data.length) {
      const hdr = el('div', 'mono', 'PUBLIC AGENT PROFILES (ZERO-PII)');
      hdr.style.marginTop = '8px';
      box.appendChild(hdr);
      data.forEach((pr) => {
        if (!players[pr.id]) {
          renderPlayerCard({ id: pr.id, name: `${pr.display_name || 'Player'} (${pr.games_played || 0}G / ${pr.wins || 0}W)`, avatar: pr.avatar }, false);
        }
      });
    }
  } catch (e) {}
}

// Save Profile (Name & HD Avatar)
$('saveProfileBtn').onclick = async () => {
  const n = ($('stNameInput').value || myName).trim().slice(0, 14);
  if (n.length >= 2) myName = n;
  $('sbName').textContent = myName;
  bindAvatarImg($('sbAvatarImg'), myAvatar, myName);
  $('name').value = myName;
  localStorage.setItem('mf_avatar_' + uid, myAvatar);
  try {
    await sb.from('profiles').update({ display_name: myName, avatar: myAvatar }).eq('id', uid);
    await sb.auth.updateUser({ data: { display_name: myName, avatar: myAvatar } });
  } catch (e) {}
  $('settingsModal').hidden = true;
  toast('Profile & Avatar saved!');
};

$('stUpdatePwBtn').onclick = async () => {
  const pw = $('stNewPw').value;
  if (!pw || pw.length < 8) return toast('Password must be at least 8 characters');
  try {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
    $('stNewPw').value = '';
    toast('Password updated successfully!');
  } catch (e) {
    fail(e, 'Could not update password');
  }
};

$('stMapSelect').onchange = () => {
  localStorage.setItem('mf_map', $('stMapSelect').value);
  toast('Default map set to ' + $('stMapSelect').value);
};

/* ---------- 3. Sidebar Navigation ---------- */
const sidebar = $('sidebar'), sbOverlay = $('sbOverlay');
function toggleSidebar(open) { sidebar.classList.toggle('on', open); sbOverlay.classList.toggle('on', open); }
$('menuBtn').onclick = () => toggleSidebar(true);
$('sbClose').onclick = () => toggleSidebar(false);
sbOverlay.onclick = () => toggleSidebar(false);

const openFriendsModal = () => { toggleSidebar(false); $('friendsModal').hidden = false; loadFriends(); };
$('sbFriendsBtn').onclick = openFriendsModal;
$('hdrFriends').onclick = openFriendsModal;
$('quickFriends').onclick = openFriendsModal;
$('inviteFriendsBtn').onclick = openFriendsModal;
$('frClose').onclick = () => { $('friendsModal').hidden = true; $('frDropdown').hidden = true; };
$('frAddBtn').onclick = () => { addFriend($('frInput').value); $('frInput').value = ''; $('frDropdown').hidden = true; };

$('sbAbilitiesBtn').onclick = () => {
  toggleSidebar(false);
  sheet((s) => {
    s.appendChild(el('h2', '', 'Special Abilities'));
    s.appendChild(el('p', '', 'Every match equips you with 4 tactical abilities:'));
    const list = [
      ['👻 Ghost (Invisibility)', 'Freezes your ping & vanishes from seeker radar for 15s.'],
      ['📍 Decoy Signal', 'Emits a false hider ping 100m away to mislead the seekers.'],
      ['⚡ Sprint Boost', 'Surges running momentum and tactical pace for 12s.'],
      ['📡 Jammer / Sonar', 'Hiders jam and delay the next ping; Seekers force an instant sonar reveal.']
    ];
    list.forEach(([t, d]) => { const c = el('div', 'card'); c.style.marginBottom = '8px'; c.appendChild(el('b', '', t)); c.appendChild(el('p', 'mu', d)); s.appendChild(c); });
    const cl = el('button', '', 'Close'); cl.onclick = closeSheet; s.appendChild(cl);
  });
};
$('sbRulesBtn').onclick = () => {
  toggleSidebar(false);
  sheet((s) => {
    s.appendChild(el('h2', '', 'Dynamic Safe Zones'));
    s.appendChild(el('p', '', 'In areas larger than 30m, Blackout activates Dynamic Hazards: sudden perimeter shifts and random Red Hazard Zones appear inside the map. Staying in a Red Zone reveals your exact location!'));
    const cl = el('button', '', 'Got it'); cl.onclick = closeSheet; s.appendChild(cl);
  });
};
$('sbOut').onclick = () => {
  localStorage.removeItem('mf_dev_session');
  sb.auth.signOut().then(() => location.replace('auth.html'));
};

/* ---------- 4. Special Abilities Engine ---------- */
const abilities = {
  ghost: { active: false, cd: 0, maxCd: 45, dur: 15 },
  decoy: { active: false, cd: 0, maxCd: 30 },
  boost: { active: false, cd: 0, maxCd: 35, dur: 12 },
  radar: { active: false, cd: 0, maxCd: 40 }
};

function initAbilitiesHUD() {
  const role = myRole();
  $('abRadarName').textContent = role === 'seeker' ? 'Sonar' : 'Jammer';
  $('abRadarIcon').textContent = role === 'seeker' ? '🔍' : '📡';
  document.querySelectorAll('.ab-btn').forEach((btn) => {
    const ab = btn.dataset.ab;
    btn.onclick = () => triggerAbility(ab);
  });
  updateAbilitiesUI();
}

function triggerAbility(key) {
  const a = abilities[key], role = myRole(), dev = isDevOrAdmin();
  if ((a.cd > 0 && !devInfiniteAbilities) || a.active) return;
  const nextCd = devInfiniteAbilities ? 0 : a.maxCd;

  if (key === 'ghost') {
    if (role === 'seeker' && !dev) return toast('Ghost is only for hiders');
    a.active = true; a.cd = nextCd;
    toast('👻 GHOST ACTIVE! Invisible for 15s');
    $('abGhost').classList.add('active');
    setTimeout(() => { a.active = false; $('abGhost').classList.remove('active'); toast('Ghost expired'); }, a.dur * 1000);
  } else if (key === 'decoy') {
    if (role === 'seeker' && !dev) return toast('Decoy is only for hiders');
    a.cd = nextCd;
    if (me) {
      const ang = Math.random() * Math.PI * 2;
      const mlngVal = 111320 * Math.cos((me.lat * Math.PI) / 180);
      const fakeLoc = { lat: me.lat + (Math.sin(ang) * 90) / 110540, lng: me.lng + (Math.cos(ang) * 90) / mlngVal };
      sb.from('pings').upsert({ game_id: gid, taken_at: new Date(nowMs()).toISOString(), hiders: [fakeLoc] }).then(() => {});
      toast('📍 DECOY DEPLOYED! False ping broadcasted');
    }
  } else if (key === 'boost') {
    a.active = true; a.cd = nextCd;
    toast('⚡ SPRINT BOOST ACTIVE! Pace surged');
    $('abBoost').classList.add('active');
    setTimeout(() => { a.active = false; $('abBoost').classList.remove('active'); }, a.dur * 1000);
  } else if (key === 'radar') {
    a.cd = nextCd;
    if (role === 'seeker' || dev) {
      releasePing();
      toast('🔍 SONAR PULSE: Immediate hider scan triggered!');
    } else {
      if (game && game.next_ping_at) {
        const delayed = new Date(Date.parse(game.next_ping_at) + 20000).toISOString();
        sb.from('games').update({ next_ping_at: delayed }).eq('id', gid).then(() => {});
        game.next_ping_at = delayed;
      }
      toast('📡 RADAR JAMMED! Next seeker ping delayed by 20s');
    }
  }
  updateAbilitiesUI();
}

function updateAbilitiesUI() {
  Object.entries(abilities).forEach(([k, a]) => {
    const btn = $('ab' + k.charAt(0).toUpperCase() + k.slice(1));
    const cdLbl = $('cd' + k.charAt(0).toUpperCase() + k.slice(1));
    if (!btn) return;
    btn.classList.toggle('cooling', a.cd > 0);
    btn.classList.toggle('ready', a.cd === 0 && !a.active);
    cdLbl.textContent = a.cd > 0 ? a.cd + 's' : '';
  });
}

function tickAbilities() {
  Object.values(abilities).forEach((a) => { if (a.cd > 0) a.cd--; });
  updateAbilitiesUI();
}

/* ---------- 5. General App Setup ---------- */
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
const isHostOrDev = () => (game && game.host === uid) || isDevOrAdmin();
const fail = (e, m) => { console.error(e); toast(m || 'Something went wrong. Try again.'); };

bindAvatarImg($('sbAvatarImg'), myAvatar, myName);
const { data: { session } } = await sb.auth.getSession();
const wantsDevGate = new URLSearchParams(location.search).get('dev') === '1';
if ((!session || !confirmed(session.user)) && !isDevOrAdmin()) {
  if (wantsDevGate) {
    openDevModal();
  } else {
    location.replace('auth.html');
    await new Promise(() => {});
  }
}
uid = (session && session.user) ? session.user.id : (activeDevSession ? activeDevSession.uid : '00000000-0000-4000-d000-000000000001');
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && !isDevOrAdmin()) location.replace('auth.html'); });
const { data: prof } = await sb.from('profiles').select('id,display_name,avatar,games_played,wins,distance_m,calories').eq('id', uid).maybeSingle();
myName = (prof && prof.display_name) || (activeDevSession ? activeDevSession.defaultName : 'Player');
const savedAv = (prof && prof.avatar) || localStorage.getItem('mf_avatar_' + uid) || (activeDevSession && activeDevSession.defaultAvatar);
myAvatar = (savedAv && savedAv.startsWith('avatars/') && !isLockedAvatar(savedAv)) ? savedAv : 'avatars/avatar_01.png';
$('name').value = myName;
$('sbName').textContent = myName;
bindAvatarImg($('sbAvatarImg'), myAvatar, myName);
$('myUidText').textContent = uid;
syncDevBadgesUI();
homeCards(prof);
loadFriends();
listenInvites();

async function homeCards(p) {
  const box = $('hstats');
  if (p) {
    const c = el('div', 'card'); c.id = 'mystats';
    c.appendChild(el('div', 'mu', 'YOUR STATS')).style.cssText = 'font-size:11px;letter-spacing:.12em;margin-bottom:10px';
    const r = el('div', 'row');
    [[p.games_played, 'GAMES'], [p.wins, 'WINS'], [Math.round(p.distance_m / 100) / 10 + ' km', 'DISTANCE'], [Math.round(p.calories), 'KCAL']].forEach(([v, l]) => { const s = el('div', 'st'); s.appendChild(el('b', '', String(v))); s.appendChild(el('span', '', l)); r.appendChild(s); });
    c.appendChild(r); box.appendChild(c);
  }
}

if ($('so')) $('so').onclick = () => sb.auth.signOut().then(() => location.replace('auth.html'));
const qc = new URLSearchParams(location.search).get('code');
if (qc) $('code').value = qc.slice(0, 6).toUpperCase();
$('sheet').onclick = (e) => { if (e.target === $('sheet') && !$('sheet').dataset.lock) closeSheet(); };
document.querySelectorAll('[data-m]').forEach((c) => (c.onclick = () => { mode = c.dataset.m; document.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('a', x === c)); }));

/* ---------- Create / Join Game ---------- */
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
  } catch (e) { if (e && e.code === 1) toast('Allow location to create a game'); else if (e && e.code === 3) toast('Could not find your location.'); else fail(e); }
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

/* ---------- Lobby & Area Setup ---------- */
let rt, rulesInit = false;
const rf = rulesForm(DEFAULTS, { onChange: (r) => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (game && isHostOrDev() && game.status === 'lobby') sb.from('games').update({ rules: r }).eq('id', gid).then(() => {}); }, 450);
} });
$('rulesForm').appendChild(rf.el);

function renderLobby() {
  if (!game) return;
  const host = isHostOrDev();
  $('lcode').textContent = game.code;
  const list = $('plist'); list.replaceChildren();
  Object.values(players).forEach((p) => {
    const row = el('div', 'pl');
    const nameWrap = el('span', '', p.name);
    if (p.user_id === uid && isDevOrAdmin()) {
      nameWrap.appendChild(el('span', 'dev-tag', activeDevSession.role));
    }
    row.appendChild(nameWrap);
    row.appendChild(el('span', p.role === 'seeker' ? 'or' : 'yl', p.role.toUpperCase()));
    if (host && game.status === 'lobby') {
      const nextRole = p.role === 'seeker' ? 'hider' : 'seeker';
      if (p.role !== 'seeker' || isDevOrAdmin()) {
        const b = el('button', '', 'Make ' + nextRole);
        b.onclick = async () => {
          const { error } = await sb.rpc('set_role', { g: gid, u: p.user_id, r: nextRole });
          if (error) {
            await sb.from('game_players').update({ role: nextRole }).eq('game_id', gid).eq('user_id', p.user_id);
          }
          loadPlayers();
        };
        row.appendChild(b);
      }
    }
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
  $('areaNote').textContent = A.type === 'Custom' ? 'Drawn by host. Includes Dynamic Hazard Red Zones.' : 'The host can choose a shape, let the map choose, or draw on the map.';
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
      if (error) fail(error); else { await loadGame(); toast('Play area: ' + areaLabel(newArea)); }
    },
    onDraw: editArea
  });
}
$('areaAsum').onclick = () => { if (game && isHostOrDev() && game.status === 'lobby') chooseShape(normalize(game.rules || {}), game.area || { type: 'Circle' }); };

async function autoArea() {
  loading('Finding a good spot...');
  try {
    const c = [game.center_lat, game.center_lng];
    const area = randomArea();
    const { error } = await sb.from('games').update({ area }).eq('id', gid);
    if (error) throw error;
    await loadGame(); toast(areaLabel(area) + ' play area selected');
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

/* ---------- Map & Dynamic Red Hazard Zones ---------- */
const ES = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const esri = (svc, o = {}) => [ES + svc + '/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 19, maxZoom: 20, attribution: 'Tiles &copy; Esri', ...o }];
const BASES = {
  Streets: { bg: '#E9E7E1', sw: 'linear-gradient(135deg,#F4F1EA 50%,#FFFFFF 50%)', layers: [esri('World_Street_Map')] },
  Light: { bg: '#EFEFEF', sw: '#E4E4E4', layers: [esri('Canvas/World_Light_Gray_Base', { maxNativeZoom: 16 }), esri('Canvas/World_Light_Gray_Reference', { maxNativeZoom: 16 })] },
  Dark: { bg: '#1C1C1E', sw: '#2B2B2E', layers: [esri('Canvas/World_Dark_Gray_Base', { maxNativeZoom: 16 }), esri('Canvas/World_Dark_Gray_Reference', { maxNativeZoom: 16 })] },
  Satellite: { bg: '#222', sw: 'linear-gradient(135deg,#2F4A2B,#6E5E3C)', layers: [esri('World_Imagery', { attribution: 'Imagery &copy; Esri' })] }
};
const who = (id) => { const p = players[id]; return { name: p ? p.name : 'Player', role: p ? p.role : 'seeker' }; };
const gc = () => [game.center_lat, game.center_lng];

let areaPts = null, finals = [], zoneKey = '', currentRedZones = [];
const keyOf = () => JSON.stringify([game.rules, game.area, game.center_lat, game.center_lng]);

function drawZone(fit) {
  if (!map || !game) return;
  finals.forEach((l) => l.remove()); finals = []; if (zone) { zone.remove(); zone = null; }
  redLayers.forEach((l) => l.remove()); redLayers = [];
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

  if (r.zoneM > 30) {
    currentRedZones = createRedZones(c, radius(), 2);
    currentRedZones.forEach((rz) => {
      const redCirc = L.circle([rz.lat, rz.lng], { radius: rz.radius, color: '#B3261E', weight: 3, fillColor: '#B3261E', fillOpacity: 0.22, interactive: false }).addTo(map);
      redLayers.push(redCirc);
    });
  }

  if (fit) map.fitBounds(zone.getBounds(), { padding: [70, 70], maxZoom: 18 });
}

function insideRedZone() {
  if (!me || !currentRedZones.length) return false;
  return currentRedZones.some((rz) => map.distance([me.lat, me.lng], [rz.lat, rz.lng]) <= rz.radius);
}

function updateZone(rad) {
  if (!zone) return;
  if (areaPts) zone.setLatLngs(toLL(gc(), areaPts, (rad * 2) / rl().zoneM)); else zone.setRadius(rad);
  if (rad <= 30 && redLayers.length) { redLayers.forEach((l) => l.remove()); redLayers = []; currentRedZones = []; }
}
function insideZone(rad) {
  if (!me) return true;
  if (!areaPts) return map.distance(gc(), me) <= rad;
  const k = (rad * 2) / rl().zoneM; return pip(offsetOf(gc(), [me.lat, me.lng]), areaPts.map(([x, y]) => [x * k, y * k]));
}

function buildMap() {
  map = L.map('map', { zoomControl: false }).setView(gc(), 15);
  const preferred = localStorage.getItem('mf_map') || 'Dark';
  const base = BASES[preferred] || BASES.Dark;
  base.layers.forEach((l) => L.tileLayer(l[0], l[1]).addTo(map));
  pts = createPoints(map, { now: nowMs });
  const lg = L.control({ position: 'bottomleft' });
  lg.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<span><i style="background:#D4621A"></i>Seeker</span><span><i style="background:#F4AE52"></i>Hider</span><span><i style="background:#B3261E"></i>Red Zone</span>'; return d; };
  lg.addTo(map);
  const zc = L.control({ position: 'topleft' }); zc.onAdd = () => { const d = L.DomUtil.create('div', 'zpill'); d.id = 'zpill'; return d; }; zc.addTo(map);
  map.on('click', (e) => {
    if (!isDevOrAdmin() || !devTeleportMode || !pts) return;
    me = { lat: e.latlng.lat, lng: e.latlng.lng };
    const role = myRole() || 'hider';
    pts.setMe(me.lat, me.lng, 5, role, myName);
    const row = { game_id: gid, user_id: uid, lat: me.lat, lng: me.lng, updated_at: new Date().toISOString() };
    sb.from('locations').upsert(row).then(() => {});
    if (role === 'seeker') sb.from('live_positions').upsert(row).then(() => {});
    toast(`📍 Dev Teleported to ${me.lat.toFixed(4)}, ${me.lng.toFixed(4)}`);
  });
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

/* ---------- Live Game & Instant Ping Engine ---------- */
async function loadLive() {
  if (!map || !pts) return;
  const { data } = await sb.from('live_positions').select('user_id,lat,lng,updated_at').eq('game_id', gid); if (!data) return;
  pts.syncLive(data, who, uid);
}

async function loadPings() {
  if (!map || !pts || (myRole() !== 'seeker' && !isDevOrAdmin())) return;
  const { data } = await sb.from('pings').select('taken_at,hiders').eq('game_id', gid).maybeSingle();
  if (!data || data.taken_at === lastPing) return;
  const first = lastPing === ''; lastPing = data.taken_at;
  pts.showPings(data.hiders || [], Date.parse(data.taken_at));
  if (!first || nowMs() - Date.parse(data.taken_at) < 25000) {
    toast('PING! Hiders located');
    if ($('stVibe').checked && navigator.vibrate) try { navigator.vibrate([70, 50, 70]); } catch (e) {}
  }
}

async function releasePing() {
  if (releasingPing || !game || game.status !== 'live' || isPaused()) return;
  releasingPing = true;
  try {
    const r = rl(), now = nowMs(), nowIso = new Date(now).toISOString();
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
    await loadPings(); loadGame();
  } catch (e) { console.warn(e); }
  finally { releasingPing = false; }
}

function startGame() {
  started = true; show('game'); finished = false; setDock(false);
  const role = myRole();
  $('role').textContent = role.toUpperCase(); $('role').style.background = role === 'seeker' ? 'var(--or)' : 'var(--yl)';
  if ($('hostBar')) $('hostBar').hidden = !isHostOrDev();
  try { if (!window.L) throw new Error('Leaflet missing'); buildMap(); } catch (e) { toast('Error loading map'); }
  firstFix = true; follow = true;
  initAbilitiesHUD();

  watchId = navigator.geolocation.watchPosition((p) => {
    if (finished || devTeleportMode) return;
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!map || !pts) return;
    pts.setMe(me.lat, me.lng, p.coords.accuracy, role, myName);
    if (firstFix) { firstFix = false; map.setView([me.lat, me.lng], Math.max(map.getZoom(), 16)); }
    else if (follow) map.panTo([me.lat, me.lng], { animate: true, duration: 0.9 });
    if (lastPos) { const d = map.distance(lastPos, me); if (d > 2 && p.coords.accuracy <= 60) dist += d; }
    lastPos = me;
    if (!amTagged() && !isPaused() && !abilities.ghost.active && Date.now() - lastSend > 3500) {
      lastSend = Date.now(); const row = { game_id: gid, user_id: uid, lat: me.lat, lng: me.lng, updated_at: new Date().toISOString() };
      sb.from('locations').upsert(row).then(() => {});
      if (role === 'seeker') sb.from('live_positions').upsert(row).then(() => {});
    }
  }, (err) => { const n = Date.now(); if (n - lastGpsErr > 20000) { lastGpsErr = n; toast('GPS signal weak'); } }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  loadLive(); loadPings();
  $('tagBtn').style.display = (role === 'seeker' || isDevOrAdmin()) ? 'block' : 'none';
  loop = setInterval(tick, 1000); tick();
}

function setBanner(txt, yellow, red) { const b = $('banner'); b.textContent = txt || ''; b.classList.toggle('on', !!txt); b.classList.toggle('y', !!yellow); b.classList.toggle('red', !!red); }

function tick() {
  const r = rl(), t = elapsed(), hs = r.headMin * 60, end = r.roundMin * 60, role = myRole(), rad = radius();
  updateZone(rad);
  tickAbilities();

  const w = hiders().length && freeHiders().length === 0 ? 'seekers' : t >= end ? 'hiders' : null;
  if (w) { if (isHostOrDev() && game.status !== 'over') sb.rpc('finish_game', { g: gid, w }).then(() => {}); return finish(w); }
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('tm').textContent = mmss(t); $('kc').textContent = kc; $('ds').textContent = Math.round(dist); $('clock').textContent = mmss(end - t);
  const out = me && map && !insideZone(rad);
  const inRed = insideRedZone();

  if (role === 'hider' && !amTagged() && t > hs && !isPaused()) {
    outT = out ? outT + 1 : Math.max(0, outT - 1);
    if (outT >= 120) { sb.rpc('tag_self', { g: gid }).then(() => loadPlayers()); toast('Stayed outside zone: tagged'); outT = 0; }
  }

  let banner = '';
  if (isPaused()) banner = 'Game paused.';
  else if (inRed) banner = '⚠️ DANGER: YOU ARE IN A RED ZONE! Location exposed!';
  else if (t < hs) banner = role === 'seeker' ? 'Hold still: hiders are hiding. ' + mmss(hs - t) : 'Head start: go hide! ' + mmss(hs - t);
  else if (amTagged()) banner = 'You are tagged. Spectating.';
  else if (out) banner = role === 'hider' ? 'Outside zone! Back in ' + Math.max(0, 120 - outT) + ' s' : 'Outside safe zone';
  setBanner(banner, t < hs, inRed);

  // Instant Ping Triggering
  const np = game.next_ping_at ? Date.parse(game.next_ping_at) : null;
  const next = np ? Math.max(0, Math.round((np - nowMs()) / 1000)) : 0;
  if (t >= hs && r.pingSec > 0 && !isPaused()) {
    const isDue = np ? nowMs() >= np : (t >= hs && !lastPing);
    if (isDue) {
      const isHost = isHostOrDev();
      const isFallback = !isHost && np && (nowMs() - np > 2000);
      if (isHost || isFallback) releasePing();
    }
  }

  if ((role === 'seeker' || isDevOrAdmin()) && t >= hs && next <= 1 && Date.now() - lastPingFetch > 1000) {
    lastPingFetch = Date.now();
    loadPings();
  }

  const free = freeHiders().length;
  if (role === 'seeker') $('info').innerHTML = (np ? '<span class="yl">NEXT PING</span> in ' + mmss(Math.max(next, t < hs ? hs - t : 0)) : '<span class="yl">PINGS OFF</span>') + ' · hiders left ' + free;
  else $('info').innerHTML = '<span class="or">SEEKER LIVE</span> · hiders left ' + free;
  $('tagBtn').disabled = t < hs || isPaused();

  if (pts) pts.fade();
  const zp = $('zpill');
  if (zp) {
    const seg = (end - hs) / 4, sh = Math.min(30, seg / 2), tt = t - hs, i = Math.floor(tt / seg), into = tt - i * seg, st = seg - sh;
    let cls = 'zpill', html;
    if (!r.shrink) html = '<small>ZONE</small><b>FIXED SIZE</b>';
    else if (t < hs) html = '<small>HEAD START ENDS IN</small><b>' + mmss(hs - t) + '</b>';
    else if (i >= 3) html = '<small>FINAL ZONE</small><b>Stay inside</b>';
    else if (into < st) { html = '<small>ZONE SHRINKS IN</small><b>' + mmss(st - into) + '</b>'; if (st - into <= 10) cls += ' warn'; }
    else { cls += ' go'; html = '<small>ZONE CLOSING</small><b>' + mmss(seg - into) + '</b><i style="width:' + Math.round(((into - st) / sh) * 100) + '%"></i>'; }
    zp.className = cls; zp.innerHTML = html;
  }
}

/* ---------- Slide Panel, Host Controls & Results ---------- */
const dock = $('dock'); let dockOpen = false;
const peekPx = () => parseFloat(getComputedStyle($('game')).getPropertyValue('--peek')) || 82;
function setDock(v) { dockOpen = v; dock.classList.toggle('open', v); dock.style.transform = ''; $('grab').setAttribute('aria-expanded', String(v)); }
$('grab').onclick = () => setDock(!dockOpen);

$('pauseBtn').onclick = async () => { const { error } = await sb.rpc(isPaused() ? 'resume_game' : 'pause_game', { g: gid }); if (error) fail(error); else { await loadGame(); toast(isPaused() ? 'Game paused' : 'Game resumed'); } };
$('rulesBtn').onclick = () => {
  if (!isPaused()) return toast('Pause game first');
  sheet((s) => {
    s.appendChild(el('h2', '', 'Rules & Red Zones'));
    const f = rulesForm(game.rules || DEFAULTS); s.appendChild(f.el);
    const save = el('button', '', 'Save rules'); save.onclick = async () => { const { error } = await sb.rpc('update_rules', { g: gid, r: f.get() }); closeSheet(); if (error) fail(error); else { await loadGame(); toast('Rules saved'); } };
    s.appendChild(save);
  });
};
$('restartBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'Restart Round?'));
  const y = el('button', '', 'Restart'); y.onclick = async () => { closeSheet(); const { error } = await sb.rpc('restart_game', { g: gid }); if (error) fail(error); else { await loadGame(); toast('Round restarted'); } };
  s.appendChild(y);
});
$('endBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'End Game?'));
  const y = el('button', '', 'End Game'); y.onclick = async () => { closeSheet(); const { error } = await sb.rpc('end_game', { g: gid }); if (error) fail(error); else loadGame(); };
  s.appendChild(y);
});

function restartLocal() { dist = 0; outT = 0; lastPing = ''; if (pts) pts.showPings([], nowMs()); toast('Round restarted'); }

$('tagBtn').onclick = () => sheet((s) => {
  s.appendChild(el('h2', '', 'Who did you tag?'));
  const f = freeHiders();
  f.forEach((p) => { const b = el('button', 'o', p.name); b.onclick = async () => { closeSheet(); const { error } = await sb.rpc('claim_tag', { g: gid, t: p.user_id }); if (error) fail(error); else toast('Waiting for ' + p.name + ' to confirm'); }; s.appendChild(b); });
});

function onTags() {
  const mine = tags[uid];
  if (mine && mine.status === 'pending' && myRole() === 'hider' && !amTagged() && pendingShown !== mine.created_at) {
    pendingShown = mine.created_at; $('sheet').dataset.lock = '1';
    sheet((s) => {
      s.appendChild(el('h2', '', 'Were you tagged?'));
      const answer = async (accept) => { delete $('sheet').dataset.lock; closeSheet(); const { error } = await sb.rpc('answer_tag', { g: gid, accept }); if (error) fail(error); loadPlayers(); loadTags(); };
      const y = el('button', '', 'Yes, tagged'); y.onclick = () => answer(true);
      const n = el('button', 'o', 'Dispute'); n.onclick = () => answer(false);
      s.append(y, n);
    });
  }
}

async function finish(winner) {
  if (finished) return; finished = true; clearInterval(loop); loop = null; clearInterval(poll); closeSheet();
  if (watchId != null) navigator.geolocation.clearWatch(watchId); if (pts) { pts.destroy(); pts = null; }
  const role = myRole(), won = winner ? (winner === 'seekers') === (role === 'seeker') : false;
  const t = Math.min(elapsed(), rl().roundMin * 60);
  $('eTitle').textContent = !winner ? 'Game ended' : winner === 'seekers' ? 'Seekers win!' : 'Hiders win!';
  $('eSub').textContent = won ? 'Your side won this round.' : 'Better luck next round.';
  $('eTag').textContent = won ? 'VICTORY' : 'ROUND OVER';
  const kc = Math.round((MET[mode] * 70 * t) / 3600);
  $('eD').textContent = Math.round(dist); $('eK').textContent = kc; $('eT').textContent = Math.round(t / 60);
  $('eP').textContent = dist > 50 ? Math.floor(t / (dist / 1000) / 60) + "'" + pad(Math.floor((t / (dist / 1000)) % 60)) + '"' : '--';
  $('eF').textContent = hiders().filter((p) => p.status === 'tagged').length;
  const l = $('eList'); l.replaceChildren();
  hiders().forEach((p) => { const r = el('div', 'er'); r.appendChild(el('span', '', p.name)); r.appendChild(el('span', p.status === 'tagged' ? 'or' : 'yl', p.status === 'tagged' ? 'Tagged' : 'Survived')); l.appendChild(r); });
  show('end');
  sb.rpc('save_result', { g: gid, p_role: role, p_won: won, p_dist: Math.round(dist), p_cal: kc, p_secs: Math.round(t) });
}
$('again').onclick = () => location.replace('play.html');
