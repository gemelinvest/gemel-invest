import { productSVG } from "./products.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;

async function loadJSON(url, fallback) {
  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

const content = await loadJSON("/content.json", null);
const manifest = await loadJSON("/stage/product-manifest.json", {});

if (!content) {
  throw new Error("content.json missing");
}

const stage = {
  bg: document.getElementById("bg").getContext("2d"),
  grain: document.getElementById("grain").getContext("2d"),
  world: document.getElementById("world"),
  flash: document.getElementById("flash"),
  corners: document.querySelector(".corners"),
};

const W = content.width;
const H = content.height;
const scenes = content.scenes;
const cuts = scenes.map((scene) => scene.start).filter((start) => start > 0.05);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261101);
const particles = Array.from({ length: 180 }, () => ({
  x: rand(),
  y: rand(),
  r: 0.8 + rand() * 2.6,
  speed: 0.012 + rand() * 0.04,
  freq: 0.4 + rand() * 1.4,
  phase: rand() * Math.PI * 2,
  amp: 0.004 + rand() * 0.012,
  gold: rand() > 0.62,
  streak: rand() > 0.86,
  len: 18 + rand() * 46,
}));

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

function entrance(local, at, dur = 0.48) {
  const p = clamp01((local - at) / dur);
  return {
    opacity: easeOut(p),
    y: (1 - easeOut(p)) * 36,
    scale: lerp(0.94, 1, easeOut(p)),
    blur: (1 - p) * 7,
  };
}

function segmentVis(local, from, to) {
  const inDur = 0.4;
  const outDur = 0.28;
  const pIn = clamp01((local - from) / inDur);
  const pOut = clamp01((local - (to - outDur)) / outDur);
  return {
    opacity: easeOut(pIn) * (1 - easeIn(pOut)),
    y: (1 - easeOut(pIn)) * 46 - easeIn(pOut) * 22,
    scale: lerp(0.9, 1, easeOut(pIn)) * (1 + 0.045 * Math.sin(clamp01(pIn) * Math.PI)),
    blur: (1 - pIn) * 6,
  };
}

function place(node, state) {
  const opacity = state.opacity ?? 1;
  node.style.opacity = String(opacity);
  node.style.visibility = opacity < 0.012 ? "hidden" : "visible";
  node.style.transform = `translate3d(0, ${state.y || 0}px, 0) scale(${state.scale ?? 1})`;
  node.style.filter = state.blur > 0.2 ? `blur(${state.blur}px)` : "none";
}

function envelope(t, start, end, isLast) {
  const fadeIn = start <= 0 ? 0.4 : 0.18;
  const incoming = easeOut(clamp01((t - start) / fadeIn));
  const outgoing = isLast ? 1 : clamp01((end - t) / 0.18);
  return Math.min(incoming, outgoing);
}

function setCaption(node, prize) {
  node.replaceChildren();
  const lines = prize.lines?.length ? prize.lines : [prize.name];
  lines.forEach((line, index) => {
    const row = el("div", index === lines.length - 1 ? "cap-main" : "cap-kicker", node);
    row.textContent = line;
    row.dir = /[\u0590-\u05FF]/.test(line) ? "rtl" : "ltr";
  });
}

function makeArt(parent, prize, uid) {
  const art = el("div", "art", parent);
  const graphic = el("div", "graphic", art);
  graphic.innerHTML = productSVG(prize.art, uid);
  const photo = el("img", "photo", art);
  photo.alt = "";
  const prizeId = uid.split("-").pop();
  if (manifest[prizeId]) {
    photo.src = `/assets/products/${prize.file}`;
    graphic.style.display = "none";
  } else {
    photo.style.display = "none";
  }
  return { art };
}

function buildRig(parent, prizeId, uid, absolute) {
  const prize = content.prizes[prizeId];
  const rig = el("div", absolute ? "rig" : "rig", parent);
  const { art } = makeArt(rig, prize, uid);
  const caption = el("div", "caption", rig);
  setCaption(caption, prize);
  return { rig, art, prizeId };
}

