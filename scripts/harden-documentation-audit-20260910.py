#!/usr/bin/env python3
"""Apply narrowly checked corrections to the documentation auditor, not application code."""
from pathlib import Path
import ast

root = Path(__file__).resolve().parents[1]
path = root / 'scripts/reconcile-documentation-20260910.py'
source = path.read_text(encoding='utf-8')
changes = [
    (
        "library's symbol file",
        "library\\'s symbol file"
    ),
    (
        "entrypoint's supported profile",
        "entrypoint\\'s supported profile"
    ),
    (
        "path.startswith(('tests/fixtures/', 'third_party/', 'third-party/', 'vendor/', 'upstream/'))",
        "path.startswith(('tests/fixtures/', 'third_party/', 'third-party/', 'vendor/', 'upstream/', '.github/ISSUE_TEMPLATE/', '.github/PULL_REQUEST_TEMPLATE/'))"
    ),
    (
        "lambda m: m.group(1) + m.group(2) + ' (at this milestone)'",
        "lambda m: m.group(1) + re.sub(r'(?: \\(at this milestone\\))+$', '', m.group(2)) + ' (at this milestone)'"
    ),
    (
        "    repairs = repair_and_check_links(repair=True)\n",
        "    # This index is linked by current guides and is finalized after link reconciliation.\n    if not (ROOT / 'docs/audit/documentation-index.json').exists():\n        dump('docs/audit/documentation-index.json', {'baseline': baseline, 'documents': [], 'status': 'generation in progress'})\n    repairs = repair_and_check_links(repair=True)\n"
    ),
    (
        "def repair_and_check_links(repair: bool = False) -> dict:\n",
        "REFERENCE_LINK = re.compile(r'(?m)^( {0,3}\\[(?!\\^)[^\\]\\n]+\\]:)\\s*(<[^>]+>|[^\\s]+)(?:[ \\t]+[^\\n]*)?$')\n\ndef repair_and_check_links(repair: bool = False) -> dict:\n"
    ),
    (
        "        for match in LINK.finditer(body):\n            label, target = match.group(1), match.group(2)\n",
        "        for match in list(LINK.finditer(body)) + list(REFERENCE_LINK.finditer(body)):\n            definition = match.re is REFERENCE_LINK\n            label, target = match.group(1), match.group(2)\n"
    ),
    (
        "                    replacements[match.group(0)] = replacement\n                    repairs.append({'source': name, 'old': target, 'reason': 'Target absent from audited source; no missing implementation was fabricated.'})",
        "                    if definition:\n                        destination_path = candidates[0] if len(candidates) == 1 else 'docs/current-status.md'\n                        replacement = label + ' ' + urllib.parse.quote(os.path.relpath(destination_path, str(Path(name).parent)).replace(os.sep, '/'), safe='/._-')\n                    replacements[match.group(0)] = replacement\n                    repairs.append({'source': name, 'old': target, 'reason': 'Target absent from audited source; no missing implementation was fabricated.'})"
    ),
    (
        "                    replacements[match.group(0)] = label + '(' + new_target + ')'\n",
        "                    replacements[match.group(0)] = label + (' ' + new_target if definition else '(' + new_target + ')')\n"
    ),
    (
        "Repository-local authored Markdown links and heading fragments. External URLs",
        "Repository-local authored inline/reference Markdown links and heading fragments. External URLs"
    )
]
for before, after in changes:
    if after in source:
        continue
    if source.count(before) != 1:
        raise RuntimeError('Auditor changed concurrently; refusing an ambiguous documentation-tool patch: ' + before[:90])
    source = source.replace(before, after, 1)
ast.parse(source, filename=str(path))
path.write_text(source, encoding='utf-8')
print('Documentation auditor corrections applied; application and fixture source unchanged.')
