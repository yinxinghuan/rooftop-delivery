#!/usr/bin/env python3
"""Generate Rooftop Delivery's poster through the Aigram transit image API.

The platform model creates the text-free key art. Pillow then adds exact title
typography so the game name is deterministic and thumbnail-safe.
"""

import json
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


API_URL = "https://chat.aiwaves.tech/aigram/api/gen-image"
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}
ROOT = Path(__file__).resolve().parent
RAW_PATH = ROOT / "_poster_platform_raw.png"
OUT_PATH = ROOT / "public" / "poster.png"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Impact.ttf")

PROMPT = """
Square 1024x1024 premium mobile game cover key art, no text, no letters, no logo,
no watermark, no UI, full-bleed edge to edge. A dramatic stylized 3D low-poly
city canyon at saturated blue-violet sunset. One single oversized coral-red
sealed rectangular cuboid cardboard shipping box with a wide cream packing-tape
stripe rockets toward the viewer through the lower-center foreground, dynamically
tilted, with small paper scraps
and brilliant cyan wind trails sweeping behind it. Far below and to the lower
right, a glowing coral-and-cream bullseye target is painted flat onto a horizontal
rooftop surface, connected to
the parcel by the curved wind trail so the throw-and-land gameplay reads
instantly. Deep forced perspective, many miniature rooftops, warm illuminated
windows, atmospheric haze, golden sunset rim light, cool cyan motion glow,
thrilling height and speed, tactile geometric materials, crisp silhouette,
polished App Store feature art. Reserve a clean dark-sky area across the upper
left 48 percent for later title typography. The parcel must remain entirely below
the top 37 percent and must not cover the reserved title area. That reserved area
must be uninterrupted clean violet sky only: no objects, no dark patches, no
panels, no squares, no badges, no signs, no icons, no symbols. Rich contrast,
playful rather than realistic. Exactly one parcel, no people, no vehicles,
no airplanes, no border, not flat vector art. The parcel is an ordinary sealed
cardboard box: no wings, no fins, no propeller, no tail, no face, no character
features. The target lies flat on the roof: no stand, no legs, no arrow stuck in it.
""".strip()


def generate_url(retries: int = 3) -> str:
    data = json.dumps({"prompt": PROMPT}).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(API_URL, data=data, method="POST", headers=HEADERS)
            with urllib.request.urlopen(request, timeout=360) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"gen-image response had no url: {body}")
            return url
        except Exception as error:
            last_error = error
            if attempt < retries - 1:
                time.sleep((3, 8, 15)[attempt])
    raise last_error or RuntimeError("gen-image failed")


def download_image(url: str) -> Image.Image:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return Image.open(BytesIO(response.read())).convert("RGB")


def crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    edge = min(width, height)
    left = (width - edge) // 2
    top = (height - edge) // 2
    return image.crop((left, top, left + edge, top + edge)).resize((1024, 1024), Image.Resampling.LANCZOS)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 32:
        font = ImageFont.truetype(str(FONT_PATH), size)
        box = draw.textbbox((0, 0), text, font=font, stroke_width=0)
        if box[2] - box[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(str(FONT_PATH), 32)


def add_title(image: Image.Image) -> Image.Image:
    base = image.convert("RGBA")
    # Models occasionally place pseudo-icons in reserved copy space. A deterministic
    # dusk scrim both removes them and guarantees thumbnail-level title contrast.
    icon_patch = Image.new("RGBA", base.size, (23, 25, 68, 255))
    icon_mask = Image.new("L", base.size, 0)
    icon_mask_draw = ImageDraw.Draw(icon_mask)
    icon_mask_draw.rectangle((0, 0, 145, 138), fill=255)
    icon_mask = icon_mask.filter(ImageFilter.GaussianBlur(24))
    base = Image.composite(icon_patch, base, icon_mask)
    scrim = Image.new("RGBA", base.size, (0, 0, 0, 0))
    scrim_pixels = scrim.load()
    for y in range(430):
        for x in range(650):
            horizontal = max(0.0, 1.0 - x / 650)
            vertical = max(0.0, 1.0 - y / 430)
            alpha = int(238 * max(horizontal * 0.86, vertical * 0.72))
            scrim_pixels[x, y] = (22, 24, 63, alpha)
    base = Image.alpha_composite(base, scrim)
    shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    draw = ImageDraw.Draw(base)
    cream = (255, 245, 222, 255)
    title_x = 54
    max_width = 550
    top_font = fit_font(draw, "ROOFTOP", max_width, 132)
    bottom_font = fit_font(draw, "DELIVERY", max_width, 124)
    top_y = 42
    top_box = draw.textbbox((title_x, top_y), "ROOFTOP", font=top_font)
    bottom_y = top_box[3] - 12

    for text, position, font in (
        ("ROOFTOP", (title_x + 7, top_y + 10), top_font),
        ("DELIVERY", (title_x + 7, bottom_y + 10), bottom_font),
    ):
        shadow_draw.text(position, text, font=font, fill=(20, 22, 52, 210))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(5))
    base = Image.alpha_composite(base, shadow_layer)
    draw = ImageDraw.Draw(base)
    draw.text((title_x, top_y), "ROOFTOP", font=top_font, fill=cream)
    draw.text((title_x, bottom_y), "DELIVERY", font=bottom_font, fill=cream)

    return base.convert("RGB")


def main() -> None:
    print("Generating key art through Aigram transit…", flush=True)
    url = generate_url()
    print(f"Platform image: {url}", flush=True)
    raw = crop_square(download_image(url))
    raw.save(RAW_PATH, quality=95)
    final = add_title(raw)
    final.save(OUT_PATH, quality=96)
    print(f"Saved {OUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
