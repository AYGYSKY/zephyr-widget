import json
import os
from PIL import Image, ImageDraw, ImageFont

SRC = r"D:\创作\防风\表情包"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "preview")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

files = sorted(
    f for f in os.listdir(SRC)
    if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp"))
)

cells = []
stats = []
for index, name in enumerate(files, 1):
    path = os.path.join(SRC, name)
    try:
        im = Image.open(path)
        if getattr(im, "is_animated", False):
            im.seek(0)
        im = im.convert("RGBA")
    except Exception as error:  # noqa: BLE001
        stats.append({"index": index, "name": name, "error": str(error)})
        continue

    width, height = im.size
    alpha = im.getchannel("A")
    opaque_ratio = sum(1 for v in alpha.getdata() if v > 32) / (width * height)
    rgb = im.convert("RGB")
    pixels = list(rgb.getdata())
    whiteish = sum(1 for r, g, b in pixels if r > 240 and g > 240 and b > 240) / len(pixels)

    stats.append({
        "index": index,
        "name": name,
        "size": [width, height],
        "mode": Image.open(path).mode,
        "animated": bool(getattr(Image.open(path), "is_animated", False)),
        "opaque_ratio": round(opaque_ratio, 3),
        "white_ratio": round(whiteish, 3),
    })

    cell = Image.new("RGBA", (220, 250), (14, 27, 29, 255))
    thumb = im.copy()
    thumb.thumbnail((200, 200), Image.LANCZOS)
    x = (220 - thumb.width) // 2
    y = 8 + (200 - thumb.height) // 2
    cell.alpha_composite(thumb, (x, y))
    draw = ImageDraw.Draw(cell)
    font = ImageFont.load_default()
    draw.text((8, 222), f"{index:03d} {name[-8:]}", fill=(127, 240, 230, 255), font=font)
    cells.append(cell)

cols = 8
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * 220, rows * 250), (8, 16, 18, 255))
for i, cell in enumerate(cells):
    sheet.alpha_composite(cell, ((i % cols) * 220, (i // cols) * 250))
sheet.convert("RGB").save(os.path.join(OUT, "contact.png"), quality=88)

with open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8") as handle:
    json.dump(stats, handle, ensure_ascii=False, indent=1)

print("cells", len(cells), "sheet", sheet.size)
