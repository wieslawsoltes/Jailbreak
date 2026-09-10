from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Actual DLL/nupkg loading, AOT execution, C# reuse and offline export gates."""
from pathlib import Path
import base64, functools, http.server, json, os, threading, unittest
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]

class BinaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site=Path(os.environ.get('JAILBREAK_SITE',ROOT/'site'))
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(cls.site)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start(); executable=os.environ.get('CHROMIUM_EXECUTABLE')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'
        cls.fixture=json.loads((ROOT/'tests/fixtures/msil/fixture.json').read_text())
        (ROOT/'test-results').mkdir(exist_ok=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1000});self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
    def tearDown(self):
        self.page.screenshot(path=str(ROOT/'test-results'/f'{self._testMethodName}.png'),full_page=True)
        self.page.close()
    def navigate(self,path='binary/index.html'):
        if os.environ.get('JAILBREAK_INLINE_TEST'):self.page.set_content((self.site/path).read_text(),wait_until='load')
        else:self.page.goto(self.url+'/'+path)
    def studio(self):
        self.navigate();expect(self.page.locator('#runtime-state')).to_have_text('Ready',timeout=30000)
    def choose(self,label,args,ctor=None):
        select_option(self.page,'#method',label=label);fill(self.page,'#args',json.dumps(args))
        if ctor is not None:fill(self.page,'#constructor',json.dumps(ctor))
    def invoke(self,expected):
        click(self.page,'#invoke');expect(self.page.locator('#result')).to_have_text(expected)
    def upload(self,name):
        self.page.set_input_files('#file',{'name':name,'mimeType':'application/octet-stream','buffer':base64.b64decode(self.fixture['files'][name]['base64'])})
        expect(self.page.locator('#method option').filter(has_text='Calculator::Factorial')).to_have_count(1,timeout=30000)
        expect(self.page.locator('#runtime-state')).to_have_text('Ready',timeout=30000)
    def test_editable_il_changes_real_emitted_behavior_and_failures_block_run(self):
        self.studio();self.invoke('42')
        source=self.page.locator('#il').input_value().replace('add','sub',1)
        fill(self.page,'#il',source);expect(self.page.locator('#invoke')).to_be_disabled()
        click(self.page,'#compile');expect(self.page.locator('#invoke')).to_be_enabled(timeout=30000);self.invoke('38')
        fill(self.page,'#il',source.replace('sub','calli',1));click(self.page,'#compile')
        expect(self.page.locator('#status')).to_have_text('Conversion failed',timeout=30000)
        expect(self.page.locator('#invoke')).to_be_disabled();expect(self.page.locator('#export')).to_be_disabled()
        self.assertEqual(self.errors,[])
    def test_loop_il_compiles_and_returns_clr_style_integer(self):
        self.studio();select_option(self.page,'#sample','loop')
        expect(self.page.locator('#method')).to_contain_text('SumTo',timeout=30000)
        expect(self.page.locator('#invoke')).to_be_enabled();self.choose('Calculator::SumTo',[100]);self.invoke('5050')
    def test_real_dll_upload_calls_recursion_arrays_and_instance_state(self):
        self.studio();self.upload('Jailbreak.BinaryExamples.dll')
        self.choose('Calculator::Factorial',[6]);self.invoke('720')
        self.choose('Calculator::Sequence',[3]);self.invoke('[0,2,4]')
        self.choose('Counter::Increment',[3],[39]);self.invoke('42');self.invoke('45')
        self.choose('NamedCounter::Describe',[],[1]);self.invoke('"named counter"')
        self.assertEqual(self.errors,[])
    def test_real_nupkg_upload_reports_metadata_and_runs_selected_lib(self):
        self.studio();self.upload('Jailbreak.BinaryExamples.1.0.0.nupkg')
        self.choose('Calculator::Add',[40,2]);self.invoke('42')
        self.page.click('[data-tab="package"]')
        expect(self.page.locator('#listing')).to_contain_text('Jailbreak.BinaryExamples')
        expect(self.page.locator('#listing')).to_contain_text('net8.0')
        fill(self.page,'#framework','net9.0');click(self.page,'#compile')
        expect(self.page.locator('#status')).to_have_text('Conversion failed',timeout=30000)
        expect(self.page.locator('#invoke')).to_be_disabled()
    def test_dll_export_is_self_contained_and_origin_isolated(self):
        self.studio();self.upload('Jailbreak.BinaryExamples.dll')
        self.assertEqual(self.page.locator('#preview').get_attribute('sandbox'),'allow-scripts')
        self.assertEqual(self.page.frames[-1].evaluate('() => {try {return parent.document===document;} catch {return "isolated";}}'),'isolated')
        with self.page.expect_download() as pending:click(self.page,'#export')
        exported=Path(pending.value.path()).read_text();app=self.browser.new_page();requests=[]
        app.on('request',lambda r:requests.append(r.url))
        try:
            app.set_content(exported,wait_until='load')
            app.select_option('#method',label='BinaryExamples.Calculator::Add');app.fill('#args','[20,22]');app.click('#run')
            expect(app.locator('#result')).to_have_text('42');self.assertEqual(requests,[])
        finally:app.close()
    def test_malformed_dll_does_not_run_and_preserves_diagnostics(self):
        self.studio();self.page.set_input_files('#file',{'name':'bad.dll','mimeType':'application/octet-stream','buffer':b'MZnot an assembly'})
        expect(self.page.locator('#status')).to_have_text('Conversion failed',timeout=30000)
        expect(self.page.locator('#diagnostics')).to_contain_text('JB6');expect(self.page.locator('#invoke')).to_be_disabled()
    def test_existing_csharp_xaml_workbench_calls_converted_dll_and_exports(self):
        self.navigate('index.html');self.page.wait_for_selector('#samples option[value="BinaryLibrary"]',state='attached')
        select_option(self.page,'#samples','BinaryLibrary');p=self.page.frame_locator('#preview')
        expect(p.get_by_text('Hello, C# and MSIL together',exact=True)).to_be_visible(timeout=30000)
        p.get_by_role('button',name='Call converted DLL').click();expect(p.get_by_text('DLL counter: 42; sum: 5050',exact=True)).to_be_visible()
        with self.page.expect_download() as pending:click(self.page,'#export')
        app=self.browser.new_page()
        try:
            app.set_content(Path(pending.value.path()).read_text(),wait_until='load')
            app.get_by_role('button',name='Call converted DLL').click()
            expect(app.get_by_text('DLL counter: 42; sum: 5050',exact=True)).to_be_visible()
        finally:app.close()
        with self.page.expect_download() as pending:click(self.page,'#save-workspace')
        data=json.loads(Path(pending.value.path()).read_text());record=json.loads(data['files']['library.binary.json'])
        self.assertEqual(record['format'],'jailbreak-binary-v1');self.assertEqual(base64.b64decode(record['base64']),base64.b64decode(self.fixture['files']['Jailbreak.BinaryExamples.dll']['base64']))
        self.assertEqual(self.errors,[])
    def test_existing_workbench_converts_package_before_compiling_source(self):
        self.navigate('index.html');self.page.wait_for_selector('#samples option[value="NugetLibrary"]',state='attached')
        select_option(self.page,'#samples','NugetLibrary');p=self.page.frame_locator('#preview')
        expect(p.get_by_text('Hello, C# and MSIL together',exact=True)).to_be_visible(timeout=30000)
        p.get_by_role('textbox').fill('NuGet');p.get_by_role('button',name='Call converted DLL').click()
        expect(p.get_by_text('Hello, NuGet',exact=True)).to_be_visible()
        expect(p.get_by_text('DLL counter: 42; sum: 5050',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
