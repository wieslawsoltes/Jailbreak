"""Optional preimage- and result-verified ASCII transport corrections.

Does not interpret source. apply.py still verifies the full decompressed source digest.
"""
import hashlib
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent
manifest = root / 'msil-transport-repairs.json'
if manifest.exists():
    changes = {}
    for name, patch in json.loads(manifest.read_text()).items():
        if not re.fullmatch(r'msil-[0-9]{2}-[0-9]{2}\.b64', name):
            raise ValueError('Invalid transport filename')
        path = root / name
        if path.is_symlink():
            raise ValueError('Transport symlinks are not allowed')
        data = path.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual == patch['resultSha256']:
            continue
        if actual != patch['sha256']:
            raise ValueError('Transport preimage mismatch: ' + name)
        text = data.decode('ascii')
        previous_end = 0
        for start, end, value in patch['edits']:
            if type(start) is not int or type(end) is not int or not isinstance(value, str):
                raise ValueError('Invalid correction')
            if start < previous_end or end < start or end > len(text):
                raise ValueError('Overlapping or out-of-bounds correction')
            value.encode('ascii')
            previous_end = end
        for start, end, value in reversed(patch['edits']):
            text = text[:start] + value + text[end:]
        result = text.encode('ascii')
        if hashlib.sha256(result).hexdigest() != patch['resultSha256']:
            raise ValueError('Transport result mismatch: ' + name)
        changes[path] = result
    for path, data in changes.items():
        path.write_bytes(data)
