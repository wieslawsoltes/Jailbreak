from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Standalone UI checks. Install Playwright and Chromium, then run this file."""
from pathlib import Path
import functools, http.server, os, threading, unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

class InspectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser = cls.pw.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/tests/browser/profile-inspector.html'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close()
    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1000, 'height': 800})
        if os.environ.get('JAILBREAK_INLINE_TEST'):
            self.page.set_content('<!doctype html><html><body><main id="host"></main></body></html>')
            source = (ROOT/'packages/build-profile/inspector.js').read_text().replace('export function ', 'function ')
            self.page.add_script_tag(content=source + '\nwindow.applied=[];window.opened=[];window.inspector=createBuildProfileInspector({onApply:p=>applied.push(p),onOpenFile:p=>opened.push(p)});document.querySelector("#host").append(inspector.button);')
        else:
            self.page.goto(self.url)
        self.page.wait_for_function('!!window.inspector')
    def tearDown(self):
        self.page.close()
    def test_apply_and_restore(self):
        click(self.page,'#build-profile')
        self.page.get_by_label('Configuration', exact=True).fill('Release')
        self.page.get_by_label('Target framework', exact=True).fill('net8.0')
        self.page.get_by_label('Additional C# symbols').fill('BROWSER;FEATURE')
        self.page.get_by_role('button', name='Apply & build').click()
        profile = self.page.evaluate('applied[0]')
        self.assertEqual(profile['configuration'], 'Release'); self.assertEqual(profile['symbols'], ['BROWSER','FEATURE'])
        click(self.page,'#build-profile')
        self.assertEqual(self.page.get_by_label('Configuration', exact=True).input_value(), 'Release')
    def test_invalid_symbols_do_not_compile(self):
        click(self.page,'#build-profile'); self.page.get_by_label('Additional C# symbols').fill('BAD-SYMBOL')
        self.page.get_by_role('button', name='Apply & build').click()
        self.assertEqual(self.page.evaluate('applied.length'), 0)
        self.assertIn('identifiers', self.page.get_by_role('alert').inner_text())
    def test_inspector_uses_text_not_markup(self):
        self.page.evaluate('''inspector.update({files:['Page.cs'],buildProfiles:[{path:'App.csproj',sources:['Page.cs'],symbols:['BROWSER'],properties:{Label:'<img src=x onerror="window.injected=true">'},imports:[{path:'common.props'}]}]})''')
        click(self.page,'#build-profile')
        self.page.get_by_text('Evaluated properties', exact=True).click()
        self.assertEqual(self.page.locator('#build-profile-dialog img').count(), 0)
        self.assertIn('<img', self.page.locator('#build-profile-dialog').inner_text())
        self.page.get_by_role('button', name='Page.cs', exact=True).click()
        self.assertEqual(self.page.evaluate('opened'), ['Page.cs'])
    def test_reset_and_stale_report(self):
        self.page.evaluate("inspector.set({configuration:'Release'});inspector.update({files:[],projects:[]});inspector.invalidate()")
        click(self.page,'#build-profile')
        self.assertIn('Out of date',self.page.locator('#build-profile-dialog').inner_text())
        self.page.get_by_role('button',name='Close',exact=True).click()
        self.page.evaluate('inspector.set()');self.assertIn('Debug', self.page.locator('#build-profile').inner_text())
    def test_mobile_dialog_fits_viewport(self):
        self.page.set_viewport_size({'width':390,'height':844});click(self.page,'#build-profile')
        box=self.page.locator('#build-profile-dialog').bounding_box()
        self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],390)
        self.page.get_by_role('button',name='Close',exact=True).click()
    def test_project_selection_and_disposal(self):
        self.page.evaluate("inspector.update({files:['A.cs','B.cs'],projects:[{file:'App.csproj',symbols:['APP']},{file:'Lib.csproj',symbols:['LIB']}]})")
        click(self.page,'#build-profile');self.page.get_by_label('Evaluated project',exact=True).select_option('Lib.csproj')
        self.assertIn('LIB',self.page.locator('#build-profile-dialog details').first.inner_text())
        self.page.evaluate('inspector.dispose()');self.assertEqual(self.page.locator('#build-profile').count(),0)

if __name__ == '__main__': unittest.main(verbosity=2)
