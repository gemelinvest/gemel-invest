#!/usr/bin/env python3
"""Build MARSHEN VINCI fashion wordmark + label lockups as outlined SVG and PNG."""

from __future__ import annotations

from pathlib import Path

import cairosvg
from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT_DIR = Path(__file__).resolve().parent
FONT_DIR = Path("/tmp/marshen-fonts")
FONT_FILE = FONT_DIR / "Oswald-Bold.ttf"
FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/oswald@5.2.5/latin-700-normal.ttf"

WORDMARK = "MARSHEN VINCI"
MONOGRAM = "MV"


def load_font(path: Path) -> dict:
    font = TTFont(path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    os2 = font["OS/2"]
    hhea = font["hhea"]
    return {
        "font": font,
        "glyphs": glyph_set,
        "cmap": cmap,
        "upem": font["head"].unitsPerEm,
        "ascender": getattr(os2, "sTypoAscender", None) or hhea.ascender,
        "descender": getattr(os2, "sTypoDescender", None) or hhea.descender,
        "path": path,
    }


def layout_text(face: dict, text: str, tracking_em: float, word_gap_em: float) -> tuple[list[dict], float]:
    glyphs = face["glyphs"]
    cmap = face["cmap"]
    upem = face["upem"]
    tracking = tracking_em * upem
    word_gap = word_gap_em * upem
    x = 0.0
    pieces: list[dict] = []
    for i, ch in enumerate(text):
        if ch == " ":
            x += word_gap
            continue
        name = cmap[ord(ch)]
        glyph = glyphs[name]
        pieces.append({"name": name, "x": x, "char": ch})
        extra = tracking if i < len(text) - 1 and text[i + 1] != " " else 0.0
        x += glyph.width + extra
    return pieces, x


def draw_pieces(
    face: dict, pieces: list[dict], scale: float, baseline_y: float
) -> tuple[list[str], tuple[float, float, float, float]]:
    glyphs = face["glyphs"]
    paths: list[str] = []
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    for piece in pieces:
        glyph = glyphs[piece["name"]]
        transform = Transform(scale, 0, 0, -scale, piece["x"] * scale, baseline_y)
        bounds_pen = BoundsPen(glyphs)
        glyph.draw(TransformPen(bounds_pen, transform))
        if bounds_pen.bounds:
            bx0, by0, bx1, by1 = bounds_pen.bounds
            min_x, min_y = min(min_x, bx0), min(min_y, by0)
            max_x, max_y = max(max_x, bx1), max(max_y, by1)
        svg_pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(svg_pen, transform))
        d = svg_pen.getCommands()
        if d:
            paths.append(d)
    return paths, (min_x, min_y, max_x, max_y)


def svg_doc(width: float, height: float, inner: str, background: str | None = None) -> str:
    bg = ""
    if background:
        bg = f'  <rect width="100%" height="100%" fill="{background}"/>\n'
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.2f} {height:.2f}" '
        f'width="{width:.2f}" height="{height:.2f}" role="img" aria-label="MARSHEN VINCI">\n'
        f"{bg}{inner}</svg>\n"
    )


def paths_group(paths: list[str], fill: str, indent: int = 2) -> str:
    pad = " " * indent
    inner = "\n".join(f"{pad}  <path d=\"{d}\"/>" for d in paths)
    return f"{pad}<g fill=\"{fill}\">\n{inner}\n{pad}</g>\n"


def write_svg_png(
    svg: str,
    svg_path: Path,
    png_path: Path,
    png_width: int,
    png_background: str | None = None,
) -> None:
    svg_path.write_text(svg, encoding="utf-8")
    cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        write_to=str(png_path),
        output_width=png_width,
        background_color=png_background,
    )


def ensure_font() -> Path:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    if not FONT_FILE.exists() or FONT_FILE.stat().st_size < 1000:
        import urllib.request

        urllib.request.urlretrieve(FONT_URL, FONT_FILE)
    return FONT_FILE


