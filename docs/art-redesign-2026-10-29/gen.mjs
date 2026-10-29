/* 家园美术方向样张生成器（设计预览用，不属于游戏代码）。
   目的：用同一张地图、同一批素材，画出 4 套候选美术方向，供用户挑选。
   运行：node docs/art-redesign-2026-10-29/gen.mjs
   输出：docs/art-redesign-2026-10-29/style-board.html
   约定：每格 48×48 像素；所有物件原点 = 落地中心点，向上绘制；光从左上来，影子向右下。 */

const T = 48;
const n = (v) => Math.round(v * 10) / 10;

/* ---------------- 基础形状 ---------------- */
const ell = (cx, cy, rx, ry, f, o = 1) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${o !== 1 ? ` opacity="${o}"` : ''}/>`;
const cir = (cx, cy, r, f, o = 1) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${f}"${o !== 1 ? ` opacity="${o}"` : ''}/>`;
const rec = (x, y, w, h, f, o = 1, rx = 0) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${f}"${o !== 1 ? ` opacity="${o}"` : ''}/>`;
const line = (pts, stroke, sw, o = 1, extra = '') =>
  `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${o !== 1 ? ` opacity="${o}"` : ''}${extra}/>`;
const poly = (pts, f, o = 1, extra = '') =>
  `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z" fill="${f}"${o !== 1 ? ` opacity="${o}"` : ''}${extra}/>`;
/** 有机轮廓：半径按两段正弦起伏，模拟手绘 / 水彩边。 */
function blob(cx, cy, rx, ry, f, o = 1, wob = 0.1, ph = 0.7, seg = 20) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const k = 1 + wob * (Math.sin(a * 2 + ph) * 0.6 + Math.sin(a * 3 + ph * 2.1) * 0.4);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return poly(pts, f, o);
}
/** 圆角矩形路径（可单独上色）。 */
const rrect = (x, y, w, h, r, f, o = 1) =>
  `<path d="M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${n(-w + 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${n(-h + 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z" fill="${f}"${o !== 1 ? ` opacity="${o}"` : ''}/>`;

/* ---------------- 共同布局：同一张地图，便于横向比较 ---------------- */
const LAYOUT = {
  house: { u: 5, v: 3, a: 2, b: 2 },
  bed: { u: 15.4, v: 4, a: 2, b: 1 },
  fence: { u: 8.3, v: 4.7, n: 3 },
  trees: [
    { u: 1.9, v: 2.5, s: 1.12 },
    { u: 21.5, v: 3.2, s: 0.96 },
    { u: 22.4, v: 11.5, s: 1.04 },
    { u: 4.2, v: 12.6, s: 0.9 },
  ],
  bushes: [
    { u: 3.3, v: 9.5, s: 0.94 },
    { u: 18.3, v: 9.0, s: 0.84 },
    { u: 10.2, v: 12.9, s: 0.8 },
  ],
  pathH: { v: 6, u0: 0, u1: 24 },
  pathV: { u: 13, v0: 6, v1: 15 },
  pond: { u: 19.1, v: 11.7, rx: 78, ry: 40 },
  bench: { u: 9.7, v: 8.7 },
  sign: { u: 15.2, v: 9.4 },
  flowers: [
    { u: 7.1, v: 5.6, s: 1.0 },
    { u: 7.9, v: 5.3, s: 0.8 },
    { u: 17.4, v: 5.7, s: 0.9 },
    { u: 12.1, v: 12.7, s: 0.85 },
    { u: 16.9, v: 8.8, s: 0.95 },
  ],
  slimes: [
    { u: 11.1, v: 5.2, s: 1.45 },
    { u: 16.4, v: 8.5, s: 1.1 },
  ],
};
const cx = (u) => u * T;
const baseY = (v) => v * T;

/* =====================================================================
   A · 晨雾绘本（水彩田园）
   ===================================================================== */
