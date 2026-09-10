"""Offline regression coverage for the documentation publication pipeline.

All generation, migrations and commits use temporary repositories. No test calls
GitHub, modifies the real checkout, or treats a fixture as compatibility evidence.
"""
from contextlib import contextmanager
import ast
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
AUDITOR = 'scripts/reconcile-documentation-20260910.py'
HARDENER = 'scripts/harden-documentation-audit-20260910.py'


def command(root, *args, check=True):
    result = subprocess.run(args, cwd=root, text=True, capture_output=True, timeout=120)
    if check and result.returncode:
        raise AssertionError(f'{args}:\n{result.stdout}\n{result.stderr}')
    return result


@contextmanager
def checkout():
    """Copy only tracked input files, including current reviewed working edits."""
    with tempfile.TemporaryDirectory(prefix='jailbreak-docs-test-') as directory:
        root = Path(directory)
        names = command(ROOT, 'git', 'ls-files', '-z').stdout.split('\0')
        for name in filter(None, names):
            source = ROOT / name
            if source.is_file() and not source.is_symlink():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        # New tests can also run before they have been staged by the developer.
        for name in (AUDITOR, HARDENER):
            shutil.copy2(ROOT / name, root / name)
        command(root, sys.executable, HARDENER)
        command(root, 'git', 'init', '-q')
        # Do not let detached Git maintenance race TemporaryDirectory cleanup.
        for key, value in [('gc.auto', '0'), ('maintenance.auto', 'false'),
                           ('gc.autoDetach', 'false'), ('maintenance.autoDetach', 'false')]:
            command(root, 'git', 'config', '--local', key, value)
        command(root, 'git', 'config', 'user.name', 'Documentation test')
        command(root, 'git', 'config', 'user.email', 'test@localhost')
        command(root, 'git', 'add', '-f', '.')
        command(root, 'git', 'commit', '-qm', 'Isolated documentation fixture')
        spec = importlib.util.spec_from_file_location('isolated_auditor', root / AUDITOR)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.gh_json = lambda _: {'audit_error': 'Intentionally offline regression test.'}
        with patch.dict(os.environ, {
            'JAILBREAK_DOCS_CHECKS': str(root / '.git/checks.json'),
            'JAILBREAK_DOCS_RECEIPT': str(root / '.git/receipt.json'),
        }):
            yield root, module


