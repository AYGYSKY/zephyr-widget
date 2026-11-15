import base64
import io
import json
import os
from PIL import Image

SRC = r"D:\创作\防风\表情包"
PKG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(PKG, "assets")
os.makedirs(ASSETS, exist_ok=True)

PICKS = [
    ("calm", "47-盯着你.png"),
    ("happy", "17-开心.png"),
    ("wow", "12-大脑过载.png"),
    ("greet", "27-招呼.png"),
    ("love", "33-比心.png"),
    ("cry", "19-恰喽.png"),
    ("smug", "18-得意.png"),
    ("sleepy", "35-沉默.png"),
    ("ask", "45-疑惑.png"),
    ("sweat", "24-担心.png"),
    ("tea", "16-干杯.png"),
    ("ok", "29-收到.png"),
]

CANVAS = 256
PAD = 10

out = {}
report = []
for key, name in PICKS:
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    scale = min((CANVAS - PAD * 2) / im.width, (CANVAS - PAD * 2) / im.height)
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    im = im.resize(size, Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CANVAS - size[0]) // 2, CANVAS - PAD - size[1]))

    path = os.path.join(ASSETS, key + ".webp")
    canvas.save(path, "WEBP", quality=86, method=6, alpha_quality=100)
    raw = open(path, "rb").read()
    out[key] = base64.b64encode(raw).decode("ascii")
    report.append((key, name, canvas.size, len(raw)))

with open(os.path.join(ASSETS, "assets.json"), "w", encoding="utf-8") as handle:
    json.dump(out, handle)

for key, name, size, n in report:
    print(f"{key:8s} {name[-10:]:12s} {size} {n/1024:6.1f} KB")
print("total", sum(n for *_, n in report) / 1024, "KB")
