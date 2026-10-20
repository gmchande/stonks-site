// Stonks' landing page. Every price drawn here is made up.
(() => {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const COL = {
    bg: v("--bg"), deep: v("--bg-deep"), fg: v("--fg"), text: v("--text"), muted: v("--muted"),
    faint: v("--faint"), up: v("--up"), down: v("--down"), accent: v("--accent"), line: v("--line"),
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // ---- Cells: Stonks' own block digits and sprites (Cells.js), plus letters for the page.

  const GLYPHS = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "001", "001", "001"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ".": ["0", "0", "0", "0", "1"],
    ",": ["0", "0", "0", "0", "1", "1"],
    // The page's letters, five wide, squared off like the digits.
    "S": ["01111", "10000", "01110", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100"],
    "O": ["11111", "10001", "10001", "10001", "11111"],
    "N": ["10001", "11001", "10101", "10011", "10001"],
    "K": ["10001", "10010", "11100", "10010", "10001"],
    "F": ["11111", "10000", "11110", "10000", "10000"],
    "R": ["11110", "10001", "11110", "10010", "10001"],
    "E": ["11111", "10000", "11110", "10000", "11111"],
    "P": ["11110", "10001", "11110", "10000", "10000"],
    "L": ["10000", "10000", "10000", "10000", "11111"],
    "A": ["01110", "10001", "11111", "10001", "10001"],
    "Y": ["10001", "01010", "00100", "00100", "00100"],
    " ": ["00", "00", "00", "00", "00"],
  };

  // Every digit and letter keeps its whole slot, faintly, as an LCD shows
  // its unlit segments; punctuation and spaces have none.
  function blockCells(text) {
    const cells = [];
    let x = 0;
    for (const ch of String(text)) {
      const g = GLYPHS[ch];
      if (!g) continue;
      const slot = g[0].length >= 3;
      g.forEach((row, r) => {
        [...row].forEach((b, c) => {
          const lit = b === "1";
          if (lit || slot) cells.push({ x: x + c, y: r, lit });
        });
      });
      x += g[0].length + 1;
    }
    return { columns: Math.max(0, x - 1), cells };
  }

  function blocksSVG(text, cell, color, rows = 5, slotAlpha = 0.07) {
    const { columns, cells } = blockCells(text);
    const gap = Math.max(1, Math.round(cell / 8));
    const s = cell - gap;
    const w = columns * cell;
    const h = rows * cell;
    let rects = "";
    for (const c of cells) {
      if (c.y >= rows) continue;
      rects += `<rect x="${c.x * cell}" y="${c.y * cell}" width="${s}" height="${s}"${c.lit ? "" : ` fill-opacity="${slotAlpha}"`}/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  }

  const BULL = [
    "....................",
    "#..................#",
    "##................##",
    ".###............###.",
    "...######..######...",
    ".....##########.....",
    "...###.######.###...",
    ".....#.######.#.....",
    ".....##########.....",
    ".....##########.....",
    "....############....",
    "....##.######.##....",
    "....############....",
    ".....##########.....",
  ];
  const BEAR = [
    "....................",
    "..###..........###..",
    ".#####........#####.",
    ".##################.",
    ".##################.",
    "..################..",
    ".#####.######.#####.",
    "####################",
    ".#######....#######.",
    ".########..########.",
    ".########..########.",
    "..################..",
    "...##############...",
    ".....##########.....",
  ];

  function spriteSVG(rows, cell, color) {
    const w = rows[0].length * cell;
    const h = rows.length * cell;
    let rects = "";
    rows.forEach((row, y) => {
      // Runs of lit pixels as one rect each, so the sprite draws seamless.
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "#") { x++; continue; }
        let end = x;
        while (end < row.length && row[end] === "#") end++;
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${(end - x) * cell}" height="${cell}"/>`;
        x = end;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  }

  // Stonks' mark: a small chart that climbs, in cells; falling is the same mirrored.
  function markSVG(cell, rows, color, falling) {
    const pts = [0.9, 0.45, 0.75, 0.25, 0.05];
    let levels = pts.map((y) => Math.round(y * (rows - 1)));
    if (falling) levels = levels.reverse();
    const w = (levels.length * 2 - 1) * cell;
    const h = rows * cell;
    const rects = levels.map((lv, i) =>
      `<rect x="${i * 2 * cell}" y="${lv * cell}" width="${cell}" height="${(rows - lv) * cell}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  }

  // ---- Made-up market data, the same on every visit.

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SESSION = 390; // 9:30 to 16:00, in minutes
  const NOW = 315; // the demo's clock stands at 14:45

  function interp(anchors, f) {
    for (let i = 1; i < anchors.length; i++) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      if (f <= x1) return y0 + (y1 - y0) * ((f - x0) / (x1 - x0));
    }
    return anchors[anchors.length - 1][1];
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  function makeDay(prev, anchors, seed) {
    const r = rng(seed);
    const pts = [];
    let noise = 0;
    for (let m = 0; m <= NOW; m += 5) {
      noise = noise * 0.6 + (r() - 0.5) * 0.24;
      const pct = interp(anchors, m / SESSION) + (m === NOW ? 0 : noise);
      pts.push({ x: m / SESSION, v: round2(prev * (1 + pct / 100)), m });
    }
    return pts;
  }

  const SYMBOLS = [
    { sym: "ARCADE", name: "Arcade Cabinets Inc", prev: 214.3, seed: 7,
      anchors: [[0, 0.15], [0.08, 0.85], [0.2, 0.35], [0.33, -0.45], [0.45, -1.05], [0.55, -0.4], [0.64, 1.25], [0.72, 0.5], [0.8077, 0.61]] },
    { sym: "PIXELS", name: "Pixel Foundry Co", prev: 88.42, seed: 11,
      anchors: [[0, -0.2], [0.15, 0.45], [0.3, -0.3], [0.5, -0.9], [0.7, -1.65], [0.8077, -1.42]] },
    { sym: "JOYPAD", name: "Joypad Industries", prev: 41.07, seed: 23,
      anchors: [[0, 0.3], [0.2, 1.1], [0.4, 0.75], [0.6, 1.7], [0.8077, 2.08]] },
    { sym: "HISCORE", name: "High Score Holdings", prev: 1286.5, seed: 31,
      anchors: [[0, -0.1], [0.2, 0.35], [0.45, -0.2], [0.6, 0.12], [0.8077, -0.27]] },
  ];
  for (const s of SYMBOLS) {
    s.day = makeDay(s.prev, s.anchors, s.seed);
    s.price = s.day[s.day.length - 1].v;
    s.open = s.day[0].v;
    s.ranges = {};
    s.range = "1D";
  }

  // Every range is a slice of one made-up history, so they agree: a range's
  // high is never above the 52 weeks' it sits in. Each: trading days back.
  const HISTORY_DAYS = 5040; // about twenty years of sessions
  const TODAY = new Date();
  const yearStart = new Date(TODAY.getFullYear(), 0, 1);
  const RANGES = [
    ["1D", 0], ["1W", 5], ["1M", 21], ["3M", 63], ["6M", 126],
    ["YTD", Math.max(5, Math.round(((TODAY - yearStart) / 864e5) * 5 / 7))],
    ["1Y", 252], ["2Y", 504], ["5Y", 1260], ["10Y", 2520], ["ALL", HISTORY_DAYS],
  ];

  // The weekdays back from today, newest first: index 0 is today.
  const SESSIONS = [];
  for (let d = new Date(TODAY); SESSIONS.length <= HISTORY_DAYS; d = new Date(d - 864e5)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) SESSIONS.push(d);
  }

  // Daily closes, oldest first; the last is yesterday's close, the day's base.
  function history(s) {
    if (s.hist) return s.hist;
    const r = rng(s.seed * 131);
    const closes = new Array(HISTORY_DAYS);
    let lv = Math.log(s.prev);
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      closes[i] = round2(Math.exp(lv));
      lv -= 0.0004 + (r() - 0.5) * 0.035;
    }
    s.hist = closes;
    return closes;
  }

  function rangeSeries(s, key) {
    if (key === "1D") return s.day;
    if (s.ranges[key]) return s.ranges[key];
    const back = RANGES.find((r) => r[0] === key)[1];
    const closes = history(s);
    let pts;
    if (key === "1W") {
      // Five sessions in half hours: four past days drawn between their
      // closes, then today's prints.
      pts = [];
      const r = rng(s.seed * 7 + 1);
      for (let k = 4; k >= 1; k--) {
        const from = closes[HISTORY_DAYS - k - 1];
        const to = closes[HISTORY_DAYS - k];
        for (let h = 0; h < 13; h++) {
          const f = h / 13;
          pts.push({ v: round2(from + (to - from) * f + (h ? (r() - 0.5) * to * 0.006 : 0)), d: SESSIONS[k], m: h * 30 });
        }
      }
      for (const p of s.day) if (p.m % 30 === 0 || p === s.day[s.day.length - 1]) pts.push({ v: p.v, d: SESSIONS[0], m: p.m });
    } else {
      const n = Math.min(back, HISTORY_DAYS - 1);
      const step = Math.max(1, Math.round(n / 130));
      pts = [];
      for (let j = n; j >= 1; j -= step) pts.push({ v: closes[HISTORY_DAYS - j], d: SESSIONS[j] });
      pts.push({ v: s.price, d: SESSIONS[0] });
    }
    pts.forEach((p, i) => { p.x = i / (pts.length - 1); });
    // The range's low and high over every session in it, not just the
    // points drawn, with this week's half hours and today's prints.
    const all = key === "1W" ? pts.slice() : closes.slice(HISTORY_DAYS - Math.min(back, HISTORY_DAYS - 1)).map((c) => ({ v: c }))
      .concat(rangeSeries(s, "1W"));
    all.push(...s.day);
    pts.lo = Math.min(...all.map((p) => p.v));
    pts.hi = Math.max(...all.map((p) => p.v));
    s.ranges[key] = pts;
    return pts;
  }

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const clock = (m) => {
    const t = 570 + m;
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };
  function pointLabel(key, p) {
    if (key === "1D") return clock(p.m);
    const d = p.d;
    if (key === "1W") return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${clock(p.m)}`;
    if (["2Y", "5Y", "10Y", "ALL"].includes(key)) return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function signed(n, retro, suffix) {
    const a = money(Math.abs(n)) + suffix;
    if (Math.abs(n) < 0.005) return money(0) + suffix;
    if (retro) return (n > 0 ? "▲" : "▼") + a;
    return (n > 0 ? "+" : "-") + a;
  }
  const tone = (n) => (n > 0.004 ? "up" : n < -0.004 ? "down" : "");
  const dayPct = (s) => ((s.price - s.prev) / s.prev) * 100;

  // ---- Canvas helpers

  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function normFor(pts, base) {
    let lo = base, hi = base;
    for (const p of pts) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); }
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    return (value) => (hi - value) / (hi - lo);
  }

  // The retro chart, as PixelChart.qml draws it: a faint grid, the baseline as
  // every other cell, a stem from each cap to the baseline at the wash's
  // alpha, and the cap at full colour.
  function drawRetro(ctx, w, h, pts, base, o) {
    const pixel = o.pixel, gap = o.gap, pitch = pixel + gap;
    const cols = Math.max(1, Math.floor(w / pitch));
    const rows = Math.max(1, Math.floor(h / pixel));
    const norm = normFor(pts, base);
    const baseRow = Math.round(norm(base) * (rows - 1));
    const baseY = baseRow * pixel;
    if (o.ghost) {
      ctx.fillStyle = rgba(COL.fg, o.ghost);
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) ctx.fillRect(c * pitch, r * pixel, pixel, pixel - gap);
    }
    ctx.fillStyle = o.baseColor || COL.faint;
    for (let c = 0; c < cols; c += 2) ctx.fillRect(c * pitch, baseY, pixel, pixel - gap);
    for (const t of o.ticks || []) {
      const c = Math.min(cols - 1, Math.floor(t * cols));
      const top = Math.max(0, (baseRow - 1) * pixel);
      ctx.fillRect(c * pitch, top, pixel, Math.min(h, (baseRow + 2) * pixel) - top);
    }
    const levels = [];
    const colOf = (p) => Math.min(cols - 1, Math.floor(p.x * cols));
    for (const p of pts) levels[colOf(p)] = Math.round(norm(p.v) * (rows - 1));
    const reveal = o.reveal == null || o.reveal >= 1 ? cols : Math.ceil(cols * o.reveal);
    for (let c = 0; c < reveal; c++) {
      const lv = levels[c];
      if (lv === undefined) continue;
      const above = lv <= baseRow;
      const color = above ? COL.up : COL.down;
      const y = lv * pixel;
      const top = Math.min(y, baseY);
      const hh = Math.abs(y - baseY);
      if (hh > 0) {
        ctx.fillStyle = rgba(color, o.stem || 0.35);
        ctx.fillRect(c * pitch, top, pixel, hh);
      }
      ctx.fillStyle = rgba(color, o.cap || 1);
      ctx.fillRect(c * pitch, y, pixel, pixel);
    }
    if (o.scrub >= 0) {
      const c = colOf(pts[o.scrub]);
      ctx.fillStyle = rgba(COL.fg, 0.3);
      ctx.fillRect(c * pitch, 0, pixel, h);
      ctx.fillStyle = COL.fg;
      ctx.fillRect(c * pitch, levels[c] * pixel, pixel, pixel);
    } else if (o.lastCap && reveal >= cols) {
      const c = colOf(pts[pts.length - 1]);
      ctx.fillStyle = COL.fg;
      ctx.fillRect(c * pitch, levels[c] * pixel, pixel, pixel);
    }
  }

  // The smooth chart: one line in the day's colours either side of the
  // baseline, a wash under it, a dashed baseline.
  function drawSmooth(ctx, w, h, pts, base, o) {
    const pad = o.pad == null ? 6 : o.pad;
    const norm = normFor(pts, base);
    const X = (x) => 1 + x * (w - 2);
    const Y = (value) => pad + norm(value) * (h - 2 * pad);
    const by = Math.round(Y(base)) + 0.5;
    ctx.save();
    ctx.strokeStyle = rgba(COL.fg, 0.28);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(w, by); ctx.stroke();
    ctx.setLineDash([]);
    for (const t of o.ticks || []) {
      const x = Math.round(X(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, by - 4); ctx.lineTo(x, by + 4); ctx.stroke();
    }
    ctx.restore();

    const clipW = o.reveal == null || o.reveal >= 1 ? w : X(o.reveal);
    const line = new Path2D();
    pts.forEach((p, i) => (i ? line.lineTo(X(p.x), Y(p.v)) : line.moveTo(X(p.x), Y(p.v))));
    const area = new Path2D(line);
    area.lineTo(X(pts[pts.length - 1].x), by);
    area.lineTo(X(pts[0].x), by);
    area.closePath();
    for (const [color, y0, y1] of [[COL.up, 0, by], [COL.down, by, h]]) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, clipW, y1 - y0); ctx.clip();
      ctx.fillStyle = rgba(color, 0.16);
      ctx.fill(area);
      ctx.strokeStyle = color;
      ctx.lineWidth = o.lineWidth || 1.5;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.stroke(line);
      ctx.restore();
    }
    const dot = (p, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.v), r, 0, Math.PI * 2); ctx.fill();
    };
    if (o.scrub >= 0) {
      const p = pts[o.scrub];
      ctx.fillStyle = rgba(COL.fg, 0.6);
      ctx.fillRect(Math.round(X(p.x)), 0, 1, h);
      dot(p, 4, COL.fg);
    } else if (o.lastCap && clipW >= w) {
      const p = pts[pts.length - 1];
      dot(p, 4, p.v >= base ? COL.up : COL.down);
    }
  }

  // The smooth bull and bear, from DrawnAnimal.qml: one round line and a wash.
  function drawAnimal(ctx, s, bull, color) {
    ctx.save();
    ctx.scale(s, s);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = 1.5 / s;
    ctx.strokeStyle = color;
    ctx.fillStyle = rgba(color, 0.16);
    const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    if (bull) {
      ctx.beginPath();
      ctx.moveTo(13.5, 8.5);
      ctx.quadraticCurveTo(20, 6.2, 26.5, 8.5);
      ctx.quadraticCurveTo(27.6, 13, 25.2, 17.2);
      ctx.quadraticCurveTo(27.2, 19.4, 26.2, 23);
      ctx.quadraticCurveTo(20, 27.4, 13.8, 23);
      ctx.quadraticCurveTo(12.8, 19.4, 14.8, 17.2);
      ctx.quadraticCurveTo(12.4, 13, 13.5, 8.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(13.8, 10); ctx.quadraticCurveTo(5, 11.5, 3.5, 3);
      ctx.moveTo(26.2, 10); ctx.quadraticCurveTo(35, 11.5, 36.5, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(13.6, 12.4); ctx.quadraticCurveTo(9.4, 13.8, 8.6, 12.6);
      ctx.moveTo(26.4, 12.4); ctx.quadraticCurveTo(30.6, 13.8, 31.4, 12.6);
      ctx.stroke();
      ctx.fillStyle = color;
      dot(17, 13.2, 1.15); dot(23, 13.2, 1.15); dot(17.6, 21.6, 0.95); dot(22.4, 21.6, 0.95);
    } else {
      const rad = (d) => (Math.PI * d) / 180;
      ctx.beginPath();
      ctx.arc(11.49, 7.71, 3.58, rad(145), rad(335), false);
      ctx.quadraticCurveTo(20, 5.47, 25.26, 6.2);
      ctx.arc(28.51, 7.71, 3.58, rad(205), rad(35), false);
      ctx.quadraticCurveTo(32.54, 12.86, 32.77, 17.34);
      ctx.quadraticCurveTo(31.87, 22.27, 26.27, 24.74);
      ctx.quadraticCurveTo(20, 27.65, 13.73, 24.74);
      ctx.quadraticCurveTo(8.13, 22.27, 7.23, 17.34);
      ctx.quadraticCurveTo(7.46, 12.86, 8.55, 9.77);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 19.81); ctx.lineTo(20, 21.82); ctx.stroke();
      ctx.fillStyle = color;
      dot(15.52, 13.76, 1.29); dot(24.48, 13.76, 1.29);
      ctx.beginPath();
      ctx.moveTo(17.98, 17.57);
      ctx.quadraticCurveTo(20, 17.01, 22.02, 17.57);
      ctx.quadraticCurveTo(22.24, 20.26, 20, 19.81);
      ctx.quadraticCurveTo(17.76, 20.26, 17.98, 17.57);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // A thin rule: dotted cells in retro, a line in smooth.
  function drawRule(canvas, retro, segments, tickAt) {
    const { ctx, w, h } = fit(canvas);
    const y = Math.round(h / 2) - 1;
    let x0 = 0;
    for (const [frac, color, alpha] of segments) {
      const x1 = x0 + frac * w;
      ctx.fillStyle = rgba(color, alpha);
      if (retro) for (let x = Math.ceil(x0 / 3) * 3; x < x1 - 1; x += 3) ctx.fillRect(x, y, 2, 2);
      else ctx.fillRect(x0, y, x1 - x0, 2);
      x0 = x1;
    }
    if (tickAt != null) {
      const x = Math.min(w - 2, Math.max(0, Math.round(tickAt * (w - 2))));
      ctx.fillStyle = COL.fg;
      if (retro) for (let ty = 0; ty + 2 <= h; ty += 3) ctx.fillRect(x, ty, 2, 2);
      else ctx.fillRect(x, 0, 2, h);
    }
  }

  // ---- The demo popup

  const demo = document.getElementById("demo");
  const el = {
    animal: demo.querySelector(".animal"), status: demo.querySelector(".status"),
    look: demo.querySelector(".look"), help: demo.querySelector(".help"),
    listing: demo.querySelector(".listing"), price: demo.querySelector(".price"),
    change: demo.querySelector(".change"), changeCap: demo.querySelector(".change-cap"),
    chart: demo.querySelector(".chart"), ranges: demo.querySelector(".ranges"),
    info: demo.querySelector(".info"), breadth: demo.querySelector(".breadth-rule"),
    rows: demo.querySelector(".rows"), sheet: demo.querySelector(".sheet"),
  };

  const state = { sym: 0, sel: 0, look: "retro", changeMode: 0, scrub: -1, reveal: 1, form: "sparkline" };
  const feat = () => SYMBOLS[state.sym];
  const retro = () => state.look === "retro";

  RANGES.forEach(([key]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = key;
    b.dataset.range = key;
    b.addEventListener("click", () => setRange(key));
    el.ranges.appendChild(b);
  });

  SYMBOLS.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "row";
    b.innerHTML = `<span><span class="sym">${s.sym}</span><br><span class="name">${s.name}</span></span><canvas aria-hidden="true"></canvas><span class="nums"><span></span><b></b></span>`;
    b.addEventListener("click", () => { state.sel = i; setSymbol(i); });
    el.rows.appendChild(b);
  });

  function series() {
    const s = feat();
    const pts = rangeSeries(s, s.range);
    const base = s.range === "1D" ? s.prev : pts[0].v;
    return { s, pts, base };
  }

  function shownIndex(pts) {
    return state.scrub >= 0 ? Math.min(state.scrub, pts.length - 1) : pts.length - 1;
  }

  function render() {
    const { s, pts, base } = series();
    const i = shownIndex(pts);
    const p = pts[i];
    const isRetro = retro();
    const day = s.range === "1D";

    // Header: the animal is the moment shown against the baseline.
    const dir = tone(p.v - base);
    el.animal.innerHTML = "";
    el.animal.disabled = !dir;
    if (dir) {
      const color = dir === "up" ? COL.up : COL.down;
      if (isRetro) el.animal.innerHTML = spriteSVG(dir === "up" ? BULL : BEAR, 2, color);
      else {
        const c = document.createElement("canvas");
        c.style.width = "40px"; c.style.height = "28px";
        el.animal.appendChild(c);
        const { ctx } = fit(c);
        drawAnimal(ctx, 1, dir === "up", color);
      }
      el.animal.setAttribute("aria-label", `Replay the chart (${dir === "up" ? "bull" : "bear"})`);
    }
    el.status.textContent = state.scrub >= 0 ? `AT ${pointLabel(s.range, p)}${day ? " · MARKET OPEN" : ""}` : "MARKET CLOSES IN 1H 15M";

    el.look.innerHTML = isRetro
      ? `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,12 6,6 10,9 17,2"/></svg>`
      : markSVG(2, 7, "currentColor", false);

    el.listing.innerHTML = `<b>${s.sym}</b>${s.name.toUpperCase()} · DEMO · USD`;

    const priceText = money(p.v);
    if (isRetro) el.price.innerHTML = blocksSVG(priceText, priceCell, COL.fg, 6);
    else el.price.innerHTML = `<span class="smooth-price">${priceText}</span>`;

    const mode = day ? state.changeMode : 0;
    let delta;
    if (mode === 2) delta = ((p.v - s.open) / s.open) * 100;
    else if (mode === 1) delta = p.v - base;
    else delta = ((p.v - base) / base) * 100;
    el.change.textContent = signed(delta, isRetro, mode === 1 ? "" : "%");
    el.change.className = `change ${tone(delta)}`;
    el.change.disabled = !day;
    el.changeCap.textContent = mode === 2 ? "SINCE OPEN" : "";

    for (const b of el.ranges.children) b.setAttribute("aria-pressed", String(b.dataset.range === s.range));

    drawChart();
    renderInfo(s, pts);
    renderRows();
    renderPill();

    el.chart.setAttribute("aria-valuenow", String(Math.round((i / Math.max(1, pts.length - 1)) * 100)));
    el.chart.setAttribute("aria-valuetext", `${pointLabel(s.range, p)}, ${priceText}, ${signed(((p.v - base) / base) * 100, false, "%")}`);
  }

  let priceCell = 10;
  function sizePriceCell() {
    // One cell size for every symbol, so the price never moves the layout.
    const room = demo.clientWidth - 40 - (innerWidth <= 640 ? 100 : 140);
    priceCell = Math.max(5, Math.min(11, Math.floor(room / 27)));
  }

  const DAY_TICKS = [30, 90, 150, 210, 270, 330].map((m) => m / SESSION);

  function drawChart() {
    const { s, pts, base } = series();
    const { ctx, w, h } = fit(el.chart);
    const day = s.range === "1D";
    const o = {
      scrub: state.scrub, reveal: state.reveal, lastCap: day, ticks: day ? DAY_TICKS : [],
    };
    if (retro()) drawRetro(ctx, w, h, pts, base, { ...o, pixel: 6, gap: 1, ghost: 0.035 });
    else drawSmooth(ctx, w, h, pts, base, o);
  }

  function renderInfo(s, pts) {
    const isRetro = retro();
    const lines = [[s.range, pts], ["52W", rangeSeries(s, "1Y")]];
    el.info.innerHTML = lines.map(([label]) => `<span>${label}</span><b></b><canvas></canvas><b></b>`).join("");
    const kids = el.info.children;
    lines.forEach(([, list], k) => {
      let lo = list.lo, hi = list.hi;
      if (lo === undefined) {
        lo = Math.min(...list.map((p) => p.v));
        hi = Math.max(...list.map((p) => p.v));
      }
      kids[k * 4 + 1].textContent = money(lo);
      kids[k * 4 + 3].textContent = money(hi);
      drawRule(kids[k * 4 + 2], isRetro, [[1, COL.fg, 0.14]], (s.price - lo) / (hi - lo || 1));
    });
    const ups = SYMBOLS.filter((x) => tone(dayPct(x)) === "up").length;
    const downs = SYMBOLS.filter((x) => tone(dayPct(x)) === "down").length;
    const n = SYMBOLS.length;
    drawRule(el.breadth, isRetro, [[ups / n, COL.up, 1], [(n - ups - downs) / n, COL.fg, 0.14], [downs / n, COL.down, 1]]);
  }

  function renderRows() {
    const isRetro = retro();
    [...el.rows.children].forEach((row, i) => {
      const s = SYMBOLS[i];
      row.setAttribute("aria-current", String(i === state.sym));
      row.style.outline = i === state.sel && i !== state.sym ? `1px dashed ${COL.faint}` : "";
      const nums = row.querySelector(".nums");
      nums.firstElementChild.textContent = money(s.price);
      const pct = dayPct(s);
      nums.lastElementChild.textContent = signed(pct, isRetro, "%");
      nums.lastElementChild.className = tone(pct);
      const { ctx, w, h } = fit(row.querySelector("canvas"));
      if (isRetro) drawRetro(ctx, w, h, s.day, s.prev, { pixel: 2, gap: 1, scrub: -1, stem: 0.35 });
      else drawSmooth(ctx, w, h, s.day, s.prev, { pad: 2, scrub: -1, lineWidth: 1.2 });
    });
  }

  // ---- Demo actions

  function setSymbol(i) {
    stopReplay();
    state.sym = (i + SYMBOLS.length) % SYMBOLS.length;
    state.scrub = -1;
    render();
  }
  function setRange(key) {
    stopReplay();
    feat().range = key; // every stock keeps its own range
    state.scrub = -1;
    render();
  }
  function stepRange(d) {
    const keys = RANGES.map((r) => r[0]);
    const k = keys.indexOf(feat().range);
    setRange(keys[Math.max(0, Math.min(keys.length - 1, k + d))]);
  }
  function setLook(look) {
    state.look = look;
    render();
  }

  function scrubAt(clientX) {
    const { pts } = series();
    const r = el.chart.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    let best = 0;
    for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - f) < Math.abs(pts[best].x - f)) best = i;
    if (f > pts[pts.length - 1].x) best = pts.length - 1;
    stopReplay();
    state.scrub = best;
    render();
  }
  el.chart.addEventListener("pointermove", (e) => scrubAt(e.clientX));
  el.chart.addEventListener("pointerdown", (e) => scrubAt(e.clientX));
  el.chart.addEventListener("pointerleave", () => { if (state.scrub >= 0 && replayFrame === null) { state.scrub = -1; render(); } });

  // A replay is a scrub that drives itself, the chart drawing in behind it.
  let replayFrame = null;
  function replay() {
    stopReplay();
    const { pts } = series();
    if (reducedMotion.matches) { state.scrub = -1; render(); return; }
    const last = pts[pts.length - 1].x;
    const t0 = performance.now();
    const dur = 2200;
    const tick = (t) => {
      const f = Math.min(1, (t - t0) / dur);
      const x = f * last;
      let i = 0;
      while (i + 1 < pts.length && pts[i + 1].x <= x) i++;
      state.scrub = f < 1 ? i : -1;
      state.reveal = f < 1 ? x + 0.0001 : 1;
      render();
      replayFrame = f < 1 ? requestAnimationFrame(tick) : null;
    };
    replayFrame = requestAnimationFrame(tick);
  }
  function stopReplay() {
    if (replayFrame !== null) cancelAnimationFrame(replayFrame);
    replayFrame = null;
    state.reveal = 1;
  }

  el.animal.addEventListener("click", replay);
  el.look.addEventListener("click", () => setLook(retro() ? "smooth" : "retro"));
  el.change.addEventListener("click", () => { state.changeMode = (state.changeMode + 1) % 3; render(); });
  el.help.addEventListener("click", () => toggleSheet());
  el.sheet.addEventListener("click", () => toggleSheet(false));
  function toggleSheet(open = el.sheet.hidden) { el.sheet.hidden = !open; }

  demo.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const onButton = e.target.tagName === "BUTTON";
    const { pts } = series();
    let handled = true;
    if (k === "?") toggleSheet();
    else if (k === "Escape") {
      if (!el.sheet.hidden) toggleSheet(false);
      else if (state.scrub >= 0) { stopReplay(); state.scrub = -1; render(); }
      else handled = false;
    } else if (k === "ArrowLeft" || k === "h" || k === "ArrowRight" || k === "l") {
      const d = k === "ArrowLeft" || k === "h" ? -1 : 1;
      stopReplay();
      const from = state.scrub >= 0 ? state.scrub : pts.length - 1;
      state.scrub = Math.max(0, Math.min(pts.length - 1, from + d));
      render();
    } else if (k === "[" || k === "]") stepRange(k === "[" ? -1 : 1);
    else if (k === "ArrowUp" || k === "k" || k === "ArrowDown" || k === "j") {
      state.sel = (state.sel + (k === "ArrowUp" || k === "k" ? -1 : 1) + SYMBOLS.length) % SYMBOLS.length;
      renderRows();
    } else if ((k === "Enter" || k === " ") && !onButton) setSymbol(state.sel);
    else if (/^[1-4]$/.test(k)) { state.sel = Number(k) - 1; setSymbol(state.sel); }
    else if (k === "p") replay();
    else if (k === "c") { if (feat().range === "1D") { state.changeMode = (state.changeMode + 1) % 3; render(); } }
    else if (k === "s") setLook(retro() ? "smooth" : "retro");
    else handled = false;
    if (handled) e.preventDefault();
  });

  // ---- The pill

  const pill = document.getElementById("pill");
  const formButtons = document.querySelectorAll(".forms button");
  const FORMS = ["sparkline", "arrow", "text", "icon"];

  function renderPill() {
    const s = feat();
    const pct = dayPct(s);
    const t = tone(pct);
    const color = t === "up" ? COL.up : t === "down" ? COL.down : COL.fg;
    const small = innerWidth <= 640;
    const change = `<span class="${t}">${signed(pct, retro(), "%")}</span>`;
    const sym = `<span>${s.sym}</span>`;
    pill.innerHTML = "";
    if (state.form === "sparkline") {
      pill.innerHTML = `<canvas style="width:${small ? 39 : 51}px;height:${small ? 16 : 22}px"></canvas>${sym}${change}`;
      const { ctx, w, h } = fit(pill.querySelector("canvas"));
      if (retro()) drawRetro(ctx, w, h, s.day, s.prev, { pixel: small ? 2 : 3, gap: 1, scrub: -1, stem: 0.35 });
      else drawSmooth(ctx, w, h, s.day, s.prev, { pad: 2, scrub: -1, lineWidth: 1.5 });
    } else if (state.form === "arrow") {
      const angle = Math.min(45, (Math.abs(pct) / 5) * 45) * Math.sign(pct);
      pill.innerHTML = `<span class="arrow ${t}" style="transform:rotate(${-angle}deg)">➜</span>${sym}${change}`;
    } else if (state.form === "text") {
      pill.innerHTML = `${sym}<span>${money(s.price)}</span>${change}`;
    } else {
      pill.innerHTML = markSVG(small ? 3 : 4, 6, color, pct < 0);
    }
    pill.setAttribute("aria-label", `Stonks' pill, made-up prices: ${s.sym} ${signed(pct, false, "%")}. Click to change its form; scroll over it to step through the list.`);
    formButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.form === state.form)));
  }

  const nextForm = () => { state.form = FORMS[(FORMS.indexOf(state.form) + 1) % FORMS.length]; renderPill(); };
  pill.addEventListener("click", nextForm);
  pill.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); nextForm(); } });
  pill.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
  let wheelSum = 0, wheelAt = 0;
  pill.addEventListener("wheel", (e) => {
    e.preventDefault();
    wheelSum += e.deltaY;
    const now = performance.now();
    if (Math.abs(wheelSum) < 40 || now - wheelAt < 120) return;
    const d = wheelSum > 0 ? 1 : -1;
    wheelSum = 0; wheelAt = now;
    state.sel = (state.sym + d + SYMBOLS.length) % SYMBOLS.length;
    setSymbol(state.sel);
  }, { passive: false });
  formButtons.forEach((b) => b.addEventListener("click", () => { state.form = b.dataset.form; renderPill(); }));

  // ---- Themes

  const THEMES = [
    ["tokyo-night", "Tokyo Night"], ["catppuccin", "Catppuccin"], ["catppuccin-latte", "Catppuccin Latte"],
    ["ethereal", "Ethereal"], ["everforest", "Everforest"], ["flexoki-light", "Flexoki Light"],
    ["gruvbox", "Gruvbox"], ["hackerman", "Hackerman"], ["kanagawa", "Kanagawa"],
    ["last-horizon", "Last Horizon"], ["lumon", "Lumon"], ["lupine", "Lupine"],
    ["matte-black", "Matte Black"], ["miasma", "Miasma"], ["nord", "Nord"],
    ["osaka-jade", "Osaka Jade"], ["retro-82", "Retro 82"], ["ristretto", "Ristretto"],
    ["rose-pine", "Rosé Pine"], ["solitude", "Solitude"], ["vantablack", "Vantablack"], ["white", "White"],
  ];
  const themeGrid = document.querySelector(".theme-grid");
  const themeImg = document.querySelector(".theme-shot img");
  const themeCap = document.querySelector(".theme-shot figcaption");
  function setTheme(file, name) {
    themeImg.src = `img/themes/${file}.webp`;
    themeImg.alt = `Stonks' popup in retro, in the ${name} theme: block-digit price, pixel-column day chart, and the list.`;
    themeCap.textContent = `The retro popup in ${name}.`;
    for (const b of themeGrid.children) b.setAttribute("aria-pressed", String(b.dataset.file === file));
  }
  THEMES.forEach(([file, name]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.dataset.file = file;
    b.addEventListener("click", () => setTheme(file, name));
    themeGrid.appendChild(b);
  });
  setTheme(...THEMES[0]);

  // ---- Page cells: headings, sprites, the mark, the hero's ground

  function paintBlocks() {
    document.querySelectorAll(".blocks[data-text]").forEach((node) => {
      const cell = Number(node.dataset.cell);
      const small = innerWidth <= 640 && cell > 8 ? Math.round(cell * 0.62) : cell;
      node.innerHTML = blocksSVG(node.dataset.text, small, COL.fg, 5, 0.06);
    });
    document.querySelectorAll("[data-sprite]").forEach((node) => {
      const bull = node.dataset.sprite === "bull";
      node.innerHTML = spriteSVG(bull ? BULL : BEAR, 8, bull ? COL.up : COL.down);
    });
    document.querySelector("[data-mark]").innerHTML = markSVG(3, 6, COL.up, false);
  }

  // Omarchy's ground: scattered cells, thicker toward the edges.
  function paintScatter() {
    const canvas = document.querySelector(".scatter");
    const { ctx, w, h } = fit(canvas);
    const r = rng(5);
    const size = 12, pitch = 22;
    for (let y = 0; y < h; y += pitch) {
      for (let x = 0; x < w; x += pitch) {
        const edge = Math.abs(x / w - 0.5) * 2;
        const chance = Math.pow(edge, 6) * 0.6;
        if (r() < chance) {
          ctx.fillStyle = rgba(COL.accent, 0.06 + r() * 0.12);
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }

  // A long made-up chart under the hero, in the retro chart's cells.
  function paintSkyline() {
    const canvas = document.querySelector(".skyline");
    const { ctx, w, h } = fit(canvas);
    const r = rng(42);
    const n = 240;
    const pts = [];
    let val = 0;
    for (let i = 0; i < n; i++) {
      val = val * 0.97 + (r() - 0.5) * 1.6 + Math.sin(i / 19) * 0.35;
      pts.push({ x: i / (n - 1), v: val });
    }
    const small = innerWidth <= 640;
    drawRetro(ctx, w, h, pts, 0, { pixel: small ? 6 : 10, gap: 2, scrub: -1, stem: 0.18, cap: 0.55, ghost: 0.025 });
  }

  // ---- Copy buttons

  document.querySelectorAll("[data-copy]").forEach((box) => {
    const btn = box.querySelector(".copy");
    const cmd = "omarchy plugin add https://github.com/gmchande/omarchy-stonks.git --enable";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(cmd);
        btn.textContent = "Copied";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(box.querySelector("code"));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        btn.textContent = "Selected";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 1600);
    });
  });

  // ---- Start

  function paintAll() {
    paintBlocks();
    sizePriceCell();
    render();
    paintScatter();
    paintSkyline();
  }
  paintAll();
  if (document.fonts) document.fonts.ready.then(paintAll);
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(paintAll, 120);
  });

  // Attract mode: the first time the demo comes into view, it replays its day.
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); setTimeout(replay, 400); }
    }, { threshold: 0.6 });
    io.observe(el.chart);
  }
})();
