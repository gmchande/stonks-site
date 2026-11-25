// The made-up market every panel on the page draws, and the words Stonks
// puts on it: a Tuesday in New York, in minutes since its midnight, the
// Monday before it, a day earlier, and Tuesday night until midnight, which
// every made-up stock trades, as the US stocks Robinhood trades at night
// do. The phases, their names, and the header's words follow Stonks'
// Market.js; the prices are made up, the same on every visit.
window.Market = (() => {
  "use strict";

  const PRE = 4 * 60, OPEN = 9 * 60 + 30, CLOSE = 16 * 60, POST_END = 20 * 60, DAY = 24 * 60;
  const PHASES = {
    closed: "Closed", pre: "Pre-market", opening: "Opening bell", open: "Market open",
    lunch: "Lunch lull", power: "Power hour", closing: "Closing bell", post: "After hours", overnight: "Overnight",
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
    if (m >= POST_END) return "overnight";
    return "closed";
  }
  const trading = (phase) => ["opening", "open", "lunch", "power", "closing"].includes(phase);

  const pad2 = (n) => String(n).padStart(2, "0");
  const hhmm = (m) => `${pad2(Math.floor((((m % DAY) + DAY) % DAY) / 60))}:${pad2(((m % 60) + 60) % 60)}`;

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
    if (phase === "overnight") return "Overnight · opens Wed 09:30";
    return "Closed · opens Wed 09:30";
  }

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

  // A print per five minutes from `from`, each at its bar's start: every
  // bar of the regular session, and the extended hours' thinner trade.
  // `day` moves the prints to their day: -DAY for Monday's.
  function makeDay(prev, anchors, seed, from, day) {
    const r = rng(seed);
    const prints = [];
    let noise = 0;
    for (let m = from; m < POST_END; m += 5) {
      const ext = m < OPEN || m >= CLOSE;
      if (ext && r() < 0.4) continue;
      noise = noise * 0.6 + (r() - 0.5) * (ext ? 0.1 : 0.24);
      prints.push({ m: m + day, ext, v: round2(prev * (1 + (interp(anchors, m) + noise) / 100)) });
    }
    return prints;
  }

  // Tonight's trade, from 20:00 to midnight, thinner still: a print per
  // five minutes on most bars, from Tuesday's close `close` by `anchors`.
  function makeNight(close, anchors, seed) {
    const r = rng(seed);
    const prints = [];
    let noise = 0;
    for (let m = POST_END; m < DAY; m += 5) {
      if (r() < 0.3) continue;
      noise = noise * 0.6 + (r() - 0.5) * 0.12;
      prints.push({ m, ext: true, night: true, v: round2(close * (1 + (interp(anchors, m) + noise) / 100)) });
    }
    return prints;
  }

  // `vol` is a whole day's volume, `shares` the shares out (for the market
  // cap), `eps` the last year's earnings per share (for the P/E). `prev` is
  // Monday's close; `anchors` draw Tuesday from it, `night` draws Tuesday
  // night from Tuesday's close, and `monday` draws Monday from its
  // pre-market from Friday's close, which its anchor at 15:55 puts Monday's
  // close above or below.
  const SYMBOLS = [
    { sym: "ARCADE", name: "Arcade Cabinets Inc", prev: 214.3, seed: 7, vol: 18.6e6, shares: 412e6, eps: 7.86, anchors: [
      [240, 0.1], [330, 0.35], [450, 0.2], [565, 0.45], [600, 0.85], [660, 0.35], [700, -0.45], [750, -1.05],
      [790, -0.4], [840, 1.25], [885, 0.61], [905, 0.2], [930, -0.3], [955, -0.42], [1000, -0.55], [1100, -0.4], [1195, -0.5]],
    monday: [[240, 0.1], [570, 0.3], [620, 1.2], [700, 1.6], [780, 1.05], [850, 1.9], [910, 1.3], [955, 0.85], [1000, 0.95], [1100, 0.8], [1195, 0.9]],
    night: [[1200, 0.05], [1250, 0.3], [1300, 0.15], [1370, 0.5], [1435, 0.65]] },
    { sym: "PIXELS", name: "Pixel Foundry Co", prev: 88.42, seed: 11, vol: 9.37e6, shares: 1.27e9, eps: 2.41, anchors: [
      [240, -0.1], [565, 0.3], [600, 0.45], [700, -0.3], [800, -0.9], [885, -1.42], [955, -1.6], [1195, -1.5]],
    monday: [[240, 0.05], [570, -0.2], [650, -0.9], [760, -0.35], [860, -1.1], [955, -0.6], [1195, -0.55]],
    night: [[1200, 0], [1435, -0.2]] },
    { sym: "JOYPAD", name: "Joypad Industries", prev: 41.07, seed: 23, vol: 4.13e6, shares: 236e6, eps: 1.19, anchors: [
      [240, 0.2], [565, 0.6], [600, 0.3], [700, 1.1], [800, 0.75], [885, 2.08], [955, 2.3], [1195, 2.4]],
    monday: [[240, 0.15], [570, 0.4], [680, 1.0], [800, 1.75], [900, 1.2], [955, 1.4], [1195, 1.5]],
    night: [[1200, 0.05], [1435, 0.3]] },
    { sym: "HISCORE", name: "High Score Holdings", prev: 1286.5, seed: 31, vol: 0.83e6, shares: 51.6e6, eps: 38.4, anchors: [
      [240, 0], [565, -0.05], [600, -0.1], [700, 0.35], [800, -0.2], [860, 0.12], [885, -0.27], [955, -0.1], [1195, -0.15]],
    monday: [[240, 0], [570, 0.1], [700, -0.3], [820, 0.05], [955, -0.2], [1195, -0.25]],
    night: [[1200, 0], [1435, 0.05]] },
  ];
  for (const s of SYMBOLS) {
    s.fri = round2(s.prev / (1 + interp(s.monday, CLOSE - 5) / 100));
    s.monday = makeDay(s.fri, s.monday, s.seed + 1000, PRE, -DAY);
    s.monday.findLast((p) => !p.ext).v = s.prev;
    s.prints = makeDay(s.prev, s.anchors, s.seed, PRE, 0);
    s.close = s.prints.findLast((p) => !p.ext).v;
    s.prints = s.prints.concat(makeNight(s.close, s.night, s.seed + 2000));
  }

  const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function big(n) {
    for (const [unit, size] of [["T", 1e12], ["B", 1e9], ["M", 1e6], ["K", 1e3]]) if (n >= size) return (n / size).toPrecision(3) + unit;
    return String(Math.round(n));
  }

  // What a listing shows at clock `now`, as Stonks' panel shows a US stock:
  // on top its newest trade (`price`), and its move from the close the
  // chart's dashed line marks (`base`), named under it (`name`). Under the
  // price, the close by its day's name (`close`): with that day's move from
  // `close.from` while the price on top is a trade since, and the part of a
  // whole day's move since its close (`close.since`), its after hours. Before
  // Tuesday's first print, Monday's whole day, after hours in it. From
  // tonight's first trade, the move counts from Tuesday's close, and the
  // close keeps Tuesday's move. Every trade of the day counts in its low and
  // high, the pre-market's too.
  function quoteAt(s, now) {
    const prints = s.prints.filter((p) => p.m < now);
    const regular = prints.filter((p) => !p.ext);
    const phase = phaseAt(now);
    const newest = prints.length ? prints[prints.length - 1] : s.monday[s.monday.length - 1];
    let base = s.prev, name = "TODAY", close = { label: "MON CLOSE", v: s.prev, from: null, since: false };
    if (!prints.length) {
      base = s.fri;
      name = "MON";
      close = { label: "MON CLOSE", v: s.prev, from: s.fri, since: true };
    } else if (newest.m < OPEN) {
      name = "PRE-MARKET";
      close = { label: "MON CLOSE", v: s.prev, from: s.fri, since: false };
    } else if (newest.night) {
      base = s.close;
      name = "OVERNIGHT";
      close = { label: "CLOSE", v: s.close, from: s.prev, since: false };
    } else if (newest.ext) {
      close = { label: "CLOSE", v: regular[regular.length - 1].v, from: s.prev, since: true };
    }
    return {
      prints, phase, base, name, close,
      price: newest.v,
      pct: ((newest.v - base) / base) * 100,
      open: regular.length ? regular[0].v : null,
      low: regular.length ? Math.min(...prints.map((p) => p.v)) : null,
      volume: s.vol * (regular.length / s.prints.filter((p) => !p.ext).length),
      high: regular.length ? Math.max(...prints.map((p) => p.v)) : null,
      asleep: phase === "closed",
      status: status(now),
    };
  }

  // Where minute `m` sits along an axis that runs by the clock, the hours
  // `axis.skip` covers taking no room (Stonks' Chart.clockRoom).
  function room(axis, m) {
    const skipped = axis.skip ? Math.max(0, Math.min(m, axis.skip.to) - axis.skip.from) : 0;
    return m - axis.start - skipped;
  }

  // Once the open has come and the day has three five-minute bars, counted
  // from 04:00, the chart turns to it (Stonks' CarriedClose.FIRST_BARS).
  const FIRST_BARS = 3;

  // The day Stonks' 1D chart draws at clock `now`, for a stock that trades
  // at night (its Day.sessionDay). From 04:00, its pre-market, on an axis
  // that runs by the clock to 20:00, so the hours to come stay empty.
  // Until Tuesday's open, and after it until Tuesday has three bars,
  // Monday's day, with what Tuesday has traded joined at its end: the night
  // between, which Monday's made-up market didn't trade, takes no room, and
  // the axis runs on to now. From the first print joined, the dashed line
  // is Monday's close, and Monday up to its close, which the move doesn't
  // count, is set aside (`aside`, the share of the width it takes). From
  // tonight's first trade, the same for Tuesday: tonight joins its end, the
  // axis runs on to now, the dashed line is Tuesday's close, and Tuesday up
  // to its close is set aside. `ticks` are the open, the bell, and where
  // the joined hours begin; `lastCap` the newest bright print; `scale`
  // every print the chart can draw before it turns, and both closes;
  // `closeAt(m)` the close a scrubbed print at minute `m` counts from, by
  // name.
  function dayAt(s, now) {
    const today = s.prints.filter((p) => p.m < now);
    const turnsAt = Math.max(OPEN, s.prints[FIRST_BARS - 1].m + 1);
    const turned = now >= turnsAt;
    const joined = !turned && today.length > 0;
    const tonight = turned && !!today[today.length - 1].night;
    const monClose = CLOSE - DAY;
    let pts, axis, scale;
    if (turned) {
      pts = today;
      axis = tonight
        ? { start: PRE, end: now, ticks: [OPEN, CLOSE, POST_END] }
        : { start: PRE, end: now >= POST_END ? pts[pts.length - 1].m : POST_END, ticks: [OPEN, CLOSE] };
      scale = s.prints;
    } else {
      pts = s.monday.concat(today);
      axis = joined
        ? { start: PRE - DAY, end: now, ticks: [OPEN - DAY, monClose, PRE], skip: { from: POST_END - DAY, to: PRE } }
        : { start: PRE - DAY, end: s.monday[s.monday.length - 1].m, ticks: [OPEN - DAY, monClose] };
      scale = s.monday.concat(s.prints.filter((p) => p.m < turnsAt), [{ v: s.fri }]);
    }
    const xOf = (m) => room(axis, m) / room(axis, axis.end);
    const aside = tonight ? CLOSE : joined ? monClose : -Infinity;
    const fri = { label: "FRI CLOSE", v: s.fri }, mon = { label: "MON CLOSE", v: s.prev }, tue = { label: "CLOSE", v: s.close };
    const closeAt = (m) => (tonight ? (m >= aside ? tue : mon) : turned || (joined && m >= aside) ? mon : fri);
    let lastCap = -1;
    pts.forEach((p, i) => { if ((!p.ext || p.night) && p.m >= aside) lastCap = i; });
    return {
      pts: pts.map((p) => ({ m: p.m, v: p.v, ext: p.ext, night: p.night, x: xOf(p.m) })),
      base: closeAt(Infinity).v,
      ticks: axis.ticks.map(xOf).filter((x) => x > 0 && x < 1),
      aside: joined || tonight ? xOf(aside) : 0,
      scale, lastCap, closeAt,
    };
  }

  // A scrubbed moment: the print's price and where it sits in its day,
  // Monday's named. The session's last regular print reads the close, at
  // the bell, once the session has ended.
  function readingAt(prints, i, now) {
    const p = prints[i];
    const monday = p.m < 0;
    const m = monday ? p.m + DAY : p.m;
    const isClose = (monday || now >= CLOSE) && !p.ext && (i + 1 === prints.length || prints[i + 1].ext);
    const phase = isClose ? "closing" : p.night ? "overnight" : p.ext ? (m < OPEN ? "pre" : "post") : phaseAt(m);
    return { v: p.v, status: `At ${monday ? "Mon " : ""}${hhmm(isClose ? CLOSE : m)} · ${PHASES[phase]}` };
  }

  // A listing's price at minute `m` of the day: its last print by then,
  // or the previous close before its first.
  function priceAt(prints, prev, m) {
    let v = prev;
    for (const p of prints) if (p.m <= m) v = p.v;
    return v;
  }

  return { PRE, OPEN, CLOSE, POST_END, SYMBOLS, rng, round2, hhmm, money, big, quoteAt, dayAt, readingAt, priceAt, phaseAt };
})();