const built = scenes.map((scene, index) => {
  const section = el("section", `scene scene-${scene.type}`, stage.world);
  section.id = `scene-${scene.id}`;
  const isLast = index === scenes.length - 1;
  if (scene.type === "open" || scene.type === "close") {
    const plate = el("div", "logo-plate", section);
    const logo = el("img", "logo", plate);
    logo.src = content.logo;
    logo.alt = "גמל";
    const lines = scene.titleLines.map((text, lineIndex) => {
      const node = el("div", lineIndex === scene.titleLines.length - 1 ? "title-line gold" : "title-line", section);
      node.textContent = text;
      return node;
    });
    const rule = scene.type === "open" ? el("div", "rule", section) : null;
    const subs = (scene.subtitleLines || []).map((text) => {
      const node = el("div", "sub-line gold", section);
      node.textContent = text;
      return node;
    });
    return { scene, section, isLast, logo, lines, rule, subs };
  }
  if (scene.type === "dates") {
    const kicker = el("div", "kicker", section);
    kicker.textContent = scene.kicker;
    const from = el("div", "date", section);
    from.textContent = scene.from;
    from.dir = "ltr";
    const dash = el("div", "date-dash", section);
    dash.textContent = "–";
    const to = el("div", "date", section);
    to.textContent = scene.to;
    to.dir = "ltr";
    const subs = scene.subtitleLines.map((text, lineIndex) => {
      const node = el("div", lineIndex === 0 ? "sub-line" : "sub-line gold", section);
      node.textContent = text;
      return node;
    });
    return { scene, section, isLast, kicker, from, dash, to, subs };
  }
  if (scene.type === "terms") {
    const title = el("h2", "terms-title", section);
    title.textContent = scene.title;
    const list = el("ol", "terms-list", section);
    const items = scene.items.map((text, itemIndex) => {
      const item = el("li", "term", list);
      const num = el("span", "n", item);
      num.textContent = `${itemIndex + 1}.`;
      num.dir = "ltr";
      const tx = el("span", "tx", item);
      tx.textContent = text;
      tx.dir = "rtl";
      return item;
    });
    return { scene, section, isLast, title, items };
  }
  const head = el("div", "track-head", section);
  const title = el("h2", "track-title", head);
  title.textContent = scene.title;
  const tierStack = el("div", "tier-stack", head);
  const zone = el("div", "product-zone", section);
  const heroSlot = el("div", "hero-slot", zone);
  const noteSlot = el("div", "note-slot", zone);
  const segments = scene.segments.map((segment, segmentIndex) => {
    if (segment.type === "tier") {
      const tier = el("div", "tier", tierStack);
      const label = el("div", "tier-label", tier);
      label.textContent = segment.label;
      const amount = el("div", "tier-amount", tier);
      amount.textContent = segment.amount;
      amount.dir = "ltr";
      const compact = segment.amount.replace(/\s/g, "").length >= 8;
      amount.style.fontSize = compact ? "92px" : "112px";
      let extra = null;
      if (segment.extraNumber) {
        extra = el("div", "extra-row", tier);
        extra.dir = "rtl";
        const plus = el("span", "plus", extra);
        plus.textContent = "+";
        const num = el("span", "num", extra);
        num.textContent = segment.extraNumber;
        num.dir = "ltr";
        const word = el("span", "word", extra);
        word.textContent = segment.extraWord;
      }
      return { ...segment, el: tier, extra };
    }
    if (segment.type === "note") {
      const note = el("div", "note", noteSlot);
      note.textContent = segment.text;
      return { ...segment, el: note };
    }
    if (segment.type === "hero") {
      const rig = buildRig(heroSlot, segment.prize, `${scene.id}-${segment.prize}`);
      return { ...segment, ...rig };
    }
    const rail = el("div", segment.prizes.length === 2 ? "rail phones" : "rail", zone);
    const items = segment.prizes.map((prizeId) =>
      buildRig(rail, prizeId, `${scene.id}-${segmentIndex}-${prizeId}`)
    );
    return { ...segment, el: rail, items };
  });
  return { scene, section, isLast, title, segments };
});

