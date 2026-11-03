"""Compose Koa's app icons from existing approved art only (Phase 9, Step 2; decision D4).

Sources (read only, never modified):
  - art/master/koa_idle_neutral.normalized.png: the approved Koa Master on the house grid
    (made from art/master/koa_idle_neutral.master.png by normalize_export.py). Same pixels
    as the shipped idle frame.
  - public/favicon.svg: the existing leaf mark, used for the notification badge.
  - src/styles/tokens.css: the cream background color (--cream-100, also theme-color).

No redrawing and no new artwork: the app icons are a crop of the Master composited on cream,
and the badge is the favicon's leaf path rasterized as a white silhouette.

Outputs (public/icons/):
  apple-touch-icon-180.png   opaque RGB, square corners (iOS rounds them)
  icon-192.png, icon-512.png purpose "any": head-and-shoulders crop
  icon-maskable-512.png      purpose "maskable": head, ears and tuft inside the central 80%
                             safe circle; only the hoodie continues past it, to the bottom edge
  badge-96.png               white leaf on transparent (Android notification badge)

Every output is read back and checked (sizes, touch icon opacity, maskable safe zone, badge
monochrome); a failed check raises and exits non-zero.

Usage:  python -I scripts/art/make_icons.py
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "art" / "master" / "koa_idle_neutral.normalized.png"
FAVICON = ROOT / "public" / "favicon.svg"
TOKENS = ROOT / "src" / "styles" / "tokens.css"
OUT = ROOT / "public" / "icons"

# Head-and-shoulders crop of the house-grid frame (1024x1536, axis x = 512): a square of
# CROP_SIDE source px from CROP_TOP down. The tuft keeps a small margin at the top, the cut
# falls across the hoodie above the feet, and the outer ear rims run slightly off the sides
# (Koa's ear span, ~800 px, is about his whole sitting height, so a head-and-shoulders crop
# that kept both ears whole would be mostly empty cream).
AXIS_X = 512
CROP_SIDE = 700
CROP_TOP = 530

# Maskable: everything above CHIN_Y (head, ears, tuft) must fit inside the safe circle.
CHIN_Y = 950          # source row just below the chin; below it is the hoodie
SAFE_FRACTION = 0.40  # safe zone = circle of radius 40% of the icon (W3C maskable spec)
SAFE_MARGIN = 0.012   # keep the head a little inside the circle (fraction of the icon)

ALPHA_SOLID = 128     # a pixel counts as artwork from this alpha up
SUPERSAMPLE = 8       # badge rasterization


def cream_from_tokens() -> tuple[int, int, int]:
    match = re.search(r"--cream-100:\s*#([0-9a-fA-F]{6})", TOKENS.read_text(encoding="utf-8"))
    assert match, "--cream-100 not found in tokens.css"
    h = match.group(1)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_master() -> Image.Image:
    img = Image.open(MASTER).convert("RGBA")
    assert img.size == (1024, 1536), f"master is not on the house grid: {img.size}"
    return img


def on_cream(layer: Image.Image, cream) -> Image.Image:
    bg = Image.new("RGBA", layer.size, cream + (255,))
    bg.alpha_composite(layer)
    return bg.convert("RGB")


def square_crop(master: Image.Image, side: int, top: int, size: int, cream) -> Image.Image:
    """A square source crop, resized to `size`, on cream. Pixels outside the frame are cream."""
    x0 = round(AXIS_X - side / 2)
    layer = master.crop((x0, top, x0 + side, top + side)).resize((size, size), Image.LANCZOS)
    return on_cream(layer, cream)


def maskable_fit(master: Image.Image, size: int):
    """Scale and source center that put all head pixels inside the safe circle."""
    alpha = np.array(master)[..., 3]
    ys, xs = np.nonzero(alpha[:CHIN_Y] >= ALPHA_SOLID)
    best = None
    for cy in range(int(ys.min()), CHIN_Y):  # center on the axis, search the height
        r = np.sqrt((xs - AXIS_X) ** 2 + (ys - cy) ** 2).max()
        if best is None or r < best[1]:
            best = (cy, r)
    cy, r = best
    scale = (SAFE_FRACTION - SAFE_MARGIN) * size / r
    return scale, cy


def maskable(master: Image.Image, size: int, cream) -> Image.Image:
    scale, cy = maskable_fit(master, size)
    side = size / scale
    x0, y0 = AXIS_X - side / 2, cy - side / 2
    layer = master.transform(
        (size, size), Image.AFFINE, (1 / scale, 0, x0, 0, 1 / scale, y0), resample=Image.BICUBIC)
    # The transform samples outside the frame as transparent, which becomes cream.
    return on_cream(layer, cream)


# --- leaf badge (from favicon.svg) -------------------------------------------------------

def parse_path(d: str):
    """Absolute/relative M, C, c and Z only (what the favicon uses). Returns a point list."""
    tokens = re.findall(r"[MmCcZz]|-?\d*\.?\d+", d)
    pts, i, cmd = [], 0, None
    cur = (0.0, 0.0)
    while i < len(tokens):
        t = tokens[i]
        if t in "MmCcZz":
            cmd = t
            i += 1
            if cmd in "Zz":
                continue
        if cmd in "Mm":
            x, y = float(tokens[i]), float(tokens[i + 1])
            cur = (cur[0] + x, cur[1] + y) if cmd == "m" else (x, y)
            pts.append(cur)
            i += 2
            cmd = "l" if cmd == "m" else "L"  # (not used by the favicon)
        elif cmd in "Cc":
            nums = [float(v) for v in tokens[i:i + 6]]
            i += 6
            if cmd == "c":
                nums = [nums[k] + cur[k % 2] for k in range(6)]
            p0, p1, p2, p3 = cur, (nums[0], nums[1]), (nums[2], nums[3]), (nums[4], nums[5])
            for s in range(1, 33):
                u = s / 32
                pts.append(tuple(
                    (1 - u) ** 3 * p0[k] + 3 * (1 - u) ** 2 * u * p1[k]
                    + 3 * (1 - u) * u ** 2 * p2[k] + u ** 3 * p3[k] for k in range(2)))
            cur = p3
        else:
            raise ValueError(f"unsupported path command {cmd!r}")
    return pts


def leaf_badge(size: int) -> Image.Image:
    svg = FAVICON.read_text(encoding="utf-8")
    paths = re.findall(r'<path d="([^"]+)"([^>]*)/>', svg)
    assert len(paths) == 2, "favicon.svg no longer has the leaf body and vein paths"
    body = parse_path(paths[0][0])
    vein = parse_path(paths[1][0])
    stroke = float(re.search(r'stroke-width="([\d.]+)"', paths[1][1]).group(1))

    # Fit the leaf (body + stem) into 84% of the badge, centered.
    xs = [p[0] for p in body] + [p[0] + o for p in vein for o in (-stroke / 2, stroke / 2)]
    ys = [p[1] for p in body] + [p[1] + o for p in vein for o in (-stroke / 2, stroke / 2)]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = 0.84 * size / max(w, h) * SUPERSAMPLE
    ox = (size * SUPERSAMPLE - w * k) / 2 - min(xs) * k
    oy = (size * SUPERSAMPLE - h * k) / 2 - min(ys) * k

    def tr(pts):
        return [(x * k + ox, y * k + oy) for x, y in pts]

    big = size * SUPERSAMPLE
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    d.polygon(tr(body), fill=255)
    # The favicon's darker vein is a stem running along the leaf's inner edge (mostly outside
    # the body). In one color it joins the silhouette, round caps included, like the favicon.
    vw = stroke * k
    v = tr(vein)
    d.line(v, fill=255, width=round(vw), joint="curve")
    for x, y in v:
        d.ellipse([x - vw / 2, y - vw / 2, x + vw / 2, y + vw / 2], fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)

    badge = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    badge.putalpha(mask)
    return badge


# --- checks --------------------------------------------------------------------------------

def check_size(path: Path, size: int):
    with Image.open(path) as img:
        assert img.size == (size, size), f"{path.name}: {img.size}, expected {size}x{size}"


def check_opaque(path: Path):
    with Image.open(path) as img:
        assert img.mode == "RGB", f"{path.name}: mode {img.mode}, must be opaque RGB (no alpha)"
        assert "transparency" not in img.info, f"{path.name}: has a transparency key"


def check_maskable(path: Path, master: Image.Image, cream):
    """Head, ears and tuft inside the safe circle; only the hoodie passes it, to the bottom edge."""
    with Image.open(path) as img:
        assert img.mode == "RGB", f"{path.name}: must be opaque"
        size = img.size[0]
    scale, cy = maskable_fit(master, size)
    # Artwork pixels, mapped from the master (the PNG itself is opaque cream + Koa).
    alpha = np.array(master)[..., 3] >= ALPHA_SOLID
    sy, sx = np.nonzero(alpha)
    x = (sx - AXIS_X) * scale + size / 2
    y = (sy - cy) * scale + size / 2
    inside = (x >= 0) & (x < size) & (y >= 0) & (y < size)
    x, y, src_row = x[inside], y[inside], sy[inside]
    dist = np.hypot(x - size / 2, y - size / 2)
    r_safe = SAFE_FRACTION * size
    head = src_row < CHIN_Y
    assert dist[head].max() <= r_safe, (
        f"{path.name}: head reaches {dist[head].max():.1f} px, safe radius {r_safe:.1f}")
    head_box = (x[head].min(), y[head].min(), x[head].max(), y[head].max())
    outside = dist > r_safe
    if outside.any():
        assert not (head & outside).any()
        assert y[outside].min() > size / 2, f"{path.name}: artwork leaves the safe zone above center"
        assert y.max() >= size - 1, f"{path.name}: the hoodie must continue to the bottom edge"
    return head_box, dist[head].max(), r_safe


def check_badge(path: Path):
    with Image.open(path) as img:
        assert img.mode == "RGBA", f"{path.name}: must have alpha"
        a = np.array(img)
    alpha, rgb = a[..., 3], a[..., :3]
    assert (rgb[alpha > 0] == 255).all(), f"{path.name}: must be monochrome white"
    assert alpha[0, 0] == 0 and (alpha == 0).mean() > 0.4, f"{path.name}: must be mostly transparent"
    assert (alpha == 255).sum() > 0.10 * alpha.size, f"{path.name}: leaf too small or too faint"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cream = cream_from_tokens()
    master = load_master()

    outputs = {
        "apple-touch-icon-180.png": square_crop(master, CROP_SIDE, CROP_TOP, 180, cream),
        "icon-192.png": square_crop(master, CROP_SIDE, CROP_TOP, 192, cream),
        "icon-512.png": square_crop(master, CROP_SIDE, CROP_TOP, 512, cream),
        "icon-maskable-512.png": maskable(master, 512, cream),
        "badge-96.png": leaf_badge(96),
    }
    for name, img in outputs.items():
        img.save(OUT / name, "PNG", optimize=True)

    sizes = {"apple-touch-icon-180.png": 180, "icon-192.png": 192, "icon-512.png": 512,
             "icon-maskable-512.png": 512, "badge-96.png": 96}
    for name, size in sizes.items():
        check_size(OUT / name, size)
    for name in ("apple-touch-icon-180.png", "icon-192.png", "icon-512.png"):
        check_opaque(OUT / name)
    head_box, head_r, r_safe = check_maskable(OUT / "icon-maskable-512.png", master, cream)
    check_badge(OUT / "badge-96.png")

    print(f"cream #{''.join(f'{c:02x}' for c in cream)}")
    for name in sizes:
        print(f"  public/icons/{name}  {sizes[name]}px  {(OUT / name).stat().st_size / 1000:.1f} kB")
    print(f"  maskable: head within {head_r:.1f} px of center (safe radius {r_safe:.1f}), "
          f"head box {tuple(round(v) for v in head_box)}")
    print("all icon checks passed")


if __name__ == "__main__":
    main()
