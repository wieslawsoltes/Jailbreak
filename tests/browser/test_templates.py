"""Browser gates for real template/resource pipelines and unchanged ProgressBarPage."""
from pathlib import Path
import functools,http.server,os,threading,unittest
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
class TemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        site=Path(os.environ.get('JAILBREAK_SITE',ROOT/'site'))
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(site)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start();executable=os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/'
        (ROOT/'test-results').mkdir(exist_ok=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1000});self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        (self.page.set_content((Path(os.environ['JAILBREAK_SITE'])/'index.html').read_text(),wait_until='load') if os.environ.get('JAILBREAK_INLINE_TEST') else self.page.goto(self.url));self.page.wait_for_selector('#samples option[value="Templates"]',state='attached')
        self.page.select_option('#samples','Templates');expect(self.page.frame_locator('#preview').get_by_text('First card: 0',exact=True)).to_be_visible(timeout=30000)
    def tearDown(self):
        self.page.screenshot(path=str(ROOT/'test-results'/f'{self._testMethodName}.png'),full_page=True);self.page.close()
    def preview(self):return self.page.frame_locator('#preview')
    def frame(self):return self.page.frames[-1]
    def test_independent_templates_execute_native_keyboard_and_compiled_click(self):
        p=self.preview();p.get_by_role('button',name='First card: 0').click()
        expect(p.get_by_text('First card: 1',exact=True)).to_be_visible()
        expect(p.get_by_text('Second card stays independent',exact=True)).to_be_visible()
        p.get_by_role('button',name='First card: 1').focus();self.page.keyboard.press('Enter')
        expect(p.get_by_text('First card: 2',exact=True)).to_be_visible();self.assertEqual(self.errors,[])
    def test_template_scope_does_not_leak_and_two_way_parent_binding_works(self):
        p=self.preview();p.get_by_role('textbox').fill('Updated templated parent')
        expect(p.get_by_text('Updated templated parent',exact=True)).to_be_visible()
        state=self.frame().evaluate("""() => {const r=Jailbreak.root;return {leaked:r.FindControl('PART_Chrome')!==null,one:r.FirstCard.FindTemplateChild('PART_Chrome').uid,two:r.SecondCard.FindTemplateChild('PART_Chrome').uid}}""")
        self.assertFalse(state['leaked']);self.assertNotEqual(state['one'],state['two'])
    def test_template_style_selector_responds_to_hover(self):
        p=self.preview();p.get_by_role('button',name='First card: 0').hover()
        chrome=p.locator('[data-name="FirstCard"] [data-name="PART_Chrome"]')
        expect(chrome).to_have_css('background-color','rgb(224, 220, 255)')
        p.get_by_text('Real templates. Shared source.',exact=True).hover();expect(chrome).to_have_css('background-color','rgb(242, 240, 255)')
    def test_repeated_template_replacement_disposes_old_parts_and_subscriptions(self):
        f=self.frame();baseline=f.evaluate('Jailbreak.root.FirstCard.PropertyChanged.Count')
        f.evaluate("window.oldPart=Jailbreak.root.FirstCard.FindTemplateChild('PART_Content')")
        for _ in range(4):
            self.preview().get_by_role('button',name='Replace first template').click()
            expect(self.preview().locator('[data-name="FirstCard"] [data-name="PART_Label"]')).to_be_visible()
            self.preview().get_by_role('button',name='Restore styled template').click()
            expect(self.preview().locator('[data-name="FirstCard"] [data-name="PART_Content"]')).to_be_visible()
        self.assertTrue(f.evaluate('oldPart._disposed'));self.assertEqual(f.evaluate('Jailbreak.root.FirstCard.PropertyChanged.Count'),baseline)
    def test_merged_resource_change_updates_live_control(self):
        p=self.preview();label=p.get_by_text('A DynamicResource from the merged dictionary',exact=True)
        expect(label).to_have_css('color','rgb(101, 89, 232)')
        p.get_by_role('button',name='Change shared accent').click();expect(label).to_have_css('color','rgb(0, 128, 0)')
    def test_content_template_and_borrowed_visual_survive_template_replacement(self):
        expect(self.preview().get_by_text('ContentTemplate renders this data',exact=True)).to_be_visible()
        self.frame().evaluate("""() => {const r=Jailbreak.root,v=new Jailbreak.TextBlock();v.Text='Borrowed content';r.FirstCard.Content=v;window.borrowed=v;}""")
        expect(self.preview().get_by_text('Borrowed content',exact=True)).to_be_visible()
        self.preview().get_by_role('button',name='Replace first template').click()
        self.assertFalse(self.frame().evaluate('borrowed._disposed'))
        self.preview().get_by_role('button',name='Restore styled template').click()
        expect(self.preview().get_by_text('Borrowed content',exact=True)).to_be_visible()
    def test_offline_export_keeps_templates_and_linked_resources(self):
        with self.page.expect_download() as pending:self.page.click('#export')
        app=self.browser.new_page()
        try:
            app.set_content(Path(pending.value.path()).read_text(),wait_until='load')
            app.get_by_role('button',name='First card: 0').click();expect(app.get_by_text('First card: 1',exact=True)).to_be_visible()
            app.get_by_role('button',name='Replace first template').click();expect(app.locator('[data-name="FirstCard"] [data-name="PART_Label"]')).to_be_visible()
        finally:app.close()
    def test_original_progressbar_page_range_text_indeterminate_and_orientation(self):
        self.page.select_option('#samples','UpstreamProgressBar');p=self.preview()
        bars=p.get_by_role('progressbar');expect(bars).to_have_count(5,timeout=30000)
        expect(bars.nth(0)).to_have_attribute('aria-valuenow','40');expect(bars.nth(1)).to_have_attribute('aria-orientation','vertical')
        for i in (2,3,4):self.assertEqual(bars.nth(i).locator('progress').evaluate('(e)=>e.value'),0.5)
        p.get_by_role('checkbox',name='Show Progress Text').check();expect(bars.nth(0)).to_contain_text('40%')
        p.locator('[data-name="stringFormat"]').fill('{0:0.0} percent');expect(bars.nth(0)).to_contain_text('40.0 percent')
        p.locator('[data-name="hprogress"]').evaluate("e=>{e.value='70';e.dispatchEvent(new Event('input',{bubbles:true}));}");expect(bars.nth(0)).to_have_attribute('aria-valuenow','70')
        p.get_by_role('checkbox',name='Toggle Indeterminate').check();self.assertIsNone(bars.nth(0).get_attribute('aria-valuenow'))
        self.assertIsNone(bars.nth(0).locator('progress').get_attribute('value'))
        p.get_by_role('checkbox',name='Toggle Indeterminate').uncheck();expect(bars.nth(0)).to_have_attribute('aria-valuenow','70')
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
