import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function midi(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function noise(i) {
  let x = i | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (((x ^ (x >>> 16)) & 65535) / 32768) - 1;
}

export function synthesize(content, outPath) {
  const sr = 48000;
  const dur = content.duration;
  const n = Math.floor(sr * dur);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const send = new Float32Array(n);

  function addTone(buffer, startTime, freq, length, amp, attack, release) {
    const start = Math.floor(startTime * sr);
    const len = Math.floor(length * sr);
    const attackN = Math.max(1, Math.floor(attack * sr));
    const releaseN = Math.max(1, Math.floor(release * sr));
    let phase = 0;
    const step = (2 * Math.PI * freq) / sr;
    for (let i = 0; i < len; i += 1) {
      const idx = start + i;
      if (idx < 0 || idx >= n) continue;
      let env = 1;
      if (i < attackN) env = i / attackN;
      else if (i > len - releaseN) env = Math.max(0, (len - i) / releaseN);
      buffer[idx] += Math.sin(phase) * env * amp;
      phase += step;
      if (phase > Math.PI * 2) phase -= Math.PI * 2;
    }
  }

  function addImpact(time, amp) {
    const start = Math.floor(time * sr);
    const len = Math.floor(0.55 * sr);
    let phase = 0;
    for (let i = 0; i < len; i += 1) {
      const idx = start + i;
      if (idx < 0 || idx >= n) break;
      const tt = i / sr;
      const env = Math.exp(-tt * 7.5);
      phase += (2 * Math.PI * (70 * Math.exp(-tt * 8) + 38)) / sr;
      const body = Math.sin(phase) * env;
      const click = noise(idx + 91) * Math.exp(-tt * 36);
      const sample = (body * 0.85 + click * 0.4) * amp;
      L[idx] += sample;
      R[idx] += sample * 0.96;
      send[idx] += sample * 0.7;
    }
  }

  function addKick(time, amp) {
    const start = Math.floor(time * sr);
    const len = Math.floor(0.18 * sr);
    let phase = 0;
    for (let i = 0; i < len; i += 1) {
      const idx = start + i;
      if (idx < 0 || idx >= n) break;
      const tt = i / sr;
      phase += (2 * Math.PI * (150 * Math.exp(-tt * 22) + 46)) / sr;
      const sample = Math.sin(phase) * Math.exp(-tt * 14) * amp;
      L[idx] += sample;
      R[idx] += sample;
    }
  }

  function addHat(time, amp) {
    const start = Math.floor(time * sr);
    const len = Math.floor(0.045 * sr);
    for (let i = 0; i < len; i += 1) {
      const idx = start + i;
      if (idx < 0 || idx >= n) break;
      const env = Math.exp((-i / sr) * 80);
      const sample = noise(idx + 400) * env * amp;
      L[idx] += sample * 0.8;
      R[idx] += sample;
    }
  }

  function addRiser(time, length = 0.85) {
    const start = Math.floor(time * sr);
    const len = Math.floor(length * sr);
    let low = 0;
    for (let i = 0; i < len; i += 1) {
      const idx = start + i;
      if (idx < 0 || idx >= n) break;
      const p = i / len;
      const cutoff = 180 + p * p * 5200;
      const dt = 1 / sr;
      const a = dt / (1 / (2 * Math.PI * cutoff) + dt);
      const x = noise(idx + 17);
      low += a * (x - low);
      const sample = low * p * p * 0.22;
      L[idx] += sample;
      R[idx] += sample * 0.85;
    }
  }

  function addChime(time, amp = 0.07) {
    addTone(L, time, 880, 0.62, amp, 0.008, 0.46);
    addTone(R, time, 1318, 0.7, amp * 0.75, 0.008, 0.5);
    addTone(send, time, 1760, 0.5, amp * 0.4, 0.005, 0.4);
  }

  const bpm = 100;
  const beat = 60 / bpm;
  const chords = [
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
  ];
  const bars = Math.ceil(dur / (beat * 4));
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chords[bar % chords.length];
    const t0 = bar * beat * 4;
    const bed = t0 < 7 ? 0.7 : t0 >= 45 && t0 < 52.5 ? 0.55 : 1;
    for (const note of chord) {
      const freq = midi(note);
      addTone(L, t0, freq, beat * 4.15, 0.03 * bed, 0.4, 0.55);
      addTone(R, t0, freq * 1.004, beat * 4.15, 0.028 * bed, 0.45, 0.55);
      addTone(L, t0, freq * 2, beat * 4.15, 0.012 * bed, 0.55, 0.4);
      addTone(R, t0, freq * 2.003, beat * 4.15, 0.011 * bed, 0.55, 0.4);
    }
    const root = midi(chord[0] - 12);
    addTone(L, t0, root, beat * 3.4, 0.15 * bed, 0.04, 0.35);
    addTone(R, t0, root, beat * 3.4, 0.15 * bed, 0.04, 0.35);
  }

  for (let i = 0; i < dur / beat; i += 1) {
    const t0 = i * beat;
    if (t0 >= dur) break;
    if (t0 < 6.4) {
      if (i % 2 === 0) addTone(L, t0, 55, 0.32, 0.08, 0.01, 0.2);
      if (i % 2 === 0) addTone(R, t0, 55, 0.32, 0.08, 0.01, 0.2);
      continue;
    }
    const terms = t0 >= 45 && t0 < 52.5;
    if (i % 2 === 0) addKick(t0, t0 >= 52.5 ? 0.5 : terms ? 0.22 : 0.34);
    if (!terms) addHat(t0 + beat * 0.5, t0 >= 52.5 ? 0.05 : 0.032);
  }

  for (const scene of content.scenes) {
    if (scene.start > 0.2) {
      addRiser(scene.start - 0.8, 0.8);
      addImpact(scene.start, scene.type === "close" ? 0.85 : 0.55);
    } else {
      addImpact(0.12, 0.35);
    }
    if (scene.type !== "track") continue;
    for (const segment of scene.segments) {
      const when = scene.start + segment.from;
      if (segment.type === "tier") addChime(when, 0.09);
      if (segment.type === "hero") addChime(when, 0.055);
      if (segment.type === "rail") {
        segment.prizes.forEach((_, index) => addChime(when + index * 0.1, 0.05));
      }
    }
  }

  addImpact(52.5, 0.9);
  addTone(L, 52.5, midi(62), 6.5, 0.06, 0.05, 2.2);
  addTone(R, 52.5, midi(65), 6.5, 0.05, 0.08, 2.4);
  addTone(L, 52.5, midi(69), 6.2, 0.04, 0.1, 2.2);
  addTone(R, 52.5, midi(74), 5.5, 0.03, 0.12, 2);

  const delayL = Math.round(0.38 * sr);
  const delayR = Math.round(0.53 * sr);
  const wetL = new Float32Array(n);
  const wetR = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const dl = i - delayL >= 0 ? wetL[i - delayL] : 0;
    const dr = i - delayR >= 0 ? wetR[i - delayR] : 0;
    wetL[i] = send[i] + dl * 0.38;
    wetR[i] = send[i] * 0.8 + dr * 0.4;
    L[i] += wetL[i] * 0.22;
    R[i] += wetR[i] * 0.22;
  }

  let peak = 0;
  let prevL = 0;
  let prevR = 0;
  let lowL = 0;
  let lowR = 0;
  const hp = 0.996;
  for (let i = 0; i < n; i += 1) {
    const inL = L[i];
    const inR = R[i];
    lowL = hp * (lowL + inL - prevL);
    lowR = hp * (lowR + inR - prevR);
    prevL = inL;
    prevR = inR;
    const fadeIn = Math.min(1, i / (sr * 0.04));
    const fadeOut = i > (dur - 0.8) * sr ? Math.max(0, (n - i) / (sr * 0.8)) : 1;
    const gain = fadeIn * fadeOut;
    L[i] = Math.tanh(lowL * 1.35) * gain;
    R[i] = Math.tanh(lowR * 1.35) * gain;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0.001 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i += 1) {
    L[i] *= norm;
    R[i] *= norm;
  }

  const header = 44;
  const buffer = Buffer.alloc(header + n * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + n * 4, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(sr * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    buffer.writeInt16LE(l < 0 ? l * 0x8000 : l * 0x7fff, header + i * 4);
    buffer.writeInt16LE(r < 0 ? r * 0x8000 : r * 0x7fff, header + i * 4 + 2);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return { samples: n, peak, sampleRate: sr, duration: dur };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const content = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
  const out = path.join(root, "assets/music/score.wav");
  const started = Date.now();
  const info = synthesize(content, out);
  console.log(`score ${out} ${info.duration}s peak-before-norm ${info.peak.toFixed(3)} in ${Date.now() - started}ms`);
}
