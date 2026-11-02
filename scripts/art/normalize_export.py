"""Normalize Koa character masters to the house grid and export WebP files for the app.

House grid (docs/character-bible.md §3):
  canvas 1024 x 1536, head width 500 px, vertical axis x = 512, ground line y = 1400.

All frames of a pose share ONE transform, computed from that pose's master frame,
so variants (e.g. blink) stay pixel-aligned with it.

Usage:  python -I scripts/art/normalize_export.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art" / "master"
OUT = ROOT / "public" / "characters"

CANVAS = (1024, 1536)
HEAD_WIDTH_TARGET = 500
AXIS_X = 512
GROUND_Y = 1400
EXPORT_WIDTHS = (1024, 512)
WEBP = dict(quality=88, alpha_quality=95, method=6)

# pose -> master frame, measured head width in source pixels, frames to export
POSES = {
    "idle": {
        "master": "koa_idle_neutral.master.png",
        "head_width_px": 583,  # measured on koa_master_v02 (cheek fur edge to edge, ears excluded)
        "frames": {
            "koa_idle_neutral": "koa_idle_neutral.master.png",
            "koa_idle_blink": "koa_idle_blink.master.png",
        },
    },
}


def clean_alpha(img: Image.Image) -> Image.Image:
    """Drop near-invisible stray pixels and make near-opaque pixels fully opaque."""
    a = np.array(img.convert("RGBA"))
    al = a[..., 3]
    a[..., 3] = np.where(al <= 8, 0, np.where(al >= 250, 255, al))
    return Image.fromarray(a, "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for pose, cfg in POSES.items():
        master = clean_alpha(Image.open(ART / cfg["master"]))
        bbox = master.getbbox()
        scale = HEAD_WIDTH_TARGET / cfg["head_width_px"]
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        size = (round(bw * scale), round(bh * scale))
        offset = (AXIS_X - size[0] // 2, GROUND_Y - size[1])
        print(f"[{pose}] bbox={bbox} scale={scale:.4f} -> {size} at {offset}")

        for name, file in cfg["frames"].items():
            frame = clean_alpha(Image.open(ART / file))
            body = frame.crop(bbox).resize(size, Image.LANCZOS)
            canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            canvas.alpha_composite(body, offset)
            canvas = clean_alpha(canvas)
            canvas.save(ART / f"{name}.normalized.png")

            for w in EXPORT_WIDTHS:
                img = canvas if w == CANVAS[0] else canvas.resize(
                    (w, round(CANVAS[1] * w / CANVAS[0])), Image.LANCZOS)
                suffix = "" if w == CANVAS[0] else f"-{w}"
                path = OUT / f"{name}{suffix}.webp"
                img.save(path, "WEBP", **WEBP)
                print(f"  {path.relative_to(ROOT)}  {img.size}  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
