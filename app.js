// Stonks' landing page: the popups, the day, the pill, the themes, the keys.
// Every price drawn here is made up (market.js).
(() => {
  "use strict";

  const { COL, rgba } = Cells;
  const { money } = Market;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const HERO_CLOCK = 14 * 60 + 45;

  const tone = (n) => (n > 0.004 ? "up" : n < -0.004 ? "down" : "");
  function signed(n, retro, suffix) {
    if (Math.abs(n) < 0.005) return money(0) + suffix;
    const a = money(Math.abs(n)) + suffix;
    if (retro) return (n > 0 ? "▲" : "▼") + a;
    return (n > 0 ? "+" : "\u2212") + a;
  }

  // ---- The look, page-wide: every popup, the pill, and the theme picture.

  const Look = {
    value: "retro",
    listeners: [],
    get retro() { return this.value === "retro"; },
    set(look) {
      this.value = look;
      this.listeners.forEach((fn) => fn());
    },
    toggle() { this.set(this.retro ? "smooth" : "retro"); },
    on(fn) { this.listeners.push(fn); },
  };

  // ---- A chart's scrub and replay, the same on every chart here. A scrub
  // lands on the print nearest the pointer and strikes the chart's chime
  // there. A replay is a scrub that drives itself over 2 s on InOutSine, as
  // Stonks' does, its sound made from the chart as drawn when it starts.

  const REPLAY_MS = 2000;
  const inOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2;

  function nearest(pts, f) {
    let best = 0;
    for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - f) < Math.abs(pts[best].x - f)) best = i;
    return f > pts[pts.length - 1].x ? pts.length - 1 : best;
  }

  // `step(scrub, reveal)` draws each frame, then (-1, 1) at the end. The
  // picture and the sound start together, once the sound can be heard
  // (`Sound.whenHeard`), and the picture keeps to what the speakers have
  // played (the replay's clock), never more than 1 s behind the page's own.
  // Returns the replay's stop, which stops its sound too, or drops its wait.
  function sweep(pts, chart, step) {
    const from = pts[0].x, to = pts[pts.length - 1].x;
    let frame = 0;
    const drop = Sound.whenHeard(() => {
      const heard = Sound.replay(chart, from, to, REPLAY_MS / 1000);
      const t0 = performance.now();
      let f = 0;
      const tick = (t) => {
        const ms = heard ? Math.max(heard() * 1000, t - t0 - 1000) : t - t0;
        f = Math.max(f, Math.min(1, ms / REPLAY_MS));
        const x = from + inOutSine(f) * (to - from);
        let i = 0;
        while (i + 1 < pts.length && pts[i + 1].x <= x) i++;
        frame = f < 1 ? requestAnimationFrame(tick) : 0;
        step(f < 1 ? i : -1, f < 1 ? x + 0.0001 : 1);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => {
      drop();
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
      Sound.stopReplay();
    };
  }

  // ---- History for the ranges: every range is a slice of one made-up
  // history, so a range's high is never above the 52 weeks' it sits in.

  const HISTORY_DAYS = 5040;
  const TODAY = new Date();
  const RANGES = [
    ["1D", 0], ["1W", 5], ["1M", 21], ["3M", 63], ["6M", 126],
    ["YTD", Math.max(5, Math.round(((TODAY - new Date(TODAY.getFullYear(), 0, 1)) / 864e5) * 5 / 7))],
    ["1Y", 252], ["2Y", 504], ["5Y", 1260], ["10Y", 2520], ["ALL", HISTORY_DAYS],
  ];
  const SESSIONS = [];
  for (let d = new Date(TODAY); SESSIONS.length <= HISTORY_DAYS; d = new Date(d - 864e5)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) SESSIONS.push(d);
  }
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function history(s) {
    if (s.hist) return s.hist;
    const r = Market.rng(s.seed * 131);
    const closes = new Array(HISTORY_DAYS);
    let lv = Math.log(s.prev);
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      closes[i] = Market.round2(Math.exp(lv));
      lv -= 0.0004 + (r() - 0.5) * 0.035;
    }
    s.hist = closes;
    return closes;
  }

  // A range at the hero's clock: its points, its low and high (`lo`, `hi`),
  // and which points they are (`loI`, `hiI`), which the chart marks. The
  // range's lowest and highest closes are always among its points, and, as
  // in Stonks, today's low and high count too, marked on today.
  function rangeSeries(s, key, q) {
    s.ranges = s.ranges || {};
    if (s.ranges[key]) return s.ranges[key];
    const back = RANGES.find((r) => r[0] === key)[1];
    const closes = history(s);
    const today = q.prints.filter((p) => !p.ext);
    let pts;
    if (key === "1W") {
      pts = [];
      const r = Market.rng(s.seed * 7 + 1);
      for (let k = 4; k >= 1; k--) {
        const from = closes[HISTORY_DAYS - k - 1];
        const to = closes[HISTORY_DAYS - k];
        for (let h = 0; h < 13; h++) {
          const v = from + (to - from) * (h / 13) + (h ? (r() - 0.5) * to * 0.006 : 0);
          pts.push({ v: Market.round2(v), d: SESSIONS[k], m: Market.OPEN + h * 30 });
        }
      }
      today.forEach((p, i) => { if (p.m % 30 === 0 || i === today.length - 1) pts.push({ v: p.v, d: SESSIONS[0], m: p.m }); });
    } else {
      const n = Math.min(back, HISTORY_DAYS - 1);
      const step = Math.max(1, Math.round(n / 130));
      const span = closes.slice(HISTORY_DAYS - n);
      const days = new Set([n - span.indexOf(Math.max(...span)), n - span.indexOf(Math.min(...span))]);
      for (let j = n; j >= 1; j -= step) days.add(j);
      pts = [...days].sort((a, b) => b - a).map((j) => ({ v: closes[HISTORY_DAYS - j], d: SESSIONS[j] }));
      pts.push({ v: q.price, d: SESSIONS[0] });
    }
    pts.forEach((p, i) => { p.x = i / (pts.length - 1); });
    const values = pts.map((p) => p.v);
    pts.lo = Math.min(...values);
    pts.hi = Math.max(...values);
    pts.loI = values.indexOf(pts.lo);
    pts.hiI = values.indexOf(pts.hi);
    if (q.low !== null && q.low < pts.lo) { pts.lo = q.low; pts.loI = pts.length - 1; }
    if (q.high !== null && q.high > pts.hi) { pts.hi = q.high; pts.hiI = pts.length - 1; }
    s.ranges[key] = pts;
    return pts;
  }

  function rangeLabel(key, p) {
    const d = p.d;
    if (key === "1W") return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${Market.hhmm(p.m)}`;
    if (["2Y", "5Y", "10Y", "ALL"].includes(key)) return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  // ---- A popup: the hero's whole one, or the day's compact one.

  const LOOK_ICONS = {
    toSmooth: `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1,12 6,6 10,9 17,2"/></svg>`,
    toRetro: () => Cells.markSVG(2, 7, "currentColor", false),
  };
  // The rows' unit, as the sign at the end of the list's header says it.
  const UNITS = [["pct", "percents"], ["abs", "amounts"], ["open", "since the open"]];

  class Popup {
    constructor(root, { symbols, clock, full, holdScale }) {
      this.root = root;
      this.all = symbols;
      this.symbols = symbols.slice(); // the rows listed; a removal takes one out
      this.clock = clock;
      this.full = full;
      this.holdScale = holdScale;
      this.sym = 0;
      this.sel = 0;
      this.range = "1D"; // every stock shows the range picked
      this.changeMode = 0; // the rows', and on 1D the price's: UNITS
      this.scrub = -1;
      this.reveal = 1;
      this.stopSweep = null;
      this.restingAt = null; // where the pointer rested as its replay began
      this.chart = null; // what the chart drew, which its chimes play
      this.chimed = -1;
      this.scrubMinute = null;
      this.removed = []; // what "+ Add a symbol" puts back, the latest last
      this.undoable = null; // the removal Ctrl+Z undoes, until the list next changes
      this.timers = {};
      this.build();
      Look.on(() => this.render());
    }

    build() {
      const r = this.root;
      const tool = (cls, label, inner = "") => `<button type="button" class="tool ${cls}" aria-label="${label}" data-tip="${label}">${inner}</button>`;
      r.innerHTML = `
        <div class="pop-head">
          <button type="button" class="animal"></button>
          <span class="zz" aria-hidden="true"></span>
          <span class="head-words"><span class="title"></span><span class="status"></span></span>
          <span class="head-tools">
            <button type="button" class="tool" data-sound-toggle><span class="speaker-icon" aria-hidden="true"></span></button>
            ${this.full ? tool("camera", "Take a screenshot") : ""}
            ${tool("look", "")}
            ${this.full ? tool("help", "Show all keys", "?") : ""}
          </span>
          ${this.full ? `<p class="toast" hidden></p>` : ""}
        </div>
        <div class="listing"></div>
        <div class="hero-row">
          <div class="price"></div>
          <button type="button" class="change"></button>
        </div>
        <div class="strip"><span class="ext"></span><span class="change-cap"></span></div>
        <canvas class="chart" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="100"></canvas>
        ${this.full ? `
        <div class="ranges" role="group" aria-label="Chart range">${RANGES.map(([k]) => `<button type="button" data-range="${k}">${k}</button>`).join("")}</div>
        <div class="info"></div>
        <div class="list-head"><span class="list-name">ALL</span><span>TODAY</span><canvas class="breadth-rule" aria-hidden="true"></canvas>${tool("unit", "")}</div>
        <div class="rows" role="group" aria-label="Made-up watchlist"></div>
        <div class="pop-foot"><button type="button" class="add">+ Add a symbol</button><button type="button" class="undo" hidden></button></div>
        <div class="sheet" hidden>
          <p class="sheet-title">KEYS · THIS DEMO</p>
          <dl>
            <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move the selection</dd>
            <dt><kbd>⏎</kbd></dt><dd>Show the row's chart</dd>
            <dt><kbd>a</kbd></dt><dd>Add a symbol: here, put one back</dd>
            <dt><kbd>Del</kbd> <kbd>⌫</kbd></dt><dd>Remove the selected row</dd>
            <dt><kbd>Ctrl+Z</kbd></dt><dd>Undo a removal</dd>
            <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Scrub one step</dd>
            <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Change the range</dd>
            <dt><kbd>p</kbd></dt><dd>Replay the chart</dd>
            <dt><kbd>c</kbd></dt><dd>Cycle the day's change</dd>
            <dt><kbd>s</kbd></dt><dd>Smooth or retro</dd>
            <dt><kbd>m</kbd></dt><dd>Sound on or off</dd>
            <dt><kbd>Esc</kbd></dt><dd>Close this sheet, then the scrub</dd>
          </dl>
        </div>` : ""}`;
      const $ = (sel) => r.querySelector(sel);
      this.el = {
        animal: $(".animal"), zz: $(".zz"), title: $(".title"), status: $(".status"), look: $(".look"), help: $(".help"),
        camera: $(".camera"), toast: $(".toast"), listing: $(".listing"), price: $(".price"), change: $(".change"),
        ext: $(".ext"), cap: $(".change-cap"), chart: $(".chart"), ranges: $(".ranges"), info: $(".info"),
        breadth: $(".breadth-rule"), unit: $(".unit"), rows: $(".rows"), add: $(".add"), undo: $(".undo"), sheet: $(".sheet"),
      };
      const el = this.el;
      el.animal.addEventListener("click", () => this.replay());
      el.look.addEventListener("click", () => Look.toggle());
      el.change.addEventListener("click", () => { if (this.range === "1D") this.cycleChange(); });
      el.chart.addEventListener("pointermove", (e) => { if (!this.resting(e)) this.scrubAt(e.clientX); });
      el.chart.addEventListener("pointerdown", (e) => this.scrubAt(e.clientX));
      el.chart.addEventListener("pointerleave", () => {
        this.restingAt = null;
        if (this.scrub >= 0 && !this.stopSweep) this.endScrub();
      });
      r.addEventListener("keydown", (e) => this.key(e));
      if (this.full) {
        el.help.addEventListener("click", () => this.toggleSheet());
        el.sheet.addEventListener("click", () => this.toggleSheet(false));
        el.camera.addEventListener("click", () => this.screenshot());
        el.ranges.addEventListener("click", (e) => { const b = e.target.closest("[data-range]"); if (b) this.setRange(b.dataset.range); });
        el.unit.addEventListener("click", () => this.cycleChange());
        el.add.addEventListener("click", () => this.putBack());
        el.undo.addEventListener("click", () => this.undo());
        // The row that slides into a removed one's place shows its × only
        // once the pointer moves, so a second click can't remove it.
        el.rows.addEventListener("pointermove", () => el.rows.classList.remove("calm"));
        el.rows.addEventListener("click", (e) => {
          const slot = e.target.closest(".row-slot");
          if (!slot) return;
          const i = [...el.rows.children].indexOf(slot);
          if (e.target.closest(".x")) this.remove(i);
          else { this.sel = i; this.setSymbol(i); }
        });
        el.rows.addEventListener("focusin", (e) => {
          const i = [...el.rows.children].indexOf(e.target.closest(".row-slot"));
          if (i >= 0 && this.sel !== i && e.target.classList.contains("row")) { this.sel = i; this.renderRows(); }
        });
        this.buildRows();
      }
    }

    buildRows() {
      const one = this.symbols.length === 1;
      this.el.rows.innerHTML = this.symbols.map((s) => `
        <div class="row-slot"><button type="button" class="row"><span class="who"><span class="sym">${s.sym}</span><span class="name">${s.name}</span></span><canvas aria-hidden="true"></canvas><span class="nums"><span></span><b></b></span></button>${one ? "" : `<button type="button" class="x" aria-label="Remove ${s.sym}" data-tip="Remove"></button>`}</div>`).join("");
    }

    feat() { return this.symbols[this.sym]; }
    quote() { return Market.quoteAt(this.feat(), this.clock); }

    series() {
      const s = this.feat();
      const q = this.quote();
      const key = this.range;
      if (key === "1D") return { s, q, key, pts: q.prints, base: s.prev, day: true };
      const pts = rangeSeries(s, key, q);
      return { s, q, key, pts, base: pts[0].v, day: false };
    }

    setClock(m) {
      if (m === this.clock) return;
      this.stopReplay();
      this.clock = m;
      this.scrub = -1;
      this.render();
    }

    priceCell() {
      // One cell size for every symbol, so the price never moves the layout.
      const widest = Math.max(...this.all.map((s) => Cells.blockCells(money(s.prev * 1.03)).columns));
      const room = this.root.clientWidth - 44 - (innerWidth <= 640 ? 100 : 140);
      return Math.max(4, Math.min(11, Math.floor(room / widest)));
    }

    // A move from `from` to `to` in the unit shown: a percent, an amount, or
    // a percent from `open`.
    moved(to, from, open, mode) {
      if (mode === 2 && open !== null) return { n: ((to - open) / open) * 100, pct: true };
      if (mode === 1) return { n: to - from, pct: false };
      return { n: ((to - from) / from) * 100, pct: true };
    }

    render() {
      const { s, q, key, pts, base, day } = this.series();
      const retro = Look.retro;
      const el = this.el;
      const scrubbed = this.scrub >= 0 && pts[this.scrub];
      this.scrubMinute = scrubbed && day ? pts[this.scrub].m : null;
      let shown, status;
      if (scrubbed) {
        const read = day ? Market.readingAt(pts, this.scrub, this.clock) : { v: pts[this.scrub].v, status: `At ${rangeLabel(key, pts[this.scrub])}` };
        shown = read.v;
        status = read.status;
      } else {
        shown = q.price;
        status = q.status;
      }

      // The animal is the direction of the moment shown against the
      // baseline; it sleeps while its market rests, and wakes for a scrub.
      // It is the pixel bull or bear in both looks, as Stonks draws it.
      const dir = tone(((shown - base) / base) * 100);
      const asleep = !scrubbed && day && q.asleep;
      el.animal.innerHTML = "";
      el.animal.disabled = !dir || !pts.length;
      el.animal.hidden = !dir;
      if (dir) {
        el.animal.innerHTML = Cells.spriteSVG(Cells.sprite(dir === "up", asleep), 2, dir === "up" ? COL.up : COL.down);
        el.animal.setAttribute("aria-label", `Replay the chart (the ${dir === "up" ? "bull" : "bear"}${asleep ? ", asleep" : ""})`);
      }
      el.zz.innerHTML = asleep && dir ? Cells.spriteSVG(Cells.SLEEP_Z, 2, rgba(COL.fg, 0.5)) : "";
      el.title.textContent = s.name;
      // With less room, as Stonks does, the status says less and keeps the time.
      const short = scrubbed ? status.replace(/ · .*$/, "") : status.replace(/^(Market|[^·]+ ·) /, "");
      el.status.textContent = innerWidth <= 640 ? short : status;

      el.look.innerHTML = retro ? LOOK_ICONS.toSmooth : LOOK_ICONS.toRetro();
      el.look.setAttribute("aria-label", retro ? "Switch to smooth" : "Switch to retro");
      el.look.dataset.tip = el.look.getAttribute("aria-label");
      if (el.help) el.help.dataset.tip = el.sheet.hidden ? "Show all keys" : "Hide the keys";
      if (el.camera && !this.timers.toast) el.camera.innerHTML = Cells.iconSVG("camera", 3, "currentColor");
      el.listing.innerHTML = `<b>${s.sym}</b>DEMO · USD`;

      const priceText = money(shown);
      el.price.innerHTML = retro
        ? Cells.blocksSVG(priceText, this.priceCell(), COL.fg, 6)
        : `<span class="smooth-price">${priceText}</span>`;

      // On a longer range the price's change is the range's; the rows stay
      // on the day's move.
      if (this.changeMode === 2 && q.open === null && !this.full) this.changeMode = 0;
      const mode = day ? this.changeMode : 0;
      const move = this.moved(shown, base, day ? q.open : null, mode);
      el.change.textContent = signed(move.n, retro, move.pct ? "%" : "");
      el.change.className = `change ${tone(move.n) || "flat"}`;
      el.change.disabled = !day;
      el.change.setAttribute("aria-label", `${el.change.textContent}. ${day ? "Show the change as a percent, an amount, or since the open." : ""}`);

      const ext = !scrubbed && day ? q.ext : null;
      if (ext) {
        const extDelta = mode === 1 ? ext.v - q.price : ext.pct;
        el.ext.innerHTML = `${ext.label} <b>${money(ext.v)}</b> <span class="${tone(ext.pct) || "flat"}">${signed(extDelta, retro, mode === 1 ? "" : "%")}</span>`;
      } else el.ext.textContent = "";
      el.cap.textContent = !day ? key : mode === 2 && q.open !== null ? "SINCE OPEN" : !scrubbed ? q.caption : "";

      this.drawChart({ s, q, pts, base, day, key });

      if (this.full) {
        for (const b of el.ranges.children) b.setAttribute("aria-pressed", String(b.dataset.range === key));
        this.renderInfo(s, q, pts, key);
        this.renderRows();
      }

      const i = scrubbed ? this.scrub : pts.length - 1;
      el.chart.setAttribute("aria-label", `${day ? "The day's chart" : `The ${key} chart`}, made-up prices. Left and right arrows scrub.`);
      el.chart.setAttribute("aria-valuenow", String(Math.round((Math.max(0, i) / Math.max(1, pts.length - 1)) * 100)));
      el.chart.setAttribute("aria-valuetext", `${status}, ${priceText}, ${signed(((shown - base) / base) * 100, false, "%")}`);
      this.onRender && this.onRender();
    }

    drawChart({ s, q, pts, base, day, key }) {
      const { ctx, w, h } = Cells.fit(this.el.chart);
      const mark = (i, v, low) => ({ i, v, low, value: money(v), date: `${pts[i].d.getDate()} ${MONTHS[pts[i].d.getMonth()]} ${pts[i].d.getFullYear()}` });
      const o = {
        scrub: this.scrub,
        reveal: this.reveal,
        lastCap: day && this.scrub < 0 ? q.lastRegular : -1,
        ticks: day ? Market.BELLS : [],
        scale: day && this.holdScale ? s.prints : null,
        marks: day ? null : [mark(pts.hiI, pts.hi, false), mark(pts.loI, pts.lo, true)],
      };
      this.chart = Look.retro
        ? Cells.drawRetro(ctx, w, h, pts, base, { ...o, pixel: 6, gap: 1, ghost: 0.035 })
        : Cells.drawSmooth(ctx, w, h, pts, base, o);
    }

    // The lines under the ranges: the range's low and high with the price
    // between, beside its open (on 1D) or START, and its volume; then the
    // past 52 weeks', beside the market cap and P/E.
    renderInfo(s, q, pts, key) {
      const retro = Look.retro;
      const day = key === "1D";
      const week = rangeSeries(s, "1W", q), year = rangeSeries(s, "1Y", q);
      const yearLo = Math.min(year.lo, week.lo, q.low ?? Infinity), yearHi = Math.max(year.hi, week.hi, q.high ?? -Infinity);
      const sessions = day ? 0 : RANGES.find((r) => r[0] === key)[1];
      const lines = [
        [key, day ? q.low : pts.lo, day ? q.high : pts.hi,
          day ? "Open" : "Start", day ? (q.open === null ? "" : money(q.open)) : money(pts[0].v),
          "Vol", Market.big(day ? q.volume : s.vol * Math.min(sessions, HISTORY_DAYS) * 0.94 + q.volume)],
        ["52W", yearLo, yearHi, "Mkt cap", `USD ${Market.big(s.shares * q.price)}`, "P/E", (q.price / s.eps).toFixed(1)],
      ];
      this.el.info.innerHTML = lines.map(([label, , , k1, v1, k2, v2]) =>
        `<span>${label}</span><b></b><canvas aria-hidden="true"></canvas><b></b><span class="fact">${k1}</span><b class="fact">${v1}</b><span class="fact">${k2}</span><b class="fact">${v2}</b>`).join("");
      const kids = this.el.info.children;
      lines.forEach(([, lo, hi], k) => {
        kids[k * 8 + 1].textContent = lo === null ? "" : money(lo);
        kids[k * 8 + 3].textContent = hi === null ? "" : money(hi);
        Cells.drawRule(kids[k * 8 + 2], retro, [[1, COL.fg, 0.14]], lo === null ? null : (q.price - lo) / (hi - lo || 1));
      });
      const pcts = this.symbols.map((x) => this.rowReading(x).pct);
      const ups = pcts.filter((p) => tone(p) === "up").length;
      const downs = pcts.filter((p) => tone(p) === "down").length;
      const n = pcts.length;
      Cells.drawRule(this.el.breadth, retro, [[ups / n, COL.up, 1], [(n - ups - downs) / n, COL.fg, 0.14], [downs / n, COL.down, 1]]);
      const [unit] = UNITS[this.changeMode];
      const [, next] = UNITS[(this.changeMode + 1) % UNITS.length];
      this.el.unit.innerHTML = Cells.iconSVG(unit, 3, "currentColor");
      this.el.unit.dataset.tip = `Show ${next}`;
      this.el.unit.setAttribute("aria-label", `Show every row's change ${next === "since the open" ? next : `as ${next}`}`);
    }

    // A row's figures: today's, or, while the day is scrubbed, its price at
    // that moment, as Stonks' rows follow the pointer.
    rowReading(s) {
      const q = Market.quoteAt(s, this.clock);
      if (this.scrubMinute === null) return q;
      const v = Market.priceAt(q.prints, s.prev, this.scrubMinute);
      return { prints: q.prints, price: v, open: q.open, pct: ((v - s.prev) / s.prev) * 100 };
    }

    renderRows() {
      const retro = Look.retro;
      [...this.el.rows.children].forEach((slot, i) => {
        const s = this.symbols[i];
        const q = this.rowReading(s);
        const row = slot.firstElementChild;
        row.setAttribute("aria-current", String(i === this.sym));
        row.classList.toggle("selected", i === this.sel && i !== this.sym);
        const nums = row.querySelector(".nums");
        const move = this.moved(q.price, s.prev, q.open, this.changeMode);
        nums.firstElementChild.textContent = money(q.price);
        nums.lastElementChild.textContent = signed(move.n, retro, move.pct ? "%" : "");
        nums.lastElementChild.className = tone(move.n) || "flat";
        const { ctx, w, h } = Cells.fit(row.querySelector("canvas"));
        if (retro) Cells.drawRetro(ctx, w, h, q.prints, s.prev, { pixel: 2, gap: 1, scrub: -1, scale: s.prints });
        else Cells.drawSmooth(ctx, w, h, q.prints, s.prev, { pad: 2, scrub: -1, lineWidth: 1.2, scale: s.prints });
        // The × sits beside the symbol: a pixel × in retro, the sign in smooth.
        const x = slot.querySelector(".x");
        if (x) {
          const sym = row.querySelector(".sym");
          x.style.left = `${sym.offsetLeft + sym.offsetWidth + 8}px`;
          x.innerHTML = retro ? Cells.spriteSVG(Cells.REMOVE, 2, "currentColor") : "×";
        }
      });
    }

    // A note under the header's icons for a few seconds, as Omarchy's
    // notification shows after a screenshot.
    toast(html, ms) {
      clearTimeout(this.timers.toast);
      this.el.toast.innerHTML = html;
      this.el.toast.hidden = false;
      this.timers.toast = setTimeout(() => {
        this.el.toast.hidden = true;
        this.timers.toast = 0;
        this.render();
      }, ms);
    }

    // In Stonks the camera saves a picture of the chart; here it sounds the
    // shutter and points to one Stonks made.
    screenshot() {
      Sound.play(Look.retro, "shutter");
      this.el.camera.innerHTML = Cells.iconSVG("cameraLit", 3, "currentColor");
      this.root.classList.remove("flash");
      void this.root.offsetWidth;
      this.root.classList.add("flash");
      this.toast(`In Stonks, a picture of this chart. <a href="#screenshot">See one</a>`, 5000);
    }

    // A removal takes the row out, and for 5 seconds "Undo …" shows beside
    // "+ Add a symbol"; Ctrl+Z undoes it until the list next changes.
    remove(i) {
      if (this.symbols.length < 2) return;
      const [s] = this.symbols.splice(i, 1);
      const shown = this.sym === i;
      if (this.sym > i || this.sym === this.symbols.length) this.sym--;
      if (this.sel > i || this.sel === this.symbols.length) this.sel--;
      // `left` is the chart that took a shown row's place, so its undo can
      // show the row again if nobody has picked another chart since.
      const removal = { s, at: i, shown, left: this.feat() };
      this.removed.push(removal);
      this.undoable = removal;
      Sound.play(Look.retro, "remove");
      clearTimeout(this.timers.undo);
      this.el.undo.textContent = `Undo ${s.sym}`;
      this.el.undo.hidden = false;
      this.timers.undo = setTimeout(() => { this.el.undo.hidden = true; }, 5000);
      this.listChanged();
      this.el.rows.classList.add("calm");
    }
    // A removed row back in its old place, and selected, as Stonks puts
    // it back; its chart shows again if the removal moved the chart off it
    // and the chart is still the one it moved to.
    restore({ s, at, shown, left }) {
      const inside = this.root.contains(document.activeElement); // before Undo hides, losing focus
      this.removed = this.removed.filter((r) => r.s !== s);
      const place = Math.min(at, this.symbols.length);
      const back = shown && this.feat() === left;
      this.symbols.splice(place, 0, s);
      if (back) this.sym = place;
      else if (this.sym >= place) this.sym++;
      this.sel = place;
      this.undoable = null;
      clearTimeout(this.timers.undo);
      this.el.undo.hidden = true;
      this.listChanged(inside);
    }
    undo() {
      if (!this.undoable) return;
      Sound.play(Look.retro, "undo");
      this.restore(this.undoable);
    }
    // "+ Add a symbol" searches in Stonks; the demo's four are all it has,
    // so it puts back the one removed last.
    putBack() {
      const last = this.removed[this.removed.length - 1];
      if (!last) {
        this.toast("In Stonks, this searches for any stock, ETF, index, or coin.", 3000);
        return;
      }
      Sound.play(Look.retro, "add");
      this.restore(last);
    }
    // The rows are drawn again. Focus that was on a row or a control that's
    // gone moves to the selected row, so the demo's keys, Ctrl+Z among
    // them, keep working.
    listChanged(inside = this.root.contains(document.activeElement)) {
      this.buildRows();
      this.render();
      const now = document.activeElement;
      if (inside && (!this.root.contains(now) || now.offsetParent === null)) {
        this.el.rows.children[this.sel].firstElementChild.focus({ preventScroll: true });
      }
    }

    setSymbol(i) {
      this.stopReplay();
      this.sym = (i + this.symbols.length) % this.symbols.length;
      this.scrub = -1;
      this.render();
    }
    setRange(key) {
      this.stopReplay();
      this.range = key;
      this.scrub = -1;
      this.render();
    }
    stepRange(d) {
      const keys = RANGES.map((r) => r[0]);
      const k = keys.indexOf(this.range);
      this.setRange(keys[Math.max(0, Math.min(keys.length - 1, k + d))]);
    }
    // The change's unit steps: a percent, an amount, since the open.
    cycleChange() {
      const canOpen = this.full || this.quote().open !== null;
      this.changeMode = (this.changeMode + 1) % (canOpen ? 3 : 2);
      this.render();
    }
    endScrub() {
      this.stopReplay();
      this.scrub = -1;
      this.chimed = -1;
      this.render();
    }

    // The scrub moved onto print `i`: the pointer strikes a bar as it moves
    // onto it, and each key step, `again`, strikes the same bar too.
    scrubTo(i, again) {
      this.stopReplay();
      this.scrub = i;
      this.render();
      const { pts } = this.series();
      const bar = Sound.barAt(this.chart, pts[i].x);
      if (bar !== this.chimed || again) Sound.chime(Look.retro, bar);
      this.chimed = bar;
    }

    scrubAt(clientX) {
      const { pts } = this.series();
      if (!pts.length) return;
      const r = this.el.chart.getBoundingClientRect();
      this.scrubTo(nearest(pts, Math.max(0, Math.min(1, (clientX - r.left) / r.width))), false);
    }

    // The chart draws in behind the replay's scrub. A replay started with
    // the pointer resting on the chart, as "Hear the replay" leaves it
    // there, plays out while the pointer only drifts (`restingAt`, where it
    // rests); moving along the chart, leaving it, or a press scrubs.
    replay(restingAt = null) {
      this.stopReplay();
      const { pts } = this.series();
      if (!pts.length || reducedMotion.matches) { this.scrub = -1; this.render(); return; }
      this.restingAt = restingAt;
      this.stopSweep = sweep(pts, this.chart, (i, reveal) => {
        if (i < 0) { this.stopSweep = null; this.restingAt = null; }
        this.scrub = i;
        this.reveal = reveal;
        this.render();
      });
    }
    stopReplay() {
      if (this.stopSweep) this.stopSweep();
      this.stopSweep = null;
      this.restingAt = null;
      this.reveal = 1;
    }
    // Whether a pointer move is only the resting pointer's drift, within
    // 16 px of where the replay began; past that, the move scrubs.
    resting(e) {
      if (!this.stopSweep || !this.restingAt) return false;
      if (Math.hypot(e.clientX - this.restingAt.x, e.clientY - this.restingAt.y) < 16) return true;
      this.restingAt = null;
      return false;
    }

    // The newest print drawn strikes its bar when the bar changes, as a
    // scrub's does, so a clock moving on plays the chart as it draws;
    // `quiet` keeps the bar without striking it.
    chimeDrawn(quiet) {
      const { pts } = this.series();
      const bar = pts.length ? Sound.barAt(this.chart, pts[pts.length - 1].x) : -1;
      if (bar !== this.chimed && !quiet) Sound.chime(Look.retro, bar);
      this.chimed = bar;
    }

    toggleSheet(open) {
      if (!this.el.sheet) return;
      this.el.sheet.hidden = !(open ?? this.el.sheet.hidden);
      this.el.help.dataset.tip = this.el.sheet.hidden ? "Show all keys" : "Hide the keys";
    }

    key(e) {
      if (e.metaKey || e.altKey) return;
      const k = e.key;
      if (e.ctrlKey) {
        // Ctrl+Z undoes a removal here; every other Ctrl key stays the browser's.
        if (this.full && k.toLowerCase() === "z" && this.undoable) { e.preventDefault(); this.undo(); }
        return;
      }
      const onButton = e.target.tagName === "BUTTON";
      const { pts } = this.series();
      let handled = true;
      if (k === "?" && this.full) this.toggleSheet();
      else if (k === "Escape") {
        if (this.el.sheet && !this.el.sheet.hidden) this.toggleSheet(false);
        else if (this.scrub >= 0) this.endScrub();
        else handled = false;
      } else if (["ArrowLeft", "h", "ArrowRight", "l"].includes(k) && pts.length) {
        // h and l scrub too, as in Stonks' popup.
        const from = this.scrub >= 0 ? this.scrub : pts.length - 1;
        this.scrubTo(Math.max(0, Math.min(pts.length - 1, from + (k === "ArrowLeft" || k === "h" ? -1 : 1))), true);
      } else if (k === "p") this.replay();
      else if (k === "c") this.cycleChange();
      else if (!this.full) handled = false;
      else if (k === "[" || k === "]") this.stepRange(k === "[" ? -1 : 1);
      else if (k === "a") this.putBack();
      else if (k === "Delete" || k === "Backspace") this.remove(this.sel);
      else if (k === "ArrowUp" || k === "ArrowDown") {
        this.sel = (this.sel + (k === "ArrowUp" ? -1 : 1) + this.symbols.length) % this.symbols.length;
        // Keep focus on the selected row, so Enter on it shows that row.
        if (e.target.classList.contains("row")) this.el.rows.children[this.sel].firstElementChild.focus();
        this.renderRows();
      } else if ((k === "Enter" || k === " ") && !onButton) this.setSymbol(this.sel);
      else handled = false;
      if (handled) e.preventDefault();
    }
  }

  // ---- The hero's popup

  const hero = new Popup(document.getElementById("demo"), { symbols: Market.SYMBOLS, clock: HERO_CLOCK, full: true });

  // ---- One day: a popup held in view while the clock follows the scroll.

  const daySection = document.getElementById("day");
  const dayPop = new Popup(document.getElementById("daypop"), { symbols: [Market.SYMBOLS[0]], clock: Market.PRE, full: false, holdScale: true });
  const clockDigits = daySection.querySelector(".clock-digits");
  const track = daySection.querySelector(".day-track");
  const WHOLE_DAY = 21 * 60;
  // Scroll to clock: each part of the day gets its share of the scroll.
  const STOPS = [
    [0, 4 * 60], [0.12, 9 * 60 + 25], [0.16, 9 * 60 + 30], [0.24, 10 * 60], [0.34, 12 * 60],
    [0.44, 13 * 60], [0.54, 15 * 60], [0.66, 15 * 60 + 55], [0.72, 16 * 60], [0.86, 20 * 60], [1, WHOLE_DAY],
  ];
  function clockFor(p) {
    for (let i = 1; i < STOPS.length; i++) {
      const [p0, m0] = STOPS[i - 1];
      const [p1, m1] = STOPS[i];
      if (p <= p1) return Math.round(m0 + ((m1 - m0) * (p - p0)) / (p1 - p0));
    }
    return WHOLE_DAY;
  }
  let dayCell = 0;
  function paintClock() {
    const cell = innerWidth <= 640 ? 6 : 12;
    const text = Market.hhmm(dayPop.clock);
    if (clockDigits.dataset.text === text && dayCell === cell) return;
    clockDigits.dataset.text = text;
    dayCell = cell;
    clockDigits.innerHTML = Cells.blocksSVG(text, cell, COL.fg, 5, 0.06);
  }
  dayPop.onRender = paintClock;
  let dayFrame = 0;
  function followScroll() {
    dayFrame = 0;
    if (reducedMotion.matches) return;
    const r = track.getBoundingClientRect();
    const sticky = track.firstElementChild;
    const total = track.offsetHeight - sticky.offsetHeight;
    const stickTop = parseFloat(getComputedStyle(sticky).top) || 0;
    const p = Math.max(0, Math.min(1, (stickTop - r.top) / Math.max(1, total)));
    const before = dayPop.clock;
    const now = clockFor(p);
    if (now === before) return;
    dayPop.setClock(now);
    // The scroll plays the chart as it draws (`chimeDrawn`), and the bell
    // rings as the clock scrolls on past the open or the close. A jump
    // across the day plays nothing, nor does the scroll a link makes, as
    // "skip it" or Install, which passes through it in steps.
    const heard = Math.abs(now - before) < 180 && performance.now() > linkScroll;
    dayPop.chimeDrawn(!heard);
    const passed = [Market.OPEN, Market.CLOSE].find((bell) => before < bell && now >= bell);
    if (passed && heard) ringBell(passed === Market.OPEN ? 1 : 2);
  }

  // The line under the clock names the bell that's heard: as each reaches
  // the speakers, its name replaces the last one's, for 2 s, about the
  // smooth bell's ring, then the day's place comes back. While a bell is
  // on its way, the one it cut short keeps its name until it lands, so the
  // place never shows between them. Every wording sits in one cell, so the
  // line keeps its longest one's width and nothing moves.
  const place = daySection.querySelector(".clock-place");
  place.innerHTML = [place.textContent, "OPENING BELL", "CLOSING BELL"].map((t, i) => `<span${i ? "" : ' class="shown"'}>${t}</span>`).join("");
  let bellNamed = 0, bellsComing = 0, nameDone = false;
  function ringBell(i) {
    bellsComing++;
    Sound.play(Look.retro, "bell").then((rang) => {
      bellsComing--;
      if (rang) nameBell(i);
      else if (nameDone && !bellsComing) nameBell(0);
    });
  }
  function nameBell(i) {
    [...place.children].forEach((s, k) => s.classList.toggle("shown", k === i));
    clearTimeout(bellNamed);
    nameDone = false;
    if (i) bellNamed = setTimeout(() => { nameDone = true; if (!bellsComing) nameBell(0); }, 2000);
  }
  let linkScroll = 0;
  document.addEventListener("click", (e) => { if (e.target.closest('a[href^="#"]')) linkScroll = performance.now() + 1500; });
  function setDayMode() {
    daySection.classList.toggle("still", reducedMotion.matches);
    if (reducedMotion.matches) dayPop.setClock(WHOLE_DAY);
    else followScroll();
  }
  addEventListener("scroll", () => { if (!dayFrame) dayFrame = requestAnimationFrame(followScroll); }, { passive: true });
  reducedMotion.addEventListener("change", setDayMode);
  addEventListener("load", setDayMode); // a restored scroll lands mid-day

  // ---- The pill: the hero's stock, in the look of the page.

  const pill = document.getElementById("pill");
  const formButtons = document.querySelectorAll(".forms button");
  const FORMS = ["sparkline", "arrow", "text", "icon"];
  let form = "sparkline";

  function renderPill() {
    const s = hero.feat();
    const q = Market.quoteAt(s, HERO_CLOCK);
    const t = tone(q.pct);
    const color = t === "up" ? COL.up : t === "down" ? COL.down : COL.fg;
    const small = innerWidth <= 640;
    const change = `<span class="${t || "flat"}">${signed(q.pct, Look.retro, "%")}</span>`;
    const sym = `<span>${s.sym}</span>`;
    if (form === "sparkline") {
      pill.innerHTML = `<canvas aria-hidden="true" style="width:${small ? 39 : 51}px;height:${small ? 16 : 22}px"></canvas>${sym}${change}`;
      const { ctx, w, h } = Cells.fit(pill.querySelector("canvas"));
      if (Look.retro) Cells.drawRetro(ctx, w, h, q.prints, s.prev, { pixel: small ? 2 : 3, gap: 1, scrub: -1 });
      else Cells.drawSmooth(ctx, w, h, q.prints, s.prev, { pad: 2, scrub: -1, lineWidth: 1.5 });
    } else if (form === "arrow") {
      const angle = Math.min(45, (Math.abs(q.pct) / 5) * 45) * Math.sign(q.pct);
      pill.innerHTML = `<span class="arrow ${t}" aria-hidden="true" style="transform:rotate(${-angle}deg)">➜</span>${sym}${change}`;
    } else if (form === "text") {
      pill.innerHTML = `${sym}<span>${money(q.price)}</span>${change}`;
    } else {
      // The day's animal: the bull up, the bear down, nothing on a flat day.
      pill.innerHTML = t ? Cells.spriteSVG(Cells.sprite(t === "up", false), 2, color) : "";
    }
    pill.setAttribute("aria-label", `Stonks' pill as ${form === "icon" ? `the ${t === "up" ? "bull" : t === "down" ? "bear" : "day's animal"}` : `a ${form}`}, made-up prices: ${s.sym} ${signed(q.pct, false, "%")}. Click to change its form.`);
    formButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.form === form)));
  }
  const setForm = (f) => { form = f; renderPill(); };
  pill.addEventListener("click", () => setForm(FORMS[(FORMS.indexOf(form) + 1) % FORMS.length]));
  pill.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); setForm(FORMS[(FORMS.indexOf(form) + 1) % FORMS.length]); } });
  pill.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
  let wheelSum = 0, wheelAt = 0;
  pill.addEventListener("wheel", (e) => {
    e.preventDefault();
    wheelSum += e.deltaY;
    const now = performance.now();
    if (Math.abs(wheelSum) < 40 || now - wheelAt < 120) return;
    const d = wheelSum > 0 ? 1 : -1;
    wheelSum = 0; wheelAt = now;
    hero.sel = (hero.sym + d + hero.symbols.length) % hero.symbols.length;
    hero.setSymbol(hero.sel);
  }, { passive: false });
  formButtons.forEach((b) => b.addEventListener("click", () => setForm(b.dataset.form)));
  hero.onRender = renderPill;

  // ---- Themes, in either look: real renders of the same screen. The
  // ground behind the picture is the theme's own.

  const THEMES = [
    ["tokyo-night", "Tokyo Night", "#1A1B26"], ["catppuccin", "Catppuccin", "#1E1E2E"], ["ethereal", "Ethereal", "#060B1E"],
    ["everforest", "Everforest", "#2D353B"], ["gruvbox", "Gruvbox", "#282828"], ["hackerman", "Hackerman", "#0B0C16"],
    ["kanagawa", "Kanagawa", "#1F1F28"], ["last-horizon", "Last Horizon", "#0C0B0C"], ["lumon", "Lumon", "#16242D"],
    ["matte-black", "Matte Black", "#121212"], ["miasma", "Miasma", "#222222"], ["nord", "Nord", "#2E3440"],
    ["osaka-jade", "Osaka Jade", "#111C18"], ["retro-82", "Retro 82", "#05182E"], ["ristretto", "Ristretto", "#2C2525"],
    ["solitude", "Solitude", "#101315"], ["vantablack", "Vantablack", "#000000"],
    ["catppuccin-latte", "Catppuccin Latte", "#EFF1F5", true], ["flexoki-light", "Flexoki Light", "#FFFCF0", true],
    ["lupine", "Lupine", "#FAFAFA", true], ["rose-pine", "Rosé Pine", "#FAF4ED", true], ["white", "White", "#FFFFFF", true],
  ];
  const themeImg = document.querySelector(".theme-shot img");
  const themeGround = document.querySelector(".theme-ground");
  const themeCap = document.querySelector(".theme-shot figcaption");
  const lookButtons = document.querySelectorAll("[data-look]");
  let theme = THEMES[0];
  const themeSrc = (file, look) => `img/themes/${file}-${look}.webp`;

  async function showTheme() {
    const [file, name, ground] = theme;
    const look = Look.value;
    for (const b of document.querySelectorAll("[data-theme]")) b.setAttribute("aria-pressed", String(b.dataset.theme === file));
    lookButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.look === look)));
    const src = themeSrc(file, look);
    const next = new Image();
    next.src = src;
    try { await next.decode(); } catch { /* shown below as it loads */ }
    if (src !== themeSrc(theme[0], Look.value)) return; // a later choice won
    themeImg.src = src;
    themeImg.alt = `Stonks' popup in ${look}, in the ${name} theme: the price, the day's chart, and the list.`;
    themeGround.style.backgroundColor = ground;
    themeCap.textContent = `${name}, ${look}.`;
  }
  for (const [file, name, ground, light] of THEMES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.theme = file;
    b.style.setProperty("--sw", ground);
    b.textContent = name;
    b.addEventListener("click", () => { theme = THEMES.find((t) => t[0] === file); showTheme(); });
    b.addEventListener("pointerenter", () => { new Image().src = themeSrc(file, Look.value); });
    document.querySelector(`.chips[data-group="${light ? "light" : "dark"}"]`).appendChild(b);
  }
  lookButtons.forEach((b) => b.addEventListener("click", () => Look.set(b.dataset.look)));
  Look.on(showTheme);

  // ---- Keys: a pressed key lights its move; s switches the look anywhere.
  // A key held with Ctrl is named "Ctrl+" and its letter, as Ctrl+Z's row
  // is, and an arrow or Tab held with Shift "Shift+" and its name (a
  // shifted letter is its capital already). Lighting never stops a key's
  // own work: a field still takes its typing and the browser its undo.

  const moves = [...document.querySelectorAll(".moves [data-keys]")];
  let unlight = 0;
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    const key = e.ctrlKey ? "Ctrl+" + e.key.toLowerCase() : (e.shiftKey && e.key.length > 1 ? "Shift+" : "") + e.key;
    const row = moves.find((r) => r.dataset.keys.split(" ").includes(key));
    if (row) {
      moves.forEach((r) => r.classList.toggle("lit", r === row));
      clearTimeout(unlight);
      unlight = setTimeout(() => row.classList.remove("lit"), 1600);
    }
    if (key === "s") Look.toggle();
    if (key === "m") Sound.toggle(Look.retro);
  });

  // ---- The speakers: the bar's and each popup's say whether sound is on,
  // off, or on and waiting for the reader's first click or key, which the
  // browser needs before anything sounds; and a press starts it, or turns
  // it on or off.

  const SPEAKER = {
    on: ["soundOn", "Turn sounds off"],
    off: ["soundOff", "Turn sounds on"],
    waiting: ["soundWaiting", "Start sounds"],
  };
  function paintSpeakers() {
    const state = !Sound.on ? "off" : Sound.heard ? "on" : "waiting";
    const [icon, label] = SPEAKER[state];
    document.querySelectorAll("[data-sound-toggle]").forEach((b) => {
      b.querySelector(".speaker-icon").innerHTML = Cells.iconSVG(icon, 3, "currentColor");
      b.dataset.state = state;
      b.setAttribute("aria-pressed", String(state === "on"));
      b.setAttribute("aria-label", label);
      b.dataset.tip = label;
    });
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-sound-toggle]")) Sound.press(Look.retro); });
  Sound.onChange(paintSpeakers);

  // The hero's invitation: while sound waits for the reader's first click
  // or key, a button over the empty corner of the demo's day, after its
  // close, below its baseline, replays it with its sound. It goes once
  // sound has started or is off, and with it the only chart it shows on.
  const hear = document.createElement("button");
  hear.type = "button";
  hear.className = "hear";
  hear.hidden = true;
  hear.innerHTML = `<span class="speaker-icon" aria-hidden="true">${Cells.iconSVG("soundOn", 3, "currentColor")}</span>Hear <span class="hear-long">the replay</span><span class="hear-short">it</span>`;
  hero.el.chart.after(hear);
  // A press on it starts the audio, which would hide it before the press
  // ends and its click lands: it stays until its click, or a moment after
  // a press that ends without one, as one dragged off it; a press again
  // within that moment holds it anew.
  let held = false, release = 0;
  const letGo = () => { clearTimeout(release); held = false; paintHear(); };
  for (const type of ["pointerdown", "keydown"]) hear.addEventListener(type, () => { clearTimeout(release); held = true; });
  // A click by the pointer leaves it resting on the chart, under where the
  // button was; one by a key leaves no pointer there.
  hear.addEventListener("click", (e) => { hero.replay(e.detail ? { x: e.clientX, y: e.clientY } : null); letGo(); });
  for (const type of ["pointerup", "pointercancel", "keyup"]) {
    addEventListener(type, () => { if (held) { clearTimeout(release); release = setTimeout(letGo, 300); } });
  }
  // Going while focused, it hands focus to the chart it replays, so the
  // demo's keys go on working.
  const paintHear = () => {
    const gone = !Sound.on || (Sound.heard && !held) || reducedMotion.matches;
    if (gone && document.activeElement === hear) hero.el.chart.focus({ preventScroll: true });
    hear.hidden = gone;
  };
  Sound.onChange(paintHear);
  reducedMotion.addEventListener("change", paintHear);

  // ---- Sound test: a made-up day to run the pointer along, and every
  // sound on a pad of its own, in the page's look's voice.

  const strip = document.querySelector("#sound .chimes");
  const stripDay = Market.SYMBOLS[0];
  const stripPts = stripDay.prints;
  const soundState = document.querySelector(".sound-state");
  let stripScrub = -1, stripReveal = 1, stripChart = null, stripChimed = -1, stopStrip = null;

  function drawStrip() {
    const { ctx, w, h } = Cells.fit(strip);
    const o = { scrub: stripScrub, reveal: stripReveal, ticks: Market.BELLS };
    stripChart = Look.retro
      ? Cells.drawRetro(ctx, w, h, stripPts, stripDay.prev, { ...o, pixel: 6, gap: 1, ghost: 0.035 })
      : Cells.drawSmooth(ctx, w, h, stripPts, stripDay.prev, o);
    const p = stripPts[stripScrub >= 0 ? stripScrub : stripPts.length - 1];
    strip.setAttribute("aria-valuenow", String(Math.round(p.x * 100)));
    strip.setAttribute("aria-valuetext", `${Market.hhmm(p.m)}, ${money(p.v)}`);
  }
  function stripTo(i, again) {
    if (stopStrip) stopStrip();
    stopStrip = null;
    stripReveal = 1;
    stripScrub = i;
    drawStrip();
    const bar = i < 0 ? -1 : Sound.barAt(stripChart, stripPts[i].x);
    if (bar !== stripChimed || again) Sound.chime(Look.retro, bar);
    stripChimed = bar;
  }
  function stripReplay() {
    stripTo(-1);
    if (reducedMotion.matches) return;
    stopStrip = sweep(stripPts, stripChart, (i, reveal) => {
      if (i < 0) stopStrip = null;
      stripScrub = i;
      stripReveal = reveal;
      drawStrip();
    });
  }
  const stripAt = (e) => {
    const r = strip.getBoundingClientRect();
    stripTo(nearest(stripPts, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))), false);
  };
  strip.addEventListener("pointermove", stripAt);
  strip.addEventListener("pointerdown", stripAt);
  strip.addEventListener("pointerleave", () => { if (!stopStrip) stripTo(-1); });
  strip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const from = stripScrub >= 0 ? stripScrub : stripPts.length - 1;
    stripTo(Math.max(0, Math.min(stripPts.length - 1, from + (e.key === "ArrowLeft" ? -1 : 1))), true);
  });
  document.querySelector("#sound .pads").addEventListener("click", (e) => {
    const pad = e.target.closest("[data-sound]");
    if (!pad) return;
    if (pad.dataset.sound === "replay") stripReplay();
    else Sound.play(Look.retro, pad.dataset.sound);
  });

  function paintSoundState() {
    if (!Sound.on) soundState.textContent = "Sound is off. Press m, or click the speaker, to turn it on.";
    else if (!Sound.heard) soundState.textContent = "Sound is on, and starts once you click or press a key on this page.";
    else soundState.textContent = `Sound is on, in ${Look.value}'s voice. Press s for the other look's, and m to turn sound off.`;
  }
  Sound.onChange(paintSoundState);
  Look.on(() => { stripTo(-1); paintSoundState(); });

  // ---- The screenshot: Stonks' own picture, in the page's look.

  const shareImg = document.querySelector(".share-shot img");
  const showShare = () => {
    shareImg.src = shareImg.dataset.lookSrc.replace("{look}", Look.value);
    shareImg.alt = shareImg.alt.replace(/in (retro|smooth):/, `in ${Look.value}:`);
  };
  Look.on(showShare);

  // ---- Page cells: headings, sprites, the hero's ground

  function paintBlocks() {
    document.querySelectorAll(".blocks[data-cell]").forEach((node) => {
      const cell = Number(node.dataset.cell);
      const small = innerWidth <= 640 && cell > 8 ? Math.round(cell * 0.62) : cell;
      node.innerHTML = Cells.blocksSVG(node.dataset.text, small, COL.fg, 5, 0.06);
    });
    document.querySelectorAll("[data-sprite]").forEach((node) => {
      const bull = node.dataset.sprite === "bull";
      node.innerHTML = Cells.spriteSVG(bull ? Cells.BULL : Cells.BEAR, 8, bull ? COL.up : COL.down);
    });
  }

  // Omarchy's ground: scattered cells, thicker toward the edges.
  function paintScatter() {
    const { ctx, w, h } = Cells.fit(document.querySelector(".scatter"));
    const r = Market.rng(5);
    for (let y = 0; y < h; y += 22) {
      for (let x = 0; x < w; x += 22) {
        const edge = Math.abs(x / w - 0.5) * 2;
        if (r() < Math.pow(edge, 6) * 0.6) {
          ctx.fillStyle = rgba(COL.accent, 0.06 + r() * 0.12);
          ctx.fillRect(x, y, 12, 12);
        }
      }
    }
  }

  // A long made-up chart under the hero, in the retro chart's cells.
  function paintSkyline() {
    const { ctx, w, h } = Cells.fit(document.querySelector(".skyline"));
    const r = Market.rng(42);
    const pts = [];
    let val = 0;
    for (let i = 0; i < 240; i++) {
      val = val * 0.97 + (r() - 0.5) * 1.6 + Math.sin(i / 19) * 0.35;
      pts.push({ x: i / 239, v: val });
    }
    Cells.drawRetro(ctx, w, h, pts, 0, { pixel: innerWidth <= 640 ? 6 : 10, gap: 2, scrub: -1, stem: 0.18, cap: 0.55, ghost: 0.025 });
  }

  // ---- Copy buttons

  const COMMAND = "omarchy plugin add https://github.com/gmchande/omarchy-stonks.git --enable";
  document.querySelectorAll("[data-copy]").forEach((box) => {
    const btn = box.querySelector(".copy");
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(COMMAND);
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
    hero.render();
    dayPop.render();
    drawStrip();
    paintScatter();
    paintSkyline();
  }
  setDayMode();
  paintAll();
  showTheme();
  showShare();
  paintSpeakers();
  paintHear();
  paintSoundState();
  if (document.fonts) document.fonts.ready.then(paintAll);
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { dayCell = 0; paintAll(); followScroll(); }, 120);
  });

  // Attract mode: the first time the hero's popup comes into view, it
  // replays its day, unless the reader is already replaying or scrubbing it.
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => { if (!hero.stopSweep && hero.scrub < 0) hero.replay(); }, 400);
    }, { threshold: 0.6 });
    io.observe(hero.el.chart);
  }
})();
