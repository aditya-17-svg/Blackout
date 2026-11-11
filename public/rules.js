// Game rules: checking the values, and the rules panel (slider AND typed number for every rule).
// Used in the lobby and again when the host edits the rules during a pause.
// Zone sizes are DIAMETERS in metres. Pings are in seconds.
export const LIM = {
  roundMin: { min: 5, max: 180, step: 5, hardMin: 5, hardMax: 480 },
  pingSec: { min: 15, max: 900, step: 5, hardMin: 15, hardMax: 3600 },
  headMin: { min: 0, max: 30, step: 1, hardMin: 0, hardMax: 60 },
  zoneM: { min: 50, max: 4000, step: 10, hardMin: 50, hardMax: 10000 },
  finalM: { min: 15, max: 2000, step: 5, hardMin: 15, hardMax: 10000 },
};
export const DEFAULTS = { roundMin: 45, pingSec: 300, headMin: 3, zoneM: 1000, finalM: 100, shrink: true };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function normalize(r = {}) {
  const x = { ...DEFAULTS, ...r };
  if (r.pingSec === undefined && r.pingMin !== undefined) x.pingSec = Math.round(r.pingMin * 60); // older games used minutes
  x.roundMin = clamp(Math.round(+x.roundMin || DEFAULTS.roundMin), LIM.roundMin.hardMin, LIM.roundMin.hardMax);
  x.pingSec = +x.pingSec > 0 ? clamp(Math.round(+x.pingSec), LIM.pingSec.hardMin, LIM.pingSec.hardMax) : 0;
  x.headMin = clamp(Math.round(+x.headMin || 0), 0, LIM.headMin.hardMax);
  x.zoneM = clamp(Math.round(+x.zoneM || DEFAULTS.zoneM), LIM.zoneM.hardMin, LIM.zoneM.hardMax);
  x.finalM = clamp(Math.round(+x.finalM || DEFAULTS.finalM), LIM.finalM.hardMin, x.zoneM);
  x.shrink = x.shrink !== false;
  delete x.pingMin;
  return x;
}

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function rulesForm(initial, opts = {}) {
  let R = normalize(initial), lastPing = R.pingSec || 300, ro = !!opts.readonly;
  const root = h('div', 'rf');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'rprev'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Zone preview');
  const mk = (n, a) => { const e = document.createElementNS(NS, n); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); svg.appendChild(e); return e; };
  mk('circle', { cx: 100, cy: 100, r: 96, style: 'fill:var(--inp);stroke:var(--line)' });
  const pOut = mk('circle', { cx: 100, cy: 100, r: 60, style: 'fill:color-mix(in srgb,var(--B) 12%,transparent);stroke:var(--B);stroke-width:3' });
  const pIn = mk('circle', { cx: 100, cy: 100, r: 20, style: 'fill:none;stroke:var(--A);stroke-width:2;stroke-dasharray:6 5' });
  root.appendChild(svg);

  const ctl = {};
  const emit = () => opts.onChange && opts.onChange(normalize(R));

  function number(key, label, unit) {
    const L = LIM[key], wrap = h('div', 'rg');
    const head = h('div', 'rh'); head.appendChild(h('span', '', label));
    const nm = h('span', 'nm'), num = h('input'); num.type = 'number'; num.inputMode = 'numeric'; num.setAttribute('aria-label', label + ' (' + unit + ')');
    nm.appendChild(num); nm.appendChild(h('em', '', unit)); head.appendChild(nm);
    const sl = h('input'); sl.type = 'range'; sl.min = L.min; sl.max = L.max; sl.step = L.step; sl.setAttribute('aria-label', label + ' slider');
    wrap.appendChild(head); wrap.appendChild(sl); root.appendChild(wrap);
    sl.oninput = () => { R[key] = +sl.value; if (key === 'zoneM') R.finalM = Math.min(R.finalM, R.zoneM); if (key === 'pingSec') lastPing = R.pingSec; paint(); emit(); };
    num.oninput = () => { const v = +num.value; if (num.value !== '' && v >= L.hardMin && v <= (key === 'finalM' ? R.zoneM : L.hardMax)) { R[key] = Math.round(v); if (key === 'zoneM') R.finalM = Math.min(R.finalM, R.zoneM); if (key === 'pingSec') lastPing = R.pingSec; paintPreview(); } };
    num.onchange = () => { const v = Math.round(+num.value); R[key] = Number.isFinite(v) ? v : R[key]; R = normalize(R); if (key === 'pingSec' && R.pingSec) lastPing = R.pingSec; paint(); emit(); };
    ctl[key] = { wrap, sl, num, L };
  }
  function toggle(key, text) {
    const wrap = h('label', 'rg chk'), cb = h('input'); cb.type = 'checkbox'; wrap.appendChild(cb); wrap.appendChild(h('span', '', text)); root.appendChild(wrap);
    cb.onchange = () => { if (key === 'ping') R.pingSec = cb.checked ? lastPing : 0; else R.shrink = cb.checked; R = normalize(R); paint(); emit(); };
    ctl[key] = { wrap, cb };
  }
  number('roundMin', 'Round length', 'min');
  toggle('ping', 'Send pings to seekers'); number('pingSec', 'Ping every', 'sec');
  number('headMin', 'Head start', 'min');
  number('zoneM', 'Starting zone (diameter)', 'm');
  toggle('shrink', 'Zone shrinks during the round'); number('finalM', 'Final zone (diameter)', 'm');

  function paintPreview() {
    const out = 30 + 62 * Math.min(1, R.zoneM / 4000);
    pOut.setAttribute('r', out); pIn.setAttribute('r', R.shrink ? Math.max(2.5, out * Math.min(1, R.finalM / R.zoneM)) : 0);
  }
  function paint() {
    ['roundMin', 'pingSec', 'headMin', 'zoneM', 'finalM'].forEach((k) => {
      const c = ctl[k]; c.num.value = R[k]; c.sl.value = clamp(R[k], c.L.min, c.L.max);
      c.num.min = c.L.hardMin; c.num.max = k === 'finalM' ? R.zoneM : c.L.hardMax; c.num.step = c.L.step; c.sl.max = k === 'finalM' ? Math.min(c.L.max, R.zoneM) : c.L.max;
      c.num.disabled = c.sl.disabled = ro;
    });
    ctl.ping.cb.checked = R.pingSec > 0; ctl.shrink.cb.checked = R.shrink; ctl.ping.cb.disabled = ctl.shrink.cb.disabled = ro;
    ctl.pingSec.wrap.hidden = R.pingSec === 0; ctl.finalM.wrap.hidden = !R.shrink;
    root.classList.toggle('ro', ro); paintPreview();
  }
  paint();
  return { el: root, get: () => normalize(R), set(r) { R = normalize(r); if (R.pingSec) lastPing = R.pingSec; paint(); }, setReadonly(b) { ro = !!b; paint(); } };
}
