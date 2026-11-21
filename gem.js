/* Recut the stone: a 2D toy ray trace of one slice of a round brilliant.
   Not a cutting guide. Refractive index 2.42, dispersion 0.044 (n 2.407 to 2.451).
   Crown angle 34.5°, table 53%, the classic Tolkowsky proportions; only the pavilion angle changes. */
(function (root) {
  'use strict';
  var D2R = Math.PI / 180;
  var N = 2.42, N_RED = 2.407, N_VIOLET = 2.451;
  var TABLE = 0.53, CROWN = 34.5, GIRDLE = 0.015;

  function stone(p) {
    var hc = (1 - TABLE) * Math.tan(CROWN * D2R);
    var d = Math.tan(p * D2R);
    return {
      // clockwise from the table's left corner; units: girdle radius = 1, y up
      V: [[-TABLE, hc], [TABLE, hc], [1, 0], [1, -GIRDLE], [0, -GIRDLE - d], [-1, -GIRDLE], [-1, 0]],
      kind: ['top', 'top', 'side', 'bottom', 'bottom', 'side', 'top']
    };
  }

  function hit(S, x, y, dx, dy) {
    var best = null;
    for (var i = 0; i < S.V.length; i++) {
      var A = S.V[i], B = S.V[(i + 1) % S.V.length];
      var ex = B[0] - A[0], ey = B[1] - A[1];
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var t = ((A[0] - x) * ey - (A[1] - y) * ex) / den;
      var u = ((A[0] - x) * dy - (A[1] - y) * dx) / den;
      if (t > 1e-9 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t: t, i: i, ex: ex, ey: ey };
    }
    if (!best) return null;
    var L = Math.hypot(best.ex, best.ey), nx = best.ey / L, ny = -best.ex / L;
    if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }   // normal points along the direction of travel
    return { x: x + dx * best.t, y: y + dy * best.t, nx: nx, ny: ny, kind: S.kind[best.i] };
  }

  // refract from index n1 into n2; the normal points along the direction of travel
  function refract(dx, dy, nx, ny, n1, n2) {
    var cosi = nx * dx + ny * dy;           // > 0, normal along travel
    var r = n1 / n2, k = 1 - r * r * (1 - cosi * cosi);
    if (k < 0) return null;                 // total internal reflection
    var c = Math.sqrt(k);
    return [r * dx + (c - r * cosi) * nx, r * dy + (c - r * cosi) * ny];
  }

  // Trace one ray arriving from above at horizontal position x0, angle a (deg from vertical, in air).
  function trace(p, x0, a, n) {
    n = n || N;
    var S = stone(p);
    var dx = Math.sin(a * D2R), dy = -Math.cos(a * D2R);
    var sx = x0 - dx * (3 / -dy), sy = 3;
    var h = hit(S, sx, sy, dx, dy);
    if (!h || h.kind !== 'top') return null;
    var pts = [[sx, sy], [h.x, h.y]];
    var d = refract(dx, dy, h.nx, h.ny, 1, n);
    dx = d[0]; dy = d[1];
    var x = h.x, y = h.y;
    for (var b = 0; b < 16; b++) {
      h = hit(S, x, y, dx, dy);
      if (!h) return { pts: pts, end: 'lost' };
      pts.push([h.x, h.y]); x = h.x; y = h.y;
      var out = refract(dx, dy, h.nx, h.ny, n, 1);
      if (!out) { var c = h.nx * dx + h.ny * dy; dx -= 2 * c * h.nx; dy -= 2 * c * h.ny; continue; }
      return { pts: pts, end: h.kind === 'top' ? 'back' : 'leak', bounces: b, at: [x, y],
               inDir: [dx, dy], normal: [h.nx, h.ny], out: out };
    }
    return { pts: pts, end: 'trapped' };
  }

  // Share of light that comes back out of the top, for light arriving within ±10° of vertical.
  function lightBack(p) {
    var tot = 0, back = 0;
    for (var k = 0; k <= 10; k++) {
      var a = -10 + k * 2;
      for (var x = -0.99; x <= 0.99; x += 0.01) {
        var r = trace(p, x, a);
        if (!r) continue;
        tot++; if (r.end === 'back') back++;
      }
    }
    return tot ? back / tot : 0;
  }

  var api = { stone: stone, trace: trace, lightBack: lightBack, refract: refract,
              N: N, N_RED: N_RED, N_VIOLET: N_VIOLET };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.Gem = api;

  /* ---------- drawing ---------- */
  var SC = 100, SVGNS = 'http://www.w3.org/2000/svg';
  function P(pt) { return (pt[0] * SC).toFixed(1) + ',' + (-pt[1] * SC).toFixed(1); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var SHOW = [[-0.45, -6], [-0.5, 6], [0.5, -6], [-0.7, 10], [0.7, -10]];
  var HERO = [0.47, 5];

  function verdict(p) {
    if (p < 39.5) return 'Too shallow. Light wanders, then slips out through the lower facets.';
    if (p > 42.25) return 'Too deep. Light meets the far facet too steeply and escapes.';
    return 'In the window. Light bounces twice and comes back to you as colour.';
  }

  function mount(fig) {
    var svg = fig.querySelector('svg');
    var input = fig.querySelector('input[type=range]');
    var outAngle = fig.querySelector('[data-angle]');
    var outBack = fig.querySelector('[data-back]');
    var bar = fig.querySelector('[data-bar]');
    var verd = fig.querySelector('[data-verdict]');
    var defs = el('defs', {}, svg);
    var gid = 'g' + Math.random().toString(36).slice(2, 7);
    var lg = el('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.16' }, lg);
    el('stop', { offset: '1', 'stop-color': '#ffffff', 'stop-opacity': '0.03' }, lg);
    var body = el('polygon', { fill: 'url(#' + gid + ')', stroke: 'rgba(255,255,255,.75)', 'stroke-width': '1.2', 'stroke-linejoin': 'round' }, svg);
    var facets = el('g', { stroke: 'rgba(255,255,255,.16)', 'stroke-width': '.8', fill: 'none' }, svg);
    var rays = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    var handle = el('g', { class: 'gem-handle' }, svg);
    el('circle', { r: '14', fill: 'transparent' }, handle);
    el('circle', { r: '5.5', fill: '#fff' }, handle);
    el('path', { d: 'M-4 12 L0 17 L4 12 M-4 -12 L0 -17 L4 -12', stroke: 'rgba(255,255,255,.7)', 'stroke-width': '1.4', fill: 'none' }, handle);

    function exitRay(r, n, len) {
      var o = refract(r.inDir[0], r.inDir[1], r.normal[0], r.normal[1], n, 1) || r.out;
      return [r.at, [r.at[0] + o[0] * len, r.at[1] + o[1] * len]];
    }
    function line(pts, attrs) {
      return el('polyline', Object.assign({ points: pts.map(P).join(' ') }, attrs), rays);
    }

    function draw(p) {
      var S = stone(p);
      body.setAttribute('points', S.V.map(P).join(' '));
      facets.innerHTML = '';
      el('line', { x1: -TABLE * SC, y1: -S.V[0][1] * SC, x2: 0, y2: -S.V[4][1] * SC }, facets);
      el('line', { x1: TABLE * SC, y1: -S.V[0][1] * SC, x2: 0, y2: -S.V[4][1] * SC }, facets);
      rays.innerHTML = '';
      SHOW.forEach(function (s) {
        var r = trace(p, s[0], s[1]);
        if (!r || !r.out) return;
        line(r.pts, { stroke: 'rgba(255,255,255,.22)', 'stroke-width': '1' });
        if (r.end === 'back') line(exitRay(r, N, 0.45), { stroke: 'rgba(255,255,255,.4)', 'stroke-width': '1' });
        else {
          line(exitRay(r, N, 0.3), { stroke: '#ff6b5a', 'stroke-width': '1.3', 'stroke-dasharray': '3 3' });
          el('circle', { cx: r.at[0] * SC, cy: -r.at[1] * SC, r: '2.6', fill: '#ff6b5a' }, rays);
        }
      });
      var h = trace(p, HERO[0], HERO[1]);
      if (h && h.out) {
        line(h.pts, { stroke: '#fff', 'stroke-width': '2' });
        if (h.end === 'back') {
          [['#ff5a4e', N_RED], ['#ffd24a', 2.425], ['#4fd18b', 2.433], ['#4aa8ff', 2.442], ['#9a6bff', N_VIOLET]].forEach(function (c) {
            line(exitRay(h, c[1], 1.6), { stroke: c[0], 'stroke-width': '2.2', opacity: '.95' });
          });
        } else {
          line(exitRay(h, N, 0.4), { stroke: '#ff6b5a', 'stroke-width': '2', 'stroke-dasharray': '4 3' });
          el('circle', { cx: h.at[0] * SC, cy: -h.at[1] * SC, r: '3.4', fill: '#ff6b5a' }, rays);
        }
      }
      handle.setAttribute('transform', 'translate(0 ' + (-S.V[4][1] * SC).toFixed(1) + ')');
      var back = lightBack(p);
      if (outAngle) outAngle.textContent = p.toFixed(2) + '°';
      if (outBack) outBack.textContent = Math.round(back * 100) + '%';
      if (bar) bar.style.transform = 'scaleX(' + back.toFixed(3) + ')';
      if (verd) verd.textContent = verdict(p);
      fig.setAttribute('data-state', p < 39.5 ? 'shallow' : p > 42.25 ? 'deep' : 'ideal');
    }

    function set(p) {
      p = Math.max(+input.min, Math.min(+input.max, Math.round(p * 4) / 4));
      input.value = p; draw(p);
    }
    input.addEventListener('input', function () { draw(+input.value); });

    // drag up or down (anywhere on the stone) to make the pavilion shallower or deeper
    var dragging = false, startY = 0, startDepth = 0;
    function toModel(evt) {
      var pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      var m = svg.getScreenCTM(); if (!m) return null;
      var q = pt.matrixTransform(m.inverse());
      return -q.y / SC;
    }
    svg.addEventListener('pointerdown', function (e) {
      var y = toModel(e); if (y == null) return;
      dragging = true; startY = y; startDepth = Math.tan(+input.value * D2R);
      svg.setPointerCapture(e.pointerId); fig.classList.add('is-dragging');
    });
    function move(e) {
      if (!dragging) return;
      var y = toModel(e); if (y == null) return;
      set(Math.atan(Math.max(0.3, startDepth + (startY - y) * 0.5)) / D2R);
    }
    svg.addEventListener('pointermove', move);
    function end() { dragging = false; fig.classList.remove('is-dragging'); }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    set(+input.value);
  }

  function init() { Array.prototype.forEach.call(document.querySelectorAll('[data-gem]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
