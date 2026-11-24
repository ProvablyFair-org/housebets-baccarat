#!/usr/bin/env python3
"""Builds evidence/ for the HouseBets baccarat package from the HouseBets workshop (run once by the auditor; the outputs
are pinned in src/loader.ts and listed in MANIFEST.md#evidence). Sources (outside this package):
  W = the HouseBets capture workshop folder, not shipped (capture rigs, bundles, 13 Oct full capture + ledger)
Every exhibit records its source path and the sha256 of the source bytes it was cut from."""
import hashlib, json, os, re, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
W = os.path.abspath(os.path.join(PKG, '..', '..', 'housebets-new-deal-2026-10-09'))
EV = os.path.join(PKG, 'evidence'); os.makedirs(EV, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
def dump(name, obj):
    open(os.path.join(EV, name), 'w', encoding='utf-8').write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n'); print('wrote', name)

prim_path = os.path.join(PKG, 'data', 'housebets-baccarat-6500rounds.json')
prim_raw = open(prim_path, 'rb').read(); prim = json.loads(prim_raw)
pf = prim['meta']['preflight']
src_note = {'file': 'data/housebets-baccarat-6500rounds.json', 'sha256': sha(prim_raw), 'field': None}

# E01 the server's published baccarat spec, as answered to the capture (GET /housegames/baccarat/fairness, 12 Oct 17:07Z)
dump('E01-baccarat-fairness-spec-2026-10-12.json', {'exhibit': 'E01', 'what': "HouseBets House Baccarat: the server's published fairness spec (GET /housegames/baccarat/fairness)",
     'source': dict(src_note, field='meta.preflight.fairnessSpec'), 'readAt': pf['at'], 'answer': pf['fairnessSpec']})

# E02 the rules panel text (English), as shipped in the baccarat game bundle. That the live page loads this bundle is
# INFERRED (bundles/LIVE-BUNDLES.md, 10 Oct 2026: "baccarat, road | ...-baccarat/-road-game.js (no "2" file exists) | inferred"),
# not observed; the capture meta's bundleSha256 is a constant typed into the capture script, not a reading from the page
bp = os.path.join(W, 'bundles', 'platform-housegames-baccarat-game.js'); braw = open(bp, 'rb').read(); bt = braw.decode('utf-8', 'replace')
i = bt.find('rulesPaysFine:"Every spot'); assert i > 0, 'bundle text moved'
blk = bt[max(0, i - 6000): i + 3000]
strings = {}
for key in re.findall(r'(rules[A-Za-z0-9]*):"', blk):
    m = re.search(key + r':"((?:[^"\\]|\\.)*)"', blk)
    if m and key not in strings: strings[key] = m.group(1)
dump('E02-baccarat-rules-panel-2026-10-10.json', {'exhibit': 'E02', 'what': 'HouseBets baccarat: the rules panel text (English), as shipped in the baccarat game bundle; that the live baccarat page loads this bundle is inferred, not observed',
     'source': {'file': 'bundles/platform-housegames-baccarat-game.js (HouseBets workshop)', 'sha256': sha(braw), 'bytes': len(braw), 'loadedByLivePage': 'inferred, not observed (bundles/LIVE-BUNDLES.md, 10 Oct 2026: no "2" file exists for baccarat); the capture meta bundleSha256 is a constant in the capture script, not a reading from the page'},
     'rulesPanelEnglish': strings})

# E03 the limits answer (min bet, max bet, max win, wallet decimals)
dump('E03-baccarat-limits-2026-10-12.json', {'exhibit': 'E03', 'what': 'HouseBets baccarat limits (GET /housegames/limits/baccarat)',
     'source': dict(src_note, field='meta.preflight.limits'), 'readAt': pf['at'], 'answer': pf['limits']})

# E04 the platform bet history rows of every round in this package's datasets
lp = os.path.join(W, 'capture-full-2026-10-12', 'ledger', 'ledger-2026-10-13-final.json'); lraw = open(lp, 'rb').read(); L = json.loads(lraw)
led = {x['id']: x for x in L['items']}
files = ['housebets-baccarat-6500rounds.json', 'supplementary/housebets-baccarat-phaseC-300rounds.json',
         'supplementary/housebets-baccarat-phaseC-10usd-300rounds.json', 'supplementary/housebets-baccarat-phaseD-200rounds.json']
rows, missing = [], []
for f in files:
    for r in json.load(open(os.path.join(PKG, 'data', f)))['rounds']:
        x = led.get(r['roundId'])
        if x is None: missing.append(r['roundId']); continue
        rows.append({k: x[k] for k in ('id', 'game', 'placed_at', 'stake', 'payout', 'currency', 'status')})
assert not missing, f'{len(missing)} rounds not in the ledger'
dump('E04-baccarat-bet-history-2026-10-13.json', {'exhibit': 'E04', 'what': 'HouseBets bet history (GET /api/v1/transactions/bets?category=casino) rows of every baccarat round in this package; fields id = roundId, stake, payout, status',
     'source': {'file': 'capture-full-2026-10-12/ledger/ledger-2026-10-13-final.json (HouseBets workshop)', 'sha256': sha(lraw), 'readAt': L['readAt'], 'entries': len(L['items'])},
     'rows': sorted(rows, key=lambda r: r['placed_at'])})

# E05 the whole-account reconciliation (every captured round of all 11 games against the history and the wallet)
# the exhibit is the FULL output of the reconciliation run, not the workshop's saved 8-line tail
import subprocess
_rc = subprocess.run(['python3', '-I', 'reconcile-full.py', '--ledger', 'ledger/ledger-2026-10-13-final.json', '--before', '986.84718000'],
                     cwd=os.path.join(W, 'capture-full-2026-10-12'), capture_output=True, text=True)
assert _rc.returncode == 0 and _rc.stdout.rstrip().endswith('RECONCILED') and not _rc.stderr, (_rc.returncode, _rc.stderr[-300:])
open(os.path.join(EV, 'E05-account-reconcile-2026-10-13.txt'), 'w', encoding='utf-8').write(_rc.stdout); print('wrote E05 (full reconcile-full.py output, ' + str(len(_rc.stdout.splitlines())) + ' lines)')

# E06 the empty-client-seed control of Phase D (POST /housegames/change_seed with clientSeed "")
dp = os.path.join(PKG, 'data', 'supplementary', 'housebets-baccarat-phaseD-200rounds.json'); draw = open(dp, 'rb').read()
dump('E06-baccarat-empty-seed-control-2026-10-13.json', {'exhibit': 'E06', 'what': "Phase D empty-seed control: the server's answer to POST /housegames/change_seed {gameType: baccarat, clientSeed: \"\"}",
     'source': {'file': 'data/supplementary/housebets-baccarat-phaseD-200rounds.json', 'sha256': sha(draw), 'field': 'meta.emptySeedControl'}, 'record': json.loads(draw)['meta']['emptySeedControl']})

# E07 the seed-reveal check of 12 Oct (GET /housegames/unhash?hs=<hash>: the active hash, its next hash, a rotated-away hash),
# with the hashes queried and the server's answers (the measured /unhash evidence, shipped)
up = os.path.join(W, 'capture-2026-10-12', 'seed-reveal', 'unhash-check-2026-10-12.json'); uraw = open(up, 'rb').read(); U = json.loads(uraw)
dump('E07-seed-reveal-check-2026-10-12.json', {'exhibit': 'E07', 'what': "GET /housegames/unhash?hs=<hash> on 12 Oct 2026 for the baccarat seed pair: the active pair's hash, its pre-committed next hash, and a hash already rotated away",
     'source': {'file': 'capture-2026-10-12/seed-reveal/unhash-check-2026-10-12.json (HouseBets workshop)', 'sha256': sha(uraw)}, 'at': U['at'], 'note': U['note'],
     'baccarat': [x for x in U['results'] if x.get('g') == 'baccarat'],
     'answers': {k: v for k, v in U['answers'].items() if k.split(':')[0] == 'baccarat'}})
