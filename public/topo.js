/* Stylised Los Angeles map background (light greys + highlighted blocks).
   Add <script src="topo.js" defer></script> to any page. Edit PAL to change the colours. */
(function () {
  const PAL = {
    land: '#2c2c2f', blockMin: 0x3b, blockMax: 0x49, water: '#1e2023', coast: '#5a5a60',
    mountain: '#343437', park: '#37393b', blvd: '#55555a', freeway: '#85858b', casing: '#1c1c1e',
    hi: ['#FF7A00', '#FFE135', '#FF3B30'],
  };
  const SEED = 11, W0 = 1000, H0 = 640, GAP = 1.7;
  const css = document.createElement('style');
  css.textContent = 'html{background:#0B0B0B}body{background:transparent!important}' +
    '#topo{position:fixed;left:-12%;top:-12%;width:124%;height:124%;z-index:-1;pointer-events:none;will-change:transform;' +
    '-webkit-mask-image:radial-gradient(ellipse 105% 100% at 55% 45%,#000 55%,transparent 100%);mask-image:radial-gradient(ellipse 105% 100% at 55% 45%,#000 55%,transparent 100%)}' +
    '@media (prefers-reduced-motion:no-preference){#topo{animation:topoDrift 90s ease-in-out infinite alternate}}' +
    '@keyframes topoDrift{to{margin-left:-2.5%;margin-top:1.5%}}';
  document.head.appendChild(css);
  const cv = document.createElement('canvas'); cv.id = 'topo'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);

  const h = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + SEED * 74.7) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  const fbm = (x, y) => vn(x, y) * 0.6 + vn(x * 2.1, y * 2.1) * 0.3 + vn(x * 4.3, y * 4.3) * 0.1;
  const pip = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

  // Geography in a 1000 x 640 world (rough Los Angeles layout, Pacific on the left)
  const OCEAN = [[0,0],[0,640],[380,640],[340,600],[292,562],[246,516],[238,462],[214,396],[166,346],[150,296],[192,240],[168,186],[106,128],[44,100],[0,92]];
  const MOUNT = [[170,150],[260,105],[420,95],[560,110],[650,160],[665,200],[560,190],[430,168],[300,162],[210,186]];
  const GRIFFITH = [[470,176],[540,164],[562,200],[502,216],[466,204]];
  const ELYSIAN = [[585,232],[618,226],[626,250],[596,262]];
  const AIRPORT = [[250,455],[335,455],[335,492],[250,492]];
  const BARRIERS = [MOUNT, GRIFFITH, ELYSIAN, AIRPORT];
  const DT = { x: 640, y: 300, r: 72, a: 0.58 };
  const FREEWAYS = [
    [[190,332],[300,338],[420,326],[560,322],[640,336],[760,330],[1000,352]],        // I-10
    [[300,0],[296,110],[306,200],[296,300],[296,420],[318,520],[348,610],[362,640]],  // I-405
    [[640,272],[626,332],[616,420],[622,520],[612,640]],                              // I-110
    [[640,300],[700,270],[762,230],[832,150],[900,62],[950,0]],                       // I-5
    [[640,290],[580,270],[520,236],[430,206],[330,160],[270,128],[252,0]],            // US-101
  ];
  const BLVDS = [
    [[190,250],[320,262],[460,274],[560,284],[630,296]],   // Wilshire
    [[200,236],[330,218],[470,232],[580,262],[636,288]],   // Sunset
    [[196,300],[330,305],[480,308],[640,312]],              // Pico / Olympic
    [[160,326],[300,330],[560,334],[900,346]],              // Venice
    [[430,180],[432,300],[434,640]], [[500,200],[502,330],[506,640]], [[560,210],[562,330],[566,640]],
    [[340,180],[340,640]], [[700,260],[704,640]], [[780,230],[790,640]],
  ];

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth * 1.24, H = innerHeight * 1.24;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = PAL.land; g.fillRect(0, 0, W, H);
    const s = Math.max(W / W0, H / H0);
    const ox = Math.min(0, Math.max(W - W0 * s, W / 2 - 520 * s)), oy = Math.min(0, Math.max(H - H0 * s, H / 2 - 300 * s));
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const hi = [];
    const free = (x, y) => !pip(x, y, OCEAN) && !BARRIERS.some((b) => pip(x, y, b));

    function grid(ang, bw, bh, cx0, cy0, n, test) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
        const lx = i * bw, ly = j * bh, mx = lx + bw / 2, my = ly + bh / 2;
        const wx = cx0 + ca * mx - sa * my, wy = cy0 + sa * mx + ca * my;
        if (wx < -20 || wx > W0 + 20 || wy < -20 || wy > H0 + 20 || !test(wx, wy)) continue;
        const v = Math.round(PAL.blockMin + (PAL.blockMax - PAL.blockMin) * h(wx * 0.37, wy * 0.53));
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 2) + ')';
        g.save(); g.translate(cx0, cy0); g.rotate(ang); g.fillRect(lx + GAP / 2, ly + GAP / 2, bw - GAP, bh - GAP); g.restore();
        if (free(wx, wy)) {
          const p = fbm(wx * 0.011, wy * 0.011) > 0.66 ? 0.2 : 0.004;
          if (h(wx * 1.9, wy * 2.7) < p) hi.push({ ang, cx0, cy0, x: lx + GAP / 2, y: ly + GAP / 2, w: bw - GAP, h: bh - GAP, c: PAL.hi[h(wx * 3.1, wy * 1.3) < 0.45 ? 0 : h(wx * 3.1, wy * 1.3) < 0.8 ? 1 : 2] });
        }
      }
    }
    const inDT = (x, y) => Math.hypot(x - DT.x, y - DT.y) < DT.r;
    grid(0, 11, 7.5, 0, 0, 130, (x, y) => !inDT(x, y));
    grid(DT.a, 8, 6, DT.x, DT.y, 20, (x, y) => inDT(x, y));

    // terrain, parks, airport
    g.fillStyle = PAL.mountain; g.beginPath(); MOUNT.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) { g.beginPath(); MOUNT.forEach((p, i) => { const q = [p[0] + (410 - p[0]) * k * 0.08, p[1] + (150 - p[1]) * k * 0.14]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke(); }
    g.fillStyle = PAL.park; [GRIFFITH, ELYSIAN].forEach((pl) => { g.beginPath(); pl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); });
    g.fillStyle = '#303134'; g.fillRect(250, 455, 85, 37); g.strokeStyle = '#6a6a70'; g.lineWidth = 1.6;
    [[258,466,328,466],[258,481,328,481]].forEach((r) => { g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.stroke(); });

    const line = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.stroke(); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = PAL.blvd; g.lineWidth = 1.5; BLVDS.forEach(line);
    g.strokeStyle = PAL.casing; g.lineWidth = 7; FREEWAYS.forEach(line);
    g.strokeStyle = PAL.freeway; g.lineWidth = 4; FREEWAYS.forEach(line);

    // Pacific Ocean
    g.fillStyle = PAL.water; g.beginPath(); OCEAN.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.strokeStyle = PAL.coast; g.lineWidth = 1.8; g.beginPath(); OCEAN.slice(2, -2).forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();

    // highlighted blocks (orange, yellow, red)
    hi.forEach((b) => {
      g.save(); g.translate(b.cx0, b.cy0); g.rotate(b.ang);
      g.shadowColor = b.c; g.shadowBlur = 10 * s; g.fillStyle = b.c; g.globalAlpha = 0.85; g.fillRect(b.x, b.y, b.w, b.h); g.restore();
    });
    // soft dark scrim in the middle so page text stays readable
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
    sc.addColorStop(0, 'rgba(11,11,11,.62)'); sc.addColorStop(0.6, 'rgba(11,11,11,.3)'); sc.addColorStop(1, 'rgba(11,11,11,0)');
    g.fillStyle = sc; g.fillRect(0, 0, W, H);
  }
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); }); draw();
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; cv.style.transform = 'translateY(' + (-scrollY * 0.06) + 'px)'; }); }, { passive: true });
})();
