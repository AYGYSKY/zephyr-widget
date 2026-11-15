"""挂件单独的一图流：preview/overview.png（1600x1000）。"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(HERE)
OUT = os.path.join(HERE, 'preview')
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(HERE, 'package.json'), encoding='utf-8') as fh:
    VERSION = json.load(fh)['version']

REG = 'C:/Windows/Fonts/msyh.ttc'
BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F = lambda s, b=False: ImageFont.truetype(BOLD if b else REG, s)

W, H = 1600, 1160
BG = (12, 17, 23)
TEXT = (232, 241, 244)
DIM = (145, 165, 175)
FAINT = (92, 110, 121)
CYAN = (127, 216, 201)
ACCENT = (0, 158, 157)

img = Image.new('RGBA', (W, H), BG + (255,))
d = ImageDraw.Draw(img, 'RGBA')

g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(g).ellipse([-340, -620, 1180, 640], fill=(0, 46, 50, 80))
img.alpha_composite(g.filter(ImageFilter.GaussianBlur(120)))


def badge(x, y, text):
    tw = d.textlength(text, font=F(13))
    d.rounded_rectangle([x, y, x + tw + 24, y + 26], 12, fill=ACCENT + (40,), outline=ACCENT + (130,), width=1)
    d.text((x + 12, y + 13), text, font=F(13), fill=CYAN, anchor='lm')
    return x + tw + 24


d.text((70, 46), '防风 Zephyr · 挂件', font=F(44, True), fill=TEXT)
d.text((72, 110), '贴在 DSH 右下角的一张 Q 版贴纸：会换表情、会说话、还盯着你的余额', font=F(18), fill=DIM)
bx = badge(70, 152, 'dsh-zephyr-widget ' + VERSION)
badge(bx + 10, 152, '12 张表情 · 全部本地')

# ---------------- 左：挂件 mock ----------------
d.text((70, 212), '① 外观', font=F(20, True), fill=CYAN)
cz, cx, cy = 240, 270, 450
st = Image.open('assets/greet.webp').convert('RGBA').resize((cz, cz), Image.LANCZOS)
img.alpha_composite(st, (cx - cz // 2, cy - cz // 2))

d.rounded_rectangle([cx - cz // 2 - 58, cy - 40, cx - cz // 2 - 24, cy + 40], 10,
                    fill=(18, 30, 42, 235), outline=(127, 216, 201, 70), width=1)
for i, ch in enumerate('招呼'):
    d.text((cx - cz // 2 - 41, cy - 18 + i * 28), ch, font=F(16, True), fill=CYAN, anchor='mm')

d.rounded_rectangle([cx - 98, cy - cz // 2 - 58, cx + 98, cy - cz // 2 - 20], 12,
                    fill=(20, 34, 48, 245), outline=(127, 216, 201, 100), width=1)
d.text((cx, cy - cz // 2 - 39), '关注防风Zephyr', font=F(14), fill=(232, 248, 244), anchor='mm')

d.rounded_rectangle([cx - 86, cy + cz // 2 + 14, cx + 86, cy + cz // 2 + 60], 10,
                    fill=(18, 30, 42, 240), outline=(127, 216, 201, 60), width=1)
d.text((cx, cy + cz // 2 + 28), '~¥2.71', font=F(14, True), fill=(205, 238, 231), anchor='mm')
d.text((cx - 15, cy + cz // 2 + 47), '峰', font=F(12, True), fill=(255, 188, 116), anchor='mm')
d.text((cx + 22, cy + cz // 2 + 47), '01:24', font=F(12, True), fill=(255, 188, 116), anchor='mm')

gx, gy = cx + cz // 2 - 13, cy - cz // 2 + 13
d.ellipse([gx - 11, gy - 11, gx + 11, gy + 11], fill=(18, 30, 42, 240), outline=(205, 238, 231, 90), width=1)
for dy in (-4, 0, 4):
    d.ellipse([gx - 1.6, gy + dy - 1.6, gx + 1.6, gy + dy + 1.6], fill=(205, 238, 231, 255))

for i, line in enumerate(['点击换表情 · 拖动改位置 · 双击打盹', '右上角三点打开设置']):
    d.text((cx, cy + cz // 2 + 92 + i * 22), line, font=F(12.5), fill=FAINT, anchor='mm')

# ---------------- 右：功能 ----------------
d.text((720, 212), '② 功能', font=F(20, True), fill=CYAN)

items = [
    ('12 张表情', '开心 / 吃惊 / 招呼 / 比心 / 恰喽 / 得意 / 无语 / 疑惑 / 紧张 / 干杯 / 收到 / 盯着你'),
    ('会话联动', '干活中 → 紧张，等你确认 → 疑惑，完成 → 收到；手动选过的表情 8 秒内优先'),
    ('等待提示', '角色背后一圈黄色呼吸光环 + 左上角「!」气泡，光环可在菜单里关掉'),
    ('点击光环', '圆环（SVG 描边，0.7s 向外扩）或星芒（内 16 根顺时针 + 外 16 根逆时针）'),
    ('四种颜色', '黄 / 青绿 / 粉 / 白，也可以整个关掉'),
    ('花费与峰谷', '今日花费（余额估算）+ 当前峰谷 + 下次切换倒计时；峰=工作日 9–12、14–18'),
    ('可拉伸菜单', '大小 88–220px、间隔 8–90s、点击音效、常用台词、重置，高度会记住'),
]
lx = 720
for i, (title, desc) in enumerate(items):
    y = 246 + i * 84
    d.ellipse([lx, y + 2, lx + 22, y + 24], fill=(0, 158, 157, 36), outline=ACCENT + (140,), width=1)
    d.text((lx + 11, y + 13), str(i + 1), font=F(12, True), fill=CYAN, anchor='mm')
    d.text((lx + 34, y - 3), title, font=F(18, True), fill=TEXT)
    # 描述自动换行
    line, ty = '', y + 26
    for ch in desc:
        if d.textlength(line + ch, font=F(12.5)) > 760:
            d.text((lx + 34, ty), line, font=F(12.5), fill=DIM)
            ty += 21
            line = ch
        else:
            line += ch
    if line:
        d.text((lx + 34, ty), line, font=F(12.5), fill=DIM)

# ---------------- 底部 ----------------
cards = [
    ('12 张表情', '256px webp 全部内联进 client.js'),
    ('235 KB', '打包后体积，发一个 tgz 就能装'),
    ('0 联网', 'localStorage + 回环路由，不外发'),
]
cw, gap = 460, 26
for i, (title, desc) in enumerate(cards):
    x = 70 + i * (cw + gap)
    d.rounded_rectangle([x, 800, x + cw, 888], 14, fill=(18, 27, 37), outline=(255, 255, 255, 16), width=1)
    d.rounded_rectangle([x + 22, 816, x + 58, 819], 1, fill=ACCENT + (200,))
    d.text((x + 22, 830), title, font=F(17, True), fill=TEXT)
    d.text((x + 22, 860), desc, font=F(13), fill=DIM)

# ---------------- 版本改进 ----------------
d.text((70, 928), '本版改进', font=F(20, True), fill=CYAN)
d.text((216, 936), 'v' + VERSION + ' 相比上一版', font=F(13), fill=FAINT)
changes = [
    ('光环触发', '定时自动换表情现在也带一圈光环，不只手动点击才有'),
    ('版本号', '0.3.36'),
]
for i, (tag, note) in enumerate(changes):
    y = 976 + i * 40
    d.text((70, y), tag, font=F(13.5, True), fill=CYAN)
    d.text((164, y), note, font=F(13.5), fill=DIM)

d.text((W // 2, H - 22), '原创角色「防风 / Zephyr」· 代表色 #009E9D',
       font=F(12), fill=(58, 72, 82), anchor='mm')

img.convert('RGB').save(os.path.join(OUT, 'overview.png'))
img.convert('RGB').save(os.path.join(OUT, 'overview.pdf'), 'PDF', resolution=150)
print('wrote preview/overview.png + .pdf', img.size)
