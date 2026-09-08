"""Exception/checked-arithmetic behavior through uploaded SDK binaries and source UI."""
from pathlib import Path
import base64, functools, http.server, json, os, threading, unittest
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]

class ExceptionBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = Path(os.environ.get('JAILBREAK_SITE', ROOT / 'site'))
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(cls.site)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser = cls.pw.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        cls.fixture = json.loads((ROOT / 'tests/fixtures/msil/exceptions.json').read_text())
        (ROOT / 'test-results').mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    def tearDown(self):
        self.page.screenshot(path=str(ROOT / 'test-results' / f'{self._testMethodName}.png'), full_page=True)
        self.page.close()

    def navigate(self, file='binary/index.html'):
        if os.environ.get('JAILBREAK_INLINE_TEST'):
            self.page.set_content((self.site / file).read_text(), wait_until='load')
        else:
            self.page.goto(self.url + '/' + file)

    def studio(self):
        self.navigate()
        expect(self.page.locator('#runtime-state')).to_have_text('Ready', timeout=30000)

    def call(self, name, args, expected):
        self.page.select_option('#method', label='Recovery::' + name)
        self.page.fill('#args', json.dumps(args)); self.page.click('#invoke')
        expect(self.page.locator('#result')).to_have_text(expected)

    def upload(self, name):
        self.page.set_input_files('#file', {'name': name, 'mimeType': 'application/octet-stream',
            'buffer': base64.b64decode(self.fixture['files'][name]['base64'])})
        expect(self.page.locator('#method')).to_contain_text('Recovery::SafeDivide', timeout=30000)
        expect(self.page.locator('#runtime-state')).to_have_text('Ready', timeout=30000)

    def test_exception_il_runs_cleanup_and_il_errors_block_export(self):
        self.studio(); self.page.select_option('#sample', 'exception')
        expect(self.page.locator('#method')).to_contain_text('CleanupOrder', timeout=30000)
        expect(self.page.locator('#invoke')).to_be_enabled()
        self.call('CleanupOrder', [], '123'); self.call('SafeDivide', [84, 0], '-1')
        self.page.click('[data-tab="disassembly"]')
        expect(self.page.locator('#listing')).to_contain_text('handlerOffset')
        self.page.click('[data-tab="il"]')
        source = self.page.locator('#il').input_value().replace('endfinally', 'ret', 1)
        self.page.fill('#il', source); self.page.click('#compile')
        expect(self.page.locator('#status')).to_have_text('Conversion failed', timeout=30000)
        expect(self.page.locator('#invoke')).to_be_disabled(); expect(self.page.locator('#export')).to_be_disabled()
        self.assertEqual(self.errors, [])

    def test_exception_dll_upload_typed_catches_rethrow_and_nested_unwind(self):
        self.studio(); self.upload('Jailbreak.ExceptionExamples.dll')
        self.call('SafeDivide', [84, 0], '-1'); self.call('CatchOrder', [0], '10')
        self.call('CatchOrder', [1], '20'); self.call('RethrowIdentity', [], 'true')
        self.call('FinallyWins', [], '12'); self.call('NestedCatchInFinally', [0], '789')
        self.call('InnerMessage', [], '"inner"'); self.call('CatchNull', [], '42')
        self.page.select_option('#method', label='Recovery::CheckedAdd'); self.page.fill('#args', '[2147483647,1]'); self.page.click('#invoke')
        expect(self.page.locator('#result')).to_contain_text('OverflowException')
        self.call('CheckedAdd', [40, 2], '42')
        self.assertEqual(self.errors, [])

    def test_exception_nuget_example_compiles_and_retains_metadata(self):
        self.studio(); self.page.select_option('#sample', 'exceptionNuget')
        expect(self.page.locator('#method')).to_contain_text('CatchFinally', timeout=30000)
        expect(self.page.locator('#runtime-state')).to_have_text('Ready', timeout=30000)
        self.call('CatchFinally', [0], '-4'); self.call('Trace', [], '12345')
        self.page.click('[data-tab="package"]')
        expect(self.page.locator('#listing')).to_contain_text('Jailbreak.ExceptionExamples')
        expect(self.page.locator('#listing')).to_contain_text('net8.0')
        self.assertEqual(self.errors, [])

    def test_exception_dll_export_runs_without_network(self):
        self.studio(); self.upload('Jailbreak.ExceptionExamples.dll')
        with self.page.expect_download() as pending:
            self.page.click('#export')
        app = self.browser.new_page(); requests = []
        app.on('request', lambda r: requests.append(r.url))
        try:
            app.set_content(Path(pending.value.path()).read_text(), wait_until='load')
            app.select_option('#method', label='ExceptionExamples.Recovery::CatchFinally')
            app.fill('#args', '[0]'); app.click('#run')
            expect(app.locator('#result')).to_have_text('-4')
            app.select_option('#method', label='ExceptionExamples.Recovery::Trace')
            app.fill('#args', '[]'); app.click('#run')
            expect(app.locator('#result')).to_have_text('12345')
            self.assertEqual(requests, [])
        finally:
            app.close()

    def test_csharp_catches_dll_overflow_and_runs_finally_in_ide_and_export(self):
        self.navigate('index.html')
        self.page.wait_for_selector('#samples option[value="ExceptionLibrary"]', state='attached')
        self.page.select_option('#samples', 'ExceptionLibrary')
        preview = self.page.frame_locator('#preview')
        expect(preview.get_by_role('button', name='Recover inside DLL')).to_be_visible(timeout=30000)
        preview.get_by_role('button', name='Recover inside DLL').click()
        expect(preview.get_by_text('DLL recovery result: -1', exact=True)).to_be_visible()
        preview.get_by_role('button', name='Catch DLL overflow in C#').click()
        expect(preview.get_by_text('Caught DLL OverflowException in C#', exact=True)).to_be_visible()
        expect(preview.get_by_text('C# finally completed', exact=True)).to_be_visible()
        preview.get_by_role('button', name='Run nested cleanup').click()
        expect(preview.get_by_text('Nested result: -4; cleanup order: 12345', exact=True)).to_be_visible()
        with self.page.expect_download() as pending:
            self.page.click('#export')
        app = self.browser.new_page(); requests = []
        app.on('request', lambda r: requests.append(r.url))
        try:
            app.set_content(Path(pending.value.path()).read_text(), wait_until='load')
            app.get_by_role('button', name='Catch DLL overflow in C#').click()
            expect(app.get_by_text('Caught DLL OverflowException in C#', exact=True)).to_be_visible()
            expect(app.get_by_text('C# finally completed', exact=True)).to_be_visible()
            self.assertEqual(requests, [])
        finally:
            app.close()
        self.assertEqual(self.errors, [])

if __name__ == '__main__':
    unittest.main(verbosity=2)