function drawBackground(t) {
  const ctx = stage.bg;
  ctx.clearRect(0, 0, W, H);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#070b18");
  base.addColorStop(0.42, "#0a1733");
  base.addColorStop(1, "#04060d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const nx = W * 0.5 + Math.sin(t * 0.33) * 90;
  const ny = H * 0.3 + Math.cos(t * 0.21) * 70;
  const nebula = ctx.createRadialGradient(nx, ny, 20, nx, ny, 680);
  nebula.addColorStop(0, "rgba(48, 104, 220, 0.42)");
  nebula.addColorStop(0.5, "rgba(18, 48, 120, 0.16)");
  nebula.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, W, H);

  const gx = W * 0.52 + Math.cos(t * 0.28) * 40;
  const gold = ctx.createRadialGradient(gx, H * 0.74, 10, gx, H * 0.74, 520);
  gold.addColorStop(0, "rgba(224, 168, 72, 0.2)");
  gold.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, W, H);

  drawBeam(ctx, t, -0.62, "rgba(90, 150, 255, 0.16)");
  drawBeam(ctx, t + 1.6, 0.48, "rgba(228, 180, 92, 0.08)");

  for (const particle of particles) {
    const y = ((particle.y - t * particle.speed) % 1 + 1) % 1;
    const x = particle.x + Math.sin(t * particle.freq + particle.phase) * particle.amp;
    const alpha = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 + particle.phase));
    ctx.fillStyle = particle.gold
      ? `rgba(228, 180, 92, ${alpha})`
      : `rgba(170, 205, 255, ${alpha})`;
    const px = ((x % 1) + 1) % 1 * W;
    const py = y * H;
    if (particle.streak) {
      ctx.fillRect(px, py, 2, particle.len);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const cut of [0.2, ...cuts]) {
    const age = t - cut;
    if (age < 0 || age > 0.85) continue;
    const strength = 1 - age / 0.85;
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const ang = (i / count) * Math.PI * 2 + cut;
      const dist = 40 + age * 520 + (i % 5) * 18;
      ctx.fillStyle = i % 3 === 0
        ? `rgba(228, 180, 92, ${0.45 * strength})`
        : `rgba(170, 205, 255, ${0.35 * strength})`;
      ctx.beginPath();
      ctx.arc(W / 2 + Math.cos(ang) * dist * 0.55, H * 0.42 + Math.sin(ang) * dist * 0.72, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let flare = 0;
  for (const cut of cuts) {
    const age = t - cut;
    if (age >= 0 && age < 0.28) flare = Math.max(flare, 1 - age / 0.28);
  }
  if (flare > 0) {
    const y = H * 0.46;
    const grad = ctx.createLinearGradient(0, y - 16, 0, y + 16);
    grad.addColorStop(0, "rgba(150, 190, 255, 0)");
    grad.addColorStop(0.5, `rgba(210, 228, 255, ${0.28 * flare})`);
    grad.addColorStop(1, "rgba(150, 190, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 18, W, 36);
  }
}

function drawBeam(ctx, t, tilt, color) {
  ctx.save();
  ctx.translate(W * 0.5, H * 0.42);
  ctx.rotate(tilt + Math.sin(t * 0.15) * 0.04);
  const grad = ctx.createLinearGradient(-70, 0, 70, 0);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(-80, -H, 160, H * 2);
  ctx.restore();
}

function spinArt(art, local, phase, emphasis = 1) {
  const ry = Math.sin(local * 1.15 + phase) * 14 * emphasis;
  art.style.transform = `rotateY(${ry}deg) rotateX(7deg)`;
}

function renderFrame(frame) {
  const t = frame / content.fps;
  drawBackground(t);

  let punch = 1;
  for (const cut of cuts) {
    const age = t - cut;
    if (age >= 0 && age < 0.45) punch = Math.max(punch, 1 + 0.028 * (1 - easeOut(age / 0.45)));
  }
  const driftX = Math.sin(t * 0.35) * 6;
  const driftY = Math.cos(t * 0.27) * 8;
  stage.world.style.transform = `translate3d(${driftX}px, ${driftY}px, 0) scale(${punch})`;

  let flash = 0;
  for (const cut of cuts) {
    const age = t - cut;
    if (age >= -0.04 && age < 0.3) {
      const ramp = age < 0 ? (age + 0.04) / 0.04 : 1 - age / 0.3;
      flash = Math.max(flash, ramp * 0.36);
    }
  }
  stage.flash.style.opacity = String(flash);
  stage.corners.style.opacity = String(0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.4)));

  for (const model of built) {
    const start = model.scene.start;
    const end = start + model.scene.duration;
    const sceneAlpha = envelope(t, start, end, model.isLast);
    model.section.style.opacity = String(sceneAlpha);
    model.section.style.visibility = sceneAlpha < 0.008 ? "hidden" : "visible";
    if (sceneAlpha < 0.008) continue;
    const local = t - start;
    if (model.scene.type === "open") renderOpen(model, local);
    else if (model.scene.type === "dates") renderDates(model, local);
    else if (model.scene.type === "terms") renderTerms(model, local);
    else if (model.scene.type === "close") renderClose(model, local);
    else renderTrack(model, local);
  }
}

