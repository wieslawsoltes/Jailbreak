"""Materialize the preserved desktop work as ordinary, checksum-verified commits.

The manifest and every part are already in this repository. No downloads, eval,
remote code execution or force push. Unexpected originals stop publication.
"""
import hashlib
import itertools
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = '.delivery/desktop-20260910.json'
RECEIPT = '.delivery/applied-desktop.json'
# Reviewed partial standalone implementations on main, before composition was wired.
REPLACEMENTS = {
    'packages/workbench/symbols.js': '97b5895056849502f60252432d1d217b5abd96e86038f1296fdfd28ea2542614',
    'apps/ide/desktop.css': '6c16f14ab6c17f7c5df7adc43e39f5fec02bae4ea70ccbe2271ec7bc0c128113',
    'apps/ide/desktop-tools.css': 'bfc563fd40f9076fa41a0c0635cbf99bb26e439dda7ddd4591bda1057a0e0893',
    'apps/ide/desktop-responsive.css': 'dbe21aecdaaf53734a3d36a8d2ed191ba5af3e9f888e066fb81d8a026113bdb2',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    p = subprocess.run(['git', *args], cwd=ROOT, check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.stdout.strip()


def target(name):
    p = pathlib.PurePosixPath(name)
    if (p.is_absolute() or '..' in p.parts or '\\' in name or
        (name != 'README.md' and (not p.parts or p.parts[0] not in
         {'apps', 'packages', 'tests', 'docs', 'scripts'}))):
        raise ValueError('Unapproved source path: ' + name)
    path = ROOT.joinpath(*p.parts)
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
        raise ValueError('Source path escapes the repository')
    return path


def edited(original, patch):
    source = original.decode('utf-8')
    last = 0
    for start, end, value in patch['edits']:
        if type(start) is not int or type(end) is not int or not isinstance(value, str):
            raise ValueError('Malformed edit')
        if start < last or end < start:
            raise ValueError('Overlapping edit')
        last = end
    for encoding in ('unicode', 'utf-16-le'):
        value = source if encoding == 'unicode' else source.encode(encoding)
        scale = 1 if encoding == 'unicode' else 2
        if any(end * scale > len(value) for _, end, _ in patch['edits']):
            continue
        for start, end, replacement in reversed(patch['edits']):
            if encoding != 'unicode':
                replacement = replacement.encode(encoding)
            value = value[:start * scale] + replacement + value[end * scale:]
        data = value.encode('utf-8') if encoding == 'unicode' else value.decode(encoding).encode('utf-8')
        if sha(data) == patch['after']:
            return data
    raise ValueError('Result checksum mismatch')


def main():
    if git('status', '--porcelain'):
        raise RuntimeError('Start from a clean checkout; never discard pending local work')
    raw = (ROOT / MANIFEST).read_bytes()
    if (ROOT / RECEIPT).exists():
        if json.loads((ROOT / RECEIPT).read_text())['manifestSha256'] != sha(raw):
            raise ValueError('Already-applied source manifest changed')
        print('Desktop source already materialized; nothing overwritten')
        return
    manifest = json.loads(raw)
    if manifest['format'] != 'source-edit-parts-v1' or len(manifest['parts']) > 100:
        raise ValueError('Invalid desktop source manifest')
    records = []
    for part in manifest['parts']:
        if not re.fullmatch(r'\.delivery/desktop-20260910-\d{2}\.json', part['path']):
            raise ValueError('Invalid manifest part path')
        data = (ROOT / part['path']).read_bytes()
        if len(data) > 1_000_000 or sha(data) != part['sha256']:
            raise ValueError('Manifest part checksum mismatch: ' + part['path'])
        records.extend(json.loads(data))
    if len(records) > 200:
        raise ValueError('Source record limit exceeded')
    overlay, groups = {}, []
    for message, group in itertools.groupby(records, key=lambda r: r[0]):
        if not isinstance(message, str) or len(message) > 200:
            raise ValueError('Invalid commit message')
        changes = {}
        for _, name, patch in group:
            path = target(name)
            if not re.fullmatch('[a-f0-9]{64}', patch['after']):
                raise ValueError('Invalid source result checksum')
            original = overlay.get(name, path.read_bytes() if path.exists() else b'')
            current = sha(original)
            if current == patch['after']:
                continue
            if patch['before'] is None:
                if original and current != REPLACEMENTS.get(name):
                    raise ValueError('Concurrent source replacement: ' + name)
                data = patch['content'].encode('utf-8')
            else:
                if current != patch['before']:
                    raise ValueError('Concurrent source edit: ' + name)
                data = edited(original, patch)
            if len(data) > 1_000_000 or sha(data) != patch['after']:
                raise ValueError('Invalid resulting source: ' + name)
            overlay[name] = changes[name] = data
        groups.append((message, changes))
    # The entire recovery passes preimage/result validation before the first write.
    for message, changes in groups:
        if not changes:
            continue
        for name, data in changes.items():
            path = target(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        git('add', '--', *changes)
        git('commit', '-m', message)
    patch = ROOT / '.delivery/desktop-ci-fixes.patch'
    expected = (ROOT / '.delivery/desktop-ci-fixes.sha256').read_text().strip()
    if sha(patch.read_bytes()) != expected:
        raise ValueError('CI-fix source checksum mismatch')
    git('apply', '--check', '--unidiff-zero', '--index', str(patch))
    git('apply', '--unidiff-zero', '--index', str(patch))
    git('commit', '-m', 'fix(ide): preserve Grid edits and verify desktop menu and symbol workflows')
    receipt = {'manifestSha256': sha(raw), 'records': len(records),
               'fixesSha256': expected, 'files': {name: sha(target(name).read_bytes()) for name in overlay}}
    (ROOT / RECEIPT).write_text(json.dumps(receipt, indent=2) + '\n')
    git('add', '--', RECEIPT)
    git('commit', '-m', 'build: record committed desktop recovery and validated source identities')
    print(json.dumps({'head': git('rev-parse', 'HEAD'), 'records': len(records),
                      'uncommitted': git('status', '--porcelain')}, indent=2))


if __name__ == '__main__':
    main()
