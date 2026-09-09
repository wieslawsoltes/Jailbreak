"""Materialize readable, hash-checked source edits as ordinary Git commits.

Transport only; it is not imported by Jailbreak compilers or browser applications.
All files in all stages are validated before the first write. Source positions
are Unicode code points (the same indexing used by Python's diff generator).
"""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / '.delivery/desktop-20260910.json'
RECEIPT = ROOT / '.delivery/desktop-20260910-applied.json'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def target(name):
    p = pathlib.PurePosixPath(name)
    if (not name or p.is_absolute() or '..' in p.parts or '\\' in name or
            (name != 'README.md' and p.parts[0] not in {'apps','packages','tests','docs','scripts'})):
        raise ValueError('Invalid source path: ' + name)
    result = ROOT.joinpath(*p.parts)
    if result.is_symlink() or not result.resolve().is_relative_to(ROOT):
        raise ValueError('Source path escapes repository: ' + name)
    if p.parts[0] == 'scripts' and name not in {'scripts/build.mjs','scripts/bundle.mjs'}:
        raise ValueError('Unapproved build entry point')
    return result

raw = MANIFEST.read_bytes()
if len(raw) > 2_000_000:
    raise ValueError('Source delivery byte budget exceeded')
digest = sha(raw)
if RECEIPT.exists():
    if json.loads(RECEIPT.read_text()).get('sha256') != digest:
        raise ValueError('Applied source delivery cannot be replaced')
    print('Source delivery already applied')
    raise SystemExit(0)
spec = json.loads(raw)
if spec.get('format') != 'source-edit-parts-v1' or not 1 <= len(spec['parts']) <= 32:
    raise ValueError('Unsupported source delivery')
stages = []
for index, part in enumerate(spec['parts'], 1):
    expected = f'.delivery/desktop-20260910-{index:02}.json'
    if part['path'] != expected or (ROOT / expected).is_symlink():
        raise ValueError('Invalid source part path')
    data = (ROOT / expected).read_bytes()
    if len(data) > 1_000_000 or sha(data) != part['sha256']:
        raise ValueError('Source part checksum mismatch: ' + expected)
    for message, name, change in json.loads(data):
        if not stages or stages[-1]['message'] != message:
            stages.append({'message':message, 'files':{}})
        if name in stages[-1]['files']:
            raise ValueError('Duplicate source file')
        stages[-1]['files'][name] = change
manifest = {'format':'source-edits-v1', 'base':spec['base'], 'stages':stages}
canonical = (json.dumps(manifest, ensure_ascii=False, separators=(',',':')) + '\n').encode('utf-8')
if sha(canonical) != spec['sourceSha256'] or not 1 <= len(stages) <= 8:
    raise ValueError('Reassembled source metadata checksum mismatch')
pending, touched = [], set()
for stage in manifest['stages']:
    if not isinstance(stage['message'], str) or not 1 <= len(stage['message']) <= 200:
        raise ValueError('Invalid source commit message')
    files = {}
    for name, change in stage['files'].items():
        if name in touched or len(touched) >= 200:
            raise ValueError('Duplicate path or source file budget exceeded')
        touched.add(name)
        dest = target(name)
        original = dest.read_bytes() if dest.exists() else None
        if (None if original is None else sha(original)) != change['before']:
            raise ValueError('Concurrent original-source change: ' + name)
        if 'content' in change:
            text = change['content']
        else:
            if original is None:
                raise ValueError('Cannot edit a missing file')
            text = original.decode('utf-8')
            end_prior = 0
            for start, end, replacement in change['edits']:
                if type(start) is not int or type(end) is not int or not isinstance(replacement,str):
                    raise ValueError('Invalid source edit')
                if start < end_prior or end < start or end > len(text):
                    raise ValueError('Overlapping or out-of-range source edit')
                end_prior = end
            for start, end, replacement in reversed(change['edits']):
                text = text[:start] + replacement + text[end:]
        if not isinstance(text,str) or len(text) > 1_000_000 or sha(text.encode('utf-8')) != change['after']:
            raise ValueError('Source result checksum mismatch: ' + name)
        files[name] = text
    pending.append((stage['message'],files))

for message, files in pending:
    for name, text in files.items():
        dest = target(name)
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(text.encode('utf-8'))
    subprocess.run(['git','add','--',*files],cwd=ROOT,check=True)
    subprocess.run(['git','commit','-m',message],cwd=ROOT,check=True)
RECEIPT.write_text(json.dumps({'sha256':digest,'files':len(touched)},indent=2)+'\n')
subprocess.run(['git','add','--',str(RECEIPT.relative_to(ROOT))],cwd=ROOT,check=True)
subprocess.run(['git','commit','-m','build: record verified desktop source materialization'],cwd=ROOT,check=True)
print('Source files applied:',len(touched))
