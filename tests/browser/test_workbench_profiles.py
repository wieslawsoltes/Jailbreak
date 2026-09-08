"""End-to-end source/build/profile tests against the static site produced by npm run build."""
from pathlib import Path
import functools, http.server, json, os, threading, unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]

class WorkbenchProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT/'site')))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start(); executable=os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'
        (ROOT/'test-results').mkdir(exist_ok=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1000})
        self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.goto(self.url+'/index.html');self.page.wait_for_selector('#samples option[value="BuildProfiles"]',state='attached')
        self.page.select_option('#samples','BuildProfiles')
        expect(self.page.frame_locator('#preview').get_by_text('Debug profile: +1 per click',exact=True)).to_be_visible(timeout=30000)
    def tearDown(self):
        self.page.screenshot(path=str(ROOT/'test-results'/f'{self._testMethodName}.png'),full_page=True)
        self.page.close()
    def set_profile(self,configuration):
        self.page.click('#build-profile');self.page.get_by_label('Configuration',exact=True).fill(configuration)
        self.page.get_by_role('button',name='Apply & build').click()
        expected='Debug profile: +1 per click' if configuration=='Debug' else 'Release profile: +10 per click'
        expect(self.page.frame_locator('#preview').get_by_text(expected,exact=True)).to_be_visible(timeout=30000)
    def test_debug_and_release_execute_different_emitted_handlers(self):
        preview=self.page.frame_locator('#preview')
        preview.get_by_role('button',name='Run compiled handler').click()
        expect(preview.get_by_text('Count: 1',exact=True)).to_be_visible()
        self.set_profile('Release');preview.get_by_role('button',name='Run compiled handler').click()
        expect(preview.get_by_text('Count: 10',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])
    def test_evaluated_profiles_include_imports_and_separate_library_symbols(self):
        self.set_profile('Release');self.page.click('#build-profile')
        self.page.get_by_label('Evaluated project',exact=True).select_option('App/App.csproj')
        text=self.page.locator('#build-profile-dialog').inner_text()
        self.assertNotIn('DebugOnly.cs',text);self.assertNotIn('Native.cs',text)
        self.page.get_by_text('Imported project files',exact=True).click()
        self.assertIn('build/Web.props',self.page.locator('#build-profile-dialog').inner_text())
        self.page.get_by_label('Evaluated project',exact=True).select_option('Library/Library.csproj')
        text=self.page.locator('#build-profile-dialog details').first.inner_text()
        self.assertIn('NETSTANDARD2_0',text);self.assertNotIn('\nAPP\n',text)
    def test_profile_survives_reload_and_json_export(self):
        self.set_profile('Release');self.page.reload()
        expect(self.page.frame_locator('#preview').get_by_text('Release profile: +10 per click',exact=True)).to_be_visible(timeout=30000)
        with self.page.expect_download() as pending:self.page.click('#save-workspace')
        data=json.loads(Path(pending.value.path()).read_text())
        self.assertEqual(data['profile']['configuration'],'Release');self.assertIn('Directory.Build.props',data['files'])
    def test_exported_html_keeps_selected_profile_and_runs_without_dotnet(self):
        self.set_profile('Release')
        with self.page.expect_download() as pending:self.page.click('#export')
        html=Path(pending.value.path()).read_text();app=self.browser.new_page()
        try:
            app.set_content(html,wait_until='load')
            expect(app.get_by_text('Release profile: +10 per click',exact=True)).to_be_visible()
            app.get_by_role('button',name='Run compiled handler').click()
            expect(app.get_by_text('Count: 10',exact=True)).to_be_visible()
        finally:app.close()
    def test_compiler_error_blocks_profile_preview(self):
        self.page.click('#build-profile');self.page.get_by_label('Additional C# symbols').fill('LIBRARY;APP')
        self.page.get_by_role('button',name='Apply & build').click()
        expect(self.page.locator('#problems')).to_contain_text('Library received an incorrect project symbol profile',timeout=30000)
        expect(self.page.locator('#preview-state')).to_have_text('Build failed')
    def test_preview_stays_opaque_origin(self):
        self.assertEqual(self.page.locator('#preview').get_attribute('sandbox'),'allow-scripts')
        isolated=self.page.frames[-1].evaluate('''() => {try {return parent.document===document;} catch {return "isolated";}}''')
        self.assertEqual(isolated,'isolated')

if __name__=='__main__':unittest.main(verbosity=2)
