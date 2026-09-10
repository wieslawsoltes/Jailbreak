from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Native Windows symbols must work through the same real Studio and offline debugger."""
import base64, json, unittest
from pathlib import Path
import test_msil as baseline
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parents[2]
class NativeSymbolTests(unittest.TestCase):
    setUpClass=classmethod(baseline.BinaryTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.BinaryTests.tearDownClass.__func__)
    setUp=baseline.BinaryTests.setUp
    tearDown=baseline.BinaryTests.tearDown
    navigate=baseline.BinaryTests.navigate
    studio=baseline.BinaryTests.studio
    choose=baseline.BinaryTests.choose
    def upload(self,changed=False):
        f=json.loads((ROOT/'tests/fixtures/msil/native-pdb.json').read_text())
        files=[{'name':n,'mimeType':'application/octet-stream','buffer':base64.b64decode(v['base64'])} for n,v in f['files'].items()]
        files.append({'name':'Library.cs','mimeType':'text/plain','buffer':(f['source']+('// changed' if changed else '')).encode('utf8')})
        self.page.set_input_files('#file',files)
        return f
    def test_native_source_breakpoint_mutation_and_offline_export(self):
        self.studio();check(self.page,'#cooperative-debug');f=self.upload()
        expect(self.page.locator('#method')).to_contain_text('Calculations::Sum',timeout=30000)
        expect(self.page.locator('#invoke')).to_be_enabled(timeout=30000)
        runner=self.page.frame_locator('#preview')
        expect(runner.locator('#binary-debug-listing')).to_have_value(f['source'].replace('\r\n','\n'))
        runner.locator('#binary-debug-line').fill('11');runner.locator('#binary-debug-breakpoint').click()
        self.choose('Calculations::Sum',[4]);click(self.page,'#invoke')
        expect(runner.locator('#binary-debug-state')).to_have_text('Paused')
        expect(runner.locator('#binary-debug-values')).to_contain_text('"total": 0')
        runner.locator('#binary-debug-local').fill('total');runner.locator('#binary-debug-value').fill('40');runner.locator('#binary-debug-set-local').click()
        runner.locator('#binary-debug-clear').click();runner.locator('#binary-debug-continue').click()
        expect(self.page.locator('#result')).to_have_text('46')
        with self.page.expect_download() as download:click(self.page,'#export')
        app=self.browser.new_page();requests=[];app.on('request',lambda r:requests.append(r.url))
        try:
            app.set_content(Path(download.value.path()).read_text(),wait_until='load')
            app.select_option('#method',label='NativeSymbols.Calculations::Sum');app.fill('#args','[10]')
            app.check('#binary-debug-entry');app.click('#run');expect(app.locator('#binary-debug-state')).to_have_text('Paused')
            app.click('#binary-debug-continue');expect(app.locator('#result')).to_have_text('45')
            self.assertEqual(requests,[])
        finally:app.close()
        self.assertEqual(self.errors,[])
    def test_native_wrong_source_cannot_run_or_export(self):
        self.studio();check(self.page,'#cooperative-debug');self.upload(changed=True)
        expect(self.page.locator('#status')).to_have_text('Conversion failed',timeout=30000)
        expect(self.page.locator('#diagnostics')).to_contain_text('checksum mismatch')
        expect(self.page.locator('#invoke')).to_be_disabled();expect(self.page.locator('#export')).to_be_disabled()
        self.assertEqual(self.errors,[])
    def test_studio_source_caller_and_native_pdb_share_frames(self):
        self.navigate('index.html');self.page.wait_for_selector('#samples option[value="NativeSymbols"]',state='attached')
        select_option(self.page,'#samples','NativeSymbols')
        preview=self.page.frame_locator('#preview')
        expect(preview.get_by_role('button',name='Call native-symbol library')).to_be_visible(timeout=30000)
        select_option(self.page,'#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        show_tool(self.page,'solution')
        self.page.locator('#files button').filter(has_text='[symbol]').filter(has_text='Library.cs').click()
        source=self.page.locator('#editor').input_value();offset=source.index('total += i')
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}',offset);self.page.keyboard.press('F9')
        preview.get_by_role('button',name='Call native-symbol library').click()
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        show_tool(self.page,'stack')
        expect(self.page.locator('#studio-stack')).to_contain_text('NativeSymbols.Calculations.Sum')
        expect(self.page.locator('#studio-stack')).to_contain_text('NativeLibrary.MainView.Calculate')
        self.page.screenshot(path=str(ROOT/'test-results'/'native-studio-paused.png'),full_page=True)
        show_tool(self.page,'breakpoints');click(self.page,'#studio-clear-breakpoints');self.page.keyboard.press('F5')
        expect(preview.get_by_text('Windows library sum: 45',exact=True)).to_be_visible(timeout=30000)
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
