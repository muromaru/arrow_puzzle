"""src/ の ES モジュールを1つの HTML にまとめる（Three.js は cdnjs の r128 を使用）。
iPhone だけで確認するための単一ファイル版。PWA（manifest / Service Worker）は含まない。
使い方: python3 tools/build-single.py 出力.html"""
import re, sys, base64, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
order = ['arrow', 'puzzle', 'stages', 'save', 'camera', 'input', 'renderer', 'ui', 'game', 'main']
parts = []
for n in order:
    s = (root / 'src' / (n + '.js')).read_text(encoding='utf-8')
    s = re.sub(r'^import .*\n?', '', s, flags=re.M)
    s = re.sub(r'^export ', '', s, flags=re.M)
    parts.append('// ---- ' + n + '.js ----\n' + s)
code = '\n'.join(parts)

guard = ("if (typeof THREE === 'undefined') {"
         "document.getElementById('count').textContent = ' Three.jsを読み込めませんでした'; return; }\n")
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'src' / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="/src/style.css" />', '<style>\n' + css + '</style>')
html = re.sub(r'.*rel="manifest".*\n', '', html)
html = re.sub(r'.*src="/src/pwa.js".*\n', '', html)
icon = base64.b64encode((root / 'public' / 'icons' / 'apple-touch-icon.png').read_bytes()).decode()
html = html.replace('href="/icons/apple-touch-icon.png"', 'href="data:image/png;base64,' + icon + '"')
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
html = html.replace('<script type="module" src="/src/main.js"></script>',
                    cdn + '<script>\n(function () {\n' + guard + code + '\n})();\n</script>')
pathlib.Path(sys.argv[1]).write_text(html, encoding='utf-8')
