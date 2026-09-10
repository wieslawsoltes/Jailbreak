from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Secondary workbench and requested-fork ControlCatalog behavioral gates."""
from pathlib import Path
import functools,http.server,os,threading,unittest
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
class SecondaryWorkbenchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT/'site')))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start();executable=os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/browser/ide/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1000})
        self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.goto(self.url)
        expect(self.page.locator('#status')).to_have_text('Application running',timeout=30000)
    def tearDown(self):
        (ROOT/'test-results').mkdir(exist_ok=True)
        self.page.screenshot(path=str(ROOT/'test-results'/f'{self._testMethodName}.png'),full_page=True)
        self.page.close()
    def test_default_demo_compiles_and_runs(self):
        preview=self.page.frame_locator('#preview')
        preview.get_by_role('button',name='Increment counter').click()
        expect(preview.get_by_text('Count: 1',exact=True)).to_be_visible()
        preview.get_by_role('textbox').fill('Updated binding')
        expect(preview.get_by_text('Updated binding',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])
    def test_secondary_profiles_use_same_project_evaluator(self):
        select_option(self.page,'#sample','profiles')
        expect(self.page.frame_locator('#preview').get_by_text('Debug profile: +1 per click',exact=True)).to_be_visible(timeout=30000)
        click(self.page,'#build-profile');self.page.get_by_label('Configuration',exact=True).fill('Release')
        self.page.get_by_role('button',name='Apply & build').click()
        preview=self.page.frame_locator('#preview')
        expect(preview.get_by_text('Release profile: +10 per click',exact=True)).to_be_visible(timeout=30000)
        preview.get_by_role('button',name='Run compiled handler').click()
        expect(preview.get_by_text('Count: 10',exact=True)).to_be_visible()
    def test_requested_fork_checkbox_states_and_three_state_cycle(self):
        select_option(self.page,'#sample','checkbox');preview=self.page.frame_locator('#preview')
        boxes=preview.locator('input[type=checkbox]');expect(boxes).to_have_count(8,timeout=30000)
        self.assertFalse(boxes.nth(0).is_checked());self.assertTrue(boxes.nth(1).is_checked())
        self.assertTrue(boxes.nth(2).evaluate('(e)=>e.indeterminate'));self.assertTrue(boxes.nth(3).is_disabled())
        boxes.nth(4).click();self.assertTrue(boxes.nth(4).is_checked())
        boxes.nth(4).click();self.assertTrue(boxes.nth(4).evaluate('(e)=>e.indeterminate'))
        boxes.nth(4).click();self.assertFalse(boxes.nth(4).is_checked());self.assertFalse(boxes.nth(4).evaluate('(e)=>e.indeterminate'))
    def test_requested_fork_radio_groups(self):
        select_option(self.page,'#sample','radio');preview=self.page.frame_locator('#preview')
        radios=preview.locator('input[type=radio]');expect(radios).to_have_count(15,timeout=30000)
        radios.nth(1).click();self.assertFalse(radios.nth(0).is_checked());self.assertTrue(radios.nth(1).is_checked())
        self.assertTrue(radios.nth(4).is_checked())
        radios.nth(8).click();self.assertTrue(radios.nth(8).is_checked());self.assertFalse(radios.nth(12).is_checked())
        self.assertTrue(radios.nth(9).is_disabled())
if __name__=='__main__':unittest.main(verbosity=2)
