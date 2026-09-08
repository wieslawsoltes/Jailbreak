"""Actual compiled UI, source edits, hot reload, sandbox checks and native debugger pauses."""
from pathlib import Path
import functools, http.server, json, os, threading, unittest, base64
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
class DevelopmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT/'site')))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start()
        executable=os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1600,'height':1200})
        self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        if os.environ.get('JAILBREAK_INLINE_TEST'):
            self.page.set_content((ROOT/'site/index.html').read_text(),wait_until='load')
        else:
            self.page.goto(self.url)
        self.page.wait_for_selector('#samples option[value="DeveloperTools"]',state='attached')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.page.select_option('#samples','DeveloperTools')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        self.page.click('#development-tools');self.page.check('#dev-enabled')
        self.page.wait_for_function("document.querySelector('#preview-state').textContent.includes('Running')")
        self.preview=self.page.frame_locator('#preview')
        expect(self.page.locator('#dev-tree')).to_contain_text('#IncrementButton',timeout=30000)
    def tearDown(self):
        (ROOT/'test-results').mkdir(exist_ok=True)
        self.page.screenshot(path=str(ROOT/'test-results'/f'dev-{self._testMethodName}.png'),full_page=True)
        self.page.close()
    def source(self,path,text=None):
        self.page.locator('#files button').get_by_text(path,exact=True).click()
        if text is not None:self.page.locator('#editor').fill(text)
        return self.page.locator('#editor').input_value()
    def test_canvas_pick_edits_xaml_and_hot_reload_preserves_identity(self):
        self.page.check('#dev-hot')
        self.preview.get_by_role('textbox').fill('preserve this')
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        frame=self.page.frames[-1];uid=frame.evaluate('appHandle.root.uid')
        self.page.click('#dev-pick');self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.get_by_label('Design Content',exact=True)).to_have_value('Increment')
        self.page.get_by_label('Design Content',exact=True).fill('Add one')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button',name='Apply').click()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        expect(self.preview.get_by_role('button',name='Add one',exact=True)).to_be_visible()
        expect(self.preview.get_by_role('textbox')).to_have_value('preserve this')
        self.assertEqual(frame.evaluate('appHandle.root.uid'),uid)
        self.assertEqual(frame.evaluate('appHandle.root.count'),1)
        self.assertIn('<!-- Designer edits preserve',self.source('MainView.axaml'))
        self.assertEqual(self.errors,[])
    def test_csharp_hot_reload_replaces_existing_xaml_and_csharp_handlers(self):
        self.page.check('#dev-hot');self.preview.get_by_role('button',name='Increment',exact=True).click()
        text=self.source('MainView.axaml.cs');self.page.locator('#editor').fill(text.replace('count += 1','count += 10'));self.page.click('#run')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.preview.get_by_text('Count: 11',exact=True)).to_be_visible()
        self.preview.get_by_role('button',name='Built in C#',exact=True).click()
        expect(self.preview.get_by_text('Count: 21',exact=True)).to_be_visible()
    def test_designer_csharp_source_literal_edit_and_explicit_restart(self):
        self.page.check('#dev-hot')
        self.page.locator('#dev-tree button').filter(has_text='#CodeButton').click()
        self.page.get_by_label('Design Content',exact=True).fill('Edited C# button')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button',name='Apply').click()
        expect(self.page.locator('#dev-status')).to_contain_text('Restart required',timeout=30000)
        expect(self.preview.get_by_role('button',name='Built in C#',exact=True)).to_be_visible()
        self.page.click('#dev-restart')
        expect(self.preview.get_by_role('button',name='Edited C# button',exact=True)).to_be_visible(timeout=30000)
        self.assertIn('Content = "Edited C# button"',self.source('MainView.axaml.cs'))
    def test_invalid_build_preserves_running_app(self):
        self.page.check('#dev-hot');self.preview.get_by_role('textbox').fill('keep on errors')
        text=self.source('MainView.axaml.cs');self.page.locator('#editor').fill(text.replace('count += 1','MissingApi()'));self.page.click('#run')
        expect(self.page.locator('#dev-status')).to_contain_text('Build failed',timeout=30000)
        expect(self.preview.get_by_role('textbox')).to_have_value('keep on errors')
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.preview.get_by_text('Count: 1',exact=True)).to_be_visible()
    def test_conditional_breakpoint_watch_and_workspace_persistence(self):
        self.page.uncheck('#dev-native');text=self.source('MainView.axaml.cs')
        line=text[:text.index('CounterLabel.Text')].count('\n')+1
        self.page.fill('#dev-breakpoint-line',str(line));self.page.fill('#dev-condition','this.count == 2');self.page.fill('#dev-watches','this.count');self.page.click('#dev-add-breakpoint')
        self.preview.get_by_role('button',name='Increment',exact=True).click();self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.locator('#dev-debug-output')).to_contain_text('"count": 2')
        with self.page.expect_download() as download:self.page.click('#save-workspace')
        workspace=json.loads(Path(download.value.path()).read_text());self.assertTrue(workspace['development']['enabled']);self.assertEqual(workspace['development']['breakpoints'][0]['line'],line)
        self.assertEqual(self.errors,[])
    def test_native_debugger_pauses_and_steps_compiled_csharp_with_source_map(self):
        text=self.source('MainView.axaml.cs');line=text[:text.index('CounterLabel.Text')].count('\n')+1
        self.page.fill('#dev-breakpoint-line',str(line));self.page.click('#dev-add-breakpoint')
        session=self.page.context.new_cdp_session(self.page.frames[-1]);scripts=[];pauses=[]
        session.on('Debugger.scriptParsed',lambda p:scripts.append(p))
        session.on('Debugger.paused',lambda event:pauses.append(event));session.send('Debugger.enable')
        session.send('Debugger.setSkipAllPauses',{'skip':False})
        self.page.frames[-1].evaluate("setTimeout(()=>appHandle.root.IncrementButton.element.click(),0)")
        for _ in range(100):
            self.page.wait_for_timeout(20)
            if pauses:break
        self.assertTrue(pauses,'No native debugger pause was received')
        session.send('Debugger.stepOver')
        for _ in range(100):
            self.page.wait_for_timeout(20)
            if len(pauses)>=2:break
        session.send('Debugger.resume')
        expect(self.preview.get_by_text('Count: 1',exact=True)).to_be_visible()
        self.assertGreaterEqual(len(pauses),2)
        self.assertEqual(pauses[0]['callFrames'][0]['functionName'],'Increment')
        mapped=[s for s in scripts if s.get('url','').endswith('jailbreak-app.js') and s.get('sourceMapURL')]
        self.assertTrue(mapped)
        url=mapped[-1]['sourceMapURL'];data=json.loads(base64.b64decode(url.split(',',1)[1]))
        self.assertTrue(any('MainView.axaml.cs' in s for s in data['sources']))
        self.assertTrue(any('count += 1' in s for s in data['sourcesContent']))
        session.detach()
    def test_canvas_commands_reject_untrusted_channel(self):
        frame=self.page.frames[-1]
        frame.evaluate("window.postMessage({jailbreakDev:1,channel:'fake',action:'reload',script:'window.injected=true'},'*')")
        self.page.wait_for_timeout(50)
        self.assertFalse(frame.evaluate('!!window.injected'))
        self.assertEqual(self.page.locator('#preview').get_attribute('sandbox'),'allow-scripts')
    def test_palette_source_edit_undo_redo(self):
        self.page.check('#dev-hot');self.page.locator('#dev-tree button').filter(has_text='#Panel').click()
        original=self.source('MainView.axaml');self.page.select_option('#dev-toolbox','CheckBox');self.page.get_by_role('button',name='Insert',exact=True).click()
        expect(self.page.locator('#dev-status')).to_contain_text('Restart required',timeout=30000)
        self.assertIn('<CheckBox',self.source('MainView.axaml'))
        self.page.get_by_role('button',name='Undo design',exact=True).click()
        self.assertEqual(self.source('MainView.axaml'),original)
        self.page.get_by_role('button',name='Redo design',exact=True).click()
        self.assertIn('<CheckBox',self.source('MainView.axaml'))
    def test_keyboard_resize_updates_xaml_as_one_undoable_edit(self):
        self.page.check('#dev-hot');self.page.locator('#dev-tree button').filter(has_text='#IncrementButton').click()
        handle=self.preview.get_by_role('button',name='Resize selected visual',exact=True)
        handle.focus();handle.press('Shift+ArrowDown')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        source=self.source('MainView.axaml');self.assertIn('Height=',source);self.assertIn('Width=',source)
        self.page.get_by_role('button',name='Undo design',exact=True).click()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 2',timeout=30000)
        self.assertNotIn('Height=',self.source('MainView.axaml'))
    def test_development_export_contains_sources_and_runs_offline(self):
        with self.page.expect_download() as download:self.page.click('#export')
        html=Path(download.value.path()).read_text();self.assertIn('sourceMappingURL=data:',html)
        page=self.browser.new_page()
        try:
            page.set_content(html,wait_until='load');page.get_by_role('button',name='Increment',exact=True).click()
            expect(page.get_by_text('Count: 1',exact=True)).to_be_visible()
        finally:page.close()
if __name__=='__main__':unittest.main(verbosity=2)
