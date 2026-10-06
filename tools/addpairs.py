#!/usr/bin/env python3
"""Add or update [hebrew, english] pairs in the game's I18N_PAIRS table (inside island.html)."""
import json,sys
pairs_new=json.load(open(sys.argv[1],encoding='utf-8'))
import os; p=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','island.html'); s=open(p,encoding='utf-8').read()
i=s.index('const I18N_PAIRS=')+len('const I18N_PAIRS='); j=s.index('];\n',i)+1
pairs=json.loads(s[i:j]); have={h:k for k,(h,_) in enumerate(pairs)}; added=0
for h,e in pairs_new:
    if h in have: pairs[have[h]][1]=e
    else: pairs.append([h,e]); added+=1
s=s[:i]+json.dumps(pairs,ensure_ascii=False,separators=(',\n',':'))+s[j:]
open(p,'w',encoding='utf-8').write(s); print('added',added,'total',len(pairs))
