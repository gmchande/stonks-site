// Stonks' sounds on the page, as the plugin plays them: the fixed sounds
// from its own WAVs (sounds/), and the chimes and the replay made from the
// chart on screen, ported from its ChartSound.js. A browser plays nothing
// until the reader clicks, taps, or presses a key, never on a scroll, so
// the first one starts them; until then the speaker says they're waiting,
// and pressing it starts them. Then the speaker, or m, turns them off, and
// the page remembers.
window.Sound = (() => {
  "use strict";

  // ---- The chart heard (ChartSound.js). The chimes are the chart as a row
  // of bars you run a hand along: the pentatonic's eleven notes, low at the
  // chart's floor and high at its ceiling. The replay is made from the
  // chart as it starts, along the replay's own InOutSine.

  const RATE = 24000;
  const STEP = 24;
  const TABLE = 1024;
  const PENTATONIC = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73, 1318.51, 1479.98, 1760];

  const inOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2;
  const placeAt = (t, from, to, seconds) => from + (to - from) * inOutSine(Math.min(1, t / seconds));

  function cycle(shape) {
    const table = new Float32Array(TABLE + 1);
    for (let i = 0; i <= TABLE; i++) table[i] = shape(i / TABLE);
    return table;
  }

  function biquad(type, f, q) {
    const w = 2 * Math.PI * f / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    const a0 = 1 + a;
    const b0 = (type === "lp" ? (1 - c) / 2 : (1 + c) / 2) / a0;
    return { b0, b1: (type === "lp" ? 1 - c : -(1 + c)) / a0, b2: b0, a1: -2 * c / a0, a2: (1 - a) / a0 };
  }

  // A high-pass then a low-pass, in place.
  function band(x, low, high) {
    const h = biquad("hp", low, 0.707), l = biquad("lp", high, 0.707);
    let hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0, ly1 = 0, ly2 = 0;
    for (let i = 0; i < x.length; i++) {
      const hy = h.b0 * x[i] + h.b1 * hx1 + h.b2 * hx2 - h.a1 * hy1 - h.a2 * hy2;
      hx2 = hx1; hx1 = x[i];
      const ly = l.b0 * hy + l.b1 * hy1 + l.b2 * hy2 - l.a1 * ly1 - l.a2 * ly2;
      hy2 = hy1; hy1 = hy; ly2 = ly1; ly1 = ly;
      x[i] = ly;
    }
    return x;
  }

  // Raised-cosine edges, so neither end clicks.
  function fadeEdges(x, inMs, outMs) {
    const a = Math.round(inMs / 1000 * RATE), b = Math.round(outMs / 1000 * RATE);
    for (let i = 0; i < a && i < x.length; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
    for (let j = 0; j < b && j < x.length; j++) x[x.length - 1 - j] *= 0.5 - 0.5 * Math.cos(Math.PI * j / b);
    return x;
  }

  // The sound, and the gain that puts its loudest 50 ms at `db` dBFS.
  function levelled(x, db) {
    const win = Math.round(0.05 * RATE);
    let best = 0, acc = 0;
    for (let i = 0; i < x.length; i++) {
      acc += x[i] * x[i];
      if (i >= win) acc -= x[i - win] * x[i - win];
      if (acc > best) best = acc;
    }
    return { samples: x, gain: best > 0 ? Math.pow(10, db / 20) / Math.sqrt(best / win) : 0 };
  }

  const barOf = (height) => Math.round(Math.max(0, Math.min(1, height)) * (PENTATONIC.length - 1));
  const rowBar = (grid, row) => barOf((grid.rows - 1 - row) / Math.max(1, grid.rows - 1));

  // The bar under smooth's line at each place along it, -1 off its ends.
  // It walks on from where it was last asked, as a replay only moves on.
  function lineBars(geometry) {
    const pts = geometry ? geometry.points : [];
    let k = 0;
    return (x) => {
      if (!pts.length || x < pts[0].x || x > pts[pts.length - 1].x) return -1;
      if (pts.length === 1) return barOf(1 - pts[0].y);
      if (x < pts[k].x) k = 0;
      while (k < pts.length - 2 && pts[k + 1].x < x) k++;
      const a = pts[k], b = pts[k + 1];
      return barOf(1 - (a.y + (b.y - a.y) * (b.x === a.x ? 0 : (x - a.x) / (b.x - a.x))));
    };
  }

  // The bar the chart sounds at `x` (0..1 along it): in smooth the line's
  // height there, in retro the lit row of the column there, dark columns
  // silent.
  function barAt(chart, x) {
    if (!chart || x < 0) return -1;
    if (chart.retro) {
      const grid = chart.grid;
      const row = grid.levels[Math.max(0, Math.min(grid.columns - 1, Math.floor(x * grid.columns)))];
      return row === undefined ? -1 : rowBar(grid, row);
    }
    return lineBars(chart.geometry)(x);
  }

  // Smooth's chime: a soft metal bar struck with felt, ringing about half a
  // second: a free bar's modes, the upper ones dying first, higher bars
  // ringing shorter.
  function smoothBar(f) {
    const ring = 0.55;
    const x = new Float32Array(Math.round(ring * RATE));
    const tau = ring / 4.6 * 1.2 * Math.sqrt(440 / f);
    const modes = [[1, 1, 1], [2.756, 0.28, 0.35], [5.404, 0.08, 0.15]];
    for (const [ratio, level, decay] of modes) {
      const w = 2 * Math.PI * f * ratio / RATE;
      const r = Math.exp(-1 / (tau * decay * RATE));
      const c = 2 * r * Math.cos(w), rr = r * r;
      let before = 0, last = level * r * Math.sin(w);
      x[1] += last;
      for (let i = 2; i < x.length; i++) {
        const next = c * last - rr * before;
        x[i] += next;
        before = last;
        last = next;
      }
    }
    return levelled(fadeEdges(x, 3, 50), -28);
  }

  const smoothBars = [];
  function smoothBarSamples(bar) {
    if (!smoothBars[bar]) {
      const sound = smoothBar(PENTATONIC[bar]);
      smoothBars[bar] = sound.samples.map((v) => v * sound.gain);
    }
    return smoothBars[bar];
  }

  // The NES's pulse pitches come from an 11-bit period, which gives retro
  // the console's slightly-off tuning.
  const nesPitch = (f) => 1789773 / (16 * Math.round(1789773 / (16 * f)));
  const nesVolume = (t, start, stepMs, floor) => Math.max(floor, start - Math.floor(t * 1000 / stepMs)) / 15;

  // One cycle of a 25% pulse, band-limited to 7 kHz.
  function pulseTable(f) {
    const duty = 0.25, top = Math.max(1, Math.floor(7000 / f));
    return cycle((phase) => {
      let v = 0;
      for (let k = 1; k <= top; k++) v += (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(2 * Math.PI * k * (phase - duty / 2));
      return v;
    });
  }
  const pulseBars = [];
  const pulseBar = (bar) => pulseBars[bar] || (pulseBars[bar] = pulseTable(nesPitch(PENTATONIC[bar])));

  // Retro's chime: a pulse blip that falls in the console's volume steps.
  function retroBar(bar) {
    const f = nesPitch(PENTATONIC[bar]);
    const x = new Float32Array(Math.round(0.113 * RATE));
    const wave = pulseBar(bar), step = f / RATE * TABLE;
    const slewK = 1 - Math.exp(-1 / (0.0012 * RATE));
    let slew = 0, ph = 0;
    for (let i = 0; i < x.length; i++) {
      slew += (nesVolume(i / RATE, 9, 12, 0) - slew) * slewK;
      ph += step;
      if (ph >= TABLE) ph -= TABLE;
      const a = ph | 0;
      x[i] = slew * (wave[a] + (wave[a + 1] - wave[a]) * (ph - a));
    }
    return levelled(fadeEdges(band(x, 90, 6500), 0.5, 3), -29);
  }

  // Smooth's replay: the scrub's chimes, struck as the replay's place moves
  // onto each bar of the line, at most one every 45 ms, a bar struck sooner
  // waiting out the gap with the latest waiting winning.
  function smoothReplay(geometry, from, to, seconds) {
    const bars = lineBars(geometry);
    const x = new Float32Array(Math.round((seconds + 0.6) * RATE));
    const gap = Math.round(0.045 * RATE), end = Math.round(seconds * RATE);
    let heard = -1, last = -gap, waiting = -1;
    const strike = (bar, at) => {
      const note = smoothBarSamples(bar), n = Math.min(note.length, x.length - at);
      for (let j = 0, k = at; j < n; j++, k++) x[k] += note[j];
      last = at;
      waiting = -1;
    };
    for (let i = 0; i < end + STEP; i += STEP) {
      const bar = bars(placeAt(i / RATE, from, to, seconds));
      if (bar < 0) waiting = -1;
      if (waiting >= 0 && i >= last + gap) strike(waiting, last + gap);
      if (bar === heard) continue;
      heard = bar;
      if (bar < 0) continue;
      if (i >= last + gap) strike(bar, i);
      else waiting = bar;
    }
    if (waiting >= 0) strike(waiting, last + gap);
    return { samples: x, gain: 1 };
  }

  // Retro's replay: each column the replay reaches plays its lit row as a
  // note, a repeated note held and falling in the console's steps; where a
  // lit column lands across the baseline from the one before, the noise
  // channel ticks.
  function retroReplay(grid, from, to, seconds) {
    const x = new Float32Array(Math.round((seconds + 0.1) * RATE));
    const slewK = 1 - Math.exp(-1 / (0.0012 * RATE));
    let slew = 0, ph = 0, note = -1, since = 0, lastCol = -1, lastSide = 0, step = 0, wave = null, lit = false;
    const ticks = [];
    for (let i = 0; i < x.length; i += STEP) {
      const t = i / RATE;
      const col = Math.max(0, Math.min(grid.columns - 1, Math.floor(placeAt(t, from, to, seconds) * grid.columns)));
      if (col !== lastCol) {
        lastCol = col;
        const row = grid.levels[col];
        const wasLit = lit;
        lit = row !== undefined;
        if (!lit) lastSide = 0;
        if (lit) {
          const next = rowBar(grid, row);
          if (next !== note || !wasLit) since = t;
          if (next !== note) {
            note = next;
            wave = pulseBar(note);
            step = nesPitch(PENTATONIC[note]) / RATE * TABLE;
          }
          const side = Math.sign(grid.baseRow - row);
          if (side && lastSide && side !== lastSide) ticks.push(i);
          if (side) lastSide = side;
        }
      }
      const volume = !lit || t > seconds ? 0 : nesVolume(t - since, 11, 25, 6);
      if (!wave) continue;
      for (let j = i, end = Math.min(x.length, i + STEP); j < end; j++) {
        slew += (volume - slew) * slewK;
        ph += step;
        if (ph >= TABLE) ph -= TABLE;
        const a = ph | 0;
        x[j] = slew * (wave[a] + (wave[a + 1] - wave[a]) * (ph - a));
      }
    }
    // The noise channel: a 15-bit shift register clocked at 9 kHz.
    const noise = new Float32Array(Math.round(0.03 * RATE));
    let reg = 7, clock = 0;
    for (let c = 0; c < noise.length; c++) {
      clock += 9000 / RATE;
      while (clock >= 1) {
        clock -= 1;
        reg = (reg >> 1) | (((reg & 1) ^ ((reg >> 1) & 1)) << 14);
      }
      noise[c] = (reg & 1) ? -1 : 1;
    }
    for (const at of ticks) {
      for (let m = 0; m < noise.length && at + m < x.length; m++) x[at + m] += 0.5 * nesVolume(m / RATE, 10, 4, 0) * noise[m];
    }
    return levelled(fadeEdges(band(x, 90, 6500), 1, 4), -28);
  }

  // ---- Playing them. The fixed sounds, the bell, and a replay play one at
  // a time: a new one stops the one playing. The chimes overlap and ring.

  let ctx = null;
  let on = true;
  try { on = localStorage.getItem("stonks-sound") !== "off"; } catch { /* on, unremembered */ }
  const listeners = [];
  const files = {};
  let solo = null;
  let replaySource = null;

  const ready = () => on && ctx && ctx.state === "running";
  const voice = (retro) => (retro ? "retro" : "smooth");

  function load(look, name) {
    const key = `${look}/${name}`;
    if (!files[key]) {
      files[key] = fetch(`sounds/${key}.wav`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
      files[key].catch(() => { delete files[key]; });
    }
    return files[key];
  }

  function bufferOf(sound) {
    const b = ctx.createBuffer(1, sound.samples.length, RATE);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = sound.samples[i] * sound.gain;
    return b;
  }

  function start(buffer, alone) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    if (alone) {
      if (solo) try { solo.stop(); } catch { /* ended */ }
      solo = src;
      src.onended = () => { if (solo === src) solo = null; };
    }
    src.start();
    return src;
  }

  // Whether sound was on and still waiting as the reader's latest press
  // began: a press on the speaker then starts sound rather than turning it
  // off, though the audio may have started by the time its click lands.
  let pressWaited = false;

  // The first click or key starts the page's audio; before it, nothing
  // can sound. Then the fixed sounds load, so the first plays at once.
  function unlock(e) {
    if (e && (e.type === "pointerdown" || e.type === "keydown")) pressWaited = on && !ready();
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      ctx = new Context();
      ctx.addEventListener("statechange", () => listeners.forEach((fn) => fn()));
    }
    if (ctx.state === "suspended") ctx.resume();
    if (on) for (const look of ["smooth", "retro"]) for (const name of ["add", "remove", "undo", "shutter", "bell"]) load(look, name);
  }
  for (const type of ["pointerdown", "pointerup", "keydown", "touchend"]) {
    addEventListener(type, unlock, { capture: true, passive: true });
  }

  // A fixed sound, in the look's voice: add, remove, undo, shutter, bell.
  // The click that turns sound on is still starting the audio as it asks.
  // Resolves true once the speakers play it (`playing`), so what names it
  // shows as it's heard; false if it doesn't sound.
  function play(retro, name) {
    if (!on || !ctx) return Promise.resolve(false);
    return Promise.all([load(voice(retro), name), ctx.state === "running" || ctx.resume()])
      .then(([b]) => {
        if (!ready()) return false;
        const at = ctx.currentTime;
        start(b, true);
        return new Promise((heard) => setTimeout(() => heard(ready()), Math.max(0, (at - playing()) * 1000)));
      }, () => false);
  }

  // A chime, bar `bar` (0..10) struck: at most one every 45 ms, 22 a
  // second, a bar struck sooner waiting out the gap and the latest waiting
  // winning; -1, a place with no bar, drops the one waiting.
  const chimes = { smooth: [], retro: [] };
  const ringing = new Set(); // the chimes still sounding, which turning sound off stops
  let lastChime = -Infinity, waiting = null, waitTimer = 0;
  function strike(retro, bar) {
    clearTimeout(waitTimer);
    waitTimer = 0;
    waiting = null;
    lastChime = performance.now();
    const kept = chimes[voice(retro)];
    if (!kept[bar]) kept[bar] = bufferOf(retro ? retroBar(bar) : { samples: smoothBarSamples(bar), gain: 1 });
    const src = start(kept[bar], false);
    ringing.add(src);
    src.onended = () => ringing.delete(src);
  }
  function chime(retro, bar) {
    if (!ready()) return;
    if (bar < 0) {
      clearTimeout(waitTimer);
      waitTimer = 0;
      waiting = null;
      return;
    }
    const wait = lastChime + 45 - performance.now();
    if (wait <= 0) return strike(retro, bar);
    waiting = { retro, bar };
    if (!waitTimer) waitTimer = setTimeout(() => { waitTimer = 0; if (waiting && ready()) strike(waiting.retro, waiting.bar); }, Math.ceil(wait));
  }

  // A replay's picture and sound start together: `go` starts both. Before
  // the reader's first press nothing can sound, so a replay starts at once,
  // silent; after one, while the audio is still starting, it waits until
  // the audio reaches the speakers, 1.5 s at most, as Stonks waits for its
  // output to wake: by the output's timestamp, or where a browser gives
  // none, once the audio has run a quarter second. Returns what drops the
  // wait.
  const pressed = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const flowing = () => ctx.state === "running"
    && ((ctx.getOutputTimestamp && ctx.getOutputTimestamp().contextTime > 0) || ctx.currentTime >= 0.25);
  function whenHeard(go) {
    if (!on || !ctx || !pressed() || flowing()) { go(); return () => {}; }
    const since = performance.now();
    let frame = requestAnimationFrame(function wait(t) {
      frame = 0;
      if (!on || flowing() || t - since >= 1500) go();
      else frame = requestAnimationFrame(wait);
    });
    return () => cancelAnimationFrame(frame);
  }

  // A replay's sound, made from the chart as it starts: `chart` is what
  // the chart drew (its retro grid or smooth points), and the replay runs
  // from `from` to `to` along it over `seconds`. Returns its clock, the
  // seconds of it the speakers have played, or null while nothing sounds:
  // a browser plays what it makes a little later, 0.3 s in Chrome over
  // PipeWire, so a picture kept to the clock keeps to what's heard.
  function replay(chart, from, to, seconds) {
    stopReplay();
    if (!ready() || !chart) return null;
    const sound = chart.retro ? retroReplay(chart.grid, from, to, seconds) : smoothReplay(chart.geometry, from, to, seconds);
    const at = ctx.currentTime;
    replaySource = start(bufferOf(sound), true);
    return () => playing() - at;
  }

  // The context's time the speakers are playing now, by the output's own
  // timestamp where the browser gives one; Chrome's first can come without
  // its moment on the page's clock, `performanceTime` 0.
  function playing() {
    const o = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    if (!o || !o.contextTime || !o.performanceTime) return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0);
    return o.contextTime + (performance.now() - o.performanceTime) / 1000;
  }
  function stopReplay() {
    if (replaySource && solo === replaySource) try { replaySource.stop(); } catch { /* ended */ }
    replaySource = null;
  }

  // On or off; turned on, the add sound plays once, so you hear how loud
  // they are.
  function set(value, retro) {
    on = value;
    try { localStorage.setItem("stonks-sound", on ? "on" : "off"); } catch { /* not remembered */ }
    if (!on) {
      stopReplay();
      if (solo) try { solo.stop(); } catch { /* ended */ }
      clearTimeout(waitTimer);
      waitTimer = 0;
      waiting = null;
      for (const src of ringing) try { src.stop(); } catch { /* ended */ }
      ringing.clear();
    }
    listeners.forEach((fn) => fn());
    if (on) { unlock(); play(retro, "add"); }
  }

  // The speaker pressed: while sound waits for the reader's first press,
  // it starts sound, as its label says; otherwise it turns sound on or off.
  function press(retro) {
    const waited = pressWaited || (on && !ctx);
    pressWaited = false;
    set(waited || !on, retro);
  }

  return {
    get on() { return on; },
    get heard() { return ready(); },
    set, toggle: (retro) => set(!on, retro), press, onChange: (fn) => listeners.push(fn),
    play, chime, barAt, whenHeard, replay, stopReplay,
  };
})();
