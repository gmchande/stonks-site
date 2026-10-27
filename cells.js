// Drawing: Stonks' block digits and pixel sprites (from its Cells.js), and
// the retro and smooth charts. Knows no prices.
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
  // A row's remove button in retro: an × in the rows' 2 px cells.
  const REMOVE = ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"];

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

  // The header's speaker and camera and the rows' unit signs, as Stonks'
  // Cells.js draws them: each a path on a grid of cells 3 px apart, scaled
  // with the cell, the pen with it (GridIcon). "A" is an arc: center,
  // radius, from and to degrees, clockwise.
  const SOUND_CONE = [["M", 0.5, 3.5], ["L", 3.5, 3.5], ["L", 7.5, 0.5], ["L", 7.5, 10.5], ["L", 3.5, 7.5], ["L", 0.5, 7.5], ["Z"], ["fill"]];
  const CAMERA_BODY = [["M", 0.5, 3], ["L", 4.8, 3], ["L", 6.3, 0.5], ["L", 10.7, 0.5], ["L", 12.2, 3], ["L", 16.5, 3], ["L", 16.5, 10.5], ["L", 0.5, 10.5], ["Z"],
    ["M", 11.3, 6.6], ["A", 8.5, 6.6, 2.8, 0, 359.9], ["Z"], ["hollow"]];
  const ICONS = {
    soundOn: { columns: 6, rows: 4, path: SOUND_CONE.concat([["A", 7, 5.5, 3.8, -50, 50], ["stroke"], ["A", 7, 5.5, 7.4, -50, 50], ["stroke"]]) },
    soundOff: { columns: 6, rows: 4, path: SOUND_CONE.concat([["M", 10.5, 3.5], ["L", 14.5, 7.5], ["stroke"], ["M", 14.5, 3.5], ["L", 10.5, 7.5], ["stroke"]]) },
    camera: { columns: 6, rows: 4, path: CAMERA_BODY },
    cameraLit: { columns: 6, rows: 4, path: CAMERA_BODY.concat([["dot", 8.5, 6.6, 1.6]]) },
    pct: { columns: 4, rows: 4, path: [["dot", 3, 3, 2.1], ["dot", 9.5, 8.5, 2.1], ["M", 10.5, 0.8], ["L", 2, 10.7], ["stroke"]] },
    abs: { columns: 4, rows: 4, path: [["M", 6.25, 0.8], ["L", 6.25, 7.2], ["stroke"], ["M", 2.6, 4], ["L", 9.9, 4], ["stroke"],
      ["M", 2.6, 10.4], ["L", 9.9, 10.4], ["stroke"]] },
    open: { columns: 4, rows: 4, path: [["A", 6.25, 4.6, 3.3, 180, 360], ["L", 9.55, 7.4], ["L", 11.4, 9.1], ["L", 1.1, 9.1], ["L", 2.95, 7.4], ["Z"], ["fill"],
      ["dot", 6.25, 10.3, 1.3], ["dot", 6.25, 1.1, 0.9]] },
  };

  function iconSVG(name, cell, color) {
    const shape = ICONS[name];
    const s = cell / 3, w = shape.columns * cell - 1, h = shape.rows * cell - 1;
    const at = (cx, cy, r, deg) => `${(cx + r * Math.cos(deg * Math.PI / 180)).toFixed(3)} ${(cy + r * Math.sin(deg * Math.PI / 180)).toFixed(3)}`;
    let d = "", out = "";
    for (const o of shape.path) {
      if (o[0] === "M" || o[0] === "L") d += `${o[0]}${o[1]} ${o[2]}`;
      else if (o[0] === "A") {
        const [, cx, cy, r, a0, a1] = o;
        d += `M${at(cx, cy, r, a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${at(cx, cy, r, a1)}`;
      } else if (o[0] === "Z") d += "Z";
      else if (o[0] === "dot") out += `<circle cx="${o[1]}" cy="${o[2]}" r="${o[3]}" fill="${color}"/>`;
      else {
        if (o[0] === "stroke") out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        else out += `<path d="${d}" fill="${color}"${o[0] === "hollow" ? ` fill-rule="evenodd"` : ""}/>`;
        d = "";
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${(w / s).toFixed(2)} ${(h / s).toFixed(2)}" aria-hidden="true">${out}</svg>`;
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

  // `room` is the share of the range kept clear above and below the line.
  function normFor(pts, base, room = 0.08) {
    let lo = base, hi = base;
    for (const p of pts) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); }
    const pad = (hi - lo) * room || 1;
    lo -= pad; hi += pad;
    return (value) => (hi - value) / (hi - lo);
  }

  // A range's high and low marked on the chart, as Stonks' RangeMarks: the
  // price, then its date, over the high and under the low, running from
  // the point toward the chart's middle. `at(i, v)` is where value v sits
  // at print i: a mark's value can be today's low or high, not a print.
  function drawMarks(ctx, w, h, marks, at) {
    ctx.save();
    ctx.font = `12px ${v("--mono")}`;
    for (const m of marks) {
      const { x, top, bottom } = at(m.i, m.v);
      const value = `${m.value} `;
      const width = ctx.measureText(value + m.date).width;
      const left = Math.max(0, Math.min(w - width, x > w / 2 ? x - width : x));
      const y = m.low ? Math.min(h - 2, bottom + 15) : Math.max(11, top - 6);
      ctx.fillStyle = COL.fg;
      ctx.fillText(value, left, y);
      ctx.fillStyle = COL.muted;
      ctx.fillText(m.date, left + ctx.measureText(value).width, y);
    }
    ctx.restore();
  }

  // The retro chart, as Stonks' PixelChart draws it: a faint grid, the
  // baseline as every other cell, a stem from each cap to the baseline at
  // the wash's alpha, the cap at full color; extended hours dimmer.
  // `o.scale` is the points' value range when it must hold still while
  // the points fill in. Returns the grid it drew, which the chimes play.
  function drawRetro(ctx, w, h, pts, base, o) {
    const pixel = o.pixel, gap = o.gap, pitch = pixel + gap;
    const cols = Math.max(1, Math.floor(w / pitch));
    const rows = Math.max(1, Math.floor(h / pixel));
    const norm = normFor((o.scale || pts).concat(o.marks || []), base, o.marks ? 0.2 : 0.08);
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
    // A column shows its last print, but a marked high or low print shows itself.
    for (const m of o.marks || []) if (pts[m.i].v === m.v) levels[colOf(pts[m.i])] = Math.round(norm(m.v) * (rows - 1));
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
    if (o.marks && reveal >= cols) {
      drawMarks(ctx, w, h, o.marks, (i, value) => {
        const row = Math.round(norm(value) * (rows - 1));
        return { x: colOf(pts[i]) * pitch + pixel / 2, top: row * pixel, bottom: (row + 1) * pixel };
      });
    }
    return { retro: true, grid: { columns: cols, rows, levels, baseRow } };
  }

  // The smooth chart: one line in the day's colors either side of the
  // baseline, a wash under it, a dashed baseline; extended hours dimmer.
  // Returns its points' heights, 0 at the top, which the chimes play.
  function drawSmooth(ctx, w, h, pts, base, o) {
    if (!pts.length) return;
    const pad = o.pad == null ? 6 : o.pad;
    const norm = normFor((o.scale || pts).concat(o.marks || []), base, o.marks ? 0.2 : 0.08);
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
    if (o.marks && clipW >= w) drawMarks(ctx, w, h, o.marks, (i, value) => ({ x: X(pts[i].x), top: Y(value), bottom: Y(value) }));
    return { retro: false, geometry: { points: pts.map((p) => ({ x: p.x, y: norm(p.v) })) } };
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
    COL, rgba, blockCells, blocksSVG, spriteSVG, sprite, SLEEP_Z, REMOVE, BULL, BEAR, markSVG, iconSVG,
    fit, drawRetro, drawSmooth, drawRule,
  };
})();
