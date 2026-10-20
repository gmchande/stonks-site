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

  // A range at the hero's clock: its points, and its low and high over
  // every session in it.
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
      pts = [];
      for (let j = n; j >= 1; j -= step) pts.push({ v: closes[HISTORY_DAYS - j], d: SESSIONS[j] });
      pts.push({ v: q.price, d: SESSIONS[0] });
    }
    pts.forEach((p, i) => { p.x = i / (pts.length - 1); });
    const all = (key === "1W" ? pts.slice() : closes.slice(HISTORY_DAYS - Math.min(back, HISTORY_DAYS - 1)).map((c) => ({ v: c }))
      .concat(rangeSeries(s, "1W", q))).concat(today);
    pts.lo = Math.min(...all.map((p) => p.v));
    pts.hi = Math.max(...all.map((p) => p.v));
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

  class Popup {
    constructor(root, { symbols, clock, full, holdScale }) {
      this.root = root;
      this.symbols = symbols;
      this.clock = clock;
      this.full = full;
      this.holdScale = holdScale;
      this.sym = 0;
      this.sel = 0;
      this.range = symbols.map(() => "1D"); // every stock keeps its own range
      this.changeMode = 0;
      this.scrub = -1;
      this.reveal = 1;
      this.replayFrame = null;
      this.build();
      Look.on(() => this.render());
    }

    build() {
      const r = this.root;
      r.innerHTML = `
        <div class="pop-head">
          <button type="button" class="animal"></button>
          <span class="zz" aria-hidden="true"></span>
          <span class="status"></span>
          <span class="head-tools">
            <button type="button" class="look"></button>
            ${this.full ? `<button type="button" class="help" aria-label="Show the demo's keys">?</button>` : ""}
          </span>
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
        <div class="breadth"><span>ALL</span><span>TODAY</span><canvas class="breadth-rule" aria-hidden="true"></canvas></div>
        <div class="rows" role="group" aria-label="Made-up watchlist">${this.symbols.map((s) => `
          <button type="button" class="row"><span><span class="sym">${s.sym}</span><br><span class="name">${s.name}</span></span><canvas aria-hidden="true"></canvas><span class="nums"><span></span><b></b></span></button>`).join("")}
        </div>
        <div class="sheet" hidden>
          <p class="sheet-title">KEYS · THIS DEMO</p>
          <dl>
            <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Scrub one chart step</dd>
            <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Change the chart range</dd>
            <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move the selection</dd>
            <dt><kbd>⏎</kbd></dt><dd>Show the selected row's chart</dd>
            <dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>Show that row's chart</dd>
            <dt><kbd>p</kbd></dt><dd>Replay the chart</dd>
            <dt><kbd>c</kbd></dt><dd>Percent, amount, or since the open</dd>
            <dt><kbd>s</kbd></dt><dd>Switch between smooth and retro</dd>
            <dt><kbd>Esc</kbd></dt><dd>Close this sheet, then the scrub</dd>
          </dl>
        </div>` : ""}`;
      const $ = (sel) => r.querySelector(sel);
      this.el = {
        animal: $(".animal"), zz: $(".zz"), status: $(".status"), look: $(".look"), help: $(".help"),
        listing: $(".listing"), price: $(".price"), change: $(".change"), ext: $(".ext"),
        cap: $(".change-cap"), chart: $(".chart"), ranges: $(".ranges"), info: $(".info"),
        breadth: $(".breadth-rule"), rows: $(".rows"), sheet: $(".sheet"),
      };
      const el = this.el;
      el.animal.addEventListener("click", () => this.replay());
      el.look.addEventListener("click", () => Look.toggle());
      el.change.addEventListener("click", () => this.cycleChange());
      el.chart.addEventListener("pointermove", (e) => this.scrubAt(e.clientX));
      el.chart.addEventListener("pointerdown", (e) => this.scrubAt(e.clientX));
      el.chart.addEventListener("pointerleave", () => { if (this.scrub >= 0 && this.replayFrame === null) this.endScrub(); });
      r.addEventListener("keydown", (e) => this.key(e));
      if (this.full) {
        el.help.addEventListener("click", () => this.toggleSheet());
        el.sheet.addEventListener("click", () => this.toggleSheet(false));
        el.ranges.addEventListener("click", (e) => { const b = e.target.closest("[data-range]"); if (b) this.setRange(b.dataset.range); });
        [...el.rows.children].forEach((row, i) => row.addEventListener("click", () => { this.sel = i; this.setSymbol(i); }));
      }
    }

    feat() { return this.symbols[this.sym]; }
    quote() { return Market.quoteAt(this.feat(), this.clock); }

    series() {
      const s = this.feat();
      const q = this.quote();
      const key = this.range[this.sym];
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
      const widest = Math.max(...this.symbols.map((s) => Cells.blockCells(money(s.prev * 1.03)).columns));
      const room = this.root.clientWidth - 44 - (innerWidth <= 640 ? 100 : 140);
      return Math.max(4, Math.min(11, Math.floor(room / widest)));
    }

    render() {
      const { s, q, key, pts, base, day } = this.series();
      const retro = Look.retro;
      const el = this.el;
      const scrubbed = this.scrub >= 0 && pts[this.scrub];
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
      const dir = tone(((shown - base) / base) * 100);
      const asleep = !scrubbed && day && q.asleep;
      el.animal.innerHTML = "";
      el.animal.disabled = !dir || !pts.length;
      el.animal.hidden = !dir;
      if (dir) {
        const color = dir === "up" ? COL.up : COL.down;
        if (retro) el.animal.innerHTML = Cells.spriteSVG(Cells.sprite(dir === "up", asleep), 2, color);
        else {
          const c = document.createElement("canvas");
          c.style.width = "40px"; c.style.height = "28px";
          el.animal.appendChild(c);
          Cells.drawAnimal(Cells.fit(c).ctx, dir === "up", color, asleep ? 1 : 0);
        }
        el.animal.setAttribute("aria-label", `Replay the chart (the ${dir === "up" ? "bull" : "bear"}${asleep ? ", asleep" : ""})`);
      }
      el.zz.innerHTML = asleep && dir ? (retro ? Cells.spriteSVG(Cells.SLEEP_Z, 2, rgba(COL.fg, 0.5)) : "z") : "";
      el.status.textContent = status;

      el.look.innerHTML = retro ? LOOK_ICONS.toSmooth : LOOK_ICONS.toRetro();
      el.look.setAttribute("aria-label", retro ? "Switch to smooth" : "Switch to retro");
      el.listing.innerHTML = `<b>${s.sym}</b>${s.name.toUpperCase()} · DEMO · USD`;

      const priceText = money(shown);
      el.price.innerHTML = retro
        ? Cells.blocksSVG(priceText, this.priceCell(), COL.fg, 6)
        : `<span class="smooth-price">${priceText}</span>`;

      const canOpen = day && q.open !== null;
      if (this.changeMode === 2 && !canOpen) this.changeMode = 0;
      const mode = day ? this.changeMode : 0;
      let delta;
      if (mode === 2) delta = ((shown - q.open) / q.open) * 100;
      else if (mode === 1) delta = shown - base;
      else delta = ((shown - base) / base) * 100;
      el.change.textContent = signed(delta, retro, mode === 1 ? "" : "%");
      el.change.className = `change ${tone(delta) || "flat"}`;
      el.change.disabled = !day;
      el.change.setAttribute("aria-label", `${el.change.textContent}. ${day ? "Show the change as a percent, an amount, or since the open." : ""}`);

      const ext = !scrubbed && day ? q.ext : null;
      if (ext) {
        const extDelta = mode === 1 ? ext.v - q.price : ext.pct;
        el.ext.innerHTML = `${ext.label} <b>${money(ext.v)}</b> <span class="${tone(ext.pct) || "flat"}">${signed(extDelta, retro, mode === 1 ? "" : "%")}</span>`;
      } else el.ext.textContent = "";
      el.cap.textContent = mode === 2 ? "SINCE OPEN" : !scrubbed && day ? q.caption : "";

      this.drawChart({ q, pts, base, day });

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

    drawChart({ q, pts, base, day }) {
      const { ctx, w, h } = Cells.fit(this.el.chart);
      const s = this.feat();
      const o = {
        scrub: this.scrub,
        reveal: this.reveal,
        lastCap: day && this.scrub < 0 ? q.lastRegular : -1,
        ticks: day ? Market.BELLS : [],
        scale: day && this.holdScale ? s.prints : null,
      };
      if (Look.retro) Cells.drawRetro(ctx, w, h, pts, base, { ...o, pixel: 6, gap: 1, ghost: 0.035 });
      else Cells.drawSmooth(ctx, w, h, pts, base, o);
    }

    renderInfo(s, q, pts, key) {
      const retro = Look.retro;
      const year = rangeSeries(s, "1Y", q);
      const lines = key === "1D"
        ? [["1D", q.low, q.high], ["52W", year.lo, year.hi]]
        : [[key, pts.lo, pts.hi], ["52W", year.lo, year.hi]];
      this.el.info.innerHTML = lines.map(([label]) => `<span>${label}</span><b></b><canvas aria-hidden="true"></canvas><b></b>`).join("");
      const kids = this.el.info.children;
      lines.forEach(([, lo, hi], k) => {
        kids[k * 4 + 1].textContent = lo === null ? "" : money(lo);
        kids[k * 4 + 3].textContent = hi === null ? "" : money(hi);
        Cells.drawRule(kids[k * 4 + 2], retro, [[1, COL.fg, 0.14]], lo === null ? null : (q.price - lo) / (hi - lo || 1));
      });
      const pcts = this.symbols.map((x) => Market.quoteAt(x, this.clock).pct);
      const ups = pcts.filter((p) => tone(p) === "up").length;
      const downs = pcts.filter((p) => tone(p) === "down").length;
      const n = pcts.length;
      Cells.drawRule(this.el.breadth, retro, [[ups / n, COL.up, 1], [(n - ups - downs) / n, COL.fg, 0.14], [downs / n, COL.down, 1]]);
    }

    renderRows() {
      const retro = Look.retro;
      [...this.el.rows.children].forEach((row, i) => {
        const s = this.symbols[i];
        const q = Market.quoteAt(s, this.clock);
        row.setAttribute("aria-current", String(i === this.sym));
        row.classList.toggle("selected", i === this.sel && i !== this.sym);
        const nums = row.querySelector(".nums");
        nums.firstElementChild.textContent = money(q.price);
        nums.lastElementChild.textContent = signed(q.pct, retro, "%");
        nums.lastElementChild.className = tone(q.pct) || "flat";
        const { ctx, w, h } = Cells.fit(row.querySelector("canvas"));
        if (retro) Cells.drawRetro(ctx, w, h, q.prints, s.prev, { pixel: 2, gap: 1, scrub: -1, scale: s.prints });
        else Cells.drawSmooth(ctx, w, h, q.prints, s.prev, { pad: 2, scrub: -1, lineWidth: 1.2, scale: s.prints });
      });
    }

    setSymbol(i) {
      this.stopReplay();
      this.sym = (i + this.symbols.length) % this.symbols.length;
      this.scrub = -1;
      this.render();
    }
    setRange(key) {
      this.stopReplay();
      this.range[this.sym] = key;
      this.scrub = -1;
      this.render();
    }
    stepRange(d) {
      const keys = RANGES.map((r) => r[0]);
      const k = keys.indexOf(this.range[this.sym]);
      this.setRange(keys[Math.max(0, Math.min(keys.length - 1, k + d))]);
    }
    cycleChange() {
      if (this.range[this.sym] !== "1D") return;
      const canOpen = this.quote().open !== null;
      this.changeMode = (this.changeMode + 1) % (canOpen ? 3 : 2);
      this.render();
    }
    endScrub() {
      this.stopReplay();
      this.scrub = -1;
      this.render();
    }

    scrubAt(clientX) {
      const { pts } = this.series();
      if (!pts.length) return;
      const r = this.el.chart.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      let best = 0;
      for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - f) < Math.abs(pts[best].x - f)) best = i;
      if (f > pts[pts.length - 1].x) best = pts.length - 1;
      this.stopReplay();
      this.scrub = best;
      this.render();
    }

    // A replay is a scrub that drives itself, the chart drawing in behind it.
    replay() {
      this.stopReplay();
      const { pts } = this.series();
      if (!pts.length || reducedMotion.matches) { this.scrub = -1; this.render(); return; }
      const first = pts[0].x;
      const last = pts[pts.length - 1].x;
      const t0 = performance.now();
      const tick = (t) => {
        const f = Math.min(1, (t - t0) / 2200);
        const x = first + f * (last - first);
        let i = 0;
        while (i + 1 < pts.length && pts[i + 1].x <= x) i++;
        this.scrub = f < 1 ? i : -1;
        this.reveal = f < 1 ? x + 0.0001 : 1;
        this.render();
        this.replayFrame = f < 1 ? requestAnimationFrame(tick) : null;
      };
      this.replayFrame = requestAnimationFrame(tick);
    }
    stopReplay() {
      if (this.replayFrame !== null) cancelAnimationFrame(this.replayFrame);
      this.replayFrame = null;
      this.reveal = 1;
    }

    toggleSheet(open) {
      if (!this.el.sheet) return;
      this.el.sheet.hidden = !(open ?? this.el.sheet.hidden);
    }

    key(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const onButton = e.target.tagName === "BUTTON";
      const { pts } = this.series();
      let handled = true;
      if (k === "?" && this.full) this.toggleSheet();
      else if (k === "Escape") {
        if (this.el.sheet && !this.el.sheet.hidden) this.toggleSheet(false);
        else if (this.scrub >= 0) this.endScrub();
        else handled = false;
      } else if (["ArrowLeft", "h", "ArrowRight", "l"].includes(k) && pts.length) {
        const d = k === "ArrowLeft" || k === "h" ? -1 : 1;
        this.stopReplay();
        const from = this.scrub >= 0 ? this.scrub : pts.length - 1;
        this.scrub = Math.max(0, Math.min(pts.length - 1, from + d));
        this.render();
      } else if (k === "p") this.replay();
      else if (k === "c") this.cycleChange();
      else if (!this.full) handled = false;
      else if (k === "[" || k === "]") this.stepRange(k === "[" ? -1 : 1);
      else if (["ArrowUp", "k", "ArrowDown", "j"].includes(k)) {
        this.sel = (this.sel + (k === "ArrowUp" || k === "k" ? -1 : 1) + this.symbols.length) % this.symbols.length;
        this.renderRows();
      } else if ((k === "Enter" || k === " ") && !onButton) this.setSymbol(this.sel);
      else if (/^[1-4]$/.test(k)) { this.sel = Number(k) - 1; this.setSymbol(this.sel); }
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
    dayPop.setClock(clockFor(p));
  }
  function setDayMode() {
    daySection.classList.toggle("still", reducedMotion.matches);
    if (reducedMotion.matches) dayPop.setClock(WHOLE_DAY);
    else followScroll();
  }
  addEventListener("scroll", () => { if (!dayFrame) dayFrame = requestAnimationFrame(followScroll); }, { passive: true });
  reducedMotion.addEventListener("change", setDayMode);

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
      pill.innerHTML = Cells.markSVG(small ? 3 : 4, 6, color, q.pct < 0);
    }
    pill.setAttribute("aria-label", `Stonks' pill as ${form === "icon" ? "the mark" : `a ${form}`}, made-up prices: ${s.sym} ${signed(q.pct, false, "%")}. Click to change its form.`);
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

  const moves = [...document.querySelectorAll(".moves [data-keys]")];
  let unlight = 0;
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    const row = moves.find((r) => r.dataset.keys.split(" ").includes(e.key));
    if (row) {
      moves.forEach((r) => r.classList.toggle("lit", r === row));
      clearTimeout(unlight);
      unlight = setTimeout(() => row.classList.remove("lit"), 1600);
    }
    if (e.key === "s") Look.toggle();
  });

  // ---- Page cells: headings, sprites, the hero's ground

  function paintBlocks() {
    document.querySelectorAll(".blocks[data-text]").forEach((node) => {
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
    paintScatter();
    paintSkyline();
  }
  setDayMode();
  paintAll();
  showTheme();
  if (document.fonts) document.fonts.ready.then(paintAll);
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { dayCell = 0; paintAll(); followScroll(); }, 120);
  });

  // Attract mode: the first time the hero's popup comes into view, it
  // replays its day.
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); setTimeout(() => hero.replay(), 400); }
    }, { threshold: 0.6 });
    io.observe(hero.el.chart);
  }
})();
