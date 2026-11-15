"""审计要发出去的 tgz：确认里面没有本机路径、账号、密钥等隐私内容。

用法：python tools/audit.py [dist/xxx.tgz]
"""
import json
import os
import re
import sys
import tarfile

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEXT_EXT = ('.js', '.mjs', '.json', '.yml', '.yaml', '.md', '.txt', '.html', '.css')

# data:image/...;base64,.... 里是图片，先挖掉再扫，否则 base64 会制造大量假阳性。
DATA_URI = re.compile(r'data:image/[a-z]+;base64,[A-Za-z0-9+/=]+')

PATTERNS = [
    ('Windows 绝对路径', re.compile(r'(?<![\w/])[A-Za-z]:[\\/][^\s"\'`<>|]{2,80}')),
    ('用户目录名', re.compile(r'(?:Users|home)[\\/]([A-Za-z][\w.-]{1,30})')),
    ('邮箱', re.compile(r'[\w.+-]{2,}@[\w-]{2,}\.[\w.]{2,}')),
    ('手机号', re.compile(r'(?<!\d)1[3-9]\d{9}(?!\d)')),
    ('API key', re.compile(r'\b(?:sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,})')),
    ('可疑赋值', re.compile(r'(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*["\'][^"\']{3,}')),
    ('内网/本机地址', re.compile(r'\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b')),
]

# 这些是本机 DSH 自己的固定位置，插件必须用到，不算泄露；命中时单独降级说明。
ALLOWED_PATH_HINTS = ('Users/China', 'China/.dsh')


def scan_text(name, text):
    hits = []
    for label, rx in PATTERNS:
        for m in rx.finditer(text):
            snippet = m.group(0)
            start = max(0, m.start() - 40)
            context = text[start:m.end() + 40].replace('\n', ' ')
            hits.append((label, snippet, context))
    return hits


def main():
    tgz = sys.argv[1] if len(sys.argv) > 1 else None
    if not tgz:
        dist = 'dist'
        cands = sorted(
            (os.path.join(dist, f) for f in os.listdir(dist) if f.endswith('.tgz')),
            key=os.path.getmtime,
        )
        tgz = cands[-1] if cands else None
    if not tgz or not os.path.exists(tgz):
        sys.exit('没有找到 tgz')

    print(f'审计：{tgz}  ({round(os.path.getsize(tgz) / 1024, 1)} KB)\n')

    with tarfile.open(tgz) as tf:
        members = tf.getmembers()
        print(f'一共 {len(members)} 个文件：')
        for m in members:
            print(f'  {m.name:<34} {m.size:>8} B')
        print()

        for m in members:
            if not m.isfile():
                continue
            data = tf.extractfile(m).read()
            base = os.path.basename(m.name)

            if base.endswith(TEXT_EXT):
                text = data.decode('utf-8', 'replace')
                stripped = DATA_URI.sub('data:image/...', text)
                hits = scan_text(m.name, stripped)
                kept = []
                for label, snippet, ctx in hits:
                    if any(h in snippet for h in ALLOWED_PATH_HINTS):
                        continue
                    kept.append((label, snippet, ctx))
                if kept:
                    print(f'[!] {m.name} 有 {len(kept)} 处需要人工确认：')
                    for label, snippet, ctx in kept[:12]:
                        print(f'    - {label}: {snippet}')
                        print(f'      …{ctx}…')
                else:
                    print(f'[ok] {m.name}：没有命中隐私模式')

                if base == 'client.js':
                    inline = DATA_URI.findall(text)
                    print(f'     内联 data URI：{len(inline)} 个（图片）')
                    kinds = {u.split(';')[0] for u in inline}
                    print(f'     类型：{", ".join(sorted(kinds)) or "无"}')

            elif base.endswith('.png'):
                try:
                    from PIL import Image
                    info = {k: str(v)[:60] for k, v in Image.open(__import__('io').BytesIO(data)).info.items()}
                    print(f'[?] {m.name} 元数据：{info or "无"}')
                except Exception as exc:  # noqa: BLE001
                    print(f'[?] {m.name} 元数据读取失败：{exc}')

    print('\n完成。')


if __name__ == '__main__':
    main()