def build_wordmark(face: dict, fill: str, background: str | None, pad_ratio: float = 0.22) -> str:
    pieces, _ = layout_text(face, WORDMARK, tracking_em=0.18, word_gap_em=0.62)
    target_cap = 220.0
    scale = target_cap / (face["ascender"] - face["descender"])
    baseline = face["ascender"] * scale
    paths, (x0, y0, x1, y1) = draw_pieces(face, pieces, scale, baseline)
    content_w = x1 - x0
    content_h = y1 - y0
    pad_x = content_w * pad_ratio * 0.28
    pad_y = content_h * pad_ratio
    width = content_w + pad_x * 2
    height = content_h + pad_y * 2
    dx = pad_x - x0
    dy = pad_y - y0
    inner = f'  <g transform="translate({dx:.2f} {dy:.2f})">\n'
    inner += paths_group(paths, fill, indent=4)
    inner += "  </g>\n"
    return svg_doc(width, height, inner, background)


def build_label(face: dict, fill: str, background: str | None) -> str:
    size = 1000.0
    inset = 70.0
    stroke = 8.0

    mv_pieces, _ = layout_text(face, MONOGRAM, tracking_em=0.08, word_gap_em=0)
    mv_scale = 460.0 / (face["ascender"] - face["descender"])
    mv_paths, (mx0, my0, mx1, my1) = draw_pieces(
        face, mv_pieces, mv_scale, face["ascender"] * mv_scale
    )
    mv_w = mx1 - mx0
    mv_h = my1 - my0

    name_pieces, _ = layout_text(face, WORDMARK, tracking_em=0.20, word_gap_em=0.62)
    name_scale = 70.0 / (face["ascender"] - face["descender"])
    name_paths, (nx0, ny0, nx1, ny1) = draw_pieces(
        face, name_pieces, name_scale, face["ascender"] * name_scale
    )
    name_w = nx1 - nx0
    name_h = ny1 - ny0

    gap_mv_line = 78.0
    gap_line_name = 64.0
    line_h = 3.0
    stack_h = mv_h + gap_mv_line + line_h + gap_line_name + name_h
    stack_top = (size - stack_h) / 2 + 8.0

    mv_dx = (size - mv_w) / 2 - mx0
    mv_dy = stack_top - my0
    line_y = stack_top + mv_h + gap_mv_line + line_h / 2
    name_dx = (size - name_w) / 2 - nx0
    name_dy = stack_top + mv_h + gap_mv_line + line_h + gap_line_name - ny0
    line_pad = 190.0

    inner = (
        f'  <rect x="{inset}" y="{inset}" width="{size - inset * 2}" height="{size - inset * 2}" '
        f'fill="none" stroke="{fill}" stroke-width="{stroke}"/>\n'
        f'  <line x1="{line_pad}" y1="{line_y}" x2="{size - line_pad}" y2="{line_y}" '
        f'stroke="{fill}" stroke-width="3"/>\n'
        f'  <g transform="translate({mv_dx:.2f} {mv_dy:.2f})">\n'
        f"{paths_group(mv_paths, fill, indent=4)}"
        f"  </g>\n"
        f'  <g transform="translate({name_dx:.2f} {name_dy:.2f})">\n'
        f"{paths_group(name_paths, fill, indent=4)}"
        f"  </g>\n"
    )
    return svg_doc(size, size, inner, background)


def export_set(face: dict) -> None:
    variants = [
        ("marshen-vinci-wordmark", lambda: build_wordmark(face, "#000000", None), 4000, None),
        ("marshen-vinci-wordmark-white", lambda: build_wordmark(face, "#FFFFFF", None), 4000, None),
        ("marshen-vinci-wordmark-on-white", lambda: build_wordmark(face, "#000000", "#FFFFFF"), 4000, "#FFFFFF"),
        ("marshen-vinci-wordmark-on-black", lambda: build_wordmark(face, "#FFFFFF", "#000000"), 4000, "#000000"),
        ("marshen-vinci-label", lambda: build_label(face, "#000000", None), 2000, None),
        ("marshen-vinci-label-white", lambda: build_label(face, "#FFFFFF", None), 2000, None),
        ("marshen-vinci-label-on-white", lambda: build_label(face, "#000000", "#FFFFFF"), 2000, "#FFFFFF"),
        ("marshen-vinci-label-on-black", lambda: build_label(face, "#FFFFFF", "#000000"), 2000, "#000000"),
    ]
    for name, builder, png_w, png_bg in variants:
        svg = builder()
        write_svg_png(svg, OUT_DIR / f"{name}.svg", OUT_DIR / f"{name}.png", png_w, png_bg)
        print("wrote", name)


def main() -> None:
    face = load_font(ensure_font())
    export_set(face)


if __name__ == "__main__":
    main()
