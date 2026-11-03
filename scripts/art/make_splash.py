"""Compose Koa's iOS startup images from existing approved art only (Phase 9, Step 5; decision D7).

Sources (read only, never modified):
  - art/master/koa_idle_neutral.normalized.png: the approved Koa Master on the house grid
    (made from art/master/koa_idle_neutral.master.png by normalize_export.py). Same pixels
    as the shipped idle frame.
  - src/styles/tokens.css: the cream background color (--cream-100, also theme-color and the
    manifest's background_color).

No redrawing and no new artwork: each image is the idle frame, scaled down, centered on cream.
No text, no shadow, no dark variant (Koa has no dark theme).

Composition: Koa's visible artwork (ear tip to ear tip, tuft to feet) is SPLASH_FRACTION of the
screen's short side wide, centered both ways. Using the short side keeps Koa the same physical
size in portrait and landscape on an iPad.

Outputs: public/splash/koa-splash-<w>x<h>.jpg, one per row of DEVICES (iPhone portrait; iPad
portrait and landscape). JPEG, quality 92 without chroma subsampling: 3-4x smaller than
lossless PNG (an iPad PNG is 0.6-0.9 MB) and visually identical (PSNR ~48 dB against the
lossless composition, asserted below; the cream stays within 1/255). iOS accepts JPEG and PNG. index.html needs one
<link rel="apple-touch-startup-image"> per image; `--links` prints them.

Every output is read back and checked (size, baseline JPEG, background color at the edges,
fidelity against the lossless composition, Koa centered at the planned width), and every image must have exactly one matching <link> in
index.html with the right media query; a failed check raises and exits non-zero.

Usage:  python -I scripts/art/make_splash.py           generate + check
        python -I scripts/art/make_splash.py --links   print the <link> tags for index.html
        python -I scripts/art/make_splash.py --check   check the existing files only
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "art" / "master" / "koa_idle_neutral.normalized.png"
TOKENS = ROOT / "src" / "styles" / "tokens.css"
INDEX = ROOT / "index.html"
OUT = ROOT / "public" / "splash"
URL_DIR = "/splash"

SPLASH_FRACTION = 0.40  # Koa's artwork width, as a fraction of the screen's short side
ALPHA_SOLID = 128       # a pixel counts as artwork from this alpha up (for measuring)
JPEG = dict(quality=92, subsampling=0, optimize=True, progressive=False)
MIN_PSNR = 44.0         # dB against the lossless composition ("visually identical")
EDGE_TOLERANCE = 2      # max per-channel difference from cream at the image edges

# (devices, CSS device-width, CSS device-height (portrait), device pixel ratio, kind)
# iOS reports device-width/height in portrait in both orientations; (orientation) tells them
# apart. iPhones get portrait only (Koa's phone layout is portrait); iPads get both.
DEVICES = [
    ("iPhone 16 Pro Max, 17 Pro Max", 440, 956, 3, "iphone"),
    ("iPhone Air", 420, 912, 3, "iphone"),
    ("iPhone 16 Pro, 17, 17 Pro", 402, 874, 3, "iphone"),
    ("iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus", 430, 932, 3, "iphone"),
    ("iPhone 14 Pro, 15, 15 Pro, 16", 393, 852, 3, "iphone"),
    ("iPhone 12 Pro Max, 13 Pro Max, 14 Plus", 428, 926, 3, "iphone"),
    ("iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e", 390, 844, 3, "iphone"),
    ("iPhone X, XS, 11 Pro, 12 mini, 13 mini", 375, 812, 3, "iphone"),
    ("iPhone XS Max, 11 Pro Max", 414, 896, 3, "iphone"),
    ("iPhone XR, 11", 414, 896, 2, "iphone"),
    ("iPhone 8 Plus", 414, 736, 3, "iphone"),
    ("iPhone SE (2nd, 3rd gen), 8", 375, 667, 2, "iphone"),
    ("iPad Pro 13-inch (M4, M5)", 1032, 1376, 2, "ipad"),
    ("iPad Pro 12.9-inch, iPad Air 13-inch", 1024, 1366, 2, "ipad"),
    ("iPad Pro 11-inch (M4, M5)", 834, 1210, 2, "ipad"),
    ("iPad Pro 11-inch (1st-4th gen)", 834, 1194, 2, "ipad"),
    ("iPad Air 10.5-inch, iPad Pro 10.5-inch", 834, 1112, 2, "ipad"),
    ("iPad Air (4th gen+), iPad Air 11-inch, iPad (10th gen+)", 820, 1180, 2, "ipad"),
    ("iPad 10.2-inch (7th-9th gen)", 810, 1080, 2, "ipad"),
    ("iPad mini (6th gen+)", 744, 1133, 2, "ipad"),
    ("iPad mini (5th gen), iPad 9.7-inch", 768, 1024, 2, "ipad"),
]


def images():
    """Every startup image: (devices, css w, css h, dpr, orientation, pixel w, pixel h, file name)."""
    out = []
    for devices, cw, ch, dpr, kind in DEVICES:
        orientations = ("portrait",) if kind == "iphone" else ("portrait", "landscape")
        for o in orientations:
            pw, ph = (cw * dpr, ch * dpr) if o == "portrait" else (ch * dpr, cw * dpr)
            out.append((devices, cw, ch, dpr, o, pw, ph, f"koa-splash-{pw}x{ph}.jpg"))
    names = [i[-1] for i in out]
    assert len(set(names)) == len(names), "two startup images share a pixel size"
    media = [(i[1], i[2], i[3], i[4]) for i in out]
    assert len(set(media)) == len(media), "two startup images share a media query"
    return out


def media_query(cw, ch, dpr, orientation):
    return (f"(device-width: {cw}px) and (device-height: {ch}px) and "
            f"(-webkit-device-pixel-ratio: {dpr}) and (orientation: {orientation})")


def link_tag(img):
    _, cw, ch, dpr, o, _, _, name = img
    return (f'<link rel="apple-touch-startup-image" media="{media_query(cw, ch, dpr, o)}" '
            f'href="{URL_DIR}/{name}" />')


def cream_from_tokens() -> tuple[int, int, int]:
    match = re.search(r"--cream-100:\s*#([0-9a-fA-F]{6})", TOKENS.read_text(encoding="utf-8"))
    assert match, "--cream-100 not found in tokens.css"
    h = match.group(1)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_master():
    img = Image.open(MASTER).convert("RGBA")
    assert img.size == (1024, 1536), f"master is not on the house grid: {img.size}"
    alpha = np.array(img)[..., 3]
    bbox = img.getbbox()  # every non-transparent pixel (soft fur edges included)
    ys, xs = np.nonzero(alpha >= ALPHA_SOLID)
    solid = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return img, bbox, solid


def compose(master, bbox, pw, ph, cream):
    """Koa's bbox scaled to SPLASH_FRACTION of the short side, centered, on cream."""
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    scale = SPLASH_FRACTION * min(pw, ph) / bw
    assert scale <= 1.05, f"{pw}x{ph}: Koa would be upscaled {scale:.2f}x"
    size = (round(bw * scale), round(bh * scale))
    koa = master.crop(bbox).resize(size, Image.LANCZOS)
    canvas = Image.new("RGBA", (pw, ph), cream + (255,))
    canvas.alpha_composite(koa, ((pw - size[0]) // 2, (ph - size[1]) // 2))
    return canvas.convert("RGB"), scale


def check_image(path: Path, pw, ph, cream, master_solid, bbox, reference):
    """Size, baseline RGB JPEG, cream edges, fidelity, and Koa centered at the planned width."""
    with Image.open(path) as img:
        assert img.format == "JPEG" and img.mode == "RGB", f"{path.name}: must be an RGB JPEG"
        assert not img.info.get("progressive"), f"{path.name}: must be baseline JPEG"
        assert img.size == (pw, ph), f"{path.name}: {img.size}, expected {pw}x{ph}"
        a = np.array(img).astype(int)
    edges = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    edge_diff = np.abs(edges - cream).max()
    assert edge_diff <= EDGE_TOLERANCE, f"{path.name}: edges differ from cream by {edge_diff}"
    mse = ((a - np.array(reference).astype(int)) ** 2).mean()
    psnr = 10 * np.log10(255 ** 2 / mse) if mse > 0 else float("inf")
    assert psnr >= MIN_PSNR, f"{path.name}: PSNR {psnr:.1f} dB, minimum {MIN_PSNR}"
    diff = np.abs(a - np.array(cream)).max(axis=2) > 24
    ys, xs = np.nonzero(diff)
    cx, cy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
    # Expected solid-artwork center, mapped through the composition transform.
    scale = SPLASH_FRACTION * min(pw, ph) / (bbox[2] - bbox[0])
    size = (round((bbox[2] - bbox[0]) * scale), round((bbox[3] - bbox[1]) * scale))
    ox, oy = (pw - size[0]) // 2, (ph - size[1]) // 2
    ex = ox + ((master_solid[0] + master_solid[2]) / 2 - bbox[0]) * scale
    ey = oy + ((master_solid[1] + master_solid[3]) / 2 - bbox[1]) * scale
    assert abs(cx - ex) <= 3 and abs(cy - ey) <= 3, (
        f"{path.name}: Koa centered at ({cx:.0f}, {cy:.0f}), expected ({ex:.0f}, {ey:.0f})")
    width_frac = (xs.max() + 1 - xs.min()) / min(pw, ph)
    assert 0.36 <= width_frac <= 0.42, f"{path.name}: Koa is {width_frac:.1%} of the short side"
    return width_frac, psnr


def check_links(all_images):
    """Exactly one <link> per image in index.html, with the right media query, and no others."""
    html = INDEX.read_text(encoding="utf-8")
    tags = re.findall(r'<link\s+rel="apple-touch-startup-image"[^>]*>', html)
    found = {}
    for tag in tags:
        media = re.search(r'media="([^"]+)"', tag)
        href = re.search(r'href="([^"]+)"', tag)
        assert media and href, f"index.html: startup image link without media or href: {tag}"
        assert href.group(1) not in found, f"index.html: {href.group(1)} is linked twice"
        found[href.group(1)] = media.group(1)
    expected = {f"{URL_DIR}/{i[-1]}": media_query(i[1], i[2], i[3], i[4]) for i in all_images}
    missing = sorted(set(expected) - set(found))
    extra = sorted(set(found) - set(expected))
    assert not missing, f"index.html: no startup image link for {missing} (run with --links)"
    assert not extra, f"index.html: startup image links without an image: {extra}"
    for href, media in expected.items():
        assert found[href] == media, f"index.html: {href} has media {found[href]!r}, expected {media!r}"
    return len(tags)


def main(argv):
    all_images = images()
    if "--links" in argv:
        for img in all_images:
            print(link_tag(img))
        return

    cream = cream_from_tokens()
    master, bbox, solid = load_master()
    OUT.mkdir(parents=True, exist_ok=True)

    if "--check" not in argv:
        expected_names = {i[-1] for i in all_images}
        for stale in OUT.iterdir():
            if stale.name not in expected_names:
                stale.unlink()
                print(f"  removed stale {stale.name}")
        for _, _, _, _, _, pw, ph, name in all_images:
            img, _ = compose(master, bbox, pw, ph, cream)
            img.save(OUT / name, "JPEG", **JPEG)

    stray = sorted(p.name for p in OUT.iterdir() if p.name not in {i[-1] for i in all_images})
    assert not stray, f"public/splash/ has files not in the table: {stray}"

    print(f"cream #{''.join(f'{c:02x}' for c in cream)}, Koa = {SPLASH_FRACTION:.0%} of the short side")
    total = 0
    for devices, cw, ch, dpr, o, pw, ph, name in all_images:
        reference, _ = compose(master, bbox, pw, ph, cream)
        frac, psnr = check_image(OUT / name, pw, ph, cream, solid, bbox, reference)
        size = (OUT / name).stat().st_size
        total += size
        print(f"  {name:<28} {o:<9} {cw}x{ch}@{dpr}x  {size / 1000:6.1f} kB  "
              f"Koa {frac:.1%}  {psnr:.1f} dB  {devices}")
    links = check_links(all_images)
    print(f"{len(all_images)} images, {total / 1000:.1f} kB total; {links} matching links in index.html")
    print("all splash checks passed")


if __name__ == "__main__":
    main(sys.argv[1:])
