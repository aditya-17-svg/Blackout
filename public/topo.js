/* Topographic contour map background. Add <script src="topo.js" defer></script> to any page. */
(function () {
  const SEED = 7, CELL = 8, LEVELS = 18;
  const css = document.createElement('style');
  css.textContent = 'html{background:#0B0B0B}body{background:transparent!important}' +
    '#topo{position:fixed;left:-12%;top:-12%;width:124%;height:124%;z-index:-1;pointer-events:none;will-change:transform;' +
    '-webkit-mask-image:radial-gradient(ellipse 85% 80% at 60% 40%,#000 35%,transparent 100%);mask-image:radial-gradient(ellipse 85% 80% at 60% 40%,#000 35%,transparent 100%)}' +
    '@media (prefers-reduced-motion:no-preference){#topo{animation:topoDrift 90s ease-in-out infinite alternate}}' +
    '@keyframes topoDrift{to{margin-left:-2.5%;margin-top:1.5%}}';
  document.head.appendChild(css);
  const cv = document.createElement('canvas'); cv.id = 'topo'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);

  // seeded value noise
  const h = (x, y) => { let n = Math.sin(x * 127.1 + y * 311.7 + SEED * 74.7) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  const fbm = (x, y) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { v += a * vn(x * f, y * f); f *= 2; a *= 0.5; } return v; };

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth * 1.24, H = innerHeight * 1.24;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cs = CELL, gw = Math.ceil(W / cs) + 1, gh = Math.ceil(H / cs) + 1, sc = 0.0042 * cs * (W > 900 ? 1 : 1.6);
    const f = new Float32Array(gw * gh); let mn = 9, mx = -9;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const dx = i / gw - 0.62, dy = j / gh - 0.4; // one broad hill so rings nest like a summit
      const v = fbm(i * sc, j * sc) + 0.55 * Math.exp(-(dx * dx + dy * dy) * 7);
      f[j * gw + i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    for (let k = 1; k <= LEVELS; k++) {
      const L = mn + (mx - mn) * (k / (LEVELS + 1)), idx = k % 5 === 0;
      g.beginPath(); g.lineWidth = idx ? 1.4 : 0.9;
      g.strokeStyle = idx ? 'rgba(255,225,53,.30)' : 'rgba(255,122,0,.20)';
      for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
        const a = f[j * gw + i], b = f[j * gw + i + 1], c = f[(j + 1) * gw + i + 1], d = f[(j + 1) * gw + i];
        const s = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (s === 0 || s === 15) continue;
        const x0 = i * cs, y0 = j * cs, x1 = x0 + cs, y1 = y0 + cs;
        const T = [x0 + (L - a) / (b - a) * cs, y0], R = [x1, y0 + (L - b) / (c - b) * cs], B = [x0 + (L - d) / (c - d) * cs, y1], Lf = [x0, y0 + (L - a) / (d - a) * cs];
        const seg = (p, q) => { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
        switch (s) {
          case 1: case 14: seg(Lf, B); break; case 2: case 13: seg(B, R); break; case 3: case 12: seg(Lf, R); break;
          case 4: case 11: seg(T, R); break; case 6: case 9: seg(T, B); break; case 7: case 8: seg(T, Lf); break;
          case 5: seg(T, Lf); seg(B, R); break; case 10: seg(T, R); seg(Lf, B); break;
        }
      }
      g.stroke();
    }
  }
  let t; const redraw = () => { clearTimeout(t); t = setTimeout(draw, 200); };
  addEventListener('resize', redraw); draw();
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; cv.style.transform = 'translateY(' + (-scrollY * 0.06) + 'px)'; }); }, { passive: true });
})();