const A = (() => {
  const c = {
    paper: '#f8f2e0',
    grass: '#9cba6f',
    patch: ['#bcd48f', '#8aa963', '#7b9a58', '#a8c47d'],
    stroke: '#8aa768',
    path: '#d9c7a0', pathShade: '#c4b088', pathDot: '#b19c74',
    wall: '#f6e7c3', wallShade: '#e2cea3', wood: '#b98f65', woodDark: '#9a7450',
    roof: '#d07a58', roofDark: '#b15f42', roofLight: '#e29a79',
    leaf: '#8fb872', leafLight: '#a9cd8b', leafDark: '#6f9a5c',
    trunk: '#ab8a61',
    water: '#96c8cd', waterLight: '#b6dcdf', waterDeep: '#77aeb6',
    soil: '#b98f66', soilDark: '#9b7450',
    ink: '#6b6a4c', bloom: '#fff7dc', accent: '#e08a4a',
    slime: '#e9cb8e', slimeLight: '#f5ddaa', slimeInk: '#4a3a28',
  };
  const shadow = (x, y, rx, ry) => ell(x + 3, y + 2, rx, ry, '#5c7048', 0.16);

  const tree = (x, y, s) =>
    shadow(x, y, 34 * s, 11 * s) +
    line([[x, y - 4 * s], [x - 4 * s, y - 50 * s]], c.trunk, 10 * s) +
    blob(x - 2 * s, y - 68 * s, 38 * s, 32 * s, c.leaf, 1, 0.09, 0.3) +
    blob(x - 13 * s, y - 79 * s, 24 * s, 20 * s, c.leafLight, 0.9, 0.1, 1.9) +
    blob(x + 12 * s, y - 57 * s, 19 * s, 15 * s, c.leafDark, 0.6, 0.12, 2.6) +
    blob(x - 8 * s, y - 90 * s, 11 * s, 8 * s, c.leafLight, 0.5, 0.14, 4.1);

  const bush = (x, y, s) =>
    shadow(x, y, 20 * s, 7 * s) +
    blob(x, y - 12 * s, 19 * s, 14 * s, c.leaf, 1, 0.12, 1.1) +
    blob(x - 4 * s, y - 18 * s, 11 * s, 9 * s, c.leafLight, 0.8, 0.14, 3.3);

  const flower = (x, y, s, tint = c.bloom) =>
    line([[x, y], [x, y - 16 * s]], c.leafDark, 2 * s) +
    cir(x, y - 19 * s, 3.4 * s, tint) +
    [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return cir(x + Math.cos(a) * 6 * s, y - 19 * s + Math.sin(a) * 6 * s, 3.2 * s, tint, 0.95);
    }).join('') +
    cir(x, y - 19 * s, 2 * s, c.accent);

  const fence = (x, y, count) => {
    let g = shadow(x, y, count * 11, 5);
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 22;
      g += poly([[px - 3.6, y], [px - 3, y - 26], [px, y - 30], [px + 3, y - 26], [px + 3.6, y]], c.paper);
      g += poly([[px + 1, y], [px + 1, y - 25], [px + 3.6, y]], c.wallShade, 0.75);
    }
    g += line([[x - (count - 1) * 11 - 4, y - 19], [x + (count - 1) * 11 + 4, y - 19]], c.wallShade, 3);
    g += line([[x - (count - 1) * 11 - 4, y - 9], [x + (count - 1) * 11 + 4, y - 9]], c.wallShade, 3);
    return g;
  };

  const house = (x, y) => {
    let g = shadow(x, y, 52, 15);
    g += poly([[x - 44, y], [x - 42, y - 92], [x + 43, y - 92], [x + 45, y]], c.wall);
    g += poly([[x + 16, y - 92], [x + 43, y - 92], [x + 45, y], [x + 16, y]], c.wallShade, 0.6);
    g += poly([[x - 40, y - 92], [x - 40, y - 20], [x - 44, y], [x - 44, y - 88]], c.wallShade, 0.35);
    // 屋顶
    g += poly([[x - 57, y - 86], [x - 31, y - 136], [x + 31, y - 136], [x + 57, y - 86]], c.roof);
    g += poly([[x - 57, y - 86], [x - 31, y - 136], [x - 6, y - 136], [x - 14, y - 86]], c.roofLight, 0.75);
    g += poly([[x + 20, y - 86], [x + 31, y - 136], [x + 56, y - 126], [x + 57, y - 86]], c.roofDark, 0.55);
    g += line([[x - 58, y - 84], [x + 58, y - 84]], c.paper, 4.5);
    g += line([[x - 33, y - 134], [x + 33, y - 134]], c.roofLight, 3.5);
    for (let i = 0; i < 5; i++) g += line([[x - 50 + i * 5, y - 88], [x - 27 + i * 5, y - 128]], c.roofDark, 1.2, 0.3);
    // 烟囱与烟
    g += rec(x + 20, y - 158, 12, 28, c.roofDark);
    g += line([[x + 22, y - 160], [x + 20, y - 176], [x + 30, y - 186]], '#efe6d2', 3.5, 0.65);
    // 窗与门
    g += rec(x + 16, y - 74, 26, 24, c.woodDark, 1, 3);
    g += rec(x + 18, y - 72, 22, 20, c.bloom, 1, 2);
    g += line([[x + 29, y - 72], [x + 29, y - 52]], c.wood, 2) + line([[x + 18, y - 62], [x + 40, y - 62]], c.wood, 2);
    g += rec(x - 15, y - 54, 28, 54, c.wood, 1, 4);
    g += rec(x - 11, y - 50, 20, 50, c.woodDark, 0.85, 3);
    g += cir(x + 5, y - 24, 1.8, c.roofLight);
    g += rec(x - 22, y - 6, 44, 7, '#cfc7b3', 1, 3);
    g += line([[x - 30, y - 68], [x - 20, y - 89]], c.leafDark, 3.4) + cir(x - 20, y - 89, 3, c.accent);
    return g;
  };

  const cropBed = (x, y) => {
    let g = shadow(x, y, 44, 13);
    g += rrect(x - 44, y - 34, 88, 34, 4, c.soil);
    g += rrect(x - 44, y - 34, 88, 8, 3, c.soilDark, 0.7);
    g += rrect(x - 40, y - 30, 80, 4, 2, '#8a6a52', 0.35);
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 5; i++) {
        const px = x - 28 + i * 14, py = y - 26 + r * 8;
        g += line([[px, py], [px, py - 7]], c.leafDark, 1.6);
        g += blob(px - 2.4, py - 8, 3.6, 2.6, c.leafLight, 0.95, 0.2, i);
        g += blob(px + 2.4, py - 8, 3.6, 2.6, c.leaf, 0.95, 0.2, i + 1);
      }
    return g;
  };

  const pond = (x, y, rx, ry) => {
    let g = ell(x, y + 4, rx + 8, ry + 6, '#7d9a63', 0.18);
    g += blob(x, y, rx, ry, c.waterDeep, 1, 0.05, 1.3);
    g += blob(x - 4, y - 2, rx - 9, ry - 6, c.water, 1, 0.06, 0.4);
    g += blob(x - 12, y - 6, rx * 0.5, ry * 0.45, c.waterLight, 0.5, 0.1, 2.2);
    for (let i = 0; i < 3; i++) g += line([[x - 40 + i * 22, y + 2 + i * 6], [x - 22 + i * 22, y - 2 + i * 6]], c.waterLight, 2.4, 0.65);
    g += ell(x + 22, y - 10, 11, 6, c.leaf, 0.95) + line([[x + 22, y - 10], [x + 30, y - 13]], c.leafDark, 1.4);
    g += line([[x - rx + 8, y - 4], [x - rx + 4, y - 34]], c.leafDark, 2.4) + line([[x - rx + 16, y - 2], [x - rx + 20, y - 26]], c.leaf, 2.2);
    return g;
  };

  const bench = (x, y) => {
    let g = shadow(x, y, 26, 8);
    g += line([[x - 18, y], [x - 16, y - 22]], c.woodDark, 4) + line([[x + 18, y], [x + 16, y - 22]], c.woodDark, 4);
    g += rrect(x - 24, y - 28, 48, 8, 3, c.wood);
    g += rec(x - 16, y - 34, 10, 7, c.bloom, 1, 2) + rec(x + 2, y - 33, 8, 6, c.water, 1, 2);
    return g;
  };

  const sign = (x, y) => {
    let g = shadow(x, y, 12, 5);
    g += line([[x, y], [x, y - 30]], c.woodDark, 3.4);
    g += rrect(x - 15, y - 44, 30, 17, 3, c.wood);
    g += line([[x - 9, y - 37], [x + 9, y - 37]], c.paper, 2.2, 0.9);
    return g;
  };

  const slime = (x, y, s, accent = c.accent) => {
    let g = ell(x, y, 19 * s, 6.5 * s, '#5c7048', 0.2);
    g += blob(x, y - 15 * s, 18 * s, 15 * s, c.slime, 1, 0.05, 0.9);
    g += blob(x - 5 * s, y - 22 * s, 9 * s, 7 * s, c.slimeLight, 0.85, 0.1, 3.4);
    g += cir(x - 6 * s, y - 17 * s, 2.6 * s, c.slimeInk) + cir(x + 6 * s, y - 17 * s, 2.6 * s, c.slimeInk);
    g += cir(x - 6.8 * s, y - 18 * s, 1 * s, '#fffaf0') + cir(x + 5.2 * s, y - 18 * s, 1 * s, '#fffaf0');
    g += line([[x - 3 * s, y - 11 * s], [x, y - 9 * s], [x + 3 * s, y - 11 * s]], c.slimeInk, 1.5 * s, 0.8);
    return g;
  };

  const ground = () => {
    let g = rec(0, 0, 24 * T, 15 * T, c.grass);
    g += `<g filter="url(#aSoft)">`;
    g += blob(cx(4), baseY(3.4), 168, 104, c.patch[0], 0.55, 0.16, 0.4);
    g += blob(cx(17), baseY(2.6), 182, 98, c.patch[1], 0.5, 0.16, 2.1);
    g += blob(cx(20), baseY(10), 172, 112, c.patch[0], 0.45, 0.16, 3.6);
    g += blob(cx(6), baseY(11.6), 160, 100, c.patch[2], 0.5, 0.16, 5.1);
    g += blob(cx(12), baseY(8.2), 196, 104, c.patch[3], 0.32, 0.16, 1.2);
    g += `</g>`;
    // 割草留下的浅色宽带
    for (let i = 0; i < 4; i++)
      g += poly([[cx(0), baseY(1.2 + i * 3.3)], [cx(24), baseY(0.2 + i * 3.3)], [cx(24), baseY(1.7 + i * 3.3)], [cx(0), baseY(2.7 + i * 3.3)]], '#d3e2ac', 0.08);
    // 草叶与小花
    for (let i = 0; i < 90; i++) {
      const x = ((i * 197) % 1120) + 16, y = ((i * 331) % 700) + 20;
      if (Math.abs(y - baseY(6.5)) < 40) continue;
      g += line([[x, y], [x - 1.5, y - 5]], c.stroke, 1.4, 0.5);
    }
    for (let i = 0; i < 26; i++) {
      const x = ((i * 271) % 1100) + 20, y = ((i * 149) % 690) + 16;
      g += cir(x, y, 1.8, i % 3 ? c.bloom : '#f6dfa0', 0.85);
    }
    return g;
  };

  const pathRoad = () => {
    const y0 = baseY(6), h = T;
    const vx = cx(13), w = T;
    let g = poly([[0, y0 + 4], [24 * T, y0 + 2], [24 * T, y0 + h + 2], [0, y0 + h + 5]], c.path);
    g += poly([[vx + w - 4, y0 + h - 6], [vx + w + 3, y0 + h - 6], [vx + w + 4, 15 * T], [vx + w - 3, 15 * T]], c.path);
    g += poly([[vx + 1, y0 + h - 8], [vx + w - 2, y0 + h - 8], [vx + w - 1, 15 * T], [vx, 15 * T]], c.path);
    // 路缘与石子
    g += line([[0, y0 + 3], [24 * T, y0 + 1]], c.pathShade, 2.4, 0.9);
    g += line([[0, y0 + h + 4], [24 * T, y0 + h + 3]], c.pathShade, 2.6, 0.75);
    for (let i = 0; i < 26; i++) {
      const x = ((i * 223) % 1130) + 12, y = y0 + 12 + ((i * 97) % 26);
      g += cir(x, y, 1.6 + (i % 3) * 0.5, c.pathDot, 0.55);
    }
    for (let i = 0; i < 10; i++) {
      const y = y0 + h + 18 + i * 40;
      g += cir(vx + 10 + (i * 53) % 28, y, 1.7, c.pathDot, 0.5);
    }
    // 路缘被草啃过：边缘长回来的草块，破掉"胶带"感
    for (let i = 0; i < 16; i++) {
      const x = ((i * 173) % 1140) + 8, wob = (i % 4) * 1.6;
      g += blob(x, y0 + 3 - wob, 13 + (i % 3) * 4, 5.5, c.grass, 1, 0.22, i * 0.7);
      g += blob(x + 34, y0 + h + 4 + wob, 11 + (i % 4) * 4, 5, c.grass, 1, 0.22, i * 1.3);
    }
    for (let i = 0; i < 6; i++) {
      const y = y0 + h + 30 + i * 62, x = vx + (i % 2 ? -14 : w + 10);
      g += blob(x, y, 9, 4.5, c.grass, 1, 0.2, i * 1.9);
    }
    for (let i = 0; i < 8; i++) {
      const x = 30 + ((i * 291) % 1080), y = y0 + 16 + ((i * 61) % 20);
      g += ell(x, y, 4.4 + (i % 3), 2.8, c.pathDot, 0.75) + line([[x - 3, y], [x + 3, y + 1]], c.pathShade, 1, 0.5);
    }
    return g;
  };

  const scene = () => {
    let g = ground() + pathRoad() + pond(cx(19.1), baseY(11.7), 78, 40);
    const items = [];
    for (const t of LAYOUT.trees) items.push([baseY(t.v), tree(cx(t.u), baseY(t.v), t.s)]);
    for (const b of LAYOUT.bushes) items.push([baseY(b.v), bush(cx(b.u), baseY(b.v), b.s)]);
    items.push([baseY(LAYOUT.fence.v), fence(cx(LAYOUT.fence.u), baseY(LAYOUT.fence.v), LAYOUT.fence.n)]);
    items.push([baseY(5), house(cx(6), baseY(5))]);
    items.push([baseY(5), cropBed(cx(16.4), baseY(5))]);
    for (const f of LAYOUT.flowers) items.push([baseY(f.v), flower(cx(f.u), baseY(f.v), f.s)]);
    items.push([baseY(LAYOUT.bench.v), bench(cx(LAYOUT.bench.u), baseY(LAYOUT.bench.v))]);
    items.push([baseY(LAYOUT.sign.v), sign(cx(LAYOUT.sign.u), baseY(LAYOUT.sign.v))]);
    for (const s of LAYOUT.slimes) items.push([baseY(s.v), slime(cx(s.u), baseY(s.v), s.s)]);
    items.sort((p, q) => p[0] - q[0]);
    g += items.map((i) => i[1]).join('');
    // 晨光：左上角奶油色柔光 + 纸张颗粒
    g += rec(0, 0, 24 * T, 15 * T, 'url(#aLight)');
    g += `<rect width="${24 * T}" height="${15 * T}" filter="url(#aGrain)" opacity=".2" style="mix-blend-mode:multiply"/>`;
    g += `<rect width="${24 * T}" height="${15 * T}" fill="url(#aVig)"/>`;
    return `<svg viewBox="0 0 1152 720" xmlns="http://www.w3.org/2000/svg"><defs>
      <filter id="aSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
      <filter id="aGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="9"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.09"/></feComponentTransfer></filter>
      <radialGradient id="aVig" cx="0.45" cy="0.42" r="0.82"><stop offset=".55" stop-color="#6f8a5a" stop-opacity="0"/><stop offset="1" stop-color="#6f8a5a" stop-opacity=".16"/></radialGradient>
      <radialGradient id="aLight" cx="0.3" cy="0.1" r="0.95"><stop stop-color="#fff4d2" stop-opacity=".12"/><stop offset="1" stop-color="#fff4d2" stop-opacity="0"/></radialGradient>
    </defs>${g}<rect class="veil" width="1152" height="720" fill="#2b3a55" style="--veil:.55;mix-blend-mode:multiply"/>
      <g class="lit">${cir(cx(6) + 29, baseY(5) - 62, 26, '#ffd98a', 0.28)}${cir(cx(6) + 29, baseY(5) - 62, 12, '#ffeab0', 0.5)}
      ${cir(cx(7.5), baseY(5.7) - 19, 14, '#ffd98a', 0.3)}${cir(cx(12.1), baseY(12.7) - 19, 12, '#ffd98a', 0.25)}</g></svg>`;
  };

  const assets = () => [
    { label: '小屋（受光面与背面同色，不描黑线）', vb: '-70 -180 140 195', g: house(0, 0) },
    { label: '树（三块水彩色，边缘微抖）', vb: '-52 -110 104 125', g: tree(0, 0, 1) },
    { label: '灌木', vb: '-40 -46 80 56', g: bush(0, 0, 1) },
    { label: '围栏（米白纸木）', vb: '-46 -44 92 54', g: fence(0, 0, 3) },
    { label: '菜畦（陶土色土面）', vb: '-52 -44 104 56', g: cropBed(0, 0) },
    { label: '伙伴（保持原形体，只调环境光）', vb: '-34 -42 68 52', g: slime(0, 0, 1) },
  ];

  return {
    key: 'a', idx: 'A', name: '晨雾绘本', sub: '水彩田园 · Gouache storybook',
    thesis: '把地面画成一片，而不是铺出来的一格一格；颜色像奶油颜料，边缘留一笔手抖，光很软。',
    tags: [['改动量', '中'], ['风险', '低'], ['差异度', '中']],
    pros: ['最贴近现在的气质，老玩家不觉得换了个游戏', '柔和色温 + 纸纹让 320px 手机上依然干净', '史莱姆本体原样放进来毫无违和'],
    cons: ['手绘感要靠大量微抖动与散布细节，逐件手工调色', '细节变多后，小屋、围栏的辨识度要靠轮廓控制'],
    scene, assets,
    palette: [['草地', '#9cba6f'], ['草地深', '#7b9a58'], ['屋顶', '#d07a58'], ['墙', '#f6e7c3'], ['木', '#b98f65'], ['水', '#96c8cd'], ['土', '#b98f66'], ['天光', '#fff4d2'], ['夜纱', '#2b3a55']],
    mapRules: ['草地：整片色块 + 16px 高斯模糊的色斑，禁止逐格棋盘', '路面：连续多边形，路缘 2px 深色描边，碎石点随机 26 颗', '建筑：只画受光面（左前）与暗面（右前），不描黑边', '阴影：椭圆 16% 深绿，向右下偏移 3px', '装饰密度：每 3 格最多一丛草叶，留出大片呼吸区'],
    assetRules: ['轮廓：每件素材用 3 个色阶（亮/中/暗），不加描边', '抖动：blob() 半径 ±10% 正弦起伏，同一素材参数固定', '共享色板 9 色，只能从色板取色', '颗粒：整场景一层 feTurbulence，不逐件叠加'],
    ui: ['面板：米白纸底 #f8f2e0，1px 茶墨边', '按钮：无阴影，按下位移 1px', '强调色：陶土橙 #e08a4a，只用于当前选中'],
    motion: ['草叶 4s 微摆（transform 幅度 1px）', '夜里窗光呼吸 6s', '点击物件：影子先收缩再回弹 120ms'],
  };
})();

