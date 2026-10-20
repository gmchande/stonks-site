// Drawing: Stonks' block digits and sprites (from its Cells.js), the retro
// and smooth charts, the drawn bull and bear. Knows no prices.
window.Cells = (() => {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const COL = {
    bg: v("--bg"), deep: v("--bg-deep"), fg: v("--fg"), text: v("--text"), muted: v("--muted"),
    faint: v("--faint"), up: v("--up"), down: v("--down"), accent: v("--accent"), line: v("--line"),
  };
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

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
    ":": ["0", "1", "0", "1", "0"],
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
  // The eyes shut as retro steps them: the bull's lowered to slits, the
  // bear's covered and opened as slits at eye level.
  const BULL_SHUT = BULL.slice();
  BULL_SHUT[6] = "...##############...";
  BULL_SHUT[7] = ".....#..####..#.....";
  const BEAR_SHUT = BEAR.slice();
  BEAR_SHUT[6] = ".####..######..####.";
  const SLEEP_Z = ["###", "..#", ".#.", "#..", "###"];

  function spriteSVG(rows, cell, color) {
    const w = rows[0].length * cell;
    const h = rows.length * cell;
    let rects = "";
    rows.forEach((row, y) => {
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

  const sprite = (bull, asleep) => (bull ? (asleep ? BULL_SHUT : BULL) : (asleep ? BEAR_SHUT : BEAR));

  // Stonks' mark: a small chart that climbs, in cells; falling is the same mirrored.
  function markSVG(cell, rows, color, falling) {
    let levels = [0.9, 0.45, 0.75, 0.25, 0.05].map((y) => Math.round(y * (rows - 1)));
    if (falling) levels = levels.reverse();
    const w = (levels.length * 2 - 1) * cell;
    const h = rows * cell;
    const rects = levels.map((lv, i) =>
      `<rect x="${i * 2 * cell}" y="${lv * cell}" width="${cell}" height="${(rows - lv) * cell}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  }

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

  // The retro chart, as Stonks' PixelChart draws it: a faint grid, the
  // baseline as every other cell, a stem from each cap to the baseline at
  // the wash's alpha, the cap at full colour; extended hours dimmer.
  // `o.scale` is the points' value range when it must hold still while
  // the points fill in.
  function drawRetro(ctx, w, h, pts, base, o) {
    const pixel = o.pixel, gap = o.gap, pitch = pixel + gap;
    const cols = Math.max(1, Math.floor(w / pitch));
    const rows = Math.max(1, Math.floor(h / pixel));
    const norm = normFor(o.scale || pts, base);
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
    const ext = [];
    const colOf = (p) => Math.min(cols - 1, Math.floor(p.x * cols));
    for (const p of pts) {
      const c = colOf(p);
      levels[c] = Math.round(norm(p.v) * (rows - 1));
      ext[c] = !!p.ext;
    }
    const reveal = o.reveal == null || o.reveal >= 1 ? cols : Math.ceil(cols * o.reveal);
    const stem = o.stem || 0.35;
    for (let c = 0; c < reveal; c++) {
      const lv = levels[c];
      if (lv === undefined) continue;
      const color = lv <= baseRow ? COL.up : COL.down;
      const y = lv * pixel;
      const top = Math.min(y, baseY);
      const hh = Math.abs(y - baseY);
      if (hh > 0) {
        ctx.fillStyle = rgba(color, ext[c] ? stem * 0.45 : stem);
        ctx.fillRect(c * pitch, top, pixel, hh);
      }
      ctx.fillStyle = rgba(color, (o.cap || 1) * (ext[c] ? 0.45 : 1));
      ctx.fillRect(c * pitch, y, pixel, pixel);
    }
    if (o.scrub >= 0 && pts[o.scrub]) {
      const c = colOf(pts[o.scrub]);
      ctx.fillStyle = rgba(COL.fg, 0.3);
      ctx.fillRect(c * pitch, 0, pixel, h);
      ctx.fillStyle = COL.fg;
      ctx.fillRect(c * pitch, levels[c] * pixel, pixel, pixel);
    } else if (o.lastCap >= 0 && pts[o.lastCap] && reveal >= cols) {
      const c = colOf(pts[o.lastCap]);
      ctx.fillStyle = COL.fg;
      ctx.fillRect(c * pitch, levels[c] * pixel, pixel, pixel);
    }
  }

  // The smooth chart: one line in the day's colours either side of the
  // baseline, a wash under it, a dashed baseline; extended hours dimmer.
  function drawSmooth(ctx, w, h, pts, base, o) {
    if (!pts.length) return;
    const pad = o.pad == null ? 6 : o.pad;
    const norm = normFor(o.scale || pts, base);
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
    // Runs of regular and extended prints, each joined to the next.
    const runs = [];
    pts.forEach((p, i) => {
      const last = runs[runs.length - 1];
      if (!last || last.ext !== !!p.ext) {
        const run = { ext: !!p.ext, pts: i ? [pts[i - 1]] : [] };
        runs.push(run);
      }
      runs[runs.length - 1].pts.push(p);
    });
    for (const run of runs) {
      const line = new Path2D();
      run.pts.forEach((p, i) => (i ? line.lineTo(X(p.x), Y(p.v)) : line.moveTo(X(p.x), Y(p.v))));
      const area = new Path2D(line);
      area.lineTo(X(run.pts[run.pts.length - 1].x), by);
      area.lineTo(X(run.pts[0].x), by);
      area.closePath();
      const a = run.ext ? 0.45 : 1;
      for (const [color, y0, y1] of [[COL.up, 0, by], [COL.down, by, h]]) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, y0, clipW, y1 - y0); ctx.clip();
        ctx.fillStyle = rgba(color, 0.16 * a);
        ctx.fill(area);
        ctx.strokeStyle = rgba(color, a);
        ctx.lineWidth = o.lineWidth || 1.5;
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.stroke(line);
        ctx.restore();
      }
    }
    const dot = (p, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.v), r, 0, Math.PI * 2); ctx.fill();
    };
    if (o.scrub >= 0 && pts[o.scrub]) {
      const p = pts[o.scrub];
      ctx.fillStyle = rgba(COL.fg, 0.6);
      ctx.fillRect(Math.round(X(p.x)), 0, 1, h);
      dot(p, 4, COL.fg);
    } else if (o.lastCap >= 0 && pts[o.lastCap] && clipW >= w) {
      const p = pts[o.lastCap];
      dot(p, 4, p.v >= base ? COL.up : COL.down);
    }
  }

  // The smooth bull and bear, from Stonks' DrawnAnimal: one round line and
  // a wash, drawn on a 40 by 28 grid; `lids` 0 open, 1 shut.
  function drawAnimal(ctx, bull, color, lids) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.fillStyle = rgba(color, 0.16);
    const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const eye = (x, y, r) => {
      const slit = ctx.lineWidth / 2 / r;
      ctx.save();
      ctx.translate(x, y + r * 0.4 * lids);
      ctx.scale(1 + 0.6 * lids, 1 - (1 - slit) * lids);
      dot(0, 0, r);
      ctx.restore();
    };
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
      eye(17, 13.2, 1.15); eye(23, 13.2, 1.15); dot(17.6, 21.6, 0.95); dot(22.4, 21.6, 0.95);
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
      eye(15.52, 13.76, 1.29); eye(24.48, 13.76, 1.29);
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

  return {
    COL, rgba, blockCells, blocksSVG, spriteSVG, sprite, SLEEP_Z, BULL, BEAR, markSVG,
    fit, drawRetro, drawSmooth, drawAnimal, drawRule,
  };
})();
