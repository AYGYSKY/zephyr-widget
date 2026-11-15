import glob
import os
import tarfile

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open('package.json', 'r', encoding='utf-8') as fh:
    version = os.environ.get('ZEPHYR_VERSION') or __import__('json').load(fh)['version']

files = ['package.json', 'index.js', 'client.js', 'cordis.patch.yml', 'icon.png', 'README.md']
files += sorted(glob.glob('locale/*.json'))

os.makedirs('dist', exist_ok=True)
out = 'dist/dsh-zephyr-widget-%s.tgz' % version
with tarfile.open(out, 'w:gz') as tf:
    for name in files:
        tf.add(name, arcname='package/' + name.replace(os.sep, '/'))

print('packed', out, round(os.path.getsize(out) / 1024, 1), 'KB')
with tarfile.open(out) as tf:
    for name in tf.getnames():
        print('  ', name)
