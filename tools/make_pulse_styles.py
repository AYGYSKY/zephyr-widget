"""生成点击光环样式的对比图 preview/pulse-styles.png（圆环 / 光晕 / 星芒）。"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(HERE)
OUT = os.path.join(HERE, 'preview')
os.makedirs(OUT, exist_ok=True)

F = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 13)
FB = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 16)
W, H = 620, 420
S = 150
COLOR = (127, 216, 201)


def sticker(img, cx, cy):
    st = Image.open('assets/calm.webp').convert('RGBA').resize((S, S), Image.LANCZOS)
    img.alpha_composite(st, (cx - S // 2, cy - S // 2))


def ring(img, cx, cy, scale, alpha, width=2):
    rr = int(S / 2 * scale) + 8
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                                  outline=COLOR + (alpha,), width=width)
    img.alpha_composite(layer)


def glow(img, cx, cy):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - 112, cy - 112, cx + 112, cy + 112], fill=COLOR + (165,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(24)))


def spark(img, cx, cy):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    # 内层：顺时针偏转，粗一点
    for k in range(16):
        ang = math.radians(k * 22.5 + 15)
        r0, r1 = S * 0.52, S * 0.70
        ld.line([cx + math.cos(ang) * r0, cy + math.sin(ang) * r0,
                 cx + math.cos(ang) * r1, cy + math.sin(ang) * r1],
                fill=COLOR + (240,), width=2)
    # 外层：逆时针偏转，细一点、更淡
    for k in range(24):
        ang = math.radians(k * 15 - 12)
        r0, r1 = S * 0.74, S * 0.92
        ld.line([cx + math.cos(ang) * r0, cy + math.sin(ang) * r0,
                 cx + math.cos(ang) * r1, cy + math.sin(ang) * r1],
                fill=COLOR + (165,), width=1)
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.5)))


STYLES = [
    ('ring', '圆环', 'SVG 描边，向外扩一圈'),
    ('spark', '星芒', '内外两层，反向旋转'),
]


def main():
    img = Image.new('RGBA', (W, H), (16, 21, 28, 255))
    d = ImageDraw.Draw(img, 'RGBA')
    d.text((40, 26), '点击光环：两种样式', font=FB, fill=(232, 241, 244, 255))
    d.text((40, 52), '同一颜色（青绿 #7fd8c9），只换表现方式', font=F, fill=(143, 163, 173, 255))

    for i, (sid, name, desc) in enumerate(STYLES):
        cx, cy = 160 + i * 300, 190
        if sid == 'ring':
            ring(img, cx, cy, 1.12, 190)
        else:
            spark(img, cx, cy)
        sticker(img, cx, cy)
        d.text((cx, cy + S // 2 + 48), name, font=FB, fill=COLOR + (255,), anchor='mm')
        d.text((cx, cy + S // 2 + 70), desc, font=F, fill=(130, 148, 158, 255), anchor='mm')

    d.text((W - 40, H - 20), 'dsh-zephyr-widget 0.3.27', font=F, fill=(80, 96, 108, 255), anchor='rm')
    img.convert('RGB').save(os.path.join(OUT, 'pulse-styles.png'))
    print('wrote preview/pulse-styles.png')


if __name__ == '__main__':
    main()
