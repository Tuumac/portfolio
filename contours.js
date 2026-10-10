/*
 * contours.js
 * Slowly morphing topographic contour lines, drawn on <canvas id="contours">.
 * No libraries. Marching squares over a 3D value-noise field (x, y, time).
 *
 * Tweak the look in CONFIG. Everything else can stay as is.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('contours');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var CONFIG = {
    rgb: '57, 126, 168',   // line colour (the site blue)
    lineAlpha: 0.13,       // normal lines
    indexAlpha: 0.24,      // every 4th line, like a real map
    lineWidth: 1,          // CSS px
    indexWidth: 1.5,
    cell: 12,              // grid cell in CSS px. Lower = smoother, more work
    levels: 13,            // number of contour lines
    levelStart: 0.17,      // first level (noise values sit roughly 0.15 to 0.85)
    levelStep: 0.05,
    indexEvery: 4,
    scale: 320,            // size of the terrain features in CSS px
    morphSpeed: 0.00005,   // how fast the terrain changes (lattice units per ms)
    driftSpeed: 0.0035,    // slow sideways drift in CSS px per ms
    fps: 30,
    mobileFps: 20,         // phones: fewer frames to save battery
    minWidth: 120          // below this canvas width, do not draw
  };

  /* ---------- seeded 3D value-noise lattice ---------- */

  var N = 32;
  var MASK = N - 1;
  var lattice = new Float32Array(N * N * N);
  (function fill() {
    var s = 20260610; // fixed seed, same terrain on every load
    for (var i = 0; i < lattice.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      lattice[i] = ((s >>> 8) & 0xffff) / 65535;
    }
  })();

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function at(x, y, z) { return lattice[((z & MASK) * N + (y & MASK)) * N + (x & MASK)]; }

  function noise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    var a = at(xi, yi, zi),         b = at(xi + 1, yi, zi);
    var c = at(xi, yi + 1, zi),     d = at(xi + 1, yi + 1, zi);
    var e = at(xi, yi, zi + 1),     f = at(xi + 1, yi, zi + 1);
    var g = at(xi, yi + 1, zi + 1), h = at(xi + 1, yi + 1, zi + 1);
    var x1 = a + (b - a) * u, x2 = c + (d - c) * u;
    var x3 = e + (f - e) * u, x4 = g + (h - g) * u;
    var y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
  }

  function field(px, py, z) {
    var k = 1 / CONFIG.scale;
    return (noise(px * k, py * k, z) + 0.45 * noise(px * k * 2.1 + 17.3, py * k * 2.1 + 5.9, z * 1.4)) / 1.45;
  }

  /* ---------- sizing ---------- */

  var width = 0, height = 0, dpr = 1;
  var cols = 0, rows = 0;
  var values = null;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (width < CONFIG.minWidth || height < 100) { width = 0; return false; }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    cols = Math.ceil(width / CONFIG.cell) + 1;
    rows = Math.ceil(height / CONFIG.cell) + 1;
    values = new Float32Array(cols * rows);
    return true;
  }

  /* ---------- drawing ---------- */

  function sample(ms) {
    var z = ms * CONFIG.morphSpeed + 3.7;
    var shift = ms * CONFIG.driftSpeed;
    var cell = CONFIG.cell;
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        values[j * cols + i] = field(i * cell + shift, j * cell, z);
      }
    }
  }

  function drawLevel(level) {
    var cell = CONFIG.cell;
    for (var j = 0; j < rows - 1; j++) {
      var y0 = j * cell, y1 = y0 + cell;
      for (var i = 0; i < cols - 1; i++) {
        var x0 = i * cell, x1 = x0 + cell;
        var a = values[j * cols + i];            // top left
        var b = values[j * cols + i + 1];        // top right
        var c = values[(j + 1) * cols + i + 1];  // bottom right
        var d = values[(j + 1) * cols + i];      // bottom left

        var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;

        var tx = x0 + cell * (level - a) / (b - a), ty = y0;   // top edge
        var rx = x1,                                ry = y0 + cell * (level - b) / (c - b); // right edge
        var bx = x0 + cell * (level - d) / (c - d), by = y1;   // bottom edge
        var lx = x0,                                ly = y0 + cell * (level - a) / (d - a); // left edge

        switch (idx) {
          case 1: case 14: seg(lx, ly, bx, by); break;
          case 2: case 13: seg(bx, by, rx, ry); break;
          case 3: case 12: seg(lx, ly, rx, ry); break;
          case 4: case 11: seg(tx, ty, rx, ry); break;
          case 6: case 9:  seg(tx, ty, bx, by); break;
          case 7: case 8:  seg(tx, ty, lx, ly); break;
          case 5: {
            var m5 = (a + b + c + d) / 4 > level;
            if (m5) { seg(tx, ty, lx, ly); seg(bx, by, rx, ry); }
            else    { seg(tx, ty, rx, ry); seg(lx, ly, bx, by); }
            break;
          }
          case 10: {
            var m10 = (a + b + c + d) / 4 > level;
            if (m10) { seg(tx, ty, rx, ry); seg(lx, ly, bx, by); }
            else     { seg(tx, ty, lx, ly); seg(bx, by, rx, ry); }
            break;
          }
        }
      }
    }
  }

  function seg(x1, y1, x2, y2) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }

  function render(ms) {
    ctx.clearRect(0, 0, width, height);
    sample(ms);

    // normal lines first, then index lines on top, one path per style
    var pass, i, level;
    for (pass = 0; pass < 2; pass++) {
      var index = pass === 1;
      ctx.beginPath();
      for (i = 0; i < CONFIG.levels; i++) {
        if ((i % CONFIG.indexEvery === 0) !== index) continue;
        level = CONFIG.levelStart + i * CONFIG.levelStep;
        drawLevel(level);
      }
      ctx.lineWidth = index ? CONFIG.indexWidth : CONFIG.lineWidth;
      ctx.strokeStyle = 'rgba(' + CONFIG.rgb + ',' + (index ? CONFIG.indexAlpha : CONFIG.lineAlpha) + ')';
      ctx.stroke();
    }
  }

  /* ---------- loop ---------- */

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var running = false;
  var last = 0;
  var phone = window.matchMedia && window.matchMedia('(max-width: 768px)');
  function frameGap() { return 1000 / (phone && phone.matches ? CONFIG.mobileFps : CONFIG.fps); }

  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (ts - last < frameGap()) return;
    last = ts;
    render(ts);
    canvas.classList.add('is-ready');
  }

  function start() {
    if (running || !width) return;
    if (reduced && reduced.matches) {
      render(60000);                       // one still frame, no motion
      canvas.classList.add('is-ready');
      return;
    }
    running = true;
    requestAnimationFrame(frame);
  }

  function stop() { running = false; }

  function setup() {
    stop();
    if (resize()) start();
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var rect = canvas.getBoundingClientRect();
      if (running && Math.round(rect.width) === width && Math.round(rect.height) === height) return;
      setup();
    }, 150);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (width) start();
  });

  if (reduced && reduced.addEventListener) {
    reduced.addEventListener('change', setup);
  }

  setup();
})();