/* =====================================================================
   B · 萤火夜庭（微光生态）
   ===================================================================== */
const B = (() => {
  const c = {
    deep: '#152639', ground: '#1b3348', moss: '#22463c', mossLit: '#2c5349',
    sil: '#0a1526', sil2: '#102337', rim: '#5fa892', rimCool: '#6fa8c0',
    mint: '#9df0cf', amber: '#ffc271', cyan: '#7fd4ff',
    water: '#0d2739', waterLit: '#3f8ea0', path: '#253e57', pathLit: '#3d5f79',
    slime: '#d9a86b', slimeLit: '#ffd9a0',
  };
  const bp = (x, y, rx, ry, wob = 0.08, ph = 1, seg = 22) => {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const k = 1 + wob * (Math.sin(a * 2 + ph) * 0.6 + Math.sin(a * 3 + ph * 2.1) * 0.4);
      pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  const dOf = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
  /** 暗剪影 + 左上轮廓光：底层画轮廓色，内层向右下偏 2px 盖住。 */
  const rimFill = (pts, fill, rim, d = 2) =>
    `<path d="${dOf(pts)}" fill="${rim}"/><path d="${dOf(pts.map(([x, y]) => [x + d, y + d]))}" fill="${fill}"/>`;
  const halo = (x, y, r, col, o = 0.55) => `<g class="bglow">${cir(x, y, r * 2.6, col, o * 0.32)}${cir(x, y, r * 1.5, col, o * 0.5)}</g>`;

  const tree = (x, y, s) => {
    const lobes = [
      [x - 1 * s, y - 70 * s, 27 * s, 23 * s, 0.6],
      [x - 17 * s, y - 60 * s, 17 * s, 15 * s, 2.1],
      [x + 16 * s, y - 58 * s, 15 * s, 13 * s, 4.4],
      [x - 3 * s, y - 85 * s, 14 * s, 12 * s, 1.2],
    ];
    let g = ell(x + 3, y + 2, 30 * s, 9 * s, '#000a12', 0.35);
    g += line([[x, y - 4 * s], [x - 3 * s, y - 52 * s]], c.sil, 8 * s);
    g += line([[x - 2.4 * s, y - 6 * s], [x - 5 * s, y - 48 * s]], c.rim, 0.9, 0.4);
    for (const [lx, ly, rx, ry, ph] of lobes) g += `<path d="${dOf(bp(lx, ly, rx, ry, 0.16, ph))}" fill="${c.rim}"/>`;
    for (const [lx, ly, rx, ry, ph] of lobes) g += `<path d="${dOf(bp(lx + 1.5, ly + 1.6, rx, ry, 0.16, ph))}" fill="${c.sil}"/>`;
    g += `<path d="${dOf(bp(x - 12 * s, y - 78 * s, 15 * s, 11 * s, 0.1, 2.4))}" fill="${c.mossLit}" opacity=".28"/>`;
    g += `<path d="${dOf(bp(x + 10 * s, y - 62 * s, 9 * s, 7 * s, 0.1, 5))}" fill="${c.mossLit}" opacity=".22"/>`;
    g += line([[x - 26 * s, y - 76 * s], [x - 8 * s, y - 96 * s]], c.mint, 1.5, 0.35);
    g += halo(x - 14 * s, y - 88 * s, 1.9, c.mint, 0.7) + halo(x + 13 * s, y - 56 * s, 1.4, c.mint, 0.55);
    return g;
  };

  const bush = (x, y, s) => {
    let g = ell(x + 2, y + 1, 19 * s, 6 * s, '#000a12', 0.4);
    g += rimFill(bp(x, y - 13 * s, 19 * s, 14 * s, 0.12, 1.4), c.sil, c.rim, 1.8);
    g += halo(x + 6 * s, y - 16 * s, 1.6, c.mint, 0.7);
    return g;
  };

  const flower = (x, y, s) =>
    line([[x, y], [x, y - 15 * s]], c.moss, 1.8 * s) +
    halo(x, y - 19 * s, 2.2 * s, c.mint, 0.9) +
    cir(x, y - 19 * s, 2.4 * s, '#e8fff4') +
    [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return `<g class="bglow">${cir(x + Math.cos(a) * 5.5 * s, y - 19 * s + Math.sin(a) * 5.5 * s, 2.6 * s, c.mint, 0.45)}</g>`;
    }).join('');

  const fence = (x, y, count) => {
    let g = ell(x, y + 1, count * 11, 4, '#000a12', 0.4);
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 22;
      g += poly([[px - 3.6, y], [px - 3, y - 26], [px, y - 30], [px + 3, y - 26], [px + 3.6, y]], c.sil);
      g += line([[px - 3.4, y - 2], [px - 3, y - 27]], c.rimCool, 1.1, 0.75);
    }
    g += line([[x - (count - 1) * 11 - 4, y - 19], [x + (count - 1) * 11 + 4, y - 19]], c.sil, 3);
    g += line([[x - (count - 1) * 11 - 4, y - 19], [x + (count - 1) * 11 + 4, y - 19]], c.rimCool, 0.9, 0.45);
    return g;
  };

  const house = (x, y) => {
    let g = ell(x + 4, y + 3, 54, 16, '#000a12', 0.5);
    // 屋内透到地面的暖光
    g += `<g class="bglow">${ell(x + 2, y + 6, 40, 14, c.amber, 0.16)}${ell(x - 24, y + 2, 16, 6, c.amber, 0.12)}</g>`;
    g += poly([[x - 44, y], [x - 42, y - 92], [x + 43, y - 92], [x + 45, y]], c.sil);
    g += poly([[x + 18, y - 92], [x + 43, y - 92], [x + 45, y], [x + 18, y]], '#1a3348');
    g += line([[x - 42.5, y - 6], [x - 41.5, y - 90]], c.rim, 1.4, 0.7);
    // 屋顶
    g += poly([[x - 57, y - 86], [x - 31, y - 136], [x + 31, y - 136], [x + 57, y - 86]], c.sil2);
    g += line([[x - 58, y - 85], [x - 31, y - 137], [x + 31, y - 137], [x + 58, y - 85]], c.rimCool, 1.7, 0.85);
    g += line([[x - 34, y - 133], [x + 34, y - 133]], c.mint, 1.4, 0.4);
    g += rec(x + 20, y - 158, 12, 28, c.sil2);
    g += `<g class="bglow">${cir(x + 26, y - 168, 15, '#cfe6ee', 0.14)}${cir(x + 22, y - 178, 11, '#cfe6ee', 0.1)}</g>`;
    // 门与窗
    g += rec(x - 15, y - 54, 28, 54, c.sil2);
    g += rec(x - 11, y - 50, 20, 50, '#3a2e26');
    g += `<g class="bglow">${cir(x - 1, y - 26, 30, c.amber, 0.2)}${cir(x - 1, y - 26, 17, c.amber, 0.3)}</g>`;
    g += rec(x - 9, y - 46, 16, 40, c.amber, 0.55, 2);
    g += rec(x + 16, y - 74, 26, 24, c.sil2, 1, 3);
    g += rec(x + 18, y - 72, 22, 20, c.amber, 0.9, 2);
    g += `<g class="bglow">${cir(x + 29, y - 62, 30, c.amber, 0.22)}${cir(x + 29, y - 62, 14, c.amber, 0.34)}</g>`;
    g += line([[x + 29, y - 72], [x + 29, y - 52]], c.sil2, 1.6) + line([[x + 18, y - 62], [x + 40, y - 62]], c.sil2, 1.6);
    g += rec(x - 22, y - 6, 44, 7, c.sil2, 1, 3);
    g += line([[x - 22, y - 5.5], [x + 22, y - 5.5]], c.rimCool, 1, 0.4);
    return g;
  };

  const cropBed = (x, y) => {
    let g = ell(x, y + 2, 44, 12, '#000a12', 0.4);
    g += rrect(x - 44, y - 34, 88, 34, 4, c.sil2);
    g += line([[x - 44, y - 33], [x + 44, y - 33]], c.rimCool, 1.2, 0.5);
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 5; i++) {
        const px = x - 28 + i * 14, py = y - 26 + r * 8;
        g += line([[px, py], [px, py - 7]], c.moss, 1.5);
        g += `<g class="bglow">${cir(px, py - 9, 8, c.mint, 0.14)}${cir(px, py - 9, 3.4, c.mint, 0.5)}</g>`;
        g += cir(px, py - 9, 1.5, '#e9fff6', 0.85);
      }
    return g;
  };

  const pond = (x, y, rx, ry) => {
    let g = `<g class="bglow">${ell(x, y + 2, rx + 12, ry + 11, c.cyan, 0.14)}</g>`;
    g += `<path d="${dOf(bp(x, y, rx, ry, 0.05, 1.3))}" fill="#143a4c"/>`;
    g += `<path d="${dOf(bp(x - 3, y - 4, rx - 10, ry - 8, 0.06, 2.2))}" fill="#1d5364"/>`;
    g += `<path d="${dOf(bp(x, y, rx, ry, 0.05, 1.3))}" fill="none" stroke="${c.cyan}" stroke-width="1.6" opacity=".7"/>`;
    for (let i = 0; i < 4; i++) g += line([[x - 46 + i * 24, y - 6 + i * 8], [x - 20 + i * 22, y - 10 + i * 8]], '#9fe3ff', 2.2, 0.55);
    g += `<g class="bglow">${cir(x + 16, y - 8, 14, c.cyan, 0.2)}</g>` + ell(x + 16, y - 8, 8, 4, c.waterLit, 0.9);
    g += line([[x - rx + 6, y - 2], [x - rx + 3, y - 32]], c.sil, 2.4) + halo(x - rx + 4, y - 34, 1.8, c.mint, 0.6);
    g += line([[x - rx + 14, y], [x - rx + 18, y - 24]], c.sil, 2) + halo(x - rx + 18, y - 26, 1.6, c.mint, 0.5);
    return g;
  };

  const bench = (x, y) => {
    let g = ell(x, y + 1, 26, 6, '#000a12', 0.4);
    g += line([[x - 18, y], [x - 16, y - 22]], c.sil, 4) + line([[x + 18, y], [x + 16, y - 22]], c.sil, 4);
    g += rrect(x - 24, y - 28, 48, 8, 3, c.sil2);
    g += line([[x - 24, y - 27.5], [x + 24, y - 27.5]], c.rim, 1, 0.6);
    g += halo(x + 6, y - 31, 1.6, c.amber, 0.9) + cir(x + 6, y - 31, 1.6, '#ffe2b0');
    return g;
  };

  const sign = (x, y) => {
    let g = ell(x, y + 1, 12, 4, '#000a12', 0.4);
    g += line([[x, y], [x, y - 30]], c.sil, 3.4);
    g += rrect(x - 15, y - 44, 30, 17, 3, c.sil2);
    g += line([[x - 15, y - 43.5], [x + 15, y - 43.5]], c.rimCool, 1, 0.6);
    g += halo(x + 4, y - 36, 2, c.mint, 0.5);
    return g;
  };

  const slime = (x, y, s) => {
    let g = ell(x, y, 19 * s, 6.5 * s, '#000a12', 0.5);
    g += `<g class="bglow">${ell(x, y - 15 * s, 30 * s, 26 * s, c.amber, 0.14)}</g>`;
    g += rimFill(bp(x, y - 15 * s, 18 * s, 15 * s, 0.05, 0.9), c.slime, c.mint, 1.2 * s);
    g += `<path d="${dOf(bp(x - 5 * s, y - 22 * s, 8 * s, 6 * s, 0.1, 3.4))}" fill="${c.slimeLit}" opacity=".75"/>`;
    g += cir(x - 6 * s, y - 17 * s, 2.5 * s, '#1a1410') + cir(x + 6 * s, y - 17 * s, 2.5 * s, '#1a1410');
    g += cir(x - 6.8 * s, y - 18 * s, 1 * s, '#fff6df') + cir(x + 5.2 * s, y - 18 * s, 1 * s, '#fff6df');
    return g;
  };

  const ground = () => {
    let g = rec(0, 0, 24 * T, 15 * T, c.deep);
    g += `<g filter="url(#bSoft)">`;
    g += blob(cx(5), baseY(3.2), 210, 130, c.ground, 0.8, 0.18, 0.4);
    g += blob(cx(18), baseY(3), 200, 120, c.moss, 0.55, 0.18, 2.2);
    g += blob(cx(6), baseY(12), 210, 130, c.moss, 0.5, 0.18, 4.1);
    g += blob(cx(19), baseY(11.6), 190, 120, c.ground, 0.7, 0.18, 1.1);
    g += `</g>`;
    // 夜露、孢子
    for (let i = 0; i < 70; i++) {
      const x = ((i * 199) % 1120) + 16, y = ((i * 337) % 700) + 20;
      g += line([[x, y], [x - 1.5, y - 6]], '#3f6a63', 1.4, 0.55);
    }
    for (let i = 0; i < 26; i++) {
      const x = ((i * 263) % 1100) + 24, y = ((i * 151) % 690) + 16;
      g += `<g class="bglow">${cir(x, y, 3.4, c.mint, 0.12)}${cir(x, y, 1.5, '#dffdf0', 0.7)}</g>`;
    }
    return g;
  };

  const pathRoad = () => {
    const y0 = baseY(6);
    let g = poly([[0, y0 + 4], [24 * T, y0 + 2], [24 * T, y0 + T + 2], [0, y0 + T + 5]], c.path);
    g += poly([[cx(13) + T - 4, y0 + T - 6], [cx(13) + T + 3, y0 + T - 6], [cx(13) + T + 4, 15 * T], [cx(13) + T - 3, 15 * T]], c.path);
    g += line([[0, y0 + 3], [24 * T, y0 + 1]], c.pathLit, 2, 0.8);
    g += line([[0, y0 + T + 4], [24 * T, y0 + T + 3]], '#0e2033', 3, 0.6);
    // 路缘咬合：短草刺与碎石打断直边
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137) % 1130) + 10, y = y0 + 2 + (i % 3) * 2;
      g += line([[x, y], [x - 2, y - 7]], '#2f5a55', 1.6, 0.55);
      g += line([[x + 22, y0 + T + 3], [x + 20, y0 + T + 11]], '#2f5a55', 1.4, 0.45);
    }
    for (let i = 0; i < 22; i++) {
      const x = ((i * 227) % 1130) + 12, y = y0 + 12 + ((i * 91) % 26);
      g += `<g class="bglow">${cir(x, y, 3, c.cyan, 0.1)}</g>${cir(x, y, 1.4, '#bfe8ff', 0.55)}`;
    }
    for (let i = 0; i < 8; i++) g += `<g class="bglow">${cir(cx(13) + 12 + (i * 47) % 26, y0 + T + 20 + i * 46, 3, c.cyan, 0.1)}</g>${cir(cx(13) + 12 + (i * 47) % 26, y0 + T + 20 + i * 46, 1.4, '#bfe8ff', 0.5)}`;
    return g;
  };

  const scene = () => {
    let g = ground() + pathRoad() + pond(cx(19.1), baseY(11.7), 78, 40);
    const items = [];
    for (const t of LAYOUT.trees) items.push([baseY(t.v), tree(cx(t.u), baseY(t.v), t.s)]);
    for (const b of LAYOUT.bushes) items.push([baseY(b.v), bush(cx(b.u), baseY(b.v), b.s)]);
    items.push([baseY(LAYOUT.fence.v), fence(cx(LAYOUT.fence.u), baseY(LAYOUT.fence.v), LAYOUT.fence.n)]);
    items.push([baseY(5), house(cx(6), baseY(5))]);
    items.push([baseY(5), cropBed(cx(16.4), baseY(5))]);
    for (const f of LAYOUT.flowers) items.push([baseY(f.v), flower(cx(f.u), baseY(f.v), f.s)]);
    items.push([baseY(LAYOUT.bench.v), bench(cx(LAYOUT.bench.u), baseY(LAYOUT.bench.v))]);
    items.push([baseY(LAYOUT.sign.v), sign(cx(LAYOUT.sign.u), baseY(LAYOUT.sign.v))]);
    for (const s of LAYOUT.slimes) items.push([baseY(s.v), slime(cx(s.u), baseY(s.v), s.s)]);
    items.sort((p, q) => p[0] - q[0]);
    g += items.map((i) => i[1]).join('');
    // 萤火虫
    let flies = '';
    for (let i = 0; i < 18; i++) {
      const x = 60 + ((i * 271) % 1040), y = 120 + ((i * 173) % 540);
      flies += `<g class="bglow">${cir(x, y, 7, c.mint, 0.13)}${cir(x, y, 2.6, '#e8fff4', 0.55)}</g>`;
    }
    g += flies;
    g += `<rect width="1152" height="720" fill="url(#bVig)"/>`;
    return `<svg viewBox="0 0 1152 720" xmlns="http://www.w3.org/2000/svg"><defs>
      <filter id="bSoft" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="22"/></filter>
      <radialGradient id="bVig" cx="0.5" cy="0.45" r="0.78"><stop offset=".55" stop-color="#04101c" stop-opacity="0"/><stop offset="1" stop-color="#04101c" stop-opacity=".55"/></radialGradient>
      <linearGradient id="bDawn" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe4b0" stop-opacity=".3"/><stop offset=".55" stop-color="#cfe0cf" stop-opacity=".15"/><stop offset="1" stop-color="#7f9a92" stop-opacity=".1"/></linearGradient>
    </defs>${g}<g class="dawn"><rect width="1152" height="720" fill="url(#bDawn)"/></g></svg>`;
  };

  const assets = () => [
    { label: '小屋（暗剪影 + 屋顶轮廓光 + 窗户 bloom）', vb: '-70 -180 140 195', g: house(0, 0) },
    { label: '树（剪影 + 孢子）', vb: '-52 -110 104 125', g: tree(0, 0, 1) },
    { label: '灌木', vb: '-40 -46 80 56', g: bush(0, 0, 1) },
    { label: '围栏（1px 冷边光）', vb: '-46 -44 92 54', g: fence(0, 0, 3) },
    { label: '菜畦（作物自带发光）', vb: '-52 -44 104 56', g: cropBed(0, 0) },
    { label: '伙伴（被环境光染成琥珀色小灯）', vb: '-34 -42 68 52', g: slime(0, 0, 1) },
  ];

  return {
    key: 'b', idx: 'B', name: '萤火夜庭', sub: '微光生态 · Bioluminescent garden',
    thesis: '把「白天经营、夜里收光」做成主循环的画面证据：夜里全压成剪影，只留轮廓光和发光作物。',
    tags: [['改动量', '中高'], ['风险', '中'], ['差异度', '高']],
    pros: ['差异化最强，截图一眼能认出来', '发光作物、窗户、萤火虫给夜晚经营一个可看的理由', '剪影画法元素少、帧率友好'],
    cons: ['白天需要另一套配色（雾光），等于设计两个场景', '320px 小屏上暗色细节容易糊，必须靠亮块分层', '现有素材几乎全部要重画为剪影'],
    scene, assets,
    palette: [['夜底', '#152639'], ['苔绿', '#22463c'], ['剪影', '#0a1526'], ['轮廓光', '#5fa892'], ['萤光', '#9df0cf'], ['琥珀', '#ffc271'], ['水光', '#7fd4ff'], ['晨雾', '#ffe4b0'], ['雾绿', '#cfe0cf']],
    mapRules: ['夜色为默认：地面大面积深色，留 1/3 面积给发光物', '地面纹理只保留极暗的短线段，靠亮块分层次', '路面加冷色高光边和发光碎石，作为夜里的行走引导', '边缘加 55% 径向压暗，形成「被灯照到的一圈」', '白天用雾光覆盖层切换，不重画素材'],
    assetRules: ['主体一律暗剪影，1–2px 轮廓光只在左上受光边', '每个光源两圈：实心核心 + 模糊光晕（同一 filter 复用）', '发光物不超过场景面积的 15%，否则失去夜晚感', '阴影比暗面更深，避免剪影糊成一团'],
    ui: ['面板：深底半透明 #101d2b / 85%，1px 冷边', '文字：骨白 #e7e2cf，次要信息 #7f9a9c', '强调色：萤光薄荷 #9df0cf；危险/消耗用琥珀'],
    motion: ['萤火虫 7–11s 不规律漂移', '发光作物随生长进度增亮', '灯与窗呼吸 6s，幅度只到 8%'],
  };
})();