function renderOpen(model, local) {
  const logoIn = entrance(local, 0.18, 0.85);
  place(model.logo, logoIn);
  model.lines.forEach((line, index) => place(line, entrance(local, 1.85 + index * 0.28, 0.55)));
  const ruleP = clamp01((local - 2.7) / 0.45);
  model.rule.style.opacity = String(easeOut(ruleP));
  model.rule.style.transform = `scaleX(${Math.max(0.001, easeOut(ruleP))})`;
}

function renderDates(model, local) {
  place(model.kicker, entrance(local, 0.08, 0.4));
  place(model.from, entrance(local, 0.32, 0.5));
  place(model.dash, entrance(local, 0.62, 0.35));
  place(model.to, entrance(local, 0.78, 0.5));
  model.subs.forEach((line, index) => place(line, entrance(local, 1.55 + index * 0.22, 0.45)));
}

function renderTerms(model, local) {
  place(model.title, entrance(local, 0.08, 0.45));
  model.items.forEach((item, index) => place(item, entrance(local, 0.45 + index * 0.22, 0.46)));
}

function renderClose(model, local) {
  place(model.logo, entrance(local, 0.12, 0.7));
  model.lines.forEach((line, index) => place(line, entrance(local, 1.15 + index * 0.24, 0.5)));
  model.subs.forEach((line, index) => place(line, entrance(local, 2.15 + index * 0.2, 0.45)));
}

function renderTrack(model, local) {
  place(model.title, entrance(local, 0.05, 0.45));
  for (const segment of model.segments) {
    if (segment.type === "tier" || segment.type === "note") {
      place(segment.el, segmentVis(local, segment.from, segment.to));
      continue;
    }
    if (segment.type === "hero") {
      const vis = segmentVis(local, segment.from, segment.to);
      place(segment.rig, vis);
      if (vis.opacity > 0.02) spinArt(segment.art, local, 0.4);
      continue;
    }
    segment.items.forEach((item, index) => {
      const vis = segmentVis(local, segment.from + index * 0.1, segment.to);
      place(item.rig, vis);
      if (vis.opacity > 0.02) {
        spinArt(item.art, local, index * 0.8, segment.prizes.length === 3 ? 0.75 : 1);
      }
    });
  }
}

window.renderFrame = renderFrame;

try {
  await document.fonts.load("700 80px Heebo");
  window.__fontOK = document.fonts.check("700 80px Heebo");
} catch {
  window.__fontOK = false;
}
window.__ready = true;

const params = new URLSearchParams(location.search);
if (params.has("play")) {
  const started = performance.now();
  const loop = (now) => {
    const elapsed = ((now - started) / 1000) % content.duration;
    renderFrame(Math.floor(elapsed * content.fps));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else if (params.has("frame")) {
  renderFrame(Number(params.get("frame")) || 0);
} else {
  renderFrame(0);
}
