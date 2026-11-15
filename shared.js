// Shared by both versions: header, version switch, the "So what happened in 2017" hero,
// the list of 2017 events and the frame loop. Load it before the page's own script.

// 2017 events, in order. Both versions read from here; content for each event goes here later.
const EVENTS = [
  { date: "Jan 31" },
  { date: "Feb 03" },
  { date: "Mar 14" },
  { date: "Apr 20" },
  { date: "Jun 06" },
  { date: "Sep 12" },
];

const VERSIONS = [
  { id: "simple", label: "simple", href: "simple.html" },
  { id: "new", label: "new", href: "index.html" },
];

const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- chrome: header, version switch ----
// the timeline bar (Figma 5168-588): a frame of colour per event, [left, width] in the 1124px bar and its colour.
// Each fills in as the scroll reaches its event (--fill, set by the page); empty until then.
const TIMELINE = [
  [4.22, 78.59, "#0773fa"], [85.96, 109.9, "#5e5e5e"], [199.01, 109.9, "#55c98b"], [312.05, 109.9, "#d6d0fd"],
  [694.31, 112.48, "#fbccfd"], [809.94, 112.48, "#76574a"], [925.56, 112.48, "#58dbe6"], [1041.19, 78.59, "#fecd53"],
];
const currentVersion = document.body.dataset.version;
document.body.insertAdjacentHTML("afterbegin", `
  <header class="header">
    <a class="header__brand" href="#top" aria-label="Wix Anniversary – back to the start">
      <div class="logo" aria-hidden="true">
        <div class="logo__wix"><img src="assets/logo-wix.svg" alt="" /></div>
        <div class="logo__text"><img src="assets/logo-anniversary.svg" alt="" /></div>
      </div>
    </a>
    <a class="header__link header__timeline" href="#timeline">
      ${TIMELINE.map(([x, w, c], i) => `<span class="header__seg" style="--x:${x};--w:${w};--c:${c};--i:${i}" data-seg="${i}"></span>`).join("")}
      <span class="header__timeline-label">2017’s timeline</span>
    </a>
    <a class="header__link" href="#gift">Choose your gift</a>
  </header>
  <nav class="version-switch" aria-label="Site version">
    ${VERSIONS.map(v => `<a href="${v.href}"${v.id === currentVersion ? ' aria-current="page"' : ""}>${v.label}</a>`).join("")}
  </nav>
`);

// the header's buttons: the brand goes back to the opening (the top of the page); the timeline and "Choose your
// gift" go to the very end, where the thank-you and its gift buttons, the bars and the closing line are all in
// place. The page glides there on its own clock rather than jumping (which the smoothed scroll then rushed through),
// over `perScreen` ms for each screen of the way, at least `min` and at most `max` ms. It picks up speed briefly
// (the first `rise` of the time) and from there slows down all the way in, so it is already easing off as it comes
// into the last section and settles gently (see glideEase). A wheel, touch, key or click on the way stops it where
// it is.
// out: the power of the ease-out (higher: a longer, softer slow-down at the end)
const HEADER_GLIDE = { perScreen: 470, min: 1600, max: 3900, rise: 0.18, out: 4 };
// time (0 … 1) → share of the way: a short ease-in, then an ease-out from the same speed, so the speed never jumps;
// from the top, the last section (about the last tenth of the way) takes the last ~1.8 s
const GLIDE_A = HEADER_GLIDE.out * HEADER_GLIDE.rise / (2 * (1 - HEADER_GLIDE.rise) + HEADER_GLIDE.out * HEADER_GLIDE.rise); // share of the way covered while picking up speed
function glideEase(t) {
  const r = HEADER_GLIDE.rise;
  if (t < r) return GLIDE_A * (t / r) ** 2;
  const u = (t - r) / (1 - r);
  return GLIDE_A + (1 - GLIDE_A) * (1 - (1 - u) ** HEADER_GLIDE.out);
}
let headerGlide = null;
const stopHeaderGlide = () => { if (headerGlide) { cancelAnimationFrame(headerGlide); headerGlide = null; } Site.gliding = false; };
function glideTo(to) {
  stopHeaderGlide();
  const from = scrollY, d = to - from;
  if (Math.abs(d) < 2) return;
  if (reduceMotion) { scrollTo({ top: to, behavior: "instant" }); return; }
  const ms = clamp(Math.abs(d) / innerHeight * HEADER_GLIDE.perScreen, HEADER_GLIDE.min, HEADER_GLIDE.max);
  const t0 = performance.now(), dir = Math.sign(d);
  // (while it runs the page leaves the scroll to it: its own glide to the end doesn't start)
  Site.gliding = true;
  const step = now => {
    const t = clamp((now - t0) / ms, 0, 1);
    const at = from + d * glideEase(t);
    if ((at - scrollY) * dir > 0) scrollTo({ top: at, behavior: "instant" });
    if (t < 1) headerGlide = requestAnimationFrame(step); else { headerGlide = null; Site.gliding = false; }
  };
  headerGlide = requestAnimationFrame(step);
}
["wheel", "touchstart", "keydown", "mousedown"].forEach(ev => addEventListener(ev, stopHeaderGlide, { passive: true }));
document.querySelector(".header").addEventListener("click", e => {
  const a = e.target.closest('a[href="#top"], a[href="#gift"], a[href="#timeline"]');
  if (!a) return;
  e.preventDefault();
  const end = document.documentElement.scrollHeight - innerHeight, href = a.getAttribute("href");
  // the timeline goes where the page says its first event is (the end when it doesn't say)
  const first = Site.timelineTarget ? Site.timelineTarget() : end;
  glideTo(href === "#top" ? 0 : href === "#timeline" ? Math.min(first, end) : end);
});