class DocumentationAuditTests(unittest.TestCase):
    def test_temporary_repositories_disable_detached_maintenance(self):
        with checkout() as (root, _):
            for key, value in [('gc.auto', '0'), ('maintenance.auto', 'false'),
                               ('gc.autoDetach', 'false'), ('maintenance.autoDetach', 'false')]:
                self.assertEqual(command(root, 'git', 'config', '--local', '--get', key).stdout.strip(), value)

    def test_recovery_repairs_both_apostrophes_and_is_idempotent(self):
        with checkout() as (root, _):
            path = root / AUDITOR
            fixed = path.read_text()
            broken = fixed.replace("entrypoint\\'s", "entrypoint's").replace(
                "library\\'s symbol file", "library's symbol file")
            with self.assertRaises(SyntaxError):
                ast.parse(broken)
            path.write_text(broken)
            command(root, sys.executable, HARDENER)
            self.assertEqual(path.read_text(), fixed)
            command(root, sys.executable, HARDENER)
            self.assertEqual(path.read_text(), fixed)
            ast.parse(fixed, feature_version=(3, 12))

    def test_ambiguous_recovery_leaves_the_original_file_untouched(self):
        with checkout() as (root, _):
            path = root / AUDITOR
            source = path.read_text().replace(
                'def repair_and_check_links(repair: bool = False) -> dict:',
                'def changed_concurrently(repair: bool = False) -> dict:')
            path.write_text(source)
            result = command(root, sys.executable, HARDENER, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('refusing an ambiguous', result.stderr)
            self.assertEqual(path.read_text(), source)

    def test_full_generation_checks_and_publishes_five_clean_local_commits(self):
        with checkout() as (root, auditor):
            before = {p: (root / p).read_bytes() for p in auditor.authored_md()
                      if auditor.protected(p)}
            source = auditor.source_snapshot(auditor.git('rev-parse', 'HEAD'))
            result = auditor.generate()
            self.assertEqual(result['requirements'], 138)
            self.assertEqual(result['groups'], 13)
            self.assertEqual(auditor.check()['result'], 'passed')
            for name, content in before.items():
                self.assertEqual((root / name).read_bytes(), content, name)
            self.assertIn("entrypoint's supported profile", auditor.text('docs/api-reference.md'))
            self.assertIn("library's symbol file", auditor.text('docs/ide-guide.md'))
            self.assertIn('[documentation-index.json](audit/documentation-index.json)',
                          auditor.text('docs/README.md'))
            self.assertEqual(source['aggregate_sha256'], result['source_fingerprint'])
            commits = auditor.commit_changes(result)
            self.assertEqual(len(commits), 5)
            self.assertEqual(auditor.git('status', '--porcelain'), '')
            after = auditor.source_snapshot(auditor.git('rev-parse', 'HEAD'))
            self.assertEqual(source['aggregate_sha256'], after['aggregate_sha256'])

    def test_repeat_generation_preserves_links_and_single_historical_notices(self):
        with checkout() as (root, auditor):
            auditor.generate()
            historical = root / 'docs/milestone-build-profiles.md'
            first = historical.read_text()
            auditor.generate()
            self.assertEqual(auditor.check()['result'], 'passed')
            self.assertEqual(historical.read_text(), first)
            self.assertEqual(first.count(auditor.BEGIN), 1)
            self.assertNotIn('(at this milestone) (at this milestone)', first)
            self.assertIn('[documentation-index.json](audit/documentation-index.json)',
                          auditor.text('docs/README.md'))

    def test_inline_reference_and_fragment_failures_are_detected(self):
        with checkout() as (root, auditor):
            auditor.generate()
            broken = root / 'docs/broken-ci-fixture.md'
            broken.write_text('# Fixture\n\n[inline](missing-fixture.md)\n'
                              '[reference][ref]\n[ref]: missing-reference.md\n'
                              '[section](README.md#definitely-not-an-anchor)\n')
            errors = auditor.repair_and_check_links()['errors']
            targets = {error.get('target') for error in errors}
            self.assertIn('missing-fixture.md', targets)
            self.assertIn('missing-reference.md', targets)
            self.assertIn('README.md#definitely-not-an-anchor', targets)
            with self.assertRaises(RuntimeError):
                auditor.check()

    def test_commit_refuses_unrelated_implementation_changes(self):
        with checkout() as (root, auditor):
            result = auditor.generate()
            path = root / 'package.json'
            path.write_text(path.read_text() + '\n')
            with self.assertRaisesRegex(RuntimeError, 'Unrelated local work'):
                auditor.commit_changes(result)
            self.assertEqual(auditor.git('diff', '--cached', '--name-only'), '')

    def test_failed_gate_is_recorded_and_not_promoted_to_success(self):
        with checkout() as (_, auditor):
            with self.assertRaisesRegex(RuntimeError, 'Gate failed'):
                auditor.record_gate('failure-fixture', [sys.executable, '-c', 'raise SystemExit(7)'])
            receipt = auditor.gate_receipts()[-1]
            self.assertEqual(receipt['exit_code'], 7)
            self.assertEqual(receipt['source_sha'], auditor.git('rev-parse', 'HEAD'))

    def test_only_tests_and_pages_workflow_remains(self):
        # One-off recovery/publication workflows are retired. Keep this guard
        # against reintroducing source-writing automation or dropping test gates.
        directory = ROOT / '.github/workflows'
        workflows = {p.name for p in directory.iterdir()
                     if p.is_file() and p.suffix.lower() in ('.yml', '.yaml')}
        self.assertEqual(workflows, {'toolchain.yml'})
        workflow = (directory / 'toolchain.yml').read_text(encoding='utf-8')
        for required in (
            '  push:', '    branches: [main]', '  pull_request:',
            '  workflow_dispatch:', '  contents: read', '  verify:',
            'npm test', 'npm run gate', 'npm run build', 'npm run check',
            'node scripts/verify-msil-clr.mjs',
            'node scripts/verify-exceptions-clr.mjs',
            "python -m unittest discover -s tests/automation -p 'test_*.py' -v",
            'python scripts/run-browser-gates.py', 'set -euo pipefail',
            'actions/upload-artifact@', 'actions/upload-pages-artifact@',
            '  deploy:', '    needs: verify',
            "    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'",
            '      pages: write', '      id-token: write',
            '      name: github-pages', 'actions/deploy-pages@',
        ):
            with self.subTest(required=required):
                self.assertIn(required, workflow)
        for retired in ('contents: write', 'actions: write', 'git push',
                        'gh workflow run', 'pull_request_target:', 'workflow_run:'):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, workflow)


if __name__ == '__main__':
    unittest.main()
