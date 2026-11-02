"""Create the idle blink frame from the approved Koa Master by editing ONLY the eye regions.

Every pixel outside the two eye ellipses is copied unchanged from the Master, so the
blink frame aligns pixel-perfectly with it.

Method per eye:
  1. Fill the eye ellipse with forehead fur using Poisson (gradient-domain) blending, so the
     fill keeps the fur texture but takes its color and lighting from the eye's surroundings.
  2. Draw a closed-eye line: a gently downward-curving arc, thicker in the middle and
     tapered at the ends, matching the closed-eye style of the reference sheet (Sleepy / Drink).

Usage:  python -I scripts/art/make_blink.py <master.png> <out.png>
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Measured on koa_master_v02 (source pixel coordinates).
EYES = [(383.5, 841.5), (646.5, 841.5)]  # eye centers
EYE_RX, EYE_RY = 33, 40                  # eye half-size (incl. dark rim)
FILL_RX, FILL_RY = EYE_RX + 7, EYE_RY + 7  # fill area, slightly larger than the eye
SOURCE_CENTER = (512, 690)               # plain forehead fur between the brows
LINE_COLOR = (43, 36, 34)                # same dark charcoal as the mouth line
LINE_HALF_WIDTH = 30                     # half the length of the closed-eye line
LINE_SAG = 9                             # how far the middle of the arc dips
LINE_THICK = 6.0                         # thickness at the middle of the line
LINE_Y_OFFSET = 6                        # eyelids close slightly below the eye's center


def ellipse_mask(h, w, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def poisson_fill(target, source, mask, iterations=3000):
    """Solve Δf = Δsource inside mask, with f = target on the boundary (per channel)."""
    f = target.copy()
    lap_src = (
        4 * source
        - np.roll(source, 1, 0) - np.roll(source, -1, 0)
        - np.roll(source, 1, 1) - np.roll(source, -1, 1)
    )
    f[mask] = source[mask]
    for _ in range(iterations):
        nb = np.roll(f, 1, 0) + np.roll(f, -1, 0) + np.roll(f, 1, 1) + np.roll(f, -1, 1)
        f_new = (nb + lap_src) / 4.0
        f[mask] = f_new[mask]
    return f


def closed_eye_layer(size, cx, cy, scale=4):
    """Anti-aliased tapered arc on a transparent layer (supersampled)."""
    w, h = size
    layer = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 120
    for i in range(steps + 1):
        t = i / steps * 2 - 1                      # -1 .. 1 along the line
        x = cx + t * LINE_HALF_WIDTH
        y = cy + LINE_Y_OFFSET + LINE_SAG * (1 - t * t)  # downward-curving arc
        r = (LINE_THICK / 2) * (0.35 + 0.65 * (1 - t ** 4))  # taper toward the ends
        d.ellipse(
            [(x - r) * scale, (y - r) * scale, (x + r) * scale, (y + r) * scale],
            fill=LINE_COLOR + (255,),
        )
    layer = layer.resize((w, h), Image.LANCZOS)
    return layer.filter(ImageFilter.GaussianBlur(0.5))


def main(src, out):
    master = Image.open(src).convert("RGBA")
    a = np.array(master).astype(np.float64)
    rgb = a[..., :3]
    H, W = rgb.shape[:2]
    result = rgb.copy()

    sx, sy = SOURCE_CENTER
    pad = 6
    for cx, cy in EYES:
        x0, x1 = int(cx - FILL_RX - pad), int(cx + FILL_RX + pad) + 1
        y0, y1 = int(cy - FILL_RY - pad), int(cy + FILL_RY + pad) + 1
        tgt = result[y0:y1, x0:x1].copy()
        hh, ww = tgt.shape[:2]
        sx0, sy0 = int(sx - ww / 2), int(sy - hh / 2)
        srcp = rgb[sy0:sy0 + hh, sx0:sx0 + ww].copy()
        m = ellipse_mask(hh, ww, cx - x0, cy - y0, FILL_RX, FILL_RY)
        filled = np.stack([poisson_fill(tgt[..., c], srcp[..., c], m) for c in range(3)], -1)
        result[y0:y1, x0:x1] = np.clip(filled, 0, 255)

    out_arr = a.copy()
    out_arr[..., :3] = result
    img = Image.fromarray(out_arr.astype(np.uint8), "RGBA")
    for cx, cy in EYES:
        img.alpha_composite(closed_eye_layer((W, H), cx, cy))

    # Safety: the edit must not touch any pixel outside the eye fill ellipses.
    changed = np.any(np.array(img) != np.array(master), axis=-1)
    allowed = np.zeros((H, W), bool)
    for cx, cy in EYES:
        allowed |= ellipse_mask(H, W, cx, cy, FILL_RX + 2, FILL_RY + 2)
    assert not (changed & ~allowed).any(), "blink edit leaked outside the eye regions"

    img.save(out)
    print(f"blink written: {out}  changed px: {int(changed.sum())}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
