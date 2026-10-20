// The made-up market every popup on the page draws, and the words Stonks
// puts on it: a Tuesday in New York, in minutes since midnight. The phases,
// their names, and the header's words follow Stonks' Market.js; the prices
// are made up, the same on every visit.
window.Market = (() => {
  "use strict";

  const PRE = 4 * 60, OPEN = 9 * 60 + 30, CLOSE = 16 * 60, POST_END = 20 * 60;
  const PHASES = {
    closed: "Closed", pre: "Pre-market", opening: "Opening bell", open: "Market open",
    lunch: "Lunch lull", power: "Power hour", closing: "Closing bell", post: "After hours",
  };

  function phaseAt(m) {
    if (m >= PRE && m < OPEN) return "pre";
    if (m >= OPEN && m < CLOSE) {
      if (m < OPEN + 30) return "opening";
      if (m >= CLOSE - 5) return "closing";
      if (m >= CLOSE - 60) return "power";
      if (m >= 12 * 60 && m < 13 * 60) return "lunch";
      return "open";
    }
    if (m >= CLOSE && m < POST_END) return "post";
    return "closed";
  }
  const trading = (phase) => ["opening", "open", "lunch", "power", "closing"].includes(phase);

  const pad2 = (n) => String(n).padStart(2, "0");
  const hhmm = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;

  // Format.duration: "45m", "1h 05m", "5h".
  function duration(minutes) {
    const m = Math.ceil(minutes);
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}m`;
    return `${h}h${r ? ` ${pad2(r)}m` : ""}`;
  }

  // The header's top line at clock `m` (Market.marketStatus).
  function status(m) {
    const phase = phaseAt(m);
    if (trading(phase)) {
      const named = phase !== "open";
      return `${named ? `${PHASES[phase]} · closes in` : "Market closes in"} ${duration(CLOSE - m)}`;
    }
    if (phase === "pre") return `Pre-market · opens in ${duration(OPEN - m)}`;
    if (phase === "post") return `After hours · closed at ${hhmm(CLOSE)}`;
    return "Closed · opens Wed 09:30";
  }

  // Where a time sits along the day's chart: the regular session takes
  // most of the width, as it has most of the prints.
  function xOf(m) {
    if (m < OPEN) return ((m - PRE) / (OPEN - PRE)) * 0.2;
    if (m < CLOSE) return 0.2 + ((m - OPEN) / (CLOSE - OPEN)) * 0.6;
    return 0.8 + ((m - CLOSE) / (POST_END - CLOSE)) * 0.2;
  }
  const BELLS = [xOf(OPEN), xOf(CLOSE)];

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const round2 = (n) => Math.round(n * 100) / 100;

  function interp(anchors, m) {
    for (let i = 1; i < anchors.length; i++) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      if (m <= x1) return y0 + (y1 - y0) * ((m - x0) / (x1 - x0));
    }
    return anchors[anchors.length - 1][1];
  }

  // A print per five minutes, each at its bar's start: every bar of the
  // regular session, and the extended hours' thinner trade.
  function makeDay(prev, anchors, seed) {
    const r = rng(seed);
    const prints = [];
    let noise = 0;
    for (let m = PRE; m < POST_END; m += 5) {
      const ext = m < OPEN || m >= CLOSE;
      if (ext && r() < 0.4) continue;
      noise = noise * 0.6 + (r() - 0.5) * (ext ? 0.1 : 0.24);
      prints.push({ m, x: xOf(m), ext, v: round2(prev * (1 + (interp(anchors, m) + noise) / 100)) });
    }
    return prints;
  }

  const SYMBOLS = [
    { sym: "ARCADE", name: "Arcade Cabinets Inc", prev: 214.3, seed: 7, anchors: [
      [240, 0.1], [330, 0.35], [450, 0.2], [565, 0.45], [600, 0.85], [660, 0.35], [700, -0.45], [750, -1.05],
      [790, -0.4], [840, 1.25], [885, 0.61], [905, 0.2], [930, -0.3], [955, -0.42], [1000, -0.55], [1100, -0.4], [1195, -0.5]] },
    { sym: "PIXELS", name: "Pixel Foundry Co", prev: 88.42, seed: 11, anchors: [
      [240, -0.1], [565, 0.3], [600, 0.45], [700, -0.3], [800, -0.9], [885, -1.42], [955, -1.6], [1195, -1.5]] },
    { sym: "JOYPAD", name: "Joypad Industries", prev: 41.07, seed: 23, anchors: [
      [240, 0.2], [565, 0.6], [600, 0.3], [700, 1.1], [800, 0.75], [885, 2.08], [955, 2.3], [1195, 2.4]] },
    { sym: "HISCORE", name: "High Score Holdings", prev: 1286.5, seed: 31, anchors: [
      [240, 0], [565, -0.05], [600, -0.1], [700, 0.35], [800, -0.2], [860, 0.12], [885, -0.27], [955, -0.1], [1195, -0.15]] },
  ];
  for (const s of SYMBOLS) s.prints = makeDay(s.prev, s.anchors, s.seed);

  const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // What a listing shows at clock `now`: the prints so far, the headline
  // (the regular session's price; before the open, yesterday's close), its
  // move from the previous close, and the extended-hours line under it.
  function quoteAt(s, now) {
    const prints = s.prints.filter((p) => p.m < now);
    const regular = prints.filter((p) => !p.ext);
    const phase = phaseAt(now);
    const price = regular.length ? regular[regular.length - 1].v : s.prev;
    const last = prints[prints.length - 1];
    const ext = !trading(phase) && last && last.ext && money(last.v) !== money(price)
      ? { label: last.m < OPEN ? "PRE-MARKET" : "AFTER HOURS", v: last.v, pct: ((last.v - price) / price) * 100 }
      : null;
    let lastRegular = -1;
    prints.forEach((p, i) => { if (!p.ext) lastRegular = i; });
    return {
      prints, price, phase, ext, lastRegular,
      pct: ((price - s.prev) / s.prev) * 100,
      open: regular.length ? regular[0].v : null,
      low: regular.length ? Math.min(...regular.map((p) => p.v)) : null,
      high: regular.length ? Math.max(...regular.map((p) => p.v)) : null,
      caption: trading(phase) ? "" : "AT CLOSE",
      asleep: phase === "closed",
      status: status(now),
    };
  }

  // A scrubbed moment: the print's price and where it sits in the day. The
  // session's last regular print reads the close, at the bell, once the
  // session has ended.
  function readingAt(prints, i, now) {
    const p = prints[i];
    const isClose = now >= CLOSE && !p.ext && (i + 1 === prints.length || prints[i + 1].ext);
    const phase = isClose ? "closing" : p.ext ? (p.m < OPEN ? "pre" : "post") : phaseAt(p.m);
    return { v: p.v, status: `At ${hhmm(isClose ? CLOSE : p.m)} · ${PHASES[phase]}` };
  }

  return { PRE, OPEN, CLOSE, POST_END, BELLS, SYMBOLS, rng, round2, hhmm, money, quoteAt, readingAt, phaseAt };
})();
