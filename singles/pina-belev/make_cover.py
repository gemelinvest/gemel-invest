#!/usr/bin/env python3
"""Warm, quiet cover for the single — a corner of light in a dark room."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from bidi.algorithm import get_display

OUT = Path(__file__).resolve().parent / "art" / "cover.jpg"
HEB = "/usr/share/fonts/truetype/noto/NotoSerifHebrew-Regular.ttf"
HEB_B = "/usr/share/fonts/truetype/noto/NotoSerifHebrew-Bold.ttf"
SANS = "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf"
LATIN = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"


def hebrew(text: str) -> str:
    return get_display(text)


def main() -> None:
    size = 1600
    rng = np.random.default_rng(21)
    y = np.linspace(0, 1, size)[:, None]
    x = np.linspace(0, 1, size)[None, :]

    # Night room: readable brown, with a warm lamp in the lower-right corner.
    r = 42 + 36 * y + 110 * np.exp(-((x - 0.78) ** 2 + (y - 0.70) ** 2) / 0.10)
    g = 28 + 24 * y + 62 * np.exp(-((x - 0.78) ** 2 + (y - 0.70) ** 2) / 0.10)
    b = 20 + 14 * y + 22 * np.exp(-((x - 0.78) ** 2 + (y - 0.70) ** 2) / 0.14)
    rgb = np.stack([r, g, b], axis=-1)
    rgb += rng.normal(0, 2.4, rgb.shape)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    img = Image.fromarray(rgb, "RGB")

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    # A small empty chair / corner mark — just a quiet rectangle of light.
    d.rounded_rectangle((1080, 1040, 1420, 1420), radius=18, fill=(232, 186, 122, 48))
    d.ellipse((1180, 980, 1380, 1160), fill=(255, 210, 140, 36))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

    draw = ImageDraw.Draw(img)
    title_f = ImageFont.truetype(HEB_B, 168)
    sub_f = ImageFont.truetype(SANS, 42)
    artist_f = ImageFont.truetype(LATIN, 48)
    small_f = ImageFont.truetype(SANS, 30)

    def shadow_text(xy, text, font, fill, shadow=(0, 0, 0, 160)):
        x0, y0 = xy
        for dx, dy in ((2, 3), (0, 2)):
            draw.text((x0 + dx, y0 + dy), text, font=font, fill=(0, 0, 0))
        draw.text(xy, text, font=font, fill=fill)

    title = hebrew("פינה בלב")
    bbox = draw.textbbox((0, 0), title, font=title_f)
    tw = bbox[2] - bbox[0]
    shadow_text(((size - tw) // 2, 210), title, title_f, (245, 232, 214))

    single = hebrew("סינגל")
    bbox = draw.textbbox((0, 0), single, font=sub_f)
    sw = bbox[2] - bbox[0]
    draw.text(((size - sw) // 2, 420), single, font=sub_f, fill=(214, 176, 128))

    artist = "oriasomech"
    bbox = draw.textbbox((0, 0), artist, font=artist_f)
    aw = bbox[2] - bbox[0]
    draw.text(((size - aw) // 2, 1380), artist, font=artist_f, fill=(210, 190, 168))

    note = hebrew("הפקה כנה")
    bbox = draw.textbbox((0, 0), note, font=small_f)
    nw = bbox[2] - bbox[0]
    draw.text(((size - nw) // 2, 1488), note, font=small_f, fill=(168, 140, 112))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "JPEG", quality=92, optimize=True)
    print(OUT, img.size)


if __name__ == "__main__":
    main()