// ---- hero markup (first section of <main>); a page with data-hero="none" brings its own opening ----
const hasHero = document.body.dataset.hero !== "none";
if (hasHero) document.querySelector("main").insertAdjacentHTML("afterbegin", `
  <section class="hero" id="hero">
    <div class="hero__stage">
      <div class="hero__comp" id="heroComp">
        <h1 class="hero__title hero__title--top">So what<br />happened</h1>
        <p class="hero__title hero__title--in" aria-hidden="true">in</p>
        <p class="hero__year" aria-hidden="true">2<span class="t0">0</span><span class="reel t1" data-reel="tens"></span><span class="reel" data-reel="ones"></span></p>
        <span class="hero__rule" aria-hidden="true"></span>
        <img class="hero__dot" id="heroDot" src="assets/hero-dot.svg" alt="" aria-hidden="true" />
      </div>
    </div>
  </section>
`);

// ---- hero: red dot travelling along the underline while the title is pinned ----
const hero = document.getElementById("hero");
const heroComp = document.getElementById("heroComp");
const heroDot = document.getElementById("heroDot");

const HERO_PIN = 1;           // viewports the title stays pinned while the dot travels
// the dot starts at the left end of the underline and travels right, ending where Figma places it
const DOT_TRAVEL = -402.08;   // px: overhangs the left end (x -194.09) as much as it overhangs the right end (x 205.17)

// ---- hero: "2027" counts down to "2017" like a slot machine ----
const COUNT_FROM = 27, COUNT_TO = 17;
const LINE_H = 124.786;            // line height of the year (Figma)
const RULE_TOP = 149.32 - 36.61;   // top of the red underline, measured from the top of the year's line (Figma)
// each reel lists the values it can show; row k of the strip shows digit k % 10
const REELS = {
  tens: { rows: [0, 1, 2, 3], shows: "12", final: 1 },
  ones: { rows: Array.from({ length: COUNT_FROM - COUNT_TO + 3 }, (_, i) => COUNT_TO - 1 + i), shows: "0123456789", final: 7 },
};
const reels = {};
document.querySelectorAll("[data-reel]").forEach(r => {
  const cfg = REELS[r.dataset.reel];
  r.innerHTML = `<span class="reel__size">${cfg.final}</span>` +
    `<span class="reel__window"><span class="reel__strip">` +
    cfg.rows.map(k => `<span>${k % 10}</span>`).join("") +
    `</span></span>`;
  reels[r.dataset.reel] = {
    cfg, first: cfg.rows[0], pitch: LINE_H,
    win: r.querySelector(".reel__window"),
    strip: r.querySelector(".reel__strip"),
    cells: [...r.querySelectorAll(".reel__strip > span")],
  };
});

