#!/usr/bin/env python3
"""Reconcile Jailbreak's authored documentation against an exact repository revision.

Documentation only: never materializes saved implementation blobs, changes upstream
fixtures, executes imported applications or force-pushes. Historical technical notes
are preserved with explicit current applicability. Runtime claims are separated from
source presence, committed test files, local checks and hosted CI evidence.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'docs/audit/requirements-contract-20260910.json'
EXCLUDED = {'.git', 'node_modules', 'site', 'dist', 'bin', 'obj', '__pycache__', 'test-results'}
BEGIN = '<!-- jailbreak-current-documentation:begin -->'
END = '<!-- jailbreak-current-documentation:end -->'
REPO = 'wieslawsoltes/Jailbreak'
CANONICAL = {
 'README.md', 'docs/README.md', 'docs/requirements.md', 'docs/requirements-traceability.md',
 'docs/current-status.md', 'docs/completed-work.md', 'docs/compatibility.md',
 'docs/architecture.md', 'docs/api-reference.md', 'docs/binary-entrypoints.md',
 'docs/ide-guide.md', 'docs/build-and-verification.md', 'docs/security-and-trust.md',
 'docs/remaining-work.md', 'docs/roadmap.md', 'docs/mandatory-targets-status.md',
 'docs/core-development-tools.md', 'docs/acceptance-plan.md', 'docs/documentation-maintenance.md'
}

def git(*args: str, check: bool = True) -> str:
    run = subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, timeout=90)
    if check and run.returncode:
        raise RuntimeError('git ' + args[0] + ' failed: ' + run.stderr[:1200])
    return run.stdout.strip()

def text(path: str) -> str:
    p = ROOT / path
    return p.read_text(encoding='utf-8') if p.is_file() else ''

def write(path: str, value: str) -> None:
    p = ROOT / path
    if p.is_symlink():
        raise RuntimeError('Refusing to replace a symlink: ' + path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(value.rstrip() + '\n', encoding='utf-8')

def dump(path: str, value: object) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2))

def rel_link(source: str, target: str, label: str | None = None) -> str:
    value = os.path.relpath(target, str(Path(source).parent)).replace(os.sep, '/')
    return '[' + (label or target).replace('|', '\\|') + '](' + urllib.parse.quote(value, safe='/._-') + ')'

def authored_md() -> list[str]:
    result = []
    for p in ROOT.rglob('*.md'):
        r = p.relative_to(ROOT)
        if not p.is_symlink() and not EXCLUDED.intersection(r.parts):
            result.append(r.as_posix())
    return sorted(result)

def protected(path: str) -> bool:
    parts = Path(path).parts
    return (path.startswith(('tests/fixtures/', 'third_party/', 'third-party/', 'vendor/', 'upstream/', '.github/ISSUE_TEMPLATE/', '.github/PULL_REQUEST_TEMPLATE/'))
            or any(part.lower() in {'third_party', 'third-party', 'vendor'} for part in parts)
            or Path(path).name.upper().startswith(('LICENSE', 'COPYING', 'NOTICE')))

def matches(patterns: list[str]) -> list[str]:
    return sorted({p.relative_to(ROOT).as_posix() for pattern in patterns for p in ROOT.glob(pattern)
                   if p.is_file() and not p.is_symlink() and not EXCLUDED.intersection(p.relative_to(ROOT).parts)})

def gh_json(endpoint: str) -> dict:
    try:
        run = subprocess.run(['gh', 'api', endpoint], cwd=ROOT, text=True, capture_output=True, timeout=60)
        if run.returncode == 0:
            return json.loads(run.stdout)
        return {'audit_error': 'GitHub API query did not succeed; no hosted result inferred.'}
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return {'audit_error': 'Hosted verification was not available to this audit process.'}

def ci_evidence(baseline: str) -> dict:
    exact = gh_json(f'repos/{REPO}/actions/runs?head_sha={baseline}&per_page=50')
    recent = gh_json(f'repos/{REPO}/actions/workflows/toolchain.yml/runs?status=success&per_page=30')
    def slim(run: dict) -> dict:
        return {k: run.get(k) for k in ('id', 'name', 'head_sha', 'path', 'event', 'status', 'conclusion', 'html_url', 'created_at', 'updated_at')}
    same = [slim(r) for r in exact.get('workflow_runs', []) if r.get('path') == '.github/workflows/toolchain.yml']
    ancestor = None
    for run in recent.get('workflow_runs', []):
        sha = run.get('head_sha', '')
        if not re.fullmatch('[0-9a-f]{40}', sha):
            continue
        result = subprocess.run(['git', 'merge-base', '--is-ancestor', sha, baseline], cwd=ROOT, capture_output=True)
        if result.returncode == 0:
            ancestor = slim(run)
            break
    changed = None
    if ancestor:
        changed = git('diff', '--name-only', ancestor['head_sha'], baseline, '--', 'packages', 'apps', 'tests', 'scripts', 'package.json', '.github/workflows/toolchain.yml').splitlines()
        changed = [p for p in changed if p != 'scripts/reconcile-documentation-20260910.py']
    return {'exact_baseline_runs': same, 'most_recent_successful_ancestor': ancestor,
            'implementation_or_gate_changes_since_successful_ancestor': changed,
            'exact_query_error': exact.get('audit_error'), 'history_query_error': recent.get('audit_error')}

def script_names(package: dict) -> str:
    rows = ['| Command | Actual package script |', '| --- | --- |']
    for name, value in sorted(package.get('scripts', {}).items()):
        rows.append('| `npm run ' + name.replace('|', '\\|') + '` | `' + value.replace('`', "'").replace('|', '\\|') + '` |')
    return '\n'.join(rows)

def exports(path: str) -> list[str]:
    source = text(path)
    found = re.findall(r'\bexport\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s*([A-Za-z_$][\w$]*)', source)
    for block in re.findall(r'\bexport\s*\{([^}]+)\}', source):
        for item in block.split(','):
            token = item.strip().split(' as ')[-1].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', token):
                found.append(token)
    return sorted(set(found))

def gate_receipts() -> list[dict]:
    path = Path(os.environ.get('JAILBREAK_DOCS_CHECKS', '/tmp/jailbreak-documentation-checks.json'))
    if not path.is_file():
        return []
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise RuntimeError('Invalid local verification receipt')
    return data

def title_of(path: str) -> str:
    m = re.search(r'^#\s+(.+)$', text(path), re.M)
    return (m.group(1) if m else Path(path).stem).replace('|', '\\|')

def source_snapshot(baseline: str) -> dict:
    paths = git('ls-files', 'packages', 'apps', 'tests', 'scripts', 'package.json', '.github/workflows').splitlines()
    hashes = {}
    for name in paths:
        p = ROOT / name
        if p.is_file() and not p.is_symlink() and not name.endswith('.md') and name != 'scripts/reconcile-documentation-20260910.py' and not name.startswith('.github/workflows/documentation-reconciliation-'):
            hashes[name] = hashlib.sha256(p.read_bytes()).hexdigest()
    raw = '\n'.join(name + ' ' + value for name, value in sorted(hashes.items())).encode()
    return {'baseline': baseline, 'algorithm': 'sha256', 'implementation_and_gate_files': hashes,
            'aggregate_sha256': hashlib.sha256(raw).hexdigest(),
            'note': 'Committed implementation and verification inputs, not proof that every API or requirement is complete. Documentation and transport blobs are not runtime implementations.'}

def original_headings(source: str) -> list[str]:
    return re.findall(r'^#{1,6}\s+(.+?)\s*#*$', source, re.M)

def markdown_body(source: str) -> str:
    return re.sub(r'(?ms)^\s*(```|~~~).*?^\s*\1[^\n]*$', '', source)

def anchor_slugs(source: str) -> set[str]:
    result = set(re.findall(r'\b(?:id|name)=[\"\']([^\"\']+)[\"\']', source))
    used = {}
    for heading in original_headings(markdown_body(source)):
        heading = re.sub(r'!?\[([^\]]+)\]\([^)]*\)', r'\1', heading)
        heading = re.sub(r'<[^>]*>', '', heading).lower().replace('`', '')
        slug = re.sub(r'[^\w\- ]', '', heading, flags=re.UNICODE).replace(' ', '-')
        count = used.get(slug, 0)
        used[slug] = count + 1
        result.add(slug if count == 0 else f'{slug}-{count}')
    return result

LINK = re.compile(r'(!?\[[^\]\n]*\])\((<[^>]+>|[^\s)]*)(?:\s+[\"\'][^\n]*?[\"\'])?\)')

def resolve_target(source: str, target: str):
    target = target.strip('<>')
    if not target or target.startswith(('https:', 'http:', 'mailto:', 'tel:', 'data:', 'javascript:')):
        return None
    if target.startswith('sandbox:'):
        return ('missing', target, '')
    parsed = urllib.parse.urlsplit(target)
    if parsed.scheme:
        return None
    path = urllib.parse.unquote(parsed.path)
    destination = (ROOT / source).parent / path if path else ROOT / source
    destination = destination.resolve()
    try:
        name = destination.relative_to(ROOT).as_posix()
    except ValueError:
        return ('outside', target, '')
    return (name, destination, urllib.parse.unquote(parsed.fragment))

REFERENCE_LINK = re.compile(r'(?m)^( {0,3}\[(?!\^)[^\]\n]+\]:)\s*(<[^>]+>|[^\s]+)(?:[ \t]+[^\n]*)?$')

def repair_and_check_links(repair: bool = False) -> dict:
    repairs, errors = [], []
    documents = authored_md()
    for name in documents:
        source = text(name)
        body = markdown_body(source)
        replacements = {}
        for match in list(LINK.finditer(body)) + list(REFERENCE_LINK.finditer(body)):
            definition = match.re is REFERENCE_LINK
            label, target = match.group(1), match.group(2)
            resolved = resolve_target(name, target)
            if not resolved:
                continue
            dest_name, destination, fragment = resolved
            if dest_name in {'missing', 'outside'} or not destination.exists():
                candidates = [p for p in documents if Path(p).name.casefold() == Path(urllib.parse.urlsplit(target).path).name.casefold()]
                if repair and not protected(name):
                    if len(candidates) == 1:
                        replacement = rel_link(name, candidates[0], label.lstrip('![').rstrip(']'))
                    else:
                        replacement = label.lstrip('![').rstrip(']') + ' (historical target not present in this audited checkout; see ' + rel_link(name, 'docs/current-status.md', 'current status') + ')'
                    if definition:
                        destination_path = candidates[0] if len(candidates) == 1 else 'docs/current-status.md'
                        replacement = label + ' ' + urllib.parse.quote(os.path.relpath(destination_path, str(Path(name).parent)).replace(os.sep, '/'), safe='/._-')
                    replacements[match.group(0)] = replacement
                    repairs.append({'source': name, 'old': target, 'reason': 'Target absent from audited source; no missing implementation was fabricated.'})
                elif not protected(name):
                    errors.append({'source': name, 'target': target, 'reason': 'missing local target'})
            elif fragment and destination.is_file() and destination.suffix.lower() == '.md' and fragment not in anchor_slugs(destination.read_text(encoding='utf-8')):
                if repair and not protected(name):
                    parsed = urllib.parse.urlsplit(target)
                    new_target = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, '')) or Path(name).name
                    replacements[match.group(0)] = label + (' ' + new_target if definition else '(' + new_target + ')')
                    repairs.append({'source': name, 'old': target, 'reason': 'Obsolete section fragment removed; link retains the actual document.'})
                elif not protected(name):
                    errors.append({'source': name, 'target': target, 'reason': 'missing section anchor'})
        if replacements:
            for before, after in replacements.items():
                source = source.replace(before, after)
            write(name, source)
    return {'documents_examined': len(documents), 'repairs': repairs, 'errors': errors,
            'scope': 'Repository-local authored inline/reference Markdown links and heading fragments. External URLs are retained as references and are not asserted reachable. Vendored/upstream/license documents are preserved byte-for-byte.'}

def generate() -> dict:
    spec = json.loads(SPEC.read_text(encoding='utf-8'))
    if spec.get('format') != 'jailbreak-requirements-contract-v1':
        raise RuntimeError('Unsupported requirements contract')
    groups = spec['groups']
    ids = [r[0] for g in groups for r in g['requirements']]
    if len(ids) != len(set(ids)) or any(not re.fullmatch('[A-Z]+-[0-9]{3}', i) for i in ids):
        raise RuntimeError('Invalid or duplicate requirement ID')
    baseline = git('rev-parse', 'HEAD')
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    snapshot = source_snapshot(baseline)
    ci = ci_evidence(baseline)
    checks = gate_receipts()
    old_docs = authored_md()
    evidence = {g['id']: {'implementation': matches(g['implementation']), 'tests': matches(g['tests'])} for g in groups}
    package = json.loads(text('package.json') or '{}')
    source_url = f'https://github.com/{REPO}/tree/{baseline}'
    stamp = f'> Audit input: [`{baseline[:12]}`]({source_url}); documentation reconciled {timestamp}. This is a source/evidence snapshot, not a declaration of full product completion.\n\n'
    up = {}
    try:
        up = json.loads(text('tests/fixtures/upstream.json') or '{}')
    except json.JSONDecodeError:
        up = {'audit_error': 'Upstream manifest was not valid JSON.'}
    def flags(value, prefix=''):
        out = {}
        if isinstance(value, dict):
            for key, item in value.items():
                name = prefix + '.' + key if prefix else key
                if re.search(r'full.*catalog|repository|commit|revision', key, re.I) and isinstance(item, (str, bool, int, float)):
                    out[name] = item
                if isinstance(item, dict):
                    out.update(flags(item, name))
        return out
    upstream_flags = flags(up)
    audit = {'format': 'jailbreak-documentation-audit-v1', 'source_baseline': baseline, 'audited_at': timestamp,
             'requirement_count': len(ids), 'group_count': len(groups), 'evidence': evidence,
             'upstream_manifest_observations': upstream_flags, 'hosted_ci': ci, 'local_verification': checks,
             'interpretation': {'source_presence': 'A located file, not semantic completeness.', 'test_presence': 'A committed test, not automatically a passing run.', 'fixture_success': 'The SDK/CLR fixture was produced, not proof of JavaScript conversion.', 'ci_success': 'The exact workflow scope passed for the recorded SHA, not every requirement.', 'deployment_success': 'Requires a successful deploy job for that SHA, not merely a source push.'}}
    dump('docs/audit/source-inventory.json', snapshot)
    dump('docs/audit/evidence.json', audit)

    req = '# Full solution requirements and acceptance contract\n\n' + stamp
    req += spec['purpose'] + '\n\n## Definition of the expected finished solution\n\nThe finished product is one usable, documented browser development system: existing solution/project inputs compile through the appropriate source or binary route; the full pinned unchanged ControlCatalog runs correctly; the UI is editable and debuggable; compatible updates preserve state; applications and the IDE export and deploy reproducibly. A smaller implementation profile is a delivery milestone, not a change to this expectation.\n\n'
    req += '## Non-negotiable acceptance rules\n\n' + '\n\n'.join(f'**{i+1}.** {r}' for i, r in enumerate(spec['rules'])) + '\n\n'
    req += '## Requirement catalogue\n\nEach stable ID describes a requirement, not a completed checkbox. The [traceability matrix](requirements-traceability.md), [current evidence](current-status.md) and [remaining plan](remaining-work.md) distinguish the implemented profile from the required end state. No requirement is marked complete merely by this documentation update.\n\n'
    for g in groups:
        req += f'### {g["id"]} — {g["title"]}\n\n| ID | Required capability | Completion gate |\n| --- | --- | --- |\n'
        for ident, requirement, acceptance in g['requirements']:
            req += f'| {ident} | {requirement} | {acceptance} |\n'
        req += '\n'
    req += '## Scope and compatibility versions\n\nPin the C# language version, .NET API/assembly profile, Avalonia revision, supported project-evaluation semantics and browser/rendering targets for each acceptance report. The complete required compatibility profile must be explicit; a later release cannot silently redefine unsupported inputs away to make the full gate pass. Browser platform adapters may be necessary, but their behavior and effect on upstream source must be documented and tested.\n'
    write('docs/requirements.md', req)

    trace = '# Requirements traceability\n\n' + stamp + 'The evidence below is collected from files present in the audited revision. **Located source and tests establish where to inspect a feature, not that its entire requirement is complete.** The canonical workflow and independent full-scope gates determine completion. Empty cells are gaps, not implied implementations.\n\n'
    for g in groups:
        e = evidence[g['id']]
        trace += f'## {g["id"]} — {g["title"]}\n\n**Requirement IDs:** ' + ', '.join(r[0] for r in g['requirements']) + '.\n\n'
        trace += '**Observed implementation files:** ' + (', '.join(rel_link('docs/requirements-traceability.md', p) for p in e['implementation'][:14]) or 'None matched the audited canonical paths; investigate before making a delivery claim.') + '\n\n'
        if len(e['implementation']) > 14:
            trace += f'{len(e["implementation"])-14} additional paths are recorded in [the machine-readable evidence](audit/evidence.json).\n\n'
        trace += '**Committed verification files:** ' + (', '.join(rel_link('docs/requirements-traceability.md', p) for p in e['tests'][:10]) or 'No dedicated file matched this group; the missing acceptance mapping remains visible.') + '\n\n'
        trace += '**Implemented-profile interpretation:** ' + (g['profile'] if e['implementation'] else 'Implementation was not established by this path audit.') + '\n\n**Full-scope work still required:** ' + g['remaining'] + '\n\n'
    write('docs/requirements-traceability.md', trace)

    exact = ci['exact_baseline_runs']
    ci_text = '\n'.join(f'| [{r["id"]}]({r["html_url"]}) | `{r["head_sha"][:12]}` | {r["status"]} | {r["conclusion"] or "not concluded"} |' for r in exact)
    if not ci_text:
        ci_text = '| No exact-SHA canonical result available to this audit | — | Not established | Do not infer a pass |'
    status = '# Current implementation and evidence status\n\n' + stamp
    status += '**The requested full solution is not declared complete.** The project has implemented and tested profiles; their scope must be read alongside the outstanding whole-application requirements. This document supersedes contradictory conversational publication reports and milestone-era exclusions. It does not make a new runtime compatibility claim from file names alone.\n\n'
    status += '## Audited source and publication evidence\n\nThe implementation/gate input manifest is [source-inventory.json](audit/source-inventory.json); the complete evidence record is [evidence.json](audit/evidence.json). The input revision and source fingerprint remain fixed even as these documentation-only commits are published. A future code change requires a new audit.\n\n| Canonical workflow run | Head | Status | Conclusion |\n| --- | --- | --- | --- |\n' + ci_text + '\n\n'
    ancestor = ci['most_recent_successful_ancestor']
    if ancestor:
        status += f'The latest successful canonical ancestor observed was [`{ancestor["head_sha"][:12]}`](https://github.com/{REPO}/commit/{ancestor["head_sha"]}), [run {ancestor["id"]}]({ancestor["html_url"]}). '
        changes = ci['implementation_or_gate_changes_since_successful_ancestor']
        status += ('No implementation/canonical-gate path changes were found between that ancestor and the audit input (excluding this documentation auditor). This is source equivalence for those paths, not a new deployment receipt.\n\n' if not changes else f'{len(changes)} implementation or gate paths changed after that successful ancestor; its pass must not be represented as verification of the changed revision. See the exact path list in the evidence record.\n\n')
    status += '## Capability status by acceptance group\n\n| Area | Audited implementation | Audited verification files | Full acceptance |\n| --- | --- | --- | --- |\n'
    for g in groups:
        e = evidence[g['id']]
        status += f'| [{g["id"]}: {g["title"]}](requirements-traceability.md#{g["id"].lower()}--{re.sub(r"[^a-z0-9 -]", "", g["title"].lower()).replace(" ", "-")}) | {len(e["implementation"])} located files | {len(e["tests"])} located files | Required; not declared complete by inventory |\n'
    status += '\n## Current integrated workflows\n\nThe current reference architecture is the primary C#/XAML project pipeline, the verified MSIL pipeline, the shared Avalonia/browser runtime and the operational desktop workbench. Source and binary debugging use separate execution contexts with shared presentation. Native-engine source debugging and cooperative in-IDE continuations are distinct paths. Read-only **[symbol]** source is checksum-verified debugger input; **[IL]** is disassembly, not reconstructed C#.\n\nThe current IDE guide describes menus and independent tool windows. Earlier screenshots/instructions about permanent Compatibility Gates/Getting Started panes or one combined All tools/Designer/Debugger inspector are historical, not the desired/current design contract.\n\n'
    status += '## Full upstream gate versus selected examples\n\nThe exact observations from the committed upstream manifest are:\n\n```json\n' + json.dumps(upstream_flags, ensure_ascii=False, indent=2) + '\n```\n\nA curated sample named ControlCatalog, an unchanged isolated page, a host adapter and a full unchanged upstream project are different acceptance scopes. A selected-page gate or total example count must not be reported as full ControlCatalog execution. The [acceptance plan](acceptance-plan.md) defines the missing whole-project evidence.\n\n'
    reference = matches(['tests/fixtures/reference-src/*', 'scripts/build-reference-fixture.mjs', 'scripts/verify-*reference*.mjs', 'tests/*reference*.test.js', 'packages/msil-*/*reference*.js'])
    status += '## Managed-reference and SDK state-machine evidence\n\nLocated reference-related files: ' + (', '.join(rel_link('docs/current-status.md', p) for p in reference) or 'none') + '.\n\nA successful SDK/CLR fixture-generation job establishes the original program and expected values only. Ref/out support requires actual emitter/runtime lowering and JavaScript-vs-CLR comparison in each claimed mode. Saved Git blobs, transport stages and proposed comparison matrices do not count as a committed, passing implementation. Likewise, source C# async continuations do not establish compatibility with arbitrary SDK-generated async state-machine IL.\n\n'
    status += '## Local checks captured during this documentation audit\n\n'
    if checks:
        status += '| Check | Exit code | Recorded result |\n| --- | --- | --- |\n'
        for check in checks:
            result = json.dumps(check.get('summary', {}), ensure_ascii=False).replace('|', '\\|')
            status += f'| {check.get("name", "unnamed")} | {check.get("exit_code", "unknown")} | `{result}` |\n'
    else:
        status += 'No local test receipt was supplied. Committed tests and old milestone totals are not being presented as a newly executed suite.\n'
    status += '\n## Completion claims that remain prohibited\n\nDo not label all C#/Avalonia/.NET support complete; do not label SVG rendering as WebGPU tessellation; do not label a download/identity match as publisher authentication; do not call an attempted write a commit, a commit a passed CI run, or a passed verify job a successful Pages deployment. See [remaining work](remaining-work.md), [verification](build-and-verification.md) and [security](security-and-trust.md).\n'
    write('docs/current-status.md', status)

    completed = '# Work implemented and retained in the repository\n\n' + stamp
    completed += 'This record identifies implementation families present in the audited checkout. Its profiles are deliberately narrower than the [full requirements](requirements.md). Test counts in older milestones remain historical. The exact current CI/local-run evidence is in [current status](current-status.md), not inferred from prior chat summaries.\n\n'
    for g in groups:
        e = evidence[g['id']]
        completed += f'## {g["title"]}\n\n' + (g['profile'] if e['implementation'] else 'No canonical implementation path was established in this audit.') + '\n\n'
        completed += '**Evidence entry:** [' + g['id'] + ' traceability](requirements-traceability.md). **Requirement boundary:** ' + g['remaining'] + '\n\n'
    history = git('log', '--first-parent', '--max-count=80', '--date=short', '--format=%h%x09%ad%x09%s').splitlines()
    completed += '## Recent committed history at the audit input\n\nThese are actual first-parent commit records, not a reconstructed narrative. A commit message alone does not prove its feature complete; use source and tests linked above.\n\n| Commit | Date | Recorded subject |\n| --- | --- | --- |\n'
    for line in history:
        parts = line.split('\t', 2)
        if len(parts) == 3:
            sha, date, subject = parts
            completed += f'| [`{sha}`](https://github.com/{REPO}/commit/{sha}) | {date} | {subject.replace("|", " / ")} |\n'
    write('docs/completed-work.md', completed)

    compatibility = '# Compatibility profiles and remaining boundaries\n\n' + stamp
    compatibility += '## How to read support\n\n**Implemented profile** means specific behavior has source and acceptance coverage. **Fixture ready** means an independent original/reference exists, not that conversion passes. **Full target open** retains the complete requirement. **Unsupported** must produce diagnostics rather than an empty implementation. None of these categories is equivalent to production certification.\n\n'
    for g in groups:
        compatibility += f'## {g["id"]}: {g["title"]}\n\n' + g['profile'] + '\n\n**Not established as complete:** ' + g['remaining'] + '\n\n'
    compatibility += '## Important distinctions\n\nThe supported source compiler, binary compiler and runtime are independently constrained. A DLL/PDB that parses is not necessarily executable. NuGet restoration/conversion does not imply every package target/API/build task is implemented. A source async method and an SDK async state machine are different compiler inputs. A native managed PDB does not enable native machine-code execution. Browser adapters must be explicit.\n\nA full claim requires the pinned version/profile, exact input manifest, independent output expectations, real-browser evidence and exact passing revision. [Acceptance plan](acceptance-plan.md) and [source traceability](requirements-traceability.md) define that process.\n'
    write('docs/compatibility.md', compatibility)

    package_dirs = sorted(p for p in (ROOT / 'packages').iterdir() if p.is_dir()) if (ROOT / 'packages').is_dir() else []
    architecture = '# Architecture and canonical execution paths\n\n' + stamp
    architecture += '```text\nSolution / project / source / assets\n  -> project evaluation -> C# parser/binder/lowering -> JavaScript\n                       -> XAML compiler -> construction/resource metadata\n\nIL text ---------------------------+\nDLL / EXE -> PE/CLI metadata -> IL verifier -> JavaScript method bodies\nNuGet -> validated executable assets+\nPDB / embedded symbols / approved restoration -> verified source/IL metadata\n\nGenerated code + shared managed operations + Avalonia/browser UI runtime\n  -> HTML / SVG / explicitly implemented WebGPU rendering paths\n  -> isolated application preview or standalone browser export\n\nDevelopment metadata / continuations / source edit transactions\n  -> debugger, designer, reload planner and operational desktop tool windows\n```\n\n'
    architecture += '## Canonical versus preserved prototype APIs\n\nThe primary source workbench uses the project-system/C# backend and XAML compiler. The verified MSIL route is `msil-compiler/verified.js`; asynchronous symbol preparation is layered through `msil-compiler/debug.js`. Source/binary linkage is in `binary-project`. Earlier compact APIs or secondary frontends remain separate where present; their existence does not make them interchangeable with verified entrypoints. See [actual exported APIs](api-reference.md) and [binary entrypoints](binary-entrypoints.md).\n\n'
    architecture += '## Runtime and rendering boundaries\n\nManaged exceptions, numerics, type/member resolution, source and converted libraries share explicit runtime contracts. UI controls own properties, events, bindings, namescopes and lifecycle. Normal and resumable construction use shared traversal where implemented. The rendering backend must be identified per feature: native SVG geometry/brush/mask output is not WebGPU tessellation. Browser layout support is not automatically full Avalonia measure/arrange compatibility.\n\n'
    architecture += '## Development tooling\n\nThe compilers emit source identity and optional continuation/debug metadata. Debugger sessions own tasks/frames and support native-engine or cooperative execution without mixing them. Designer libraries inspect/edit source with preimage checks. Reload libraries plan compatible method/property/tree/environment changes and preserve or roll back owned state. The workbench is a client: moving docked views must not clone their controllers, and switching source/binary perspectives must not merge runtime state.\n\n'
    architecture += '## Trust boundaries\n\nImported source, IL, DLLs, packages and symbols are inputs, not permission to execute in the IDE origin or fetch arbitrary URLs. Preview CSP/sandbox and authenticated messages are distinct protections. Explicit symbol restoration runs in a trusted tool context with separate origin approval and bounded downloads; verified original source remains read-only debugger attachment data. See [security](security-and-trust.md).\n\n'
    architecture += '## Actual reusable package inventory\n\nThe inventory is generated from the checkout; it describes organization, not completeness.\n\n| Package | JavaScript files | Entrypoint/source |\n| --- | --- | --- |\n'
    for p in package_dirs:
        files = sorted(p.rglob('*.js'))
        index = p / 'index.js'
        target = (index if index.exists() else files[0] if files else p).relative_to(ROOT).as_posix()
        architecture += f'| `{p.name}` | {len(files)} | {rel_link("docs/architecture.md", target)} |\n'
    architecture += '\n## Extension obligations\n\nAdd semantics in the canonical parser/binder/verifier/runtime layer, not a sample-specific patch. A new capability must include positive/negative tests, source locations, debugger behavior, designer editability and reload/disposal impact. Update the versioned requirement mapping and strict upstream acceptance gates in the same change.\n'
    write('docs/architecture.md', architecture)

    api = '# Reusable API entrypoints\n\n' + stamp
    api += 'The names below are extracted from current authored modules. This is an entrypoint index, not a claim that every argument/type/API combination is supported. Read the linked source and tests for exact option/result contracts; retain `success`/diagnostic checks and never execute a failed result.\n\n| Module | Exported names found in source |\n| --- | --- |\n'
    api_paths = ['packages/project-system/index.js', 'packages/project-system/backend.js', 'packages/csharp-compiler/index.js', 'packages/csharp-compiler/backend.js', 'packages/xaml-compiler/index.js', 'packages/avalonia-runtime/index.js', 'packages/msil-compiler/verified.js', 'packages/msil-compiler/debug.js', 'packages/msil-runtime/index.js', 'packages/binary-project/index.js', 'packages/binary-project/workspace.js', 'packages/nuget/index.js', 'packages/portable-pdb/index.js', 'packages/portable-pdb/symbols.js', 'packages/native-pdb/index.js', 'packages/symbol-restoration/index.js', 'packages/development/designer.js', 'packages/development/reload.js', 'packages/development/cooperative-debugger.js', 'packages/workbench/dock-model.js', 'packages/workbench/debug-context.js']
    for p in api_paths:
        if (ROOT / p).is_file():
            names = exports(p)
            api += '| ' + rel_link('docs/api-reference.md', p) + ' | ' + (', '.join('`' + n + '`' for n in names) or 'See module reexports/implementation') + ' |\n'
    api += '\n## Input, output and lifecycle rules\n\nSource workspaces, evaluated projects and binary records are not interchangeable structures. Symbol preparation is asynchronous and must complete before verified binary emission. Register/link assemblies with the matching runtime instance and preserve type identity. Source maps and original documents belong only in deliberate development output. Runtime/development/preview handles must be disposed when replacing a session.\n\nDesign edits and refactors are source transactions, not unchecked string replacements. Reload plans are revision-bound; do not apply an incompatible plan or substitute a successful older result for a failed current compilation. A restored symbol attachment must be validated against the unchanged DLL record before publishing it.\n\nThe [build guide](build-and-verification.md) lists exact package scripts from this revision. [Architecture](architecture.md), [compatibility](compatibility.md) and the linked tests define each entrypoint\'s supported profile.\n'
    write('docs/api-reference.md', api)
    write('docs/binary-entrypoints.md', '# Binary compiler entrypoints and route selection\n\n' + stamp + 'Use the verified MSIL pipeline for whole-assembly checking and JavaScript emission; use the debug wrapper for PDB/source preparation before that same emission. Use binary-project for C#/XAML linkage and workspace records, NuGet for package validation/asset selection, and the matching MSIL runtime for execution. Preserved compact prototypes are not a substitute for this route.\n\n' + api.split('## Input, output and lifecycle rules')[0].split('| Module |')[0].split('The names below')[0].replace('# Reusable API entrypoints\n\n' + stamp, '') + 'See the exact [module/export index](api-reference.md). IL text, loose managed binaries and packages have different input validation. Unsupported IL, metadata or executable dependencies stop output; a PDB reader cannot make an unsupported DLL executable.\n\nNative-engine `debug` and cooperative-debug instrumentation are separate modes. Both must retain the ordinary supported semantics and share exception/type/lifetime rules with source callers. SDK-generated async-state-machine IL remains a separate acceptance requirement from source async support.\n\nVerified original source is read-only debugger data; symbol-free methods expose labeled IL. Explicit symbol restoration cannot silently introduce source compilation replacements or execute package/native tasks. Standalone exports must carry the generated runtime/assets they need, with development source disclosure made explicit.\n')

    ide = '# Using the integrated desktop IDE\n\n' + stamp
    ide += '## Workspace model\n\nJailbreak is one development environment with source, split, designer and binary perspectives. The central document area contains editable source, the actual compiled preview or binary documents. Operational tool windows are docked independently; informational Compatibility Gates/Getting Started panes and the old oversized combined inspector are not the desired layout. Compatibility and learning material lives in this documentation.\n\n'
    ide += '## Menus, commands and docking\n\nUse the menu bar or command palette to discover commands available in the current context. Tool-window commands expose Solution Explorer, Document Outline, Properties, Layout, Toolbox, Find Results, Error List, Output, Call Stack, Locals, Watch, Breakpoints, Tasks, Debug Console, Debug Settings and Symbols & Sources where registered. Docking moves the existing view/controller; floating, auto-hide, close/reopen and named layouts must not reset its runtime session. Layout reset recovers hidden/off-screen windows.\n\nKeyboard shortcuts are defined by the current command registry rather than by screenshots in older milestone guides. Check the displayed shortcut/availability before invoking an operation; platform-reserved browser shortcuts and native paused-engine behavior may differ.\n\n'
    ide += '## Open, build and run\n\nOpen a folder or complete set of files to include the solution/projects, XAML, code-behind, resources and dependencies. A browser permission for one project file does not grant access to neighboring files. Choose the startup project/build profile/entry view, edit source, and build through the primary pipeline. Navigate errors in Error List and inspect build/application output. Failed development builds retain the previous working preview; incompatible successful edits require explicit restart.\n\n'
    ide += '## Debug source and converted libraries\n\nChoose the execution mode appropriate to release, design, in-IDE continuation debugging or native DevTools. Bind breakpoints to actual source/IL points, then inspect the selected session in Call Stack, Locals, Watch and Tasks. Permitted scalar local edits affect the suspended invocation. Conditions/logpoints and exception settings have explicit supported expression/event semantics. Native-engine stepping is not the same transport as cooperative in-IDE stepping.\n\nWhen the binary workspace is selected, shared execution/debugger commands route to its isolated runtime, not the source preview. Original **[symbol]** documents require identity and checksum verification. **[IL]** documents display actual disassembly. A library\'s symbol file does not expand its executable opcode/type/API compatibility.\n\n'
    ide += '## Design and hot reload\n\nUse Document Outline or canvas picking to select real controls. Properties edits literals or explicit expressions according to source editability; Layout exposes available Canvas/Grid operations; Toolbox inserts actual supported controls. Artboard zoom/pan/grid/snapping and multi-selection use logical coordinates. Text, designer and refactor changes share preimage-checked history where integrated.\n\nCanvas sibling operations and Grid track/cell tools have different compatibility rules. Template/generated instances, computed assignments and ambiguous C# ownership require source editing or additional analysis rather than silent rewrites. Straight-line C# aliases/final literal writes are not unrestricted control-flow analysis.\n\nEnable hot reload for compatible method/property/tree/environment changes. Constructor/type-shape or unsupported structural changes must report restart requirements. Cancelling a gesture, encountering stale source or failing a patch must leave the prior source/app coherent.\n\n'
    ide += '## Review changes and restore symbols\n\nUse the available change-review/refactor tools for multi-file operations: inspect the proposed diff and diagnostics, apply only if every preimage is current, and retain grouped undo. For Symbols & Sources, preview candidate requests first, approve symbol servers and source origins separately, and attach only validated bytes to an unchanged library record. Network/authentication/CORS and format limitations remain explicit.\n\n'
    ide += '## Offline, persistence and release\n\nStandalone IDE/application exports use the same tested build inputs. Development exports may include original source maps and debugging controls; rebuild in release before distributing source-free output. Persistence failures need visible session-only behavior, not a false Saved indicator. Source/binary workspaces, layouts and debugger tasks have different lifetimes and must not be merged accidentally.\n\nSee [compatibility](compatibility.md), [security](security-and-trust.md), [verification](build-and-verification.md), and [remaining desktop work](remaining-work.md). Full desktop editing/refactoring/project tooling is not declared equivalent to Visual Studio or Rider merely because the layout resembles them.\n'
    write('docs/ide-guide.md', ide)

    verify = '# Build, verification and evidence\n\n' + stamp
    verify += '## Exact repository scripts\n\nThe following is generated from the audited package.json, avoiding stale command names:\n\n' + script_names(package) + '\n\n'
    engines = package.get('engines', {})
    verify += 'Declared engines: `' + json.dumps(engines, ensure_ascii=False) + '`. Read the canonical workflow for exact CI Node/.NET/Python/browser setup. Do not claim arbitrary Node or browser versions were tested.\n\n'
    verify += '## Local development sequence\n\nRun the package unit test, example gate, static build and syntax-check scripts that appear above. For browser verification, use the same Playwright dependency/browser version and discovery command as [toolchain.yml](../.github/workflows/toolchain.yml). SDK/Windows reference builders execute repository-owned fixture source only; conversion of user inputs must not execute those user binaries or package tasks.\n\n'
    verify += '## Acceptance layers are different\n\n| Layer | What it proves | What it does not prove |\n| --- | --- | --- |\n| Source/entrypoint inventory | Code is present at an exact revision | Correct or full semantics |\n| Committed test file | An acceptance case has been authored | A test run passed |\n| Fixture builder + CLR oracle | An original SDK/Windows binary and independent expectation exist | JavaScript conversion passed |\n| Compiler/runtime tests | Their specific positive/negative profile passed | Arbitrary .NET/Avalonia compatibility |\n| Browser tests | Actual tested interactions/rendering/debugging worked | Full upstream catalog or every browser/GPU |\n| Canonical verify job | Its declared suite passed for its head SHA | A later or different revision passed |\n| Pages deploy job | That verified artifact was deployed | Unimplemented features became compatible |\n\n'
    verify += '## Current audit evidence\n\nSee [current-status.md](current-status.md) and [audit/evidence.json](audit/evidence.json). Local gate receipts record command, exit status and parsed summary only when actually executed. Historical milestone test totals stay attached to their historical scope, not the current suite. Full browser/CLR verification of the final documentation revision is recorded by the canonical Actions run after publication.\n\n'
    verify += '## Required regression coverage\n\nEvery compiler feature needs positive and negative parsing/binding/verification/execution cases and independent semantics where applicable. Every control/layout change needs real interaction and, where relevant, rendered-image/pixel evidence. Every runtime feature needs lifecycle/error/cancellation tests. Every capability needs source-map/debugger, designer editability and reload/disposal coverage or an explicit blocking gap.\n\nThe strict whole-ControlCatalog gate must consume the complete pinned original project input manifest. Selected unchanged-page tests and source hashes remain valuable but cannot set the full-project pass flag. Test failure must never be converted into a warning or excluded page merely to improve the reported pass count.\n\n## Documentation checks\n\n```sh\npython scripts/reconcile-documentation-20260910.py --check\n```\n\nThe check validates authored Markdown local targets/anchors, stable requirement IDs, traceability evidence links and current manifest files. It preserves vendored/upstream/license documents unchanged. External URLs are references; this check does not claim to have verified their availability. See [documentation maintenance](documentation-maintenance.md).\n'
    write('docs/build-and-verification.md', verify)

    security = '# Security, trust and execution boundaries\n\n' + stamp
    security += '## Imported code and browser isolation\n\nApplication source, IL, managed binaries and package contents are untrusted inputs. They must not run in the IDE origin. The runtime preview uses its explicit sandbox, CSP and message validation code; an opaque origin alone does **not** block network access. Verify the actual policy and sender-window/per-session-channel checks when changing previews or keyboard/command relays. This documentation is not a complete adversarial-security audit or production certification.\n\n'
    security += '## Symbols and source restoration\n\nParsing a PDB, CodeView path, Source Link map or source-server record never grants filesystem/network permission. The restoration path requires consent, approved symbol endpoints and separately approved source origins, credentials omitted, no redirect-following, streaming size/request/timeout budgets and cancellation. Browser CORS/authentication/server behavior may still make an approved endpoint unavailable. Do not execute native source-server scripts or arbitrary package/build tasks.\n\nPDB identities, CRC and legacy MD5 document checksums match data; they do not authenticate a publisher or establish that code is safe to execute. Validate the DLL/PDB pair, metadata/method/local ranges and exact original-source byte checksum before exposing source. Attach only if the selected workspace DLL record remains unchanged.\n\n'
    security += '## Source disclosure and release output\n\nDevelopment source maps, PDB embedded sources, symbol attachments, saved workspaces and debug exports can contain original code. Release compilation must omit emitted debug hooks/continuations and original-source maps according to its profile. That claim is separate from whether dormant development helper modules remain in the runtime bundle. Never describe all bundle tooling bytes as stripped without checking the actual artifact.\n\n'
    security += '## Data mutation and cancellation\n\nDesigner/refactor operations use preimages and bounded transactions. Hot reload owns a limited set of property stores, method descriptors, names, children and subscriptions; it cannot magically reverse arbitrary external side effects of user callbacks. Construction cancellation must dispose partial trees and unwind generators. Debugger cancellation must preserve finally/fault/type-initialization semantics for the supported profile without corrupting competing tasks.\n\n'
    security += '## User work and repository publication\n\nDo not overwrite dirty local work or newer remote source when recovering a stage. A saved blob or patch is evidence to reconcile, not proof it belongs on the current branch. Use ordinary commits, explicit source checks and non-forced publication. Never print credentials, upload runtime font files or execute imported binary code merely to inspect it.\n\n## Verification still required\n\nKeep malformed-input, memory/expansion, path traversal, message-origin, source-checksum, archive, cancellation, session isolation and release-disclosure tests in the canonical pipeline. A bounded reader or a passing happy-path test is not unrestricted hostile-input safety.\n'
    write('docs/security-and-trust.md', security)

    core = '# Mandatory core development tools contract\n\n' + stamp
    core += 'Debugging, visual design, source identity, hot reload and lifecycle cleanup are mandatory parts of every compiler/runtime/control increment. They are not optional plugins to add after compatibility work. The [full requirements](requirements.md) preserve the requested end state; the [current status](current-status.md) identifies implemented profiles and actual evidence.\n\n'
    core += '## Debugger obligations\n\nEmit original source/IL identity, distinguish executable/bound from unbound locations, preserve ordinary semantics in native and cooperative modes, and validate actual frame/local mutation. Source constructors/XAML, library calls, SDK state machines, callbacks and lazy construction must each have declared suspension coverage. Cancellation, exception cleanup, static initialization and competing tasks are core semantics. Release source disclosure/instrumentation must be separately tested.\n\n'
    core += '## Designer obligations\n\nEvery control needs runtime/source identity, inspectable properties and explicit editability. Preserve unrelated source and expressions. Use one atomic, preimage-checked change history across text, designer and refactor edits. Alias/final-write support does not imply arbitrary control-flow/interprocedural analysis. Ambiguous/generated/template instances must be labeled and refused rather than rewritten incorrectly.\n\n'
    core += '## Reload obligations\n\nDocument whether each new feature supports in-place update, reconstruction with state handling, or restart. Validate every affected owner/name/subscription/method/debug site before mutating live state. Reject stale results. Keep the last working application after failed builds or incompatible edits. Test rollback, repeated updates and exceptional disposal; explicitly state external side effects that are outside rollback ownership.\n\n'
    core += '## IDE obligations\n\nExpose real commands and controller-backed tool windows through the menu registry, palette and docking system. Source and binary contexts remain isolated even when they share presentation. Views can move/close/reopen without duplicating controllers or losing sessions. Keyboard, touch, focus and narrow-screen non-occlusion are acceptance requirements. No permanent informational sidebar or monolithic inspector substitutes for integrated tools.\n\n'
    core += '## Definition of done for a capability\n\nA change needs implementation in canonical reusable libraries; positive/negative and real-browser acceptance; independent managed semantics where applicable; source mapping/debug behavior; designer editability; reload/disposal coverage; exact committed/tested/deployed evidence; and requirements/status/docs updates. A missing integration is a blocking tracked gap, not a silently omitted condition. Full product completion additionally requires the whole unchanged ControlCatalog and complete declared compatibility profile.\n'
    write('docs/core-development-tools.md', core)

    remaining = '# Remaining work to the full requested solution\n\n' + stamp
    remaining += '**The work below remains part of the contract.** It is not removed from scope because current versions implement narrower profiles. Priorities describe dependencies, not promised completion dates or unsupported effort estimates. Completed profile work remains recorded in [completed work](completed-work.md); each remaining area is mapped to [stable requirements](requirements.md).\n\n'
    remaining += '## P0 — Establish the strict whole-project target\n\nPin the requested Avalonia fork/revision and capture all original ControlCatalog solution/project inputs, transitive dependencies, assets, themes and generated inputs. Run the existing source/binary pipeline against this whole manifest and publish blockers by original file/feature. Keep selected-page success separate. Build a strict gate that fails on any excluded/replaced page, suppressed unsupported diagnostic, missing dependency or required behavior. Do not set fullControlCatalogPassed from an example count or source-preservation check.\n\n'
    remaining += '## P0 — Finish compiler/runtime prerequisites\n\nUse the blocker inventory to extend binding/type resolution, overloads/conversions, managed reference and value semantics, generics/constraints, framework calls and SDK async/iterator state-machine lowering. For ref/out, use the owned reference fixtures but also implement and compare actual address/indirection/alias/lifetime behavior in all claimed modes. For SDK async, test independently built Debug/Release DLLs and packages with multiple awaits, nested callers, cancellation and failure/cleanup; source C# async tests are not the same gate.\n\n'
    remaining += '## P0 — Finish UI/XAML behavior against real inputs\n\nComplete required control families, measurement/arrangement, data/selection/virtualization, binding modes and relative/template binding, selectors/property precedence, resources/templates and browser platform adapters. Add interaction and rendered-image checks for upstream expectations with explicit tolerances. Identify HTML/SVG/WebGPU backend ownership and fallback/device-loss/performance behavior without relabeling SVG as GPU output.\n\n'
    remaining += '## P0 — Generalize safe designer and debug/reload behavior\n\nExtend imperative C# ownership analysis beyond straight-line aliases/final literals into branches, loops, escapes, callbacks and interprocedural construction. Preserve source and references across every edit. Expand general layout/constraint/template/binding editing instead of forcing coordinates. Complete resumable accessor/callback/lazy-resource/template construction where required. Expand state-machine/managed-reference debugger semantics and retained frame/site handling. Define safe reload or explicit restart for every new feature, with cancellation/rollback/disposal evidence.\n\n'
    remaining += '## P1 — Complete symbol format/restoration profiles\n\nMaintain the delivered portable, embedded-portable, managed MSF7/C13 and explicitly approved restoration routes. Extend legacy/native profiles only with format-specific decoders and independent Windows/compiler evidence. Native machine-code symbols do not imply native execution support. Server authentication/CORS, source-server formats, symbol packages and unsupported embedded data need explicit permission and validated behavior; no automatic script execution or guessed source.\n\n'
    remaining += '## P1 — Continue desktop IDE parity\n\nExtend measured editor/language-service depth, semantic refactoring, reliable project/dependency/configuration workflows, test/profiling integrations, document/diff navigation, accessibility and performance. Preserve genuine menu/docking/window/session integration and existing designer/debugger features. Add each capability to the command registry and acceptance matrix, not decorative controls or text-only panels. Treat multi-caret/advanced editing and general language-server behavior as explicit tasks rather than inferred from syntax highlighting/completion.\n\n'
    remaining += '## P0 — Final acceptance and release\n\nRun full declared language/framework conformance, whole upstream application compile/link/run, all page navigation/interaction/rendering gates, representative source/binary debugging, safe designer edits and state-preserving reload, repeated lifecycle stress and standalone export. Record exact source/tool/browser/OS/GPU profiles. Publish only after the canonical verify and Pages jobs pass for the final committed revision; keep limitations and unresolved issues visible until their gates actually pass.\n\n'
    remaining += '## Requirement-group backlog\n\n| Priority | Group | Work not established as full acceptance | Evidence needed to close |\n| --- | --- | --- | --- |\n'
    for g in groups:
        remaining += f'| {g["priority"]} | {g["id"]} | {g["remaining"]} | All criteria for the group in [requirements](requirements.md), original-input provenance and exact passing acceptance artifacts. |\n'
    remaining += '\n## Handoff rules\n\nA future round starts from a fresh read of main, current source and CI. Preserve dirty local work and staged transport data separately; reconcile instead of overwriting. Select the next concrete blocker, implement reusable semantics, add independent and browser/tooling tests, update this record, and publish granularly. A partial milestone must state what changed and what remains; it must not repeat obsolete exclusions that current source has already closed.\n'
    write('docs/remaining-work.md', remaining)
    write('docs/roadmap.md', '# Roadmap to the complete browser development system\n\n' + stamp + 'The roadmap retains the original full product expectation; it is not a list of capabilities assumed complete because an initial subset ships.\n\n| Order | Deliverable | Dependencies and exit gate |\n| --- | --- | --- |\n| 1 | Reproducible unchanged whole-ControlCatalog input and blocker inventory | Requested upstream fork/revision, original project/source/dependencies, no suppressed failures |\n| 2 | Missing language/type/runtime and project-linking semantics | Independent source/IL/CLR cases, negative diagnostics and shared source/binary behavior |\n| 3 | Complete required XAML, controls, layout, data and platform behavior | Original page/application interaction and rendered-reference gates |\n| 4 | General safe C# visual round-trip and full required debug/reload coverage | Ownership/control-flow analysis, actual continuations, transactional lifecycle evidence |\n| 5 | Remaining symbols and professional IDE depth | Format-specific validation, consent-based restoration, real integrated command/window/editor workflows |\n| 6 | Full-profile release and ongoing conformance | Entire unchanged application and declared language/framework profile pass, offline artifacts and exact CI/deployment provenance |\n\nDebugger, designer, reload, accessibility and documentation work runs alongside every stage rather than waiting for stage 4 or 5. See [full requirements](requirements.md), [current implementation](current-status.md), [completed work](completed-work.md), [detailed remaining work](remaining-work.md) and [acceptance plan](acceptance-plan.md).\n')
    write('docs/mandatory-targets-status.md', '# Mandatory targets: current status and acceptance\n\n' + stamp + 'The canonical contract is [requirements.md](requirements.md); the source-grounded status is [current-status.md](current-status.md); implementation/test paths are in [requirements-traceability.md](requirements-traceability.md). This replaces recovery-era assumptions with an exact audit snapshot.\n\n| Mandatory target | Current interpretation | Still required for full acceptance |\n| --- | --- | --- |\n| Complete unchanged ControlCatalog | Selected original-page and curated-example gates are distinct scopes | Complete pinned original project compile/link/construction/navigation/interaction/rendering and tooling evidence |\n| General C# visual round-tripping | Source-preserving initializer and supported flow/alias editing is a profile | Safe arbitrary supported control-flow/interprocedural ownership and reference-preserving edits |\n| Resumable construction and debugging | Source/XAML/MSIL continuation paths must be read from current code/tests | Remaining required callbacks/accessors/lazy construction and full SDK state-machine semantics |\n| Full declared C#/.NET/Avalonia compatibility | Reusable compilers/runtime implement tested profiles | Complete versioned language/type/framework/project/UI acceptance without suppressed diagnostics |\n| Symbols and restoration | Portable/embedded/native-managed profiles and explicit restoration are separately evidenced | Remaining formats/servers/authentication/embedded/async metadata under explicit safety and correctness gates |\n| Desktop IDE parity | Operational menus/docking/windows/editor/designer/debugger integration is not merely a mockup | Advanced semantic/editor/project/tooling/accessibility/performance coverage measured against requirements |\n\nNo target is declared complete by an uploaded blob, fixture-generation success, unrelated test count or this documentation revision. Historical recovery commits and milestone test totals are preserved in the [work record](completed-work.md) and individually annotated milestone notes. The [remaining plan](remaining-work.md) gives dependencies and exit criteria, while [core-development-tools.md](core-development-tools.md) keeps debugging/design/reload obligations mandatory in every implementation increment.\n')

    acceptance = '# Final acceptance plan and required evidence\n\n' + stamp
    acceptance += '## Gate definitions\n\n| Gate | Required inputs | Required result/artifact | Failure must not be hidden by |\n| --- | --- | --- | --- |\n| Full source/project | Versioned original solutions/projects, all source/resources/dependencies | Evaluated input manifest and successful diagnostics-free supported compilation/link report | Excluded failing files, substituted projects, stubbed APIs |\n| Managed semantics | Independently built source/Debug DLL/Release DLL/NuGet fixtures and CLR oracle | Values, errors, state and cleanup agree in every claimed release/native/cooperative mode | Fixture generation alone or source rewriting |\n| Full unchanged ControlCatalog | Entire pinned requested upstream application | All required page construction/navigation/interaction/rendering and source hashes | A curated catalog, isolated page or host adapter alone |\n| Designer | Real source-created/XAML-created runtime tree and original source | Correct edit target, minimal source diff, reference/name/ownership integrity and atomic undo | Editing a screenshot, guessed aliases or protected bindings |\n| Debugger | Actual source/IL/PDB locations and suspended compiled invocations | Pause/step/cancel, actual frame/local mutation and correct resumed behavior | Synthetic pause notifications, invented source or unrelated native traces |\n| Hot reload | Working stateful app and supported/incompatible/invalid edits | Compatible identity/state retained; incompatible/failed edit rejected or rolled back | Reconstructing everything without disclosure or partial state mutation |\n| Rendering/platform | Versioned browser/backend/layout/input reference profile | Pixel/interaction/accessibility/performance/lifecycle evidence with explicit tolerance | Counting elements/API names as rendering parity |\n| Symbols/restoration | Exact DLL/PDB/source identities and explicit endpoint consent | Bounded verified attachments; no unapproved I/O, stale writes or source substitutes | Identity matching treated as publisher trust |\n| IDE/offline | Generated hosted and offline build from same committed source | Operational menus/windows/commands/session isolation, usable layout and offline execution | Decorative panels or silent external runtime requirements |\n| Publication | Exact final source SHA and canonical workflow | Successful verify and deploy jobs with artifact/source provenance | Prior ancestor success, queued workflow or an unverified push |\n\n'
    acceptance += '## Evidence package\n\nRecord input revision/manifests/hashes, runtime/compiler versions, browser/OS/GPU profile, command lines, exit statuses, original output expectations, actual output, negative cases, source maps/locations, screenshots or pixel assertions, lifecycle/cancellation checks and artifact identities. Store fixture provenance separately from conversion results. Retain meaningful failures and blocker lists rather than silently weakening a gate.\n\n'
    acceptance += '## Completion decision\n\nA requirement closes only when its complete declared criterion is covered, its canonical implementation is committed and its exact acceptance evidence is available. A group cannot close because a narrower requirement passed. Full solution acceptance requires all mandatory groups plus unchanged whole-ControlCatalog success. Until then publish versioned profiles and honest remaining work.\n'
    write('docs/acceptance-plan.md', acceptance)

    maintenance = '# Documentation maintenance and audit procedure\n\n' + stamp
    maintenance += '## Sources of truth\n\nThe user-approved requirements are recorded in [the requirements contract](requirements.md) and its [machine-readable source](audit/requirements-contract-20260910.json). Current implementation means ordinary source on a verified revision. Tests and CI establish only their actual scope. Chat summaries, uploaded blobs and historical milestone prose are not substitutes for a fresh source/CI audit.\n\n'
    maintenance += '## Document roles\n\nCanonical current guides are indexed in [README.md](README.md). Specialized notes retain detail and link to current guides. Milestone documents preserve historical design decisions/evidence and are explicitly marked historical; their old Remaining/Unsupported lists and test counts are not current global status. Vendored/upstream/license documents remain byte-identical. [documentation-index.json](audit/documentation-index.json) records every Markdown file reviewed and its role.\n\n'
    maintenance += '## Reconciliation command\n\n```sh\npython scripts/reconcile-documentation-20260910.py\npython scripts/reconcile-documentation-20260910.py --check\n```\n\nRun in a clean checkout of the intended main revision. The auditor records exact implementation hashes, current module/export/script inventory, requirements, source/test paths and available hosted CI evidence; it rewrites canonical guides and adds current-applicability notices to authored historical/specialized notes. It does not implement missing code or mark full targets complete. Review semantic changes in code/tests and adjust the contract/profile descriptions before treating a generated audit as sufficient.\n\n'
    maintenance += '## Granular publication\n\n`--commit` creates focused documentation commits after source/contract/link checks, using only the enumerated documentation paths. The audit script and requirement source should already be committed. The workflow preserves evidence, pushes without force and invokes canonical CI for the final documentation head. Concurrent source changes stop publication rather than being overwritten. The final run receipt is an Actions artifact; no document invents its own future successful deployment.\n\n'
    maintenance += '## Required updates with implementation changes\n\nUpdate the relevant stable requirement mapping, present capability/limit, canonical API/architecture or UI guide, remaining task and acceptance tests. Keep historical results clearly dated and add supersession notes when a later stage closes an old limitation. Verify local Markdown paths/anchors and source fingerprints, and report any explicit documentation exclusions. Never copy all old test totals into a current status table.\n'
    write('docs/documentation-maintenance.md', maintenance)

    root_readme = '# Jailbreak\n\nBrowser-native C#, Avalonia XAML and managed IL to JavaScript compilers, reusable runtime/UI libraries, and an integrated desktop-style browser IDE.\n\n**Expected end state:** existing applications and the complete unchanged ControlCatalog from `wieslawsoltes/Avalonia` compile and run in the browser with professional editing, visual design, debugging and state-preserving hot reload. **The full target is not declared complete.** Current supported profiles and exact evidence are documented rather than hidden behind empty API stubs or renamed examples.\n\n'
    root_readme += '## Documentation\n\n[Documentation index](docs/README.md) · [Full requirements](docs/requirements.md) · [Current status](docs/current-status.md) · [Implemented work](docs/completed-work.md) · [Remaining work](docs/remaining-work.md) · [Architecture](docs/architecture.md) · [IDE guide](docs/ide-guide.md) · [Build and verification](docs/build-and-verification.md)\n\n'
    root_readme += '## Development system\n\nSource/project evaluation feeds the C# and XAML compilers. The verified binary route reads real PE/CLI DLLs/EXEs and IL text, validates packages and emits JavaScript with shared managed/runtime operations. Optional verified symbols and cooperative continuations feed the integrated debugger. HTML/SVG and explicitly implemented WebGPU paths have distinct rendering roles.\n\nThe IDE exposes actual source/design/binary perspectives, Solution Explorer, editor/language-service tools, menus/command palette and independent docked/floating/auto-hidden tool windows. Designer source transactions, change review, debugging, hot reload and explicit symbol restoration share the real underlying libraries. Informational compatibility/getting-started panes are not a substitute for these tools.\n\n'
    root_readme += '## Build and test\n\nUse the declared engine versions and exact npm scripts in [the build guide](docs/build-and-verification.md). The canonical [toolchain workflow](.github/workflows/toolchain.yml) governs unit/example/browser/CLR checks and Pages deployment. The browser IDE and standalone exports must be built from the same verified source.\n\n'
    root_readme += '## Contribution and acceptance\n\n[Core development-tool obligations](docs/core-development-tools.md) apply to every compiler/control/runtime change. Use real upstream inputs, independent managed reference results, actual browser interactions and source/disposal/error tests. Preserve user work; publish ordinary, granular commits without force-overwriting concurrent source.\n\n[Compatibility](docs/compatibility.md) and [security/trust](docs/security-and-trust.md) distinguish tested profiles from full language/framework support, symbol matching from authentication, debug source disclosure from release output, and committed source from passing deployment. Historical milestones remain indexed with current-applicability notices.\n'
    write('README.md', root_readme)

    notice_updates = []
    for name in old_docs:
        if name in CANONICAL or protected(name):
            continue
        content = text(name)
        content = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\s*', '', content, flags=re.S)
        historical = Path(name).name.startswith('milestone-') or '/milestones/' in name
        role = 'Historical milestone' if historical else 'Specialized guide / example'
        note = f'{BEGIN}\n> **{role}; current applicability audited {timestamp[:10]}.** '
        if historical:
            note += 'The implementation details and test totals below record this milestone, not the complete present-day product. Its old remaining/unsupported lists and UI instructions may have been superseded. '
        else:
            note += 'This document is a specialized profile/example, not a full-solution completion claim. '
        note += 'Use ' + rel_link(name, 'docs/current-status.md', 'current source and CI status') + ', ' + rel_link(name, 'docs/requirements.md', 'full requirements') + ', and ' + rel_link(name, 'docs/remaining-work.md', 'remaining acceptance work') + ' for the current global contract.\n> '
        note += 'The current IDE uses real menus, a command palette and independent docked tool windows; old combined-inspector or informational-sidebar workflows are historical. See ' + rel_link(name, 'docs/ide-guide.md', 'the integrated IDE guide') + '. '
        note += 'Source/XAML/MSIL cooperative debugging, constructor chaining, structural/environment reload, native-managed symbols and explicit symbol restoration each have current implementation/test profiles; do not infer their absence from an earlier milestone exclusion, or infer unrestricted compatibility from their presence.\n' + END + '\n\n'
        first = re.search(r'^#\s+.*(?:\n|$)', content, re.M)
        if first:
            content = content[:first.end()] + '\n' + note + content[first.end():].lstrip('\n')
        else:
            content = note + content
        if historical:
            content = re.sub(r'^(#{2,6}\s+)(Remaining(?:\s+[^\n]*)?)$', lambda m: m.group(1) + re.sub(r'(?: \(at this milestone\))+$', '', m.group(2)) + ' (at this milestone)', content, flags=re.M)
        write(name, content)
        notice_updates.append(name)

    hub = '# Jailbreak documentation\n\n' + stamp
    hub += 'Start with the expected finished solution, then read actual implementation/evidence and the remaining acceptance plan. The current guides below take precedence over historical milestone status statements. Source and tests remain the authority for precise supported behavior.\n\n| Question | Current guide |\n| --- | --- |\n| What exactly was requested? | [Full requirements](requirements.md) and [traceability](requirements-traceability.md) |\n| What is in the audited source and what passed? | [Current status](current-status.md), [completed work](completed-work.md), [evidence JSON](audit/evidence.json) |\n| What is still needed for the full solution? | [Remaining work](remaining-work.md), [roadmap](roadmap.md), [mandatory target status](mandatory-targets-status.md) |\n| How is the reusable system organized? | [Architecture](architecture.md), [API entrypoints](api-reference.md), [binary routes](binary-entrypoints.md) |\n| How do I use the current integrated IDE? | [IDE guide](ide-guide.md) |\n| Which profiles and trust boundaries apply? | [Compatibility](compatibility.md), [security/trust](security-and-trust.md) |\n| How is correctness established? | [Build and verification](build-and-verification.md), [acceptance plan](acceptance-plan.md) |\n| What is mandatory for every implementation increment? | [Core development tools](core-development-tools.md), [documentation maintenance](documentation-maintenance.md) |\n\n'
    hub += f'The contract contains **{len(ids)} stable requirements in {len(groups)} groups**. A requirements inventory is not a completed-feature count.\n\n## Historical milestones and specialized records\n\nThese documents retain implementation detail and original evidence. Their current-applicability notices prevent old exclusions, test totals, recovery uncertainty and retired UI instructions from being mistaken for current global status.\n\n| Document | Role |\n| --- | --- |\n'
    for name in sorted(n for n in authored_md() if n.startswith('docs/') and n not in CANONICAL and not protected(n)):
        role = 'Historical milestone' if Path(name).name.startswith('milestone-') else 'Specialized guide'
        hub += '| ' + rel_link('docs/README.md', name, title_of(name)) + ' | ' + role + ' |\n'
    hub += '\nThe complete Markdown coverage/exclusion record is [documentation-index.json](audit/documentation-index.json). Upstream/vendor/license documents are intentionally preserved instead of rewriting provenance material.\n'
    write('docs/README.md', hub)

    # This index is linked by current guides and is finalized after link reconciliation.
    if not (ROOT / 'docs/audit/documentation-index.json').exists():
        dump('docs/audit/documentation-index.json', {'baseline': baseline, 'documents': [], 'status': 'generation in progress'})
    repairs = repair_and_check_links(repair=True)
    final_check = repair_and_check_links(repair=False)
    dump('docs/audit/link-check.json', {**final_check, 'repairs': repairs['repairs'], 'baseline': baseline, 'audited_at': timestamp})
    index = []
    for name in authored_md():
        role = ('preserved-upstream-vendor-license' if protected(name) else 'canonical-current-guide' if name in CANONICAL else 'historical-milestone' if Path(name).name.startswith('milestone-') else 'specialized-guide-or-example')
        index.append({'path': name, 'role': role, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest(),
                      'treatment': 'Preserved byte-for-byte' if protected(name) else 'Current guide regenerated against source/evidence' if name in CANONICAL else 'Detailed content preserved; current-applicability and supersession notice added; stale local links reconciled'})
    dump('docs/audit/documentation-index.json', {'baseline': baseline, 'audited_at': timestamp, 'documents': index, 'count': len(index)})
    if final_check['errors']:
        raise RuntimeError('Documentation link validation failed: ' + json.dumps(final_check['errors'][:20]))
    return {'baseline': baseline, 'requirements': len(ids), 'groups': len(groups), 'documents': len(index), 'notices': notice_updates,
            'link_repairs': repairs['repairs'], 'source_fingerprint': snapshot['aggregate_sha256']}

def check() -> dict:
    result = repair_and_check_links(False)
    spec = json.loads(SPEC.read_text())
    ids = [r[0] for g in spec['groups'] for r in g['requirements']]
    if len(ids) != len(set(ids)):
        result['errors'].append({'reason': 'duplicate requirement IDs'})
    for ident in ids:
        if ident not in text('docs/requirements.md') or ident not in text('docs/requirements-traceability.md'):
            result['errors'].append({'reason': 'unmapped requirement', 'id': ident})
    for name in CANONICAL:
        if not (ROOT / name).is_file():
            result['errors'].append({'reason': 'missing canonical guide', 'path': name})
    index_file = ROOT / 'docs/audit/documentation-index.json'
    if not index_file.is_file():
        result['errors'].append({'reason': 'missing documentation audit index'})
    else:
        index = json.loads(index_file.read_text())
        indexed = {d['path'] for d in index['documents']}
        for name in authored_md():
            if name not in indexed:
                result['errors'].append({'reason': 'unaudited Markdown file', 'path': name})
    evidence_file = ROOT / 'docs/audit/evidence.json'
    if evidence_file.is_file():
        evidence = json.loads(evidence_file.read_text())
        for group in evidence.get('evidence', {}).values():
            for name in group['implementation'] + group['tests']:
                if not (ROOT / name).is_file():
                    result['errors'].append({'reason': 'missing implementation/test evidence', 'path': name})
    if result['errors']:
        raise RuntimeError(json.dumps(result['errors'][:30], ensure_ascii=False))
    return {**result, 'requirement_count': len(ids), 'result': 'passed'}

def commit_changes(result: dict) -> list[dict]:
    changed = set(git('diff', '--name-only').splitlines()) | set(git('ls-files', '--others', '--exclude-standard').splitlines())
    allowed = {p for p in changed if p.endswith('.md') and not protected(p)} | {p for p in changed if p.startswith('docs/audit/') and p.endswith('.json')}
    unexpected = changed - allowed
    if unexpected:
        raise RuntimeError('Unrelated local work is not being committed: ' + ', '.join(sorted(unexpected)))
    if git('diff', '--cached', '--name-only'):
        raise RuntimeError('Index must be clean; unrelated staged work is preserved')
    batches = [
      ('docs(requirements): define full solution acceptance and mandatory development tooling', {'docs/requirements.md', 'docs/requirements-traceability.md', 'docs/core-development-tools.md'}),
      ('docs(status): reconcile implemented profiles with exact source and CI evidence', {'docs/current-status.md', 'docs/completed-work.md', 'docs/compatibility.md', 'docs/audit/source-inventory.json', 'docs/audit/evidence.json'}),
      ('docs(guides): align architecture APIs IDE and verification with current implementation', {'docs/architecture.md', 'docs/api-reference.md', 'docs/binary-entrypoints.md', 'docs/ide-guide.md', 'docs/build-and-verification.md', 'docs/security-and-trust.md'}),
      ('docs(roadmap): retain full mandatory backlog and explicit completion gates', {'docs/remaining-work.md', 'docs/roadmap.md', 'docs/mandatory-targets-status.md', 'docs/acceptance-plan.md'}),
      ('docs(history): reconcile superseded milestones examples and documentation navigation', allowed)
    ]
    commits = []
    for message, paths in batches:
        selected = sorted(allowed.intersection(paths))
        if not selected:
            continue
        git('add', '--', *selected)
        git('commit', '-m', message)
        commits.append({'sha': git('rev-parse', 'HEAD'), 'message': message, 'paths': selected})
        allowed.difference_update(selected)
    if allowed or git('status', '--porcelain'):
        raise RuntimeError('Documentation worktree is not clean after focused commits')
    return commits

def record_gate(name: str, args: list[str]) -> None:
    if not args:
        raise RuntimeError('A gate command is required')
    path = Path(os.environ.get('JAILBREAK_DOCS_CHECKS', '/tmp/jailbreak-documentation-checks.json'))
    path.parent.mkdir(parents=True, exist_ok=True)
    receipts = json.loads(path.read_text()) if path.exists() else []
    log = path.parent / ('jailbreak-docs-' + re.sub('[^a-zA-Z0-9_-]', '-', name) + '.log')
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    with log.open('w') as stream:
        run = subprocess.run(args, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, text=True, timeout=1200)
    content = log.read_text(errors='replace')
    counts = {k: int(v) for k, v in re.findall(r'^# (tests|pass|fail|cancelled|skipped) ([0-9]+)$', content, re.M)}
    receipts.append({'name': name, 'command': args, 'source_sha': git('rev-parse', 'HEAD'), 'started_at': started,
                     'exit_code': run.returncode, 'summary': counts, 'log_file': log.name})
    path.write_text(json.dumps(receipts, indent=2) + '\n')
    print(content[-6000:])
    if run.returncode:
        raise RuntimeError('Gate failed: ' + name)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--commit', action='store_true')
    parser.add_argument('--record-gate')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.record_gate:
        record_gate(args.record_gate, args.command[1:] if args.command[:1] == ['--'] else args.command)
        return
    if args.check:
        print(json.dumps(check(), ensure_ascii=False, indent=2))
        return
    if args.commit and git('status', '--porcelain'):
        raise RuntimeError('Start from a clean checkout; this auditor does not overwrite unrelated local work')
    result = generate()
    result['documentation_check'] = check()
    if args.commit:
        result['commits'] = commit_changes(result)
    receipt = Path(os.environ.get('JAILBREAK_DOCS_RECEIPT', '/tmp/jailbreak-documentation-result.json'))
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
