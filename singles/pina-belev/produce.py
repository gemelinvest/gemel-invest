#!/usr/bin/env python3
"""Sincere single mix + master for פינה בלב.

Keeps the original performance and arrangement. Cleans mud, lifts the vocal,
and masters for streaming without crushing the verses.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import sosfilt

SRC = Path("/tmp/pina-belev/source.wav")
OUT_DIR = Path(__file__).resolve().parent / "audio"
MIX_WAV = Path("/tmp/pina-belev/mix.wav")
MASTER_WAV = OUT_DIR / "pina-belev-single.wav"
MASTER_MP3 = OUT_DIR / "pina-belev-single.mp3"
COVER = Path(__file__).resolve().parent / "art" / "cover.jpg"
REPORT = Path("/tmp/pina-belev/master-report.json")


def db(x: float) -> float:
    return 10 ** (x / 20.0)


def rbj_peaking(f0: float, q: float, gain_db: float, sr: int) -> np.ndarray:
    a = 10 ** (gain_db / 40.0)
    w0 = 2 * math.pi * f0 / sr
    alpha = math.sin(w0) / (2 * q)
    cosw = math.cos(w0)
    b0 = 1 + alpha * a
    b1 = -2 * cosw
    b2 = 1 - alpha * a
    a0 = 1 + alpha / a
    a1 = -2 * cosw
    a2 = 1 - alpha / a
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def rbj_lowshelf(f0: float, gain_db: float, sr: int, slope: float = 0.72) -> np.ndarray:
    a = 10 ** (gain_db / 40.0)
    w0 = 2 * math.pi * f0 / sr
    cosw = math.cos(w0)
    sinw = math.sin(w0)
    alpha = (sinw / 2.0) * math.sqrt((a + 1 / a) * (1 / slope - 1) + 2)
    b0 = a * ((a + 1) - (a - 1) * cosw + 2 * math.sqrt(a) * alpha)
    b1 = 2 * a * ((a - 1) - (a + 1) * cosw)
    b2 = a * ((a + 1) - (a - 1) * cosw - 2 * math.sqrt(a) * alpha)
    a0 = (a + 1) + (a - 1) * cosw + 2 * math.sqrt(a) * alpha
    a1 = -2 * ((a - 1) + (a + 1) * cosw)
    a2 = (a + 1) + (a - 1) * cosw - 2 * math.sqrt(a) * alpha
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def rbj_highshelf(f0: float, gain_db: float, sr: int, slope: float = 0.72) -> np.ndarray:
    a = 10 ** (gain_db / 40.0)
    w0 = 2 * math.pi * f0 / sr
    cosw = math.cos(w0)
    sinw = math.sin(w0)
    alpha = (sinw / 2.0) * math.sqrt((a + 1 / a) * (1 / slope - 1) + 2)
    b0 = a * ((a + 1) + (a - 1) * cosw + 2 * math.sqrt(a) * alpha)
    b1 = -2 * a * ((a - 1) + (a + 1) * cosw)
    b2 = a * ((a + 1) + (a - 1) * cosw - 2 * math.sqrt(a) * alpha)
    a0 = (a + 1) - (a - 1) * cosw + 2 * math.sqrt(a) * alpha
    a1 = 2 * ((a - 1) - (a + 1) * cosw)
    a2 = (a + 1) - (a - 1) * cosw - 2 * math.sqrt(a) * alpha
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def rbj_highpass(f0: float, q: float, sr: int) -> np.ndarray:
    w0 = 2 * math.pi * f0 / sr
    alpha = math.sin(w0) / (2 * q)
    cosw = math.cos(w0)
    b0 = (1 + cosw) / 2
    b1 = -(1 + cosw)
    b2 = (1 + cosw) / 2
    a0 = 1 + alpha
    a1 = -2 * cosw
    a2 = 1 - alpha
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def apply_sos(x: np.ndarray, sos: np.ndarray) -> np.ndarray:
    """Minimum-phase EQ. Pad to hide filter startup."""
    pad = 4096
    if x.ndim == 1:
        xp = np.pad(x, (pad, pad), mode="edge")
        return sosfilt(sos, xp)[pad:-pad].astype(np.float64)
    y = np.empty_like(x)
    for ch in range(x.shape[1]):
        xp = np.pad(x[:, ch], (pad, pad), mode="edge")
        y[:, ch] = sosfilt(sos, xp)[pad:-pad]
    return y


def smooth_gain(n: int, sr: int, nodes: list[tuple[float, float]]) -> np.ndarray:
    times = np.array([t for t, _ in nodes], dtype=np.float64)
    gains = np.array([g for _, g in nodes], dtype=np.float64)
    t = np.arange(n, dtype=np.float64) / sr
    env = np.interp(t, times, gains)
    # 80 ms smoothing
    k = max(1, int(sr * 0.08))
    kernel = np.hanning(k * 2 + 1)
    kernel /= kernel.sum()
    env = np.convolve(env, kernel, mode="same")
    return env.astype(np.float64)


def rbj_bandpass(f0: float, q: float, sr: int) -> np.ndarray:
    w0 = 2 * math.pi * f0 / sr
    alpha = math.sin(w0) / (2 * q)
    cosw = math.cos(w0)
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1 + alpha
    a1 = -2 * cosw
    a2 = 1 - alpha
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]])


def deess_mid(mid: np.ndarray, sr: int) -> np.ndarray:
    """Gentle dynamic de-ess on ~7.2 kHz, mid channel only."""
    band = apply_sos(mid, rbj_bandpass(7200, 1.8, sr))
    win = max(1, int(sr * 0.010))
    env = np.abs(band)
    pad = np.pad(env, (win, win), mode="edge")
    csum = np.cumsum(pad)
    avg = (csum[2 * win :] - csum[: -2 * win]) / (2 * win)
    thresh = 0.035
    over = np.maximum(avg / thresh, 1.0)
    gr = np.clip(1.0 / (over ** 0.55), 0.62, 1.0)
    return mid - band * (1.0 - gr)


def soft_warmth(x: np.ndarray, drive: float = 1.12) -> np.ndarray:
    return np.tanh(x * drive) / math.tanh(drive)


def follow_gain(gr: np.ndarray, sr: int, attack: float, release: float, hop: int = 64) -> np.ndarray:
    """Control-rate attack/release, then upsample. Keeps the Python loop short."""
    ctrl = gr[::hop].copy()
    atk = math.exp(-hop / (sr * attack))
    rel = math.exp(-hop / (sr * release))
    sm = np.empty_like(ctrl)
    acc = 1.0
    for i, g in enumerate(ctrl):
        coef = atk if g < acc else rel
        acc = coef * acc + (1 - coef) * g
        sm[i] = acc
    t_ctrl = np.arange(len(sm), dtype=np.float64) * hop
    t = np.arange(len(gr), dtype=np.float64)
    return np.interp(t, t_ctrl, sm).astype(np.float64)


def glue_compress(x: np.ndarray, sr: int) -> np.ndarray:
    """Very slow bus glue, ~1–2 dB on the chorus only."""
    mono = np.mean(x, axis=1)
    win = max(1, int(sr * 0.08))
    rms = np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode="same") + 1e-12)
    thresh = 0.16
    ratio = 1.45
    over = np.maximum(20 * np.log10(rms / thresh), 0.0)
    gr_db = -over * (1.0 - 1.0 / ratio)
    gr = 10 ** (gr_db / 20.0)
    sm = follow_gain(gr, sr, attack=0.035, release=0.28, hop=64)
    return x * sm[:, None]


def lookahead_limit(x: np.ndarray, sr: int, ceiling: float = 0.89, lookahead_ms: float = 4.0) -> np.ndarray:
    la = max(1, int(sr * lookahead_ms / 1000.0))
    peak = np.max(np.abs(x), axis=1)
    kernel = np.ones(2 * la + 1, dtype=np.float64)
    # max-filter via stride windows at control rate
    hop = 32
    idx = np.arange(0, len(peak), hop)
    env_ctrl = np.empty(len(idx), dtype=np.float64)
    for i, p in enumerate(idx):
        lo = max(0, p - la)
        hi = min(len(peak), p + la + 1)
        env_ctrl[i] = peak[lo:hi].max()
    env = np.interp(np.arange(len(peak)), idx, env_ctrl)
    needed = np.maximum(env / ceiling, 1.0)
    gr = 1.0 / needed
    sm = follow_gain(gr, sr, attack=0.001, release=0.080, hop=32)
    y = x * sm[:, None]
    return np.clip(y, -ceiling, ceiling)


def mix(x: np.ndarray, sr: int) -> np.ndarray:
    left, right = x[:, 0].astype(np.float64), x[:, 1].astype(np.float64)
    mid = (left + right) * 0.5
    side = (left - right) * 0.5

    # Shared cleanup — rumble and boxiness without thinning the chest.
    shared = np.vstack(
        [
            rbj_highpass(26, 0.70, sr),
            rbj_lowshelf(48, -0.8, sr),
            rbj_peaking(220, 0.90, -1.0, sr),
        ]
    )
    mid = apply_sos(mid, shared)
    side = apply_sos(side, shared)

    # Vocal sits in the mid. A little diction, still close and human.
    mid = apply_sos(
        mid,
        np.vstack(
            [
                rbj_peaking(900, 1.00, 0.5, sr),
                rbj_peaking(3000, 1.10, 1.5, sr),
                rbj_peaking(4800, 1.40, 0.6, sr),
                rbj_highshelf(12000, 0.3, sr),
            ]
        ),
    )
    mid = deess_mid(mid, sr)

    # Room / strings stay a little wider after the second verse.
    side = apply_sos(
        side,
        np.vstack(
            [
                rbj_highpass(130, 0.70, sr),
                rbj_highshelf(10000, 0.4, sr),
            ]
        ),
    )
    n = len(mid)
    side_env = smooth_gain(
        n,
        sr,
        [(0, 1.00), (12, 1.00), (58, 1.04), (90, 1.06), (112, 1.10), (140, 1.12), (170, 1.04)],
    )
    side = side * side_env

    left = mid + side
    right = mid - side
    y = np.stack([left, right], axis=1)

    y = glue_compress(y, sr)
    y = soft_warmth(y, drive=1.08)

    # Tiny section ride: verses stay intimate, chorus does not jump harder.
    ride = smooth_gain(
        n,
        sr,
        [
            (0.0, db(0.4)),
            (12.0, db(0.6)),
            (58.0, db(0.2)),
            (90.0, db(0.5)),
            (111.0, db(0.15)),
            (132.0, db(0.25)),
            (168.0, db(0.0)),
        ],
    )
    y = y * ride[:, None]
    return y


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    x, sr = sf.read(str(SRC), always_2d=True)
    if sr != 48000:
        raise SystemExit(f"expected 48 kHz source, got {sr}")

    y = mix(x, sr)
    peak = float(np.max(np.abs(y)))
    if peak > 0.95:
        y *= 0.95 / peak
    y = lookahead_limit(y, sr, ceiling=0.89)
    sf.write(str(MIX_WAV), y, sr, subtype="FLOAT")

    import subprocess

    # Two-pass loudnorm: sincere streaming single, not a slammed club master.
    probe = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(MIX_WAV),
            "-af",
            "loudnorm=I=-13:TP=-1.0:LRA=9:print_format=json",
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    raw = probe.stderr
    start = raw.rfind("{")
    end = raw.rfind("}")
    meas = json.loads(raw[start : end + 1])
    ln = (
        "loudnorm=I=-13:TP=-1.0:LRA=9:"
        f"measured_I={meas['input_i']}:"
        f"measured_TP={meas['input_tp']}:"
        f"measured_LRA={meas['input_lra']}:"
        f"measured_thresh={meas['input_thresh']}:"
        f"offset={meas['target_offset']}:"
        "linear=true:print_format=summary"
    )
    MASTER_WAV.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-i",
            str(MIX_WAV),
            "-af",
            ln,
            "-c:a",
            "pcm_s24le",
            str(MASTER_WAV),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    cover_args = []
    if COVER.exists():
        cover_args = ["-i", str(COVER)]
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-i",
        str(MASTER_WAV),
        *cover_args,
        "-map",
        "0:a",
    ]
    if COVER.exists():
        cmd += ["-map", "1:v", "-c:v", "mjpeg", "-disposition:v", "attached_pic"]
    cmd += [
        "-c:a",
        "libmp3lame",
        "-b:a",
        "320k",
        "-id3v2_version",
        "3",
        "-metadata",
        "title=פינה בלב",
        "-metadata",
        "artist=oriasomech",
        "-metadata",
        "album=פינה בלב",
        "-metadata",
        "album_artist=oriasomech",
        "-metadata",
        "genre=Israeli Pop",
        "-metadata",
        "comment=סינגל בהפקה כנה",
        str(MASTER_MP3),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)

    verify = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(MASTER_WAV),
            "-af",
            "loudnorm=I=-13:TP=-1.0:LRA=9:print_format=json",
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    raw = verify.stderr
    start = raw.rfind("{")
    end = raw.rfind("}")
    out_meas = json.loads(raw[start : end + 1])
    REPORT.write_text(json.dumps({"mix_peak": peak, "premaster": meas, "master": out_meas}, indent=2), encoding="utf-8")
    print(json.dumps({"master_wav": str(MASTER_WAV), "master_mp3": str(MASTER_MP3), "loudness": out_meas}, indent=2))


if __name__ == "__main__":
    main()