// Fit each reel's window to the ink of its digits, so a digit starts to disappear
// the moment it leaves its own top/bottom edge; the next digit follows right behind it.
function fitReels() {
  const year = document.querySelector(".hero__year");
  const cs = getComputedStyle(year);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const fm = ctx.measureText("0");
  // baseline inside the line box: half-leading + font ascent
  const baseline = (LINE_H - (fm.fontBoundingBoxAscent + fm.fontBoundingBoxDescent)) / 2 + fm.fontBoundingBoxAscent;
  Object.values(reels).forEach(r => {
    let top = Infinity, bottom = -Infinity;
    for (const ch of r.cfg.shows) {
      const m = ctx.measureText(ch);
      top = Math.min(top, baseline - m.actualBoundingBoxAscent);
      bottom = Math.max(bottom, baseline + m.actualBoundingBoxDescent);
    }
    top = Math.floor(top) - 1;   // 1px so antialiasing isn't shaved
    bottom = RULE_TOP;           // the red underline is the floor: digits never pass below it
    r.win.style.top = `${top}px`;
    r.win.style.height = `${bottom - top}px`;
    r.strip.style.top = `${-top}px`;
    r.pitch = bottom - top;
    r.cells.forEach((c, i) => { c.style.top = `${i * r.pitch}px`; });
  });
}

function setReel(name, pos) {
  const r = reels[name];
  // smaller values sit above, so counting down rolls the strip downward
  r.strip.style.transform = `translateY(${(-(pos - r.first) * r.pitch).toFixed(2)}px)`;
}

// Scroll span (document px) over which the dot travels and the year counts down.
// By default it is the pinned stretch at the top of the hero; a page can widen it with Site.setHeroRange.
let heroRange = () => ({ start: hero.offsetTop, length: innerHeight * HERO_PIN });

function heroProgress(y) {
  const { start, length } = heroRange();
  return length > 0 ? clamp((y - start) / length, 0, 1) : 0;
}

function renderCount(y) {
  const t = heroProgress(y);
  // step through the values one by one; each step eases so the reels settle on every digit
  const steps = t * (COUNT_FROM - COUNT_TO);
  const whole = Math.min(Math.floor(steps), COUNT_FROM - COUNT_TO - 1);
  const value = COUNT_FROM - (whole + easeInOut(clamp(steps - whole, 0, 1)));
  // tens turns slowly from 2 to 1 across the whole scroll (gentle ease at both ends)
  const tens = Math.floor(COUNT_FROM / 10) - (0.5 - 0.5 * Math.cos(Math.PI * t));
  setReel("ones", value);
  setReel("tens", tens);
}

function renderDot(y) {
  const t = heroProgress(y);
  heroDot.style.transform = `translateX(${((1 - easeInOut(t)) * DOT_TRAVEL).toFixed(2)}px)`;
}

function heroLayout() {
  hero.style.height = `${innerHeight * (1 + HERO_PIN)}px`;
  const s = Math.min(1, (innerWidth - 32) / 680, (innerHeight - 80) / 520);
  heroComp.style.setProperty("--hero-scale", Math.max(0.3, s).toFixed(3));
}

// ---- frame loop: pages register their own layout and per-frame work ----
const Site = {
  smoothY: scrollY,
  _frame: [],
  _layout: [],
  onFrame(fn) { this._frame.push(fn); },
  onLayout(fn) { this._layout.push(fn); },
  setHeroRange(fn) { heroRange = fn; },
  // where the header's timeline button takes the page (a scroll position); the page sets it
  timelineTarget: null,
  // true while a header button's glide is running
  gliding: false,
  start() {
    const layoutAll = () => { if (hasHero) heroLayout(); this._layout.forEach(fn => fn()); };
    const draw = () => {
      if (hasHero) {
        renderDot(this.smoothY);
        renderCount(this.smoothY);
      }
      this._frame.forEach(fn => fn(this.smoothY));
    };
    const tick = () => {
      // smooth the scroll value so the motion feels weighted
      this.smoothY = reduceMotion ? scrollY : this.smoothY + (scrollY - this.smoothY) * 0.12;
      if (Math.abs(scrollY - this.smoothY) < 0.05) this.smoothY = scrollY;
      draw();
      requestAnimationFrame(tick);
    };
    layoutAll();
    if (hasHero) fitReels();
    document.fonts.ready.then(() => { if (hasHero) fitReels(); draw(); });
    addEventListener("resize", layoutAll);
    this.smoothY = scrollY;
    draw();
    requestAnimationFrame(tick);
  },
};
