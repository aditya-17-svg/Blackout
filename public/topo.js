/* Stylised San Francisco map background in a GTA V-like palette, with highlighted blocks.
   Add <script src="topo.js" defer></script> to any page. Edit PAL to change the colours. */
(function () {
  const PAL = {
    water: '#2b4657', shore: '#7ea6ba', land: '#3d3a33', blockMin: 0x55, blockMax: 0x63,
    park: '#4d5b46', hill: '#4a463c', blvd: '#8d867a', freeway: '#d9d0ae', casing: '#26241f', bridge: '#e3a63f',
    hi: ['#FF7A00', '#FFE135', '#FF3B30'],
  };
  const SEED = 5, W0 = 1000, H0 = 640, GAP = 1.7;
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
  const ell = (cx, cy, rx, ry) => Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos(i * Math.PI / 8), cy + ry * Math.sin(i * Math.PI / 8)]);

  // Geography in a 1000 x 640 world: Pacific on the left, the Bay on the right, Golden Gate at the top left
  const SF = [[170,170],[212,152],[262,132],[330,118],[400,126],[470,134],[520,128],[560,150],[612,172],[648,214],[676,252],[694,300],[704,350],[728,402],[742,452],[760,500],[772,560],[790,640],[170,640],[146,560],[134,470],[128,390],[132,310],[146,240],[158,200]];
  const MARIN = [[0,0],[560,0],[520,40],[440,70],[360,84],[290,92],[230,98],[196,112],[150,96],[90,110],[0,130]];
  const EAST = [[900,0],[1000,0],[1000,640],[880,640],[868,560],[858,470],[850,380],[858,300],[866,240],[880,170],[872,90],[890,40]];
  const ISLANDS = [ell(520, 92, 9, 7), ell(768, 246, 16, 8)];
  const LAND = [SF, MARIN, EAST, ...ISLANDS];
  const SOMA = [[470,190],[560,150],[612,172],[648,214],[676,252],[694,300],[640,330],[580,270],[520,240]];
  const GGP = [[150,258],[372,254],[374,272],[152,278]];
  const PRESIDIO = [[212,152],[262,132],[330,118],[336,160],[290,182],[232,184]];
  const HILLS = [[[360,330],[420,318],[450,345],[430,385],[380,392],[352,362]], [[290,420],[340,410],[360,445],[320,470],[280,455]]];
  const PARKS = [GGP, PRESIDIO];
  const BARRIER = [...PARKS, ...HILLS, MARIN, ...ISLANDS];
  const FREEWAYS = [
    [[300,125],[330,190],[470,262],[560,330],[650,390],[728,455],[780,640]],  // US-101
    [[694,330],[620,420],[560,520],[540,640]],                                 // I-280
    [[560,262],[620,262],[676,254],[770,258],[866,262]],                       // Bay Bridge
  ];
  const BLVDS = [
    [[612,176],[560,230],[500,290],[440,350],[405,372]], [[520,132],[522,330]], [[170,205],[300,215],[420,235],[520,238]],
    [[260,130],[420,140]], [[248,254],[250,600]], [[540,250],[620,340],[660,420]], [[470,134],[560,148],[612,172],[648,214],[676,256]],
    [[330,280],[336,600]], [[420,300],[430,640]], [[160,420],[360,430]], [[170,500],[420,510]],
  ];

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth * 1.24, H = innerHeight * 1.24;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = PAL.water; g.fillRect(0, 0, W, H);
    const s = Math.max(W / W0, H / H0);
    const ox = Math.min(0, Math.max(W - W0 * s, W / 2 - 450 * s)), oy = Math.min(0, Math.max(H - H0 * s, H / 2 - 330 * s));
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const path = (p) => { g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
    const inLand = (x, y) => LAND.some((p) => pip(x, y, p));
    const free = (x, y) => inLand(x, y) && !BARRIER.some((b) => pip(x, y, b));
    const hi = [];

    g.save();
    g.fillStyle = PAL.land; LAND.forEach((p) => { path(p); g.fill(); });
    g.beginPath(); LAND.forEach((p) => { p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); }); g.clip(); // keep everything inside the coastline
    function grid(ang, bw, bh, cx0, cy0, n, test) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
        const lx = i * bw, ly = j * bh, mx = lx + bw / 2, my = ly + bh / 2;
        const wx = cx0 + ca * mx - sa * my, wy = cy0 + sa * mx + ca * my;
        if (wx < -20 || wx > W0 + 20 || wy < -20 || wy > H0 + 20 || !test(wx, wy)) continue;
        const v = Math.round(PAL.blockMin + (PAL.blockMax - PAL.blockMin) * h(wx * 0.37, wy * 0.53));
        g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 14) + ')';
        g.save(); g.translate(cx0, cy0); g.rotate(ang); g.fillRect(lx + GAP / 2, ly + GAP / 2, bw - GAP, bh - GAP); g.restore();
        if (free(wx, wy)) {
          const p = fbm(wx * 0.011, wy * 0.011) > 0.66 ? 0.2 : 0.004, c = h(wx * 3.1, wy * 1.3);
          if (h(wx * 1.9, wy * 2.7) < p) hi.push({ ang, cx0, cy0, x: lx + GAP / 2, y: ly + GAP / 2, w: bw - GAP, h: bh - GAP, c: PAL.hi[c < 0.45 ? 0 : c < 0.8 ? 1 : 2] });
        }
      }
    }
    grid(0, 11, 7.5, 0, 0, 130, (x, y) => pip(x, y, SF) && !pip(x, y, SOMA));
    grid(0.72, 8, 6, 590, 250, 24, (x, y) => pip(x, y, SOMA) && pip(x, y, SF));
    grid(0.12, 10, 8, 940, 320, 80, (x, y) => pip(x, y, EAST));
    g.fillStyle = PAL.hill; [...HILLS, MARIN].forEach((p) => { path(p); g.fill(); });
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 0.8;
    [...HILLS, MARIN].forEach((p) => { const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length; for (let k = 1; k < 4; k++) { path(p.map((q) => [cx + (q[0] - cx) * (1 - k * 0.22), cy + (q[1] - cy) * (1 - k * 0.22)])); g.stroke(); } });
    g.fillStyle = PAL.park; PARKS.forEach((p) => { path(p); g.fill(); });
    const line = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.stroke(); };
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = PAL.blvd; g.lineWidth = 1.5; BLVDS.forEach(line);
    g.restore();

    // shoreline glow (GTA-style light edge on the water)
    g.strokeStyle = PAL.shore; g.globalAlpha = 0.55; g.lineWidth = 1.6; LAND.forEach((p) => { path(p); g.stroke(); }); g.globalAlpha = 1;
    // Lake Merced
    g.fillStyle = PAL.water; path(ell(178, 556, 11, 20)); g.fill();
    // freeways and bridges
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = PAL.casing; g.lineWidth = 7; FREEWAYS.forEach(line);
    g.strokeStyle = PAL.freeway; g.lineWidth = 4; FREEWAYS.forEach(line);
    g.strokeStyle = PAL.casing; g.lineWidth = 8; line([[214, 150], [208, 104]]);
    g.strokeStyle = PAL.bridge; g.lineWidth = 4.6; line([[214, 150], [208, 104]]); // Golden Gate Bridge
    // labels
    g.fillStyle = 'rgba(255,255,255,.16)'; g.font = 'italic 800 20px Arial Black, Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('SAN FRANCISCO', 440, 440); g.font = 'italic 800 14px Arial, sans-serif';
    g.fillText('PACIFIC OCEAN', 62, 330); g.fillText('SAN FRANCISCO BAY', 790, 160); g.fillText('OAKLAND', 940, 430); g.fillText('MARIN', 300, 55);
    // highlighted blocks (orange, yellow, red)
    hi.forEach((b) => { g.save(); g.translate(b.cx0, b.cy0); g.rotate(b.ang); g.shadowColor = b.c; g.shadowBlur = 10 * s; g.fillStyle = b.c; g.globalAlpha = 0.85; g.fillRect(b.x, b.y, b.w, b.h); g.restore(); });
    // soft dark scrim in the middle so page text stays readable
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
    sc.addColorStop(0, 'rgba(11,11,11,.62)'); sc.addColorStop(0.6, 'rgba(11,11,11,.3)'); sc.addColorStop(1, 'rgba(11,11,11,0)');
    g.fillStyle = sc; g.fillRect(0, 0, W, H);
  }
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); }); draw();
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; cv.style.transform = 'translateY(' + (-Math.min(scrollY * 0.06, innerHeight * 0.1)) + 'px)'; }); }, { passive: true });
})();
