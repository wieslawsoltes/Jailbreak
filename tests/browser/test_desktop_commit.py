"""Real browser acceptance for the independent tool-window desktop composition."""
import base64
import os
import functools
import http.server
import json
import threading
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]

class DesktopCommitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'site')))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True,**({'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if os.environ.get('CHROMIUM_EXECUTABLE') else {}))
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1600, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.wait_for_selector('#samples option[value="DeveloperTools"]', state='attached')
        self.page.select_option('#samples', 'DeveloperTools')
        expect(self.page.frame_locator('#preview').get_by_role('button', name='Increment', exact=True)).to_be_visible(timeout=30000)

    def tearDown(self):
        (ROOT / 'test-results').mkdir(exist_ok=True)
        self.page.screenshot(path=str(ROOT / 'test-results' / (self._testMethodName + '.png')), full_page=True)
        self.page.close()

    def tool(self, name):
        self.page.click('#wb-menu-view')
        self.page.get_by_role('menuitem', name='Tool Windows', exact=True).click()
        self.page.get_by_role('menuitem', name=name, exact=True).click()

    def source(self, name):
        self.tool('Solution Explorer')
        self.page.locator('#files button').filter(has_text=name).first.click()
        return self.page.locator('#editor').input_value()

    def test_removed_text_panels_and_real_menu_commands(self):
        self.assertEqual(self.page.locator('#help-panel, #about-panel').count(), 0)
        self.assertEqual(self.page.locator('.activity').count(), 0)
        self.page.click('#wb-menu-file')
        expect(self.page.get_by_role('menu', name='File menu', exact=True)).to_be_visible()
        expect(self.page.get_by_role('menuitem', name='Save all', exact=True)).to_be_visible()
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('Control+Shift+p')
        expect(self.page.locator('#wb-palette')).to_be_visible()
        self.page.fill('#wb-palette-query', 'View Properties')
        self.page.keyboard.press('Enter')
        expect(self.page.locator('[data-tool-window="properties"]')).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_float_redock_close_reopen_preserves_actual_property_view(self):
        self.tool('Properties')
        view = self.page.locator('[data-tool-window="properties"]')
        view.evaluate("e=>e.dataset.acceptanceIdentity='same-object'")
        self.page.get_by_role('button', name='Properties window options', exact=True).click()
        self.page.get_by_role('menuitem', name='Float', exact=True).click()
        expect(self.page.get_by_role('region', name='Properties floating window', exact=True)).to_be_visible()
        self.assertEqual(view.get_attribute('data-acceptance-identity'), 'same-object')
        self.page.get_by_role('button', name='Dock Properties', exact=True).click()
        expect(self.page.locator('#dock-zone-right-lower [data-tool-window="properties"]')).to_be_visible()
        self.page.get_by_role('button', name='Close Properties', exact=True).click()
        self.tool('Properties')
        self.assertEqual(view.get_attribute('data-acceptance-identity'), 'same-object')
        self.assertEqual(self.errors, [])

    def test_auto_hide_and_pin_uses_registered_view(self):
        self.tool('Properties')
        self.page.get_by_role('button', name='Auto hide Properties', exact=True).click()
        tab = self.page.locator('.dock-auto-tab[data-window="properties"]')
        expect(tab).to_be_visible()
        tab.click()
        expect(self.page.locator('.dock-flyout [data-tool-window="properties"]')).to_be_visible()
        self.page.get_by_role('button', name='Pin Properties', exact=True).click()
        expect(self.page.locator('#dock-zone-right-lower [data-tool-window="properties"]')).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_keyboard_splitter_and_saved_layout_restore(self):
        self.tool('Properties')
        handle = self.page.get_by_role('separator', name='Resize right tool windows', exact=True)
        previous = int(handle.get_attribute('aria-valuenow'))
        handle.focus()
        handle.press('Shift+ArrowLeft')
        self.assertEqual(int(handle.get_attribute('aria-valuenow')), previous + 10)
        self.page.click('#wb-menu-window')
        self.page.get_by_role('menuitem', name='Save or restore named layout', exact=True).click()
        self.page.fill('#desktop-layout-name', 'Acceptance layout')
        self.page.click('#desktop-save-layout')
        self.page.click('#desktop-close-layouts')
        self.page.reload()
        expect(self.page.locator('body')).to_have_class(__import__('re').compile('desktop-ide'))
        self.assertEqual(int(self.page.get_by_role('separator', name='Resize right tool windows', exact=True).get_attribute('aria-valuenow')), previous + 10)
        self.assertEqual(self.errors, [])

    def test_source_breakpoint_routes_to_shared_stack_and_continue(self):
        self.page.select_option('#studio-session-mode', 'cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running', timeout=30000)
        text = self.source('MainView.axaml.cs')
        offset = text.index('count += 1')
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}', offset)
        self.page.keyboard.press('F9')
        self.page.frame_locator('#preview').get_by_role('button', name='Increment', exact=True).click()
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        expect(self.page.locator('[data-tool-window="stack"]')).to_be_visible()
        expect(self.page.locator('#studio-stack')).to_contain_text('Increment')
        self.page.click('#run')
        expect(self.page.frame_locator('#preview').get_by_text('Count: 1', exact=True)).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_design_property_edit_retains_input_and_root(self):
        self.page.select_option('#studio-session-mode', 'design')
        expect(self.page.locator('#preview-state')).to_contain_text('Running', timeout=30000)
        self.page.locator('#studio-perspectives').get_by_role('tab', name='Designer', exact=True).click()
        self.tool('Debug Settings')
        self.page.check('#dev-hot')
        preview = self.page.frame_locator('#preview')
        preview.get_by_role('textbox').fill('Keep the live state')
        frame = self.page.locator('#preview').element_handle().content_frame()
        identity = frame.evaluate('appHandle.root.uid')
        self.tool('Document Outline')
        self.page.locator('#dev-tree button').filter(has_text='#IncrementButton').click()
        self.tool('Properties')
        self.page.get_by_label('Design Content', exact=True).fill('Updated action')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button', name='Apply', exact=True).click()
        expect(preview.get_by_role('button', name='Updated action', exact=True)).to_be_visible(timeout=30000)
        expect(preview.get_by_role('textbox')).to_have_value('Keep the live state')
        self.assertEqual(frame.evaluate('appHandle.root.uid'), identity)
        self.assertEqual(self.errors, [])

    def test_binary_execution_uses_main_start_and_preserves_source_preview(self):
        self.page.frame_locator('#preview').get_by_role('textbox').fill('Independent source session')
        self.page.locator('#studio-perspectives').get_by_role('tab', name='Binary Studio', exact=True).click()
        binary = self.page.frame_locator('#studio-binary-host iframe')
        expect(binary.locator('#method')).to_contain_text('Calculator::Add', timeout=30000)
        expect(binary.locator('#runtime-state')).to_have_text('Ready', timeout=30000)
        self.page.click('#run')
        expect(binary.locator('#result')).to_have_text('42')
        self.page.locator('#studio-perspectives').get_by_role('tab', name='Split', exact=True).click()
        expect(self.page.frame_locator('#preview').get_by_role('textbox')).to_have_value('Independent source session')
        self.assertEqual(self.errors, [])

    def test_symbol_restoration_requests_then_attaches_verified_sidecar(self):
        self.page.select_option('#samples', 'NativeSymbols')
        expect(self.page.frame_locator('#preview').get_by_role('button', name='Call native-symbol library')).to_be_visible(timeout=30000)
        original = json.loads(self.source('library.binary.json'))
        self.assertIn('pdb', original['symbols'])
        pdb = base64.b64decode(original['symbols'].pop('pdb'))
        self.page.locator('#editor').fill(json.dumps(original))
        requests = []
        def serve(route):
            requests.append(route.request.url)
            route.fulfill(status=200, content_type='application/octet-stream', headers={'Access-Control-Allow-Origin': '*'}, body=pdb)
        self.page.route('https://symbols.example/**', serve)
        self.tool('Symbols & Sources')
        self.page.select_option('#symbols-library', 'library.binary.json')
        self.page.fill('#symbols-servers', 'https://symbols.example/store')
        expect(self.page.locator('#symbols-restore')).to_be_disabled()
        self.page.click('#symbols-inspect')
        self.assertEqual(requests, [])
        expect(self.page.locator('#symbols-report')).to_contain_text('jailbreak.nativesymbols.pdb')
        self.page.check('#symbols-consent')
        self.page.click('#symbols-restore')
        expect(self.page.locator('#symbols-status')).to_contain_text('Verified 1 original', timeout=30000)
        self.page.click('#symbols-attach')
        expect(self.page.locator('#symbols-status')).to_contain_text('Verified symbols attached', timeout=30000)
        self.assertEqual(len(requests), 1)
        stored = json.loads(self.source('library.binary.json'))
        self.assertEqual(base64.b64decode(stored['symbols']['pdb']), pdb)
        self.assertEqual(self.errors, [])

    def test_narrow_layout_and_keyboard_menu_remain_bounded(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.click('#wb-menu-window')
        self.page.get_by_role('menuitem', name='Hide all tool windows', exact=True).click()
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.page.keyboard.press('Control+Shift+p')
        expect(self.page.locator('#wb-palette')).to_be_visible()
        self.assertLessEqual(self.page.locator('#wb-palette').bounding_box()['width'], 390)
        self.assertEqual(self.errors, [])

if __name__ == '__main__':
    unittest.main(verbosity=2)
