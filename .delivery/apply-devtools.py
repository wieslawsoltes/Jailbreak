"""Apply reviewed UTF-8 development-tool stages as granular source commits.

No compressed payloads and no evaluated patch code. Every changed original and
result is checksum verified; all stages are preflighted before the first write.
"""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE = ROOT / '.delivery/applied-development.json'
state = json.loads(STATE.read_text()) if STATE.exists() else {}
allowed = {'README.md', 'apps', 'packages', 'tests', 'examples', 'docs'}
copy_sources = {'.delivery/development.test.js', '.delivery/test_development.py'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_path(name):
    path = pathlib.PurePosixPath(name)
    if not name or path.is_absolute() or '..' in path.parts or '.git' in path.parts or '\\' in name:
        raise ValueError('Unsafe source path: ' + name)
    if path.parts[0] not in allowed:
        raise ValueError('Unapproved source directory: ' + name)
    target = ROOT.joinpath(*path.parts)
    if not target.resolve().is_relative_to(ROOT) or target.is_symlink():
        raise ValueError('Source path escapes the repository')
    return target


pending = []
touched = set()
for number in range(1, 6):
    file = ROOT / f'.delivery/devtools-{number}.json'
    raw = file.read_bytes()
    if len(raw) > 1_000_000:
        raise ValueError('Stage size limit exceeded')
    digest = sha(raw)
    if state.get(file.name) == digest:
        continue
    stage = json.loads(raw)
    if stage.get('format') != 'development-delta-v1':
        raise ValueError('Unsupported development source stage')
    files = dict(stage.get('files', {}))
    for name, copy in stage.get('copies', {}).items():
        if copy['source'] not in copy_sources or name in files:
            raise ValueError('Unapproved or duplicate staged copy')
        src = ROOT / copy['source']
        if src.is_symlink():
            raise ValueError('Copy source is a symlink')
        data = src.read_bytes()
        if sha(data) != copy['sha256']:
            raise ValueError('Staged test checksum mismatch: ' + name)
        files[name] = data.decode('utf-8')
    for name, text in files.items():
        target = source_path(name)
        if not isinstance(text, str) or len(text) > 1_000_000:
            raise ValueError('Invalid source content')
        if target.exists() and target.read_bytes() != text.encode('utf-8'):
            raise ValueError('Existing source would be overwritten: ' + name)
    for name, patch in stage.get('patches', {}).items():
        if name in files:
            raise ValueError('Source is both patched and replaced')
        original = source_path(name).read_bytes()
        if sha(original) != patch['sha256']:
            raise ValueError('Concurrent original-source change: ' + name)
        text = original.decode('utf-8')
        last = 0
        for start, end, replacement in patch['edits']:
            if type(start) is not int or type(end) is not int or not isinstance(replacement, str):
                raise ValueError('Invalid source edit')
            if start < last or end < start or end > len(text):
                raise ValueError('Overlapping or out-of-range edit')
            last = end
        for start, end, replacement in reversed(patch['edits']):
            text = text[:start] + replacement + text[end:]
        if sha(text.encode('utf-8')) != patch['resultSha256']:
            raise ValueError('Source result checksum mismatch: ' + name)
        files[name] = text
    if touched.intersection(files):
        raise ValueError('Multiple pending stages edit the same path')
    touched.update(files)
    pending.append((file.name, digest, stage['message'], files))

for name, digest, message, files in pending:
    for path, text in files.items():
        target = source_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text.encode('utf-8'))
    state[name] = digest
    STATE.write_text(json.dumps(state, indent=2) + '\n')
    subprocess.run(['git', 'add', '--', *files, '.delivery/applied-development.json'], cwd=ROOT, check=True)
    subprocess.run(['git', 'commit', '-m', message], cwd=ROOT, check=True)
print('Development source stages applied:', len(pending))
