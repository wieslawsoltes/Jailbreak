"""Apply SHA-256-verified source bundles from an offline development environment.

Every payload becomes ordinary, reviewable repository files and a separate commit.
This is transport tooling, not part of the compilers or application runtime.
"""
import base64
import gzip
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
state_path = root / '.delivery/applied.json'
state = json.loads(state_path.read_text()) if state_path.exists() else {}
for bundle_path in sorted((root / '.delivery').glob('stage-*.json')):
    bundle = json.loads(bundle_path.read_text())
    digest = bundle['sha256']
    if state.get(bundle_path.name) == digest:
        continue
    compressed = base64.b64decode(bundle['payload'], validate=True)
    data = gzip.decompress(compressed)
    if len(data) > 10000000 or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('Source delivery checksum/size validation failed')
    files = json.loads(data)
    for name, content in files.items():
        path = pathlib.PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '.git' in path.parts or '\\' in name:
            raise ValueError('Unsafe source path: ' + name)
        dest = root.joinpath(*path.parts)
        if not dest.resolve().is_relative_to(root) or dest.is_symlink():
            raise ValueError('Source path leaves the repository')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding='utf-8')
    state[bundle_path.name] = digest
    state_path.write_text(json.dumps(state, indent=2) + '\n')
    subprocess.run(['git', 'add', '--all'], cwd=root, check=True)
    subprocess.run(['git', 'commit', '-m', bundle['message']], cwd=root, check=True)
