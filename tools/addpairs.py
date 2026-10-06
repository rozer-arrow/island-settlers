#!/usr/bin/env python3
"""Add or update [hebrew, english] pairs in the game's I18N_PAIRS table
(src/js/translation/i18n-pairs.js), then rebuild island.html.

usage: python3 tools/addpairs.py pairs.json      (a JSON list of [hebrew, english] pairs)"""
import json, os, subprocess, sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
p = os.path.join(root, 'src', 'js', 'translation', 'i18n-pairs.js')
pairs_new = json.load(open(sys.argv[1], encoding='utf-8'))
s = open(p, encoding='utf-8').read()
i = s.index('const I18N_PAIRS=') + len('const I18N_PAIRS=')
j = s.index('];\n', i) + 1
pairs = json.loads(s[i:j])
have = {h: k for k, (h, _) in enumerate(pairs)}
added = 0
for h, e in pairs_new:
    if h in have:
        pairs[have[h]][1] = e
    else:
        pairs.append([h, e])
        added += 1
s = s[:i] + json.dumps(pairs, ensure_ascii=False, separators=(',\n', ':')) + s[j:]
open(p, 'w', encoding='utf-8').write(s)
print('added', added, 'total', len(pairs))
subprocess.check_call(['node', os.path.join(root, 'tools', 'build.js')])