/* =====================================================================
   C · 纸艺立体书（Paper diorama）
   ===================================================================== */
const C = (() => {
  const c = {
    sheet: '#d8e0b2', patch1: '#c6d5a0', patch2: '#a9c082', sageD: '#86a06c',
    cream: '#fbf3e2', creamD: '#e9dcc0',
    terra: '#cf7458', terraD: '#b25e46',
    teal: '#6a9aa2', tealL: '#a6cdd4',
    mustard: '#e3b464', plum: '#8f7ba0', ink: '#39413a', wood: '#b08a66',
  };
  /** 纸厚：0 模糊的 drop-shadow，等于一层硬投影。 */
  const paper = (inner, d = 4, o = 0.2) => `<g style="filter:drop-shadow(${d}px ${d}px 0 rgba(44,51,44,${o}))">${inner}</g>`;
  const edge = (pts, col = 'rgba(44,51,44,.22)', w = 1.4) =>
    `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>`;
  const cutShadow = (x, y, rx, ry) => ell(x + 2, y + 2, rx, ry, '#39413a', 0.13);

  const tree = (x, y, s) => {
    let g = cutShadow(x, y, 28 * s, 8 * s);
    g += paper(line([[x, y], [x - 2 * s, y - 46 * s]], c.wood, 8 * s));
    g += paper(blob(x, y - 62 * s, 35 * s, 30 * s, c.sageD, 1, 0.07, 0.5), 6, 0.22);
    g += blob(x - 4 * s, y - 69 * s, 25 * s, 20 * s, c.patch2, 1, 0.09, 2.2);
    g += blob(x + 9 * s, y - 52 * s, 15 * s, 11 * s, c.sageD, 0.85, 0.1, 4.4);
    g += line([[x - 21 * s, y - 73 * s], [x - 3 * s, y - 87 * s]], '#ffffff', 2, 0.5);
    return g;
  };
  const bush = (x, y, s) =>
    cutShadow(x, y, 18 * s, 5 * s) +
    paper(blob(x, y - 12 * s, 18 * s, 13 * s, c.patch2, 1, 0.1, 1.6), 3.5) +
    blob(x - 3 * s, y - 17 * s, 10 * s, 8 * s, c.patch1, 1, 0.12, 3.2) +
    line([[x - 9 * s, y - 18 * s], [x - 2 * s, y - 24 * s]], '#ffffff', 1.4, 0.45);
  const flower = (x, y, s) =>
    line([[x, y], [x, y - 15 * s]], c.patch2, 2 * s) +
    paper([0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 - 0.3;
      return cir(x + Math.cos(a) * 6 * s, y - 19 * s + Math.sin(a) * 6 * s, 3.4 * s, c.cream);
    }).join(''), 2.5, 0.18) +
    cir(x, y - 19 * s, 2.4 * s, c.mustard);
  const fence = (x, y, count) => {
    let inner = '';
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 22;
      inner += poly([[px - 4, y], [px - 4, y - 24], [px, y - 30], [px + 4, y - 24], [px + 4, y]], c.cream);
    }
    inner += rec(x - (count - 1) * 11 - 6, y - 20, (count - 1) * 22 + 12, 4, c.cream);
    return cutShadow(x, y, count * 11, 4) + paper(inner, 3.5, 0.18);
  };
  const house = (x, y) => {
    let inner = poly([[x - 44, y], [x - 42, y - 92], [x + 43, y - 92], [x + 45, y]], c.cream);
    inner += poly([[x + 16, y - 92], [x + 43, y - 92], [x + 45, y], [x + 16, y]], c.creamD);
    // 屋顶两个平面（左亮右暗，折线清楚）
    inner += poly([[x - 57, y - 86], [x - 31, y - 136], [x - 4, y - 136], [x - 8, y - 86]], c.terra);
    inner += poly([[x - 8, y - 86], [x - 4, y - 136], [x + 31, y - 136], [x + 57, y - 86]], c.terraD);
    inner += rec(x - 58, y - 90, 116, 5, c.cream);
    inner += line([[x - 31, y - 136], [x + 31, y - 136]], c.cream, 2.5);
    inner += rec(x + 20, y - 158, 12, 26, c.terraD);
    inner += rec(x + 16, y - 74, 26, 24, c.creamD) + rec(x + 19, y - 71, 20, 18, c.mustard);
    inner += line([[x + 29, y - 71], [x + 29, y - 53]], c.creamD, 2) + line([[x + 19, y - 62], [x + 39, y - 62]], c.creamD, 2);
    inner += rec(x - 15, y - 54, 28, 54, c.plum) + rec(x - 11, y - 50, 20, 50, '#75628a');
    inner += rec(x - 22, y - 6, 44, 7, c.creamD);
    return cutShadow(x, y, 50, 14) + paper(inner, 5, 0.22);
  };
  const cropBed = (x, y) => {
    let inner = rrect(x - 44, y - 34, 88, 34, 3, c.wood);
    inner += rrect(x - 44, y - 34, 88, 8, 3, '#9c7a58');
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 5; i++) {
        const px = x - 28 + i * 14, py = y - 26 + r * 8;
        inner += line([[px, py], [px, py - 8]], c.patch2, 1.8);
        inner += blob(px - 3, py - 10, 4, 3, c.patch1, 1, 0.2, i) + blob(px + 3, py - 10, 4, 3, c.patch2, 1, 0.2, i + 1);
      }
    return cutShadow(x, y, 42, 12) + paper(inner, 4, 0.2);
  };
  const pond = (x, y, rx, ry) => {
    let inner = blob(x, y, rx, ry, c.teal, 1, 0.05, 1.3);
    inner += blob(x - 3, y - 2, rx - 12, ry - 7, c.tealL, 1, 0.06, 0.4);
    for (let i = 0; i < 3; i++) inner += rrect(x - 40 + i * 24, y - 2 + i * 8, 20, 3, 1.5, c.cream, 0.8);
    return cutShadow(x, y + 2, rx, ry) + paper(inner, 4, 0.2) +
      line([[x - rx + 6, y - 2], [x - rx + 4, y - 30]], c.patch2, 2.4) +
      line([[x - rx + 16, y], [x - rx + 20, y - 22]], c.sageD, 2.2);
  };
  const bench = (x, y) =>
    cutShadow(x, y, 24, 6) +
    paper(line([[x - 18, y], [x - 16, y - 22]], c.wood, 4) + line([[x + 18, y], [x + 16, y - 22]], c.wood, 4) + rrect(x - 24, y - 28, 48, 8, 2, c.cream), 3.5) +
    rec(x - 14, y - 34, 9, 6, c.tealL, 1, 2) + rec(x + 2, y - 34, 8, 6, c.mustard, 1, 2);
  const sign = (x, y) =>
    cutShadow(x, y, 10, 4) +
    paper(line([[x, y], [x, y - 30]], c.wood, 3.4) + rrect(x - 15, y - 44, 30, 17, 2, c.cream) + rec(x - 9, y - 38, 18, 3, c.sageD, 1, 1.5), 3.5);
  const slime = (x, y, s) => {
    let inner = blob(x, y - 15 * s, 18 * s, 15 * s, c.mustard, 1, 0.05, 0.9);
    inner += blob(x - 4 * s, y - 22 * s, 9 * s, 7 * s, '#f0cd8a', 1, 0.1, 3.4);
    inner += cir(x - 6 * s, y - 17 * s, 2.6 * s, c.ink) + cir(x + 6 * s, y - 17 * s, 2.6 * s, c.ink);
    inner += cir(x - 6.8 * s, y - 18 * s, 1 * s, c.cream) + cir(x + 5.2 * s, y - 18 * s, 1 * s, c.cream);
    inner += line([[x - 3 * s, y - 11 * s], [x, y - 9 * s], [x + 3 * s, y - 11 * s]], c.ink, 1.6 * s, 0.75);
    return cutShadow(x, y, 17 * s, 5 * s) + paper(inner, 3.5, 0.22);
  };
  const ground = () => {
    let g = rec(0, 0, 24 * T, 15 * T, c.sheet);
    // 纸张拼贴：大块剪切地形 + 硬投影
    const patches = [
      [cx(4.5), baseY(3.4), 200, 130, c.patch1, 0.8],
      [cx(18), baseY(3.2), 210, 120, c.patch2, 0.6],
      [cx(6.5), baseY(12), 210, 130, c.patch2, 0.55],
      [cx(18.5), baseY(11.4), 200, 120, c.patch1, 0.7],
      [cx(12), baseY(8), 230, 130, c.patch2, 0.3],
    ];
    for (const [x, y, rx, ry, f, o] of patches)
      g += paper(blob(x, y, rx, ry, f, o, 0.14, x / 100), 7, 0.17);
    // 剪好的草簇：小三角纸片
    for (let i = 0; i < 64; i++) {
      const x = ((i * 197) % 1090) + 24, y = ((i * 331) % 680) + 24;
      if (Math.abs(y - baseY(6.5)) < 46) continue;
      g += paper(poly([[x - 4, y], [x, y - 9], [x + 4, y]], c.sageD, 0.85), 2, 0.14);
      g += paper(poly([[x - 8, y], [x - 5, y - 6], [x - 2, y]], c.patch2, 0.8), 2, 0.12);
    }
    return g;
  };
  const pathRoad = () => {
    const y0 = baseY(6);
    let inner = poly([[0, y0 + 4], [24 * T, y0 + 2], [24 * T, y0 + T + 2], [0, y0 + T + 5]], c.creamD);
    inner += poly([[cx(13) + 2, y0 + T - 6], [cx(13) + T + 2, y0 + T - 6], [cx(13) + T + 3, 15 * T], [cx(13) + 1, 15 * T]], c.creamD);
    for (let i = 0; i < 14; i++) inner += rrect(20 + i * 78, y0 + 16 + (i % 2) * 12, 26, 6, 3, '#dccda8', 0.9);
    return paper(inner, 4, 0.16);
  };
  const scene = () => {
    let g = ground() + pathRoad() + pond(cx(19.1), baseY(11.7), 76, 38);
    const items = [];
    for (const t of LAYOUT.trees) items.push([baseY(t.v), tree(cx(t.u), baseY(t.v), t.s)]);
    for (const b of LAYOUT.bushes) items.push([baseY(b.v), bush(cx(b.u), baseY(b.v), b.s)]);
    items.push([baseY(LAYOUT.fence.v), fence(cx(LAYOUT.fence.u), baseY(LAYOUT.fence.v), LAYOUT.fence.n)]);
    items.push([baseY(5), house(cx(6), baseY(5))]);
    items.push([baseY(5), cropBed(cx(16.4), baseY(5))]);
    for (const f of LAYOUT.flowers) items.push([baseY(f.v), flower(cx(f.u), baseY(f.v), f.s)]);
    items.push([baseY(LAYOUT.bench.v), bench(cx(LAYOUT.bench.u), baseY(LAYOUT.bench.v))]);
    items.push([baseY(LAYOUT.sign.v), sign(cx(LAYOUT.sign.u), baseY(LAYOUT.sign.v))]);
    for (const s of LAYOUT.slimes) items.push([baseY(s.v), slime(cx(s.u), baseY(s.v), s.s)]);
    items.sort((p, q) => p[0] - q[0]);
    g += items.map((i) => i[1]).join('');
    return `<svg viewBox="0 0 1152 720" xmlns="http://www.w3.org/2000/svg">${g}<rect class="veil" width="1152" height="720" fill="#2a3448" style="--veil:.5;mix-blend-mode:multiply"/>
      <g class="lit">${cir(cx(6) + 29, baseY(5) - 62, 22, '#ffd98a', 0.3)}${rec(cx(6) + 19, baseY(5) - 71, 20, 18, '#ffe9b4', 0.85, 2)}${cir(cx(7.1), baseY(5.6) - 19, 11, '#ffd98a', 0.22)}</g></svg>`;
  };
  const assets = () => [
    { label: '小屋（纸面折角 + 硬投影）', vb: '-70 -180 140 195', g: house(0, 0) },
    { label: '树（三层剪贴纸冠）', vb: '-52 -110 104 125', g: tree(0, 0, 1) },
    { label: '灌木', vb: '-40 -46 80 56', g: bush(0, 0, 1) },
    { label: '围栏（奶油卡纸）', vb: '-46 -44 92 54', g: fence(0, 0, 3) },
    { label: '菜畦（木片围边）', vb: '-52 -44 104 56', g: cropBed(0, 0) },
    { label: '伙伴（纸剪造型，保留原表情比例）', vb: '-34 -42 68 52', g: slime(0, 0, 1) },
  ];
  return {
    key: 'c', idx: 'C', name: '纸艺立体书', sub: '分层卡纸 · Paper diorama',
    thesis: '整个世界是一本立体书：每样东西都是剪下来的色卡纸，靠一道硬投影表现厚度，没有一处渐变。',
    tags: [['改动量', '低'], ['风险', '低'], ['差异度', '高']],
    pros: ['零渐变零纹理，现有扁平多边形几乎可以直接复用', '统一光源 + 硬投影，遮挡与立体感自然立住', '限色板让 UI 与地图同一套语言，最省工'],
    cons: ['画面容易显"平"，需要靠层次与色块面积取胜', '柔和、温暖的乡野气会被换成工艺感，不是所有人喜欢'],
    scene, assets,
    palette: [['底色纸', '#d8e0b2'], ['浅纸', '#c6d5a0'], ['深纸', '#a9c082'], ['鼠尾草', '#86a06c'], ['奶油', '#fbf3e2'], ['陶土', '#cf7458'], ['陶土深', '#b25e46'], ['青苔蓝', '#6a9aa2'], ['芥黄', '#e3b464'], ['梅紫', '#8f7ba0']],
    mapRules: ['地形 = 几张剪好的纸，每层 5–6px 硬投影错位', '路面 = 一条连续纸条 + 几片纸屑，不做格子缝', '所有物件统一光从左上，投影方向右下，角度固定', '草地用小三角纸片点缀，间距 40px 以上，不铺满', '限 10 色，任何新素材只能从色板取色'],
    assetRules: ['每个物件 = 2–4 层纸，层与层之间必须有投影', '不用描边，边界靠"相邻纸面明度差 ≥ 12%"', '折角/折线用 2px 奶油色高光表达', '零渐变、零模糊；阴影 0 blur 硬投影'],
    ui: ['面板：奶油卡纸 + 4px 硬投影，无圆角或只留 4px 圆角', '按钮：纸片按压 2px 位移，边框即剪口', '强调色：陶土 #cf7458；选中卡纸略微抬起'],
    motion: ['点选物件：纸片抬起 3px 再落下，投影同步变长', '面板开合：像翻一页纸（rotateX 8°）', '不抖、不呼吸，保持工艺品的静止感'],
  };
})();

