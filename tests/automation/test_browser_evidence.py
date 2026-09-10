"""Test the browser runner's reporting with tiny isolated unittest fixtures."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / 'scripts/run-browser-gates.py'


class BrowserEvidenceTests(unittest.TestCase):
    def run_fixture(self, source):
        with tempfile.TemporaryDirectory(prefix='browser-evidence-') as directory:
            root = Path(directory)
            inputs = root / 'tests'
            inputs.mkdir()
            sample = inputs / 'test_sample.py'
            sample.write_text(source, encoding='utf-8')
            report = root / 'evidence.json'
            report.write_text('{"successful":true,"stale":true}')
            run = subprocess.run([sys.executable, str(RUNNER), '--start-directory', str(inputs),
                                  '--report', str(report)], cwd=ROOT, text=True,
                                 capture_output=True, timeout=30)
            evidence = json.loads(report.read_text())
            self.assertNotIn('stale', evidence)
            self.assertEqual(evidence['inputs'], [{'path': 'test_sample.py',
                'sha256': hashlib.sha256(sample.read_bytes()).hexdigest()}])
            return run, evidence

    def test_success_retains_actual_test_count_and_revision(self):
        run, evidence = self.run_fixture('import unittest\nclass Sample(unittest.TestCase):\n'
            '    def test_ok(self): self.assertEqual(2 + 2, 4)\n')
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertTrue(evidence['successful'])
        self.assertEqual(evidence['tests_run'], 1)
        sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        self.assertEqual(evidence['source_sha'], sha)

    def test_assertion_failure_retains_traceback_and_nonzero_status(self):
        run, evidence = self.run_fixture('import unittest\nclass Sample(unittest.TestCase):\n'
            '    def test_failure(self): self.fail("intentional assertion")\n')
        self.assertEqual(run.returncode, 1)
        self.assertFalse(evidence['successful'])
        self.assertEqual(evidence['failures'][0]['test'], 'test_sample.Sample.test_failure')
        self.assertIn('intentional assertion', evidence['failures'][0]['traceback'])

    def test_import_error_remains_a_failing_gate(self):
        run, evidence = self.run_fixture('raise RuntimeError("intentional import failure")\n')
        self.assertEqual(run.returncode, 1)
        self.assertFalse(evidence['successful'])
        self.assertIn('intentional import failure', evidence['errors'][0]['traceback'])

    def test_empty_discovery_rejects_stale_success(self):
        run, evidence = self.run_fixture('# No test cases\n')
        self.assertEqual(run.returncode, 1)
        self.assertTrue(evidence['empty_discovery'])
        self.assertFalse(evidence['successful'])

    def test_unexpected_success_is_not_hidden(self):
        run, evidence = self.run_fixture('import unittest\nclass Sample(unittest.TestCase):\n'
            '    @unittest.expectedFailure\n    def test_unexpected(self): pass\n')
        self.assertEqual(run.returncode, 1)
        self.assertFalse(evidence['successful'])
        self.assertEqual(evidence['unexpected_successes'], ['test_sample.Sample.test_unexpected'])


if __name__ == '__main__':
    unittest.main()
