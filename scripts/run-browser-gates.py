#!/usr/bin/env python3
"""Run the unchanged browser unittest suite and retain revision-bound evidence.

No retries, forced actions or suppressed failures: unittest decides the outcome.
A zero-test discovery is an error rather than a green release gate.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start-directory', type=Path, default=ROOT / 'tests/browser')
    parser.add_argument('--pattern', default='test_*.py')
    parser.add_argument('--report', type=Path, default=ROOT / 'test-results/browser-tests.json')
    args = parser.parse_args(argv)
    started = datetime.now(timezone.utc).isoformat()
    clock = time.monotonic()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    # Never let a failed discovery leave a previous successful receipt behind.
    args.report.unlink(missing_ok=True)
    completed = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                               capture_output=True, text=True, timeout=10)
    source_sha = completed.stdout.strip() if completed.returncode == 0 else None
    inputs = []
    for path in sorted(args.start_directory.glob(args.pattern)):
        if path.is_file():
            inputs.append({'path': path.name,
                           'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    try:
        suite = unittest.TestLoader().discover(str(args.start_directory.resolve()), pattern=args.pattern)
    except Exception as error:
        # Run a real failing test so discovery exceptions use the same report path.
        def failed_discovery(failure=error):
            raise failure
        suite = unittest.TestSuite([unittest.FunctionTestCase(failed_discovery)])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    successful = result.wasSuccessful() and result.testsRun > 0
    report = {
        'format': 'jailbreak-browser-gates-v1',
        'source_sha': source_sha,
        'workflow_sha': os.environ.get('GITHUB_SHA'),
        'run_id': os.environ.get('GITHUB_RUN_ID'),
        'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'started_at': started,
        'elapsed_seconds': round(time.monotonic() - clock, 3),
        'inputs': inputs,
        'tests_run': result.testsRun,
        'successful': successful,
        'empty_discovery': result.testsRun == 0,
        'failures': [{'test': test.id(), 'traceback': trace} for test, trace in result.failures],
        'errors': [{'test': test.id(), 'traceback': trace} for test, trace in result.errors],
        'skipped': [{'test': test.id(), 'reason': reason} for test, reason in result.skipped],
        'expected_failures': [{'test': test.id(), 'traceback': trace} for test, trace in result.expectedFailures],
        'unexpected_successes': [test.id() for test in result.unexpectedSuccesses],
    }
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=args.report.parent,
                                         prefix=args.report.name + '.', delete=False) as output:
            temporary = Path(output.name)
            json.dump(report, output, indent=2)
            output.write('\n')
        temporary.replace(args.report)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f'Browser evidence: {args.report}; revision {source_sha}; '
          f'{result.testsRun} tests; successful={successful}', flush=True)
    return 0 if successful else 1


if __name__ == '__main__':
    sys.exit(main())