/* =====================================================================
   D · 像素农耕（16-bit）
   逻辑分辨率减半（每格 24px，整图 576×360），2 倍最近邻放大
   ===================================================================== */
const D = (() => {
  const T2 = 24;
  const p = {
    ink: '#0b1622', d1: '#152b3a', d2: '#1f4450', teal: '#2e6470', tealL: '#4a8b7e',
    grass: '#7fb383', grassL: '#9bc47e', grassXL: '#d9e8a6', cream: '#f2f0c8',
    gold: '#e8b45c', orange: '#d98a46', path: '#c3a468', pathRim: '#9a7742',
    brick: '#b85c3c', brickD: '#8a3a34', wood: '#a8703c', sand: '#cbb489',
    plum: '#5a2b3a', white: '#e6e6e6', gray: '#8f8fa8',
  };
  const r = (x, y, w, h, f) => `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${f}"/>`;
  /** 阶梯多边形：把任意多边形按 2px 行切成矩形，得到像素轮廓。 */
  const stair = (pts, f, step = 2) => {
    const ys = pts.map((q) => q[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    let out = '';
    for (let y = y0; y < y1; y += step) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((m, q) => m - q);
      for (let i = 0; i + 1 < xs.length; i += 2) out += r(Math.floor(xs[i] / step) * step, y, Math.floor((xs[i + 1] - xs[i]) / step) * step, step, f);
    }
    return out;
  };
  const tree = (x, y, s) => {
    const k = s;
    let g = r(x - 8 * k, y - 2, 16 * k, 3, p.d2);
    g += r(x - 2 * k, y - 28 * k, 4 * k, 26 * k, p.wood);
    g += r(x - 2 * k, y - 28 * k, 1, 26 * k, p.orange);
    g += r(x - 4 * k, y - 3, 8 * k, 3, p.brick);
    g += stair([[x - 14 * k, y - 26 * k], [x - 12 * k, y - 42 * k], [x + 12 * k, y - 42 * k], [x + 14 * k, y - 26 * k]], p.teal);
    g += stair([[x - 16 * k, y - 26 * k], [x - 10 * k, y - 34 * k], [x + 10 * k, y - 34 * k], [x + 16 * k, y - 26 * k]], p.d2);
    g += r(x - 10 * k, y - 38 * k, 12 * k, 4, p.tealL);
    g += r(x - 12 * k, y - 32 * k, 6 * k, 4, p.tealL);
    g += r(x + 2 * k, y - 24 * k, 6 * k, 4, p.d1);
    g += r(x - 4 * k, y - 43 * k, 6 * k, 2, p.tealL);
    return g;
  };
  const bush = (x, y, s) => {
    const k = s;
    return r(x - 10 * k, y - 2, 20 * k, 2, p.d2) +
      stair([[x - 10 * k, y - 4], [x - 10 * k, y - 10 * k], [x + 10 * k, y - 10 * k], [x + 10 * k, y - 4]], p.teal) +
      r(x - 8 * k, y - 12 * k, 12 * k, 3, p.tealL) + r(x - 4 * k, y - 14 * k, 6 * k, 3, p.tealL);
  };
  const flower = (x, y, s) => {
    const k = s;
    return r(x, y - 6 * k, 2, 6 * k, p.tealL) + r(x - 2, y - 10 * k, 6, 2, p.gold) + r(x - 4, y - 8 * k, 2, 4, p.gold) + r(x + 4, y - 8 * k, 2, 4, p.gold) + r(x - 1, y - 9 * k, 2, 2, p.white);
  };
  const fence = (x, y, count) => {
    let g = r(x - count * 5, y - 1, count * 10, 2, p.d2);
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 10;
      g += r(px - 2, y - 14, 4, 14, p.cream) + r(px - 2, y - 14, 1, 14, p.white);
    }
    g += r(x - count * 5 + 2, y - 10, count * 10 - 4, 2, p.gray);
    return g;
  };
  const house = (x, y) => {
    let g = r(x - 26, y - 1, 52, 3, p.d1);
    // 墙
    g += r(x - 18, y - 42, 36, 42, p.cream) + r(x + 6, y - 42, 12, 42, p.grassXL);
    g += r(x - 18, y - 42, 36, 2, p.white);
    // 屋顶：阶梯梯形，左右两面深浅不同
    for (let i = 0; i < 6; i++) {
      const w = 54 - i * 6, yy = y - 42 - (i + 1) * 4, half = w / 2;
      g += r(x - half, yy, half, 4, p.brick) + r(x, yy, half, 4, p.brickD);
    }
    g += r(x - 27, y - 46, 54, 4, p.orange) + r(x - 26, y - 46, 52, 1, p.gold);
    g += r(x + 8, y - 72, 6, 12, p.brickD) + r(x + 10, y - 78, 2, 4, p.gray) + r(x + 12, y - 84, 2, 4, p.gray);
    // 门与窗
    g += r(x - 7, y - 20, 14, 20, p.plum) + r(x - 5, y - 18, 10, 18, p.d1) + r(x + 3, y - 12, 2, 2, p.gold);
    g += r(x + 7, y - 36, 11, 11, p.gold) + r(x + 12, y - 36, 1, 11, p.cream) + r(x + 7, y - 31, 11, 1, p.cream);
    g += r(x - 22, y - 2, 44, 3, p.gray);
    return g;
  };
  const cropBed = (x, y) => {
    let g = r(x - 22, y - 12, 44, 12, p.brick) + r(x - 22, y - 12, 44, 2, p.brickD) + r(x - 22, y - 1, 44, 2, p.d1);
    for (let rr = 0; rr < 3; rr++)
      for (let i = 0; i < 5; i++) {
        const px = x - 16 + i * 8, py = y - 10 + rr * 4;
        g += r(px, py - 2, 1, 3, p.tealL) + r(px - 2, py - 4, 2, 2, p.grassL) + r(px + 1, py - 4, 2, 2, p.grassL);
      }
    return g;
  };
  const pond = (x, y, rx, ry) => {
    let g = stair([[x - rx - 3, y - ry / 2 - 2], [x - rx / 2 - 2, y - ry - 2], [x + rx / 2 + 2, y - ry - 2], [x + rx + 3, y - ry / 2 - 2], [x + rx + 4, y + ry / 2 + 2], [x - rx - 4, y + ry / 2 + 2]], p.grassXL);
    g += stair([[x - rx, y - ry / 2], [x - rx / 2, y - ry], [x + rx / 2, y - ry], [x + rx, y - ry / 2], [x + rx, y + ry / 2], [x - rx, y + ry / 2]], p.d2);
    g += stair([[x - rx + 8, y - ry / 2], [x - rx / 2, y - ry + 6], [x + rx / 2 - 8, y - ry + 6], [x + rx - 6, y - ry / 2]], p.teal);
    g += r(x - 22, y - 14, 14, 2, p.tealL) + r(x + 2, y - 8, 12, 2, p.tealL) + r(x - 10, y - 2, 10, 2, p.tealL);
    return g;
  };
  const bench = (x, y) => r(x - 12, y - 12, 24, 4, p.orange) + r(x - 12, y - 12, 24, 1, p.gold) + r(x - 10, y - 8, 3, 8, p.brickD) + r(x + 7, y - 8, 3, 8, p.brickD);
  const sign = (x, y) => r(x - 1, y - 14, 2, 14, p.brickD) + r(x - 8, y - 22, 16, 9, p.gold) + r(x - 8, y - 22, 16, 2, p.cream) + r(x - 5, y - 18, 10, 2, p.orange);
  const slime = (x, y, s) => {
    const k = s;
    let g = r(x - 8 * k, y - 1, 16 * k, 2, p.d1);
    g += stair([[x - 9 * k, y - 2], [x - 9 * k, y - 10 * k], [x - 6 * k, y - 14 * k], [x + 6 * k, y - 14 * k], [x + 9 * k, y - 10 * k], [x + 9 * k, y - 2]], p.gold);
    g += stair([[x - 6 * k, y - 6], [x - 6 * k, y - 12 * k], [x - 2 * k, y - 12 * k], [x - 2 * k, y - 6]], p.grassXL);
    g += r(x - 6 * k, y - 9 * k, 2, 3, p.ink) + r(x + 4 * k, y - 9 * k, 2, 3, p.ink);
    g += r(x - 6 * k, y - 9 * k, 1, 1, p.white) + r(x + 4 * k, y - 9 * k, 1, 1, p.white);
    g += r(x - 1, y - 5, 3, 1, p.plum);
    return g;
  };
  const ground = () => {
    let g = rec(0, 0, 576, 360, p.grass);
    g += stair([[40, 150], [200, 120], [330, 150], [300, 240], [60, 250]], p.grassL);
    g += stair([[250, 40], [420, 30], [470, 130], [300, 150]], p.grassL);
    g += stair([[330, 250], [520, 240], [540, 350], [340, 350]], p.grassL);
    // 只在大色块边缘做稀疏抖动，避免整屏网纹
    for (let i = 0; i < 70; i++) {
      const x = ((i * 137) % 540) + 12, y = ((i * 89) % 340) + 10;
      g += r(x, y, 2, 2, p.grassL);
    }
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137) % 540) + 12, y = ((i * 89) % 340) + 10;
      if (Math.abs(y - 168) < 30) continue;
      g += r(x, y - 4, 1, 4, p.tealL) + r(x - 2, y - 3, 1, 3, p.tealL);
    }
    for (let i = 0; i < 16; i++) g += r(((i * 271) % 540) + 20, ((i * 149) % 330) + 16, 2, 2, i % 3 ? p.grassXL : p.gold);
    return g;
  };
  const pathRoad = () => {
    let g = r(0, 168, 576, 24, p.path) + r(0, 168, 576, 3, p.pathRim) + r(0, 189, 576, 3, p.pathRim);
    g += r(312, 168, 24, 192, p.path) + r(312, 168, 3, 192, p.pathRim) + r(333, 168, 3, 192, p.pathRim);
    for (let i = 0; i < 20; i++) g += r(8 + i * 28, 176 + (i % 3) * 5, 4, 3, p.brick);
    for (let i = 0; i < 12; i++) g += r(316, 182 + i * 15, 4, 3, p.brick) ;
    return g;
  };
  const scene = () => {
    let g = ground() + pathRoad() + pond(460, 282, 34, 40);
    const items = [];
    for (const t of LAYOUT.trees) items.push([t.v * T2, tree(t.u * T2, t.v * T2, t.s)]);
    for (const b of LAYOUT.bushes) items.push([b.v * T2, bush(b.u * T2, b.v * T2, b.s)]);
    items.push([LAYOUT.fence.v * T2, fence(LAYOUT.fence.u * T2, LAYOUT.fence.v * T2, LAYOUT.fence.n)]);
    items.push([120, house(144, 120)]);
    items.push([120, cropBed(394, 120)]);
    for (const f of LAYOUT.flowers) items.push([f.v * T2, flower(f.u * T2, f.v * T2, f.s)]);
    items.push([LAYOUT.bench.v * T2, bench(LAYOUT.bench.u * T2, LAYOUT.bench.v * T2)]);
    items.push([LAYOUT.sign.v * T2, sign(LAYOUT.sign.u * T2, LAYOUT.sign.v * T2)]);
    for (const s of LAYOUT.slimes) items.push([s.v * T2, slime(s.u * T2, s.v * T2, s.s)]);
    items.sort((m, q) => m[0] - q[0]);
    g += items.map((i) => i[1]).join('');
    return `<svg viewBox="0 0 576 360" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${g}<rect class="veil" width="576" height="360" fill="#0b1622" style="--veil:.62"/>
      <g class="lit">${r(151, 84, 11, 11, '#ffe9a8')}${r(148, 100, 14, 20, '#e8b45c', 0.5)}</g></svg>`;
  };
  const assets = () => [
    { label: '小屋（48×48 占地内完成）', vb: '-36 -96 72 104', g: house(0, 0) },
    { label: '树', vb: '-26 -52 52 58', g: tree(0, 0, 1) },
    { label: '灌木', vb: '-20 -22 40 28', g: bush(0, 0, 1) },
    { label: '围栏（4px 板条）', vb: '-24 -22 48 28', g: fence(0, 0, 3) },
    { label: '菜畦', vb: '-28 -20 56 26', g: cropBed(0, 0) },
    { label: '伙伴（需要重画像素版，与原形冲突）', vb: '-18 -20 36 26', g: slime(0, 0, 1) },
  ];
  return {
    key: 'd', idx: 'D', name: '像素农耕', sub: '16-bit · Pixel farm（高风险备选）',
    thesis: '把逻辑分辨率砍一半，每格只留 24×24 像素，2 倍整数放大，做出 16 位机的颗粒感。',
    tags: [['改动量', '高'], ['风险', '高'], ['差异度', '很高']],
    pros: ['最有"游戏"味，缩放后依然锐利，320px 小屏可读性最好', '像素风对元素数量要求低，剪影和色块就能讲清内容', '资源体积极小，纯整数坐标，不会有抗锯齿模糊'],
    cons: ['史莱姆本体是 HTML/CSS 平滑渲染，和像素世界同框会明显冲突，需要重协商"基线不可改"这条约束', '26 种设施 + 全部装饰、植物、访客要逐件重画', '建筑立面、遮挡、旋转镜像规则全部要按像素网格重新验证'],
    scene, assets,
    palette: [['墨', '#0b1622'], ['深水', '#152b3a'], ['石板', '#1f4450'], ['苔青', '#2e6470'], ['草深', '#4a8b7e'], ['草', '#78b08a'], ['草亮', '#a8cf8a'], ['草黄', '#d9e8a6'], ['奶油', '#f2f0c8'], ['金', '#e8b45c'], ['橙', '#d98a46'], ['砖', '#b85c3c'], ['砖深', '#8a3a34'], ['梅', '#5a2b3a'], ['灰', '#8f8fa8'], ['白', '#e6e6e6']],
    mapRules: ['每格 24×24 逻辑像素，整数 2× 放大，禁止非整数缩放', '地形用 2–3 个整数像素色块，边缘阶梯化，不用渐变', '路面只用 3 色：金 / 橙描边 / 橙点', '所有斜线走阶梯，禁止抗锯齿斜边', '装饰按 2×2 像素点阵分布，密度靠抖动控制'],
    assetRules: ['16 色调色板，一件素材最多 5 色', '轮廓不描黑线，靠明度差与 1px 高光', '所有尺寸为偶数，保证像素对齐', '阴影用 2px 深色块，不用模糊'],
    ui: ['面板：2px 像素边框 + 4px 硬阴影，字体用等宽或像素字体', '按钮：按下整体下移 2px，取消圆角', '强调色：金 #e8b45c，禁止半透明叠加'],
    motion: ['动画按 4/8 帧阶梯切换，不做补间', '切换场景用像素溶解，不用淡入淡出', '数字与进度条按整数跳变'],
  };
})();

