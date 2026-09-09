"""Materialize the three already-uploaded source deltas as normal source commits.

Inputs are immutable Git blobs from this repository. They contain data, never
Python or shell code. Every original/result is verified before the first write.
This script does not push. The workflow runs tests before a non-forced push.
"""
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = 'wieslawsoltes/Jailbreak'
BLOBS = (
    '049991d6b93b22e2d897e050d785c5dafc96a566',
    'b2846da12d5068bd286e1dad3c72180c051c52ab',
    '46cb5b3ee73d12d76539dae1917ad121813c8020',
)
STATE = ROOT / 'integration/desktop-source-applied.json'


def run(*args):
    result = subprocess.run(args, cwd=ROOT, check=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True)
    return result.stdout.strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def target(name):
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or not p.parts:
        raise ValueError('Unsafe source path: ' + name)
    if p.parts[0] not in {'apps', 'packages', 'scripts', 'tests', 'docs'}:
        raise ValueError('Source path is outside approved project directories')
    path = ROOT.joinpath(*p.parts)
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
        raise ValueError('Source path escapes repository')
    return path


def apply_edits(original, patch):
    source = original.decode('utf-8')
    edits = patch['edits']
    last = 0
    for start, end, value in edits:
        if type(start) is not int or type(end) is not int or not isinstance(value, str):
            raise ValueError('Malformed source edit')
        if start < last or end < start:
            raise ValueError('Overlapping source edits')
        last = end
    # Source transport was generated with Unicode text offsets. A UTF-16 producer
    # is accepted only when the complete expected result hash matches as well.
    if all(end <= len(source) for _, end, _ in edits):
        out = source
        for start, end, value in reversed(edits):
            out = out[:start] + value + out[end:]
        data = out.encode('utf-8')
        if sha(data) == patch['after']:
            return data
    raw = source.encode('utf-16-le')
    if all(end * 2 <= len(raw) for _, end, _ in edits):
        for start, end, value in reversed(edits):
            raw = raw[:start*2] + value.encode('utf-16-le') + raw[end*2:]
        data = raw.decode('utf-16-le').encode('utf-8')
        if sha(data) == patch['after']:
            return data
    raise ValueError('Result hash mismatch; no unverified source is accepted')


def fetch_blob(blob):
    import base64
    payload = json.loads(run('gh', 'api', f'repos/{REPO}/git/blobs/{blob}'))
    if payload.get('sha') != blob or payload.get('encoding') != 'base64':
        raise ValueError('Unexpected Git blob response')
    data = base64.b64decode(payload['content'])
    identity = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if identity != blob or len(data) > 1_000_000:
        raise ValueError('Source blob identity or byte budget mismatch')
    return json.loads(data)


def commit_files(message, files):
    if not files:
        return
    for name, data in files.items():
        path = target(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    run('git', 'add', '--', *files)
    if run('git', 'diff', '--cached', '--name-only'):
        run('git', 'commit', '-m', message)


def main():
    if run('git', 'status', '--porcelain'):
        raise RuntimeError('Use a clean checkout; pending local work must be preserved')
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    overlay = {}
    groups = []
    for blob in BLOBS:
        if state.get(blob) is True:
            continue
        records = fetch_blob(blob)
        if not isinstance(records, list) or len(records) > 100:
            raise ValueError('Invalid source-delta record budget')
        changed = {}
        for message, name, patch in records:
            if not isinstance(message, str) or len(message) > 200:
                raise ValueError('Invalid source commit message')
            path = target(name)
            original = overlay.get(name, path.read_bytes())
            if sha(original) == patch['after']:
                continue
            if sha(original) != patch['before']:
                raise RuntimeError('Concurrent or unrecovered source change: ' + name)
            data = apply_edits(original, patch)
            overlay[name] = changed[name] = data
        groups.append((blob, changed))
    # Source integration is fully preflighted before ordinary files are written.
    for blob, changed in groups:
        commit_files('feat(ide): materialize verified desktop integration ' + blob[:8], changed)
        state[blob] = True
    if groups:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, indent=2) + '\n')
        run('git', 'add', '--', str(STATE.relative_to(ROOT)))
        if run('git', 'diff', '--cached', '--name-only'):
            run('git', 'commit', '-m', 'build: record fully materialized desktop source identities')

    app = ROOT / 'apps/ide/app.js'
    text = app.read_text()
    marker = 'symbolWorkspace:()=>({...files})'
    if marker not in text:
        matches = list(re.finditer(r'\bworkspace\s*:\s*\{', text))
        if len(matches) != 1:
            raise RuntimeError('Locate the unique Studio workspace adapter before editing')
        code = '''
      symbolWorkspace:()=>({...files}),
      applySymbolAttachments:edits=>{
        if(!Array.isArray(edits)||!edits.length||edits.length>32)throw new Error('Invalid symbol transaction');
        const seen=new Set(),next={...files};
        for(const edit of edits){
          if(!edit||typeof edit.path!=='string'||!edit.path.endsWith('.binary.json')||seen.has(edit.path)||!Object.hasOwn(files,edit.path)||files[edit.path]!==edit.before)throw new Error('The symbol attachment changed; refresh before applying');
          if(typeof edit.after!=='string'||edit.after.length>4000000)throw new Error('Symbol attachment exceeds interactive workspace limits');
          validateSymbolWorkspaceRecord(edit.after,edit.path);seen.add(edit.path);next[edit.path]=edit.after;
        }
        if(Object.values(next).reduce((n,value)=>n+value.length,0)>16000000)throw new Error('Workspace exceeds 16 MB');
        for(const edit of edits)files[edit.path]=edit.after;
        modified=true;lastBuild=null;profiles.invalidate();renderEditor();renderFiles();save();
      },
'''
        at = matches[0].end()
        text = text[:at] + code + text[at:]
        text = "import {decodeBinaryRecord as validateSymbolWorkspaceRecord} from './packages/binary-project/workspace.js';\n" + text
        commit_files('feat(symbols): attach verified restored sources through workspace preimage transactions',
                     {'apps/ide/app.js': text.encode('utf-8')})
    print(json.dumps({'head': run('git', 'rev-parse', 'HEAD'), 'materialized_blobs': list(state),
                      'uncommitted': run('git', 'status', '--porcelain')}, indent=2))


if __name__ == '__main__':
    main()
