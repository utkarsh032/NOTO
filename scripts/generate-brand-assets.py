#!/usr/bin/env python3
"""Regenerate every platform icon in the repository from the two brand sources.

The sources in `assets/brand/` are the only files a designer ever hands over.
Everything else — favicons, the Windows/macOS/Linux application icons, the Expo
icons and the small copies the sidebar imports — is derived here so the whole
set stays in step when the brand changes.

Requires Pillow (`pip install pillow`); it is not a workspace dependency
because this runs by hand on the rare occasion the artwork changes, not as part
of `turbo build`. Outputs are committed.

    python scripts/generate-brand-assets.py
"""

from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"

# The artwork is drawn with a soft outer glow whose alpha never quite reaches
# zero. Cropping on a threshold rather than on `getbbox()` finds the rounded
# square itself instead of the halo around it.
SOLID_ALPHA = 16

# Fills whatever transparency survives an overscale, for the targets that
# forbid an alpha channel (App Store validation rejects one). Sampled from the
# midpoint of the artwork's own gradient so the seam is invisible.
OPAQUE_BACKDROP = (63, 81, 235, 255)

# Enough to push the artwork's rounded corners past the canvas edge, so an icon
# that may not carry transparency reads as full-bleed rather than as a square
# with four coloured triangles in it.
BLEED = 1.22


def load(name: str) -> Image.Image:
    return Image.open(BRAND / name).convert("RGBA")


def trim(image: Image.Image) -> Image.Image:
    """Crop away the transparent margin and the glow just inside it."""
    mask = image.split()[3].point(lambda value: 255 if value > SOLID_ALPHA else 0)
    return image.crop(mask.getbbox() or image.getbbox())


def squared(image: Image.Image) -> Image.Image:
    """Centre the artwork on a transparent square canvas."""
    side = max(image.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas


def scaled(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.LANCZOS)


def bled(icon: Image.Image, size: int) -> Image.Image:
    """Overscale and centre-crop, then flatten — for alpha-free targets."""
    grown = scaled(icon, round(size * BLEED))
    offset = (grown.width - size) // 2
    cropped = grown.crop((offset, offset, offset + size, offset + size))

    backdrop = Image.new("RGBA", (size, size), OPAQUE_BACKDROP)
    backdrop.alpha_composite(cropped)
    return backdrop.convert("RGB")


def inset(icon: Image.Image, size: int, fraction: float) -> Image.Image:
    """Centre the artwork inside a larger transparent canvas.

    Android masks an adaptive icon down to a shape it chooses, guaranteeing
    only the inner 66% of the foreground survives on every launcher.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    art = scaled(icon, round(size * fraction))
    canvas.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return canvas


def by_height(image: Image.Image, height: int) -> Image.Image:
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.LANCZOS)


def icns(icon: Image.Image, path: Path) -> None:
    """Write a PNG-payload .icns.

    `iconutil` only exists on macOS, and the release runs on whichever runner
    picked up the job, so the container is assembled here instead. Every type
    below accepts a PNG payload, which is what modern macOS reads.
    """
    types = {
        b"ic11": 32,  # 16pt @2x
        b"ic12": 64,  # 32pt @2x
        b"ic07": 128,
        b"ic13": 256,  # 128pt @2x
        b"ic08": 256,
        b"ic14": 512,  # 256pt @2x
        b"ic09": 512,
        b"ic10": 1024,  # 512pt @2x
    }

    blocks = b""
    for code, size in types.items():
        payload = png_bytes(scaled(icon, size))
        blocks += code + struct.pack(">I", len(payload) + 8) + payload

    path.write_bytes(b"icns" + struct.pack(">I", len(blocks) + 8) + blocks)


def png_bytes(image: Image.Image) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def write(image: Image.Image, path: Path, **kwargs: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True, **kwargs)
    print(f"  {path.relative_to(ROOT).as_posix()}  {image.size[0]}x{image.size[1]}")


def main() -> None:
    icon = squared(trim(load("noto-icon.png")))
    wordmark = trim(load("noto-wordmark.png"))

    # The application is installable, so it carries the manifest sizes too. The
    # marketing site is not; its 512 exists only to be the Open Graph preview.
    print("apps/web")
    public = ROOT / "apps" / "web" / "public"
    write(scaled(icon, 256), public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    write(bled(icon, 180), public / "apple-touch-icon.png")
    write(scaled(icon, 192), public / "icon-192.png")
    write(scaled(icon, 512), public / "icon-512.png")

    print("apps/website")
    public = ROOT / "apps" / "website" / "public"
    write(scaled(icon, 256), public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    write(bled(icon, 180), public / "apple-touch-icon.png")
    write(bled(icon, 512), public / "social-card.png")

    print("apps/desktop")
    desktop = ROOT / "apps" / "desktop" / "assets"
    write(
        scaled(icon, 256),
        desktop / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    write(scaled(icon, 512), desktop / "icon.png")
    icns(icon, desktop / "icon.icns")
    print("  apps/desktop/assets/icon.icns  up to 1024x1024")

    print("apps/mobile")
    mobile = ROOT / "apps" / "mobile" / "assets"
    write(bled(icon, 1024), mobile / "icon.png")
    write(inset(icon, 1024, 0.66), mobile / "adaptive-icon.png")

    print("packages/ui")
    ui = ROOT / "packages" / "ui" / "src" / "assets"
    write(scaled(icon, 128), ui / "noto-icon.png")
    write(by_height(wordmark, 128), ui / "noto-wordmark.png")


if __name__ == "__main__":
    main()