/* =====================================================================
   页面装配
   ===================================================================== */
const STYLES = [A, B, C, D];

const swatches = (list) => list.map(([name, hex]) => `<span class="sw"><i style="background:${hex}"></i><b>${name}</b><em>${hex}</em></span>`).join('');

const shelf = (s) => s.assets().map((a) => `<figure class="tile"><svg viewBox="${a.vb}" xmlns="http://www.w3.org/2000/svg">${a.g}</svg><figcaption>${a.label}</figcaption></figure>`).join('');

const section = (s) => `
<section class="style" data-style="${s.key}" id="scene-${s.key}">
  <header class="head">
    <span class="idx">${s.idx}</span>
    <div class="titles">
      <h2>${s.name}<em>${s.sub}</em></h2>
      <p class="thesis">${s.thesis}</p>
    </div>
    <ul class="tags">${s.tags.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join('')}</ul>
  </header>
  <div class="deck">
    <figure class="stage">
      <div class="frame">${s.scene()}</div>
      <figcaption>同一张 36×24 地图、同一批素材、同一机位。点顶部按钮切换昼夜，四套样张都可对比。</figcaption>
    </figure>
    <aside class="rail">
      <h3>色板</h3>
      <div class="swatches">${swatches(s.palette)}</div>
      <h3>素材架</h3>
      <div class="shelf">${shelf(s)}</div>
      <h3>地图规则</h3><ul class="rules">${s.mapRules.map((t) => `<li>${t}</li>`).join('')}</ul>
      <h3>素材规则</h3><ul class="rules">${s.assetRules.map((t) => `<li>${t}</li>`).join('')}</ul>
      <h3>界面皮肤</h3><ul class="rules">${s.ui.map((t) => `<li>${t}</li>`).join('')}</ul>
      <h3>动效</h3><ul class="rules">${s.motion.map((t) => `<li>${t}</li>`).join('')}</ul>
      <div class="verdict">
        <h4>取舍</h4>
        <p class="pros">${s.pros.map((t) => `<span>+ ${t}</span>`).join('')}</p>
        <p class="cons">${s.cons.map((t) => `<span>− ${t}</span>`).join('')}</p>
      </div>
    </aside>
  </div>
</section>`;

