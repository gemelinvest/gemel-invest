#!/usr/bin/env python3
"""YouTube 16:9 thumbnail for פינה בלב — title sits in the dark room, not on her face."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
from bidi.algorithm import get_display

ROOT = Path(__file__).resolve().parent
ART = ROOT / "art"
SRC = ART / "youtube-base.jpg"
OUT_HD = ART / "youtube.jpg"
OUT_THUMB = ART / "youtube-1280.jpg"
HEB_B = "/usr/share/fonts/truetype/noto/NotoSerifHebrew-Bold.ttf"
SANS = "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf"
LATIN = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"


def hebrew(text: str) -> str:
    return get_display(text)


def fit(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    src = img.convert("RGB")
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    src = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2)
    top = max(0, (nh - th) // 2)
    return src.crop((left, top, left + tw, top + th))


def draw_title(img: Image.Image) -> Image.Image:
    w, h = img.size
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.06)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    # Soft veil on the right so type reads, her face stays clear.
    for i in range(int(w * 0.42)):
        x = w - i
        alpha = int(150 * (1 - i / (w * 0.42)) ** 1.4)
        d.line([(x, 0), (x, h)], fill=(8, 5, 3, alpha))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    draw = ImageDraw.Draw(img)
    title_f = ImageFont.truetype(HEB_B, max(72, h // 9))
    sub_f = ImageFont.truetype(SANS, max(28, h // 24))
    artist_f = ImageFont.truetype(LATIN, max(26, h // 28))

    def text(xy, s, font, fill):
        x0, y0 = xy
        for dx, dy in ((2, 3), (0, 2)):
            draw.text((x0 + dx, y0 + dy), s, font=font, fill=(0, 0, 0))
        draw.text(xy, s, font=font, fill=fill)

    title = hebrew("פינה בלב")
    single = hebrew("סינגל")
    artist = "oriasomech"
    tb = draw.textbbox((0, 0), title, font=title_f)
    tw = tb[2] - tb[0]
    # Right-side block, RTL page: title near the lamp, clear of her face.
    tx = w - tw - int(w * 0.06)
    ty = int(h * 0.36)
    text((tx, ty), title, title_f, (245, 232, 214))
    sb = draw.textbbox((0, 0), single, font=sub_f)
    sw = sb[2] - sb[0]
    text((w - sw - int(w * 0.06), ty - int(h * 0.08)), single, sub_f, (214, 176, 128))
    ab = draw.textbbox((0, 0), artist, font=artist_f)
    aw = ab[2] - ab[0]
    text((w - aw - int(w * 0.06), ty + (tb[3] - tb[1]) + 18), artist, artist_f, (210, 190, 168))
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC)
    hd = draw_title(fit(src, (1920, 1080)))
    hd.save(OUT_HD, "JPEG", quality=93, optimize=True)
    thumb = hd.resize((1280, 720), Image.Resampling.LANCZOS)
    thumb.save(OUT_THUMB, "JPEG", quality=92, optimize=True)
    print(OUT_HD, hd.size)
    print(OUT_THUMB, thumb.size)


if __name__ == "__main__":
    main()
