#!/bin/bash
# syntax-check the script inside island.html
cd "$(dirname "$0")/.."
python3 - <<'PY'
s=open('island.html',encoding='utf-8').read()
i=s.index('<script>')+8; j=s.rindex('</script>')
open('/tmp/island-all.js','w',encoding='utf-8').write(s[i:j])
PY
node --check /tmp/island-all.js && echo "SYNTAX OK" && wc -c island.html