const CMP = [
  ['气质', '温柔、像绘本', '神秘、有夜生活', '工艺、像立体书', '复古、像掌机游戏'],
  ['素材做法', '三色阶 + 手抖轮廓 + 颗粒', '暗剪影 + 轮廓光 + 光晕', '分层卡纸 + 硬投影', '24px 像素 + 抖动'],
  ['地图做法', '整片色斑草地，连续路面', '深色底 + 发光引导线', '拼贴纸层 + 硬投影错位', '棋盘抖动 + 阶梯边'],
  ['改动量', '中（重画全部素材）', '中高（还要设计白天）', '低（多为色板与投影）', '高（含角色重协商）'],
  ['风险', '低', '中', '低', '高'],
  ['适合', '要保留现在的手感', '想让截图一眼不同', '要最快看到整体升级', '愿意重做角色基线'],
];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>家园系统 · 四套美术方向样张</title>
<style>
  :root{
    --bg:#0f1209; --panel:#171b10; --line:#333a27; --fg:#eae7d7; --dim:#a3aa8d; --dim2:#7d8468; --gold:#d8b46a;
    --serif:Georgia,'Songti SC','Noto Serif CJK SC','SimSun',serif;
    --sans:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{background:var(--bg);color:var(--fg);font:15px/1.7 var(--sans);-webkit-font-smoothing:antialiased}
  .board{max-width:1660px;margin:0 auto;padding:56px 40px 120px}
  a{color:inherit}
  /* 头部 */
  .top{display:flex;flex-wrap:wrap;gap:32px;align-items:flex-end;justify-content:space-between}
  .intro{max-width:70ch}
  .kicker{font:600 11px/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:var(--dim2)}
  h1{font:600 clamp(30px,3.6vw,50px)/1.1 var(--serif);margin:14px 0 16px;letter-spacing:.01em}
  .lede{color:var(--dim);margin:0}
  .lede b{color:var(--fg);font-weight:600}
  /* 工具栏 */
  .toolbar{position:sticky;top:0;z-index:60;display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:center;
    margin:32px -40px 0;padding:14px 40px;background:rgba(15,18,9,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .seg{display:flex;gap:4px;flex-wrap:wrap}
  .seg button{font:500 13px/1 var(--sans);color:var(--dim);background:transparent;border:1px solid var(--line);border-radius:999px;padding:9px 14px;cursor:pointer;transition:color .15s,background .15s,border-color .15s}
  .seg button:hover{color:var(--fg);border-color:#4d5638}
  .seg button.on{background:var(--fg);border-color:var(--fg);color:#14170d}
  .seg .lbl{align-self:center;font:600 11px/1 var(--sans);letter-spacing:.16em;color:var(--dim2);text-transform:uppercase;margin-right:4px}
  /* 章节 */
  .style{padding-top:64px;margin-top:64px;border-top:1px solid var(--line)}
  body[data-only] .style{padding-top:8px;margin-top:8px;border-top:0}
  body[data-only=a] .style:not([data-style=a]),body[data-only=b] .style:not([data-style=b]),
  body[data-only=c] .style:not([data-style=c]),body[data-only=d] .style:not([data-style=d]){display:none}
  .head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:24px;align-items:start}
  .idx{font:600 46px/1 var(--serif);color:var(--gold);opacity:.85;letter-spacing:-.02em;padding-top:2px}
  .titles h2{font:600 clamp(20px,2.1vw,27px)/1.25 var(--serif);margin:0 0 8px}
  .titles h2 em{display:block;font:400 12px/1.4 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--dim2);margin-top:8px;font-style:normal}
  .thesis{margin:0;color:var(--dim);max-width:64ch}
  .tags{display:flex;gap:22px;margin:0;padding:0;list-style:none}
  .tags li{font:600 11px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--dim2);text-align:right}
  .tags b{display:block;font:600 15px/1.4 var(--sans);letter-spacing:0;color:var(--fg);margin-top:6px;text-transform:none}
  /* 舞台 + 侧栏 */
  .deck{display:grid;grid-template-columns:minmax(0,1.62fr) minmax(300px,.72fr);gap:32px;margin-top:28px;align-items:start}
  .stage{margin:0}
  .frame{border-radius:12px;overflow:hidden;background:#0b0e06;box-shadow:0 26px 70px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
  .frame svg{display:block;width:100%;height:auto}
  .stage figcaption,.rail figcaption{margin:12px 0 0;font-size:11.5px;line-height:1.55;color:var(--dim2)}
  .rail>h3{font:600 10.5px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--dim2);margin:26px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
  .rail>h3:first-child{margin-top:0}
  .swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
  .sw{display:flex;align-items:center;gap:7px;font:400 10.5px/1.2 var(--sans);color:var(--dim);white-space:nowrap;overflow:hidden}
  .sw i{width:18px;height:18px;border-radius:4px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
  .sw b{font-weight:500;color:var(--fg);font-size:11px}
  .sw em{font-style:normal;color:var(--dim2);font-size:9.5px;letter-spacing:.02em}
  .shelf{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .tile{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 6px 4px;text-align:center}
  .tile svg{display:block;width:100%;height:92px}
  .tile figcaption{font:400 9.5px/1.35 var(--sans);color:var(--dim2);margin:2px 0 0;text-align:left}
  .rules{margin:0;padding:0;list-style:none}
  .rules li{position:relative;padding-left:14px;margin-bottom:7px;font-size:12.5px;line-height:1.6;color:var(--dim)}
  .rules li:before{content:"–";position:absolute;left:0;color:var(--dim2)}
  .verdict{margin-top:28px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
  .verdict h4{font:600 10.5px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--dim2);margin:0 0 12px}
  .verdict p{margin:0;display:grid;gap:5px;font-size:12.5px;line-height:1.55}
  .verdict .pros span{color:#b3c99a}
  .verdict .cons span{color:#d3a48e;margin-top:2px}
  .verdict .cons{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
  /* 对比表 */
  .cmp-wrap{margin-top:96px;padding-top:56px;border-top:1px solid var(--line);overflow-x:auto}
  .cmp-wrap h2{font:600 24px/1.3 var(--serif);margin:0 0 6px}
  .cmp-wrap p.sub{margin:0 0 24px;color:var(--dim);max-width:70ch}
  table{border-collapse:collapse;width:100%;min-width:760px;font-size:13px}
  th,td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top}
  thead th{font:600 10.5px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--dim2);border-bottom:1px solid #4a5232}
  tbody th{font-weight:600;color:var(--dim);white-space:nowrap;font-size:12px;letter-spacing:.02em}
  td{color:var(--fg)}
  tbody tr:hover{background:rgba(255,255,255,.025)}
  .final{margin-top:72px;padding:28px 30px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:4px;background:linear-gradient(90deg,rgba(216,180,106,.06),transparent 70%)}
  .final h2{font:600 20px/1.35 var(--serif);margin:0 0 10px}
  .final p{margin:0 0 10px;color:var(--dim);max-width:82ch}
  .final p:last-child{margin-bottom:0}
  .final b{color:var(--fg)}
  footer{margin-top:72px;padding-top:24px;border-top:1px solid var(--line);color:var(--dim2);font-size:11.5px;line-height:1.7}
  /* 昼夜 */
  .veil{opacity:0;transition:opacity .45s ease}
  body[data-light=night] .veil{opacity:var(--veil,.55)}
  .lit{opacity:0;transition:opacity .45s ease}
  body[data-light=night] .lit{opacity:1}
  .dawn{opacity:0;transition:opacity .45s ease}
  body[data-light=day] .dawn{opacity:1}
  body[data-light=day] .bglow{opacity:.32}
  .bglow{transition:opacity .45s ease}
  @media(max-width:1180px){
    .deck{grid-template-columns:1fr}
    .board{padding:40px 22px 90px}
    .toolbar{margin:26px -22px 0;padding:12px 22px}
    .head{grid-template-columns:auto minmax(0,1fr);row-gap:16px}
    .tags{grid-column:1/-1;justify-content:flex-start;text-align:left}
    .tags li{text-align:left}
    .shelf{grid-template-columns:repeat(3,1fr)}
  }
  @media(max-width:640px){
    .board{padding:28px 14px 70px}
    .toolbar{margin:20px -14px 0;padding:10px 14px}
    .toolbar .seg button{padding:8px 11px;font-size:12px}
    .idx{font-size:32px}
    .tile svg{height:70px}
    .shelf{gap:7px}
  }
  @media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body data-light="day">
<div class="board">
  <header class="top">
    <div class="intro">
      <p class="kicker">最强召唤师系统 · 家园系统 · 美术方向提案 · 2026-10-29</p>
      <h1>家园的四种画法</h1>
      <p class="lede">现在的家园是<b>柔和乡间插画</b>：低饱和黄绿草地、米白面板、48px 一格的正交地图。问题不在画风，而在<b>密度和材质</b>——地面读起来像一格一格铺的，路面像贴上去的胶带，建筑和草地不在同一套光里。下面四套方向都画在<b>同一张地图、同一批素材、同一机位</b>上，可以直接横向比较。</p>
    </div>
  </header>

  <nav class="toolbar">
    <div class="seg" role="group" aria-label="只看某一套">
      <span class="lbl">风格</span>
      <button data-goto="all" class="on">四套并看</button>
      <button data-goto="a">A 晨雾绘本</button>
      <button data-goto="b">B 萤火夜庭</button>
      <button data-goto="c">C 纸艺立体书</button>
      <button data-goto="d">D 像素农耕</button>
    </div>
    <div class="seg" role="group" aria-label="昼夜">
      <span class="lbl">光线</span>
      <button data-light-btn="day" class="on">白天</button>
      <button data-light-btn="night">夜晚</button>
    </div>
  </nav>

${STYLES.map(section).join('\n')}

  <section class="cmp-wrap">
    <h2>放在一张表里看</h2>
    <p class="sub">四套都是"换皮肤"级的工作量区间；区别在于改动落在哪个文件、要不要重画全部素材。</p>
    <table>
      <thead><tr><th></th><th>A 晨雾绘本</th><th>B 萤火夜庭</th><th>C 纸艺立体书</th><th>D 像素农耕</th></tr></thead>
      <tbody>${CMP.map((row) => `<tr><th>${row[0]}</th>${row.slice(1).map((t) => `<td>${t}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </section>

  <section class="final">
    <h2>我的建议</h2>
    <p><b>想最快看到整体提升，选 C（纸艺立体书）。</b>现在的实现本来就是扁平多边形加明暗三面，纸艺风只是把它推到极致：去掉所有渐变，改成限色板 + 固定方向硬投影。改动集中在 <code>kit.ts</code> 的色板与抽影、<code>home.css</code> 的变量，素材轮廓基本不用动，是最省工的高感知方案。</p>
    <p><b>想让截图一眼不同，选 B（萤火夜庭）。</b>它把已经存在的昼夜切换变成卖点，但要额外设计一套白天配色，工作量最大。</p>
    <p><b>最稳的是 A（晨雾绘本）。</b>气质最贴现在的产品，玩家不会有"换了个游戏"的割裂感，代价是整套素材要按新色阶重画一遍。</p>
    <p><b>D（像素农耕）只在愿意重新协商"史莱姆形体基线"时考虑。</b>它是唯一和现有 HTML/CSS 角色渲染冲突的方向。</p>
  </section>

  <footer>
    样张说明：四套样张为设计预览，不含游戏逻辑，未改动 <code>src/</code> 下任何代码。所有图形由 <code>docs/art-redesign-2026-10-29/gen.mjs</code> 用与游戏相同的 48px 格坐标规则程序化生成，可随时改色板重跑。<br>
    选定方向后，落地顺序建议：P0 色板与投影（只动 <code>kit.ts</code> / <code>home.css</code> 变量）→ P1 重画素材 → P2 地图构图与面板皮肤 → 按五种视口 + 昼夜截图验收。
  </footer>
</div>
<script>
  var body = document.body;
  var q = new URLSearchParams(location.search);
  var LIGHT = { a: 'day', b: 'night', c: 'day', d: 'day' };
  var forced = false;
  function setOnly(k){ body.dataset.only = k === 'all' ? '' : k;
    document.querySelectorAll('[data-goto]').forEach(function(b){ b.classList.toggle('on', b.dataset.goto === k); });
    if (!forced && LIGHT[k]) setLight(LIGHT[k]); }
  function setLight(v){ body.dataset.light = v;
    document.querySelectorAll('[data-light-btn]').forEach(function(b){ b.classList.toggle('on', b.dataset.lightBtn === v); }); }
  document.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ forced = false; setOnly(b.dataset.goto); }); });
  document.querySelectorAll('[data-light-btn]').forEach(function(b){ b.addEventListener('click', function(){ forced = true; setLight(b.dataset.lightBtn); }); });
  if (q.get('only')) setOnly(q.get('only'));
  if (q.get('light')) { forced = true; setLight(q.get('light') === 'night' ? 'night' : 'day'); }
</script>
</body>
</html>`;

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'style-board.html'), html, 'utf8');
console.log('written', join(here, 'style-board.html'), html.length, 'chars');

