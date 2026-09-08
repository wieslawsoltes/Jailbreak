"""Materialize checksum-verified source batches as ordinary reviewable commits.

Transport only: never imported by compilers or applications. Delta batches also
verify each original source file so concurrent edits cannot be overwritten.
"""
import base64
import gzip
import hashlib
import io
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
state_path = root / '.delivery/applied.json'
state = json.loads(state_path.read_text()) if state_path.exists() else {}
MAX_BYTES = 10_000_000


def safe_path(name):
    path = pathlib.PurePosixPath(name)
    if not name or path.is_absolute() or '..' in path.parts or '.git' in path.parts or '\\' in name:
        raise ValueError('Unsafe source path: ' + name)
    dest = root.joinpath(*path.parts)
    if not dest.resolve().is_relative_to(root) or dest.is_symlink():
        raise ValueError('Source path leaves the repository: ' + name)
    return dest


for bundle_path in sorted((root / '.delivery').glob('stage-*.json')):
    bundle = json.loads(bundle_path.read_text())
    digest = bundle['sha256']
    if state.get(bundle_path.name) == digest:
        continue
    if 'chunks' in bundle:
        parts = []
        for name in bundle['chunks']:
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*\.b64', name):
                raise ValueError('Invalid payload chunk name')
            parts.append(safe_path('.delivery/' + name).read_text())
        payload = ''.join(parts)
    else:
        payload = bundle['payload']
    if len(payload) > MAX_BYTES * 2:
        raise ValueError('Compressed source batch exceeds size limit')
    compressed = base64.b64decode(payload, validate=True)
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('Source delivery checksum/size validation failed')
    decoded = json.loads(data)
    if decoded.get('format') == 'source-delta-v1':
        files, patches = dict(decoded['files']), decoded['patches']
    else:
        files, patches = decoded, {}
    # Preflight the entire stage before changing any file.
    for name, patch in patches.items():
        if name in files:
            raise ValueError('A source path cannot be both replaced and patched')
        original = safe_path(name).read_bytes()
        if hashlib.sha256(original).hexdigest() != patch['sha256']:
            raise ValueError('Concurrent source change detected: ' + name)
        text = original.decode('utf-8')
        previous_end = 0
        for start, end, replacement in patch['edits']:
            if type(start) is not int or type(end) is not int or not isinstance(replacement, str):
                raise ValueError('Invalid source edit')
            if start < previous_end or end < start or end > len(text):
                raise ValueError('Overlapping or out-of-range source edit')
            previous_end = end
        for start, end, replacement in reversed(patch['edits']):
            text = text[:start] + replacement + text[end:]
        files[name] = text
    destinations = {}
    for name, content in files.items():
        if not isinstance(content, str):
            raise ValueError('Source contents must be UTF-8 text')
        destinations[name] = safe_path(name)
    for name, content in files.items():
        dest = destinations[name]
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content.encode('utf-8'))
    state[bundle_path.name] = digest
    state_path.write_text(json.dumps(state, indent=2) + '\n')
    subprocess.run(['git', 'add', '--all'], cwd=root, check=True)
    subprocess.run(['git', 'commit', '-m', bundle['message']], cwd=root, check=True)
