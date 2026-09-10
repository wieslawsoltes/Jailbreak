from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Real emitted DLL continuations in Studio and the offline Binary Studio runner."""
import base64, json, unittest
from pathlib import Path
import test_msil as baseline
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parents[2]
class MsilContinuationTests(unittest.TestCase):
    setUpClass=classmethod(baseline.BinaryTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.BinaryTests.tearDownClass.__func__)
    setUp=baseline.BinaryTests.setUp
    tearDown=baseline.BinaryTests.tearDown
    navigate=baseline.BinaryTests.navigate
    studio=baseline.BinaryTests.studio
    choose=baseline.BinaryTests.choose

    def binary_debug(self):
        self.studio();check(self.page,'#cooperative-debug')
        runner=self.page.frame_locator('#preview')
        expect(runner.locator('#binary-debugger')).to_be_visible(timeout=30000)
        expect(self.page.locator('#invoke')).to_be_enabled(timeout=30000)
        return runner

    def test_binary_instruction_steps_stack_and_offline_export(self):
        runner=self.binary_debug();runner.locator('#binary-debug-entry').check()
        click(self.page,'#invoke');expect(runner.locator('#binary-debug-state')).to_have_text('Paused')
        runner.locator('#binary-debug-into').click()
        expect(runner.locator('#binary-debug-values')).to_contain_text('$evaluationStack')
        expect(runner.locator('#binary-debug-values')).to_contain_text('40')
        runner.locator('#binary-debug-continue').click();expect(self.page.locator('#result')).to_have_text('42')
        with self.page.expect_download() as download:click(self.page,'#export')
        html=Path(download.value.path()).read_text();app=self.browser.new_page();requests=[]
        app.on('request',lambda r:requests.append(r.url))
        try:
            app.set_content(html,wait_until='load');app.locator('#binary-debug-entry').check();app.click('#run')
            expect(app.locator('#binary-debug-state')).to_have_text('Paused')
            app.click('#binary-debug-continue');expect(app.locator('#result')).to_have_text('42')
            self.assertEqual(requests,[])
        finally:app.close()
        self.assertEqual(self.errors,[])

    def test_uploaded_pdb_locals_mutation_and_source_breakpoint(self):
        self.binary_debug();f=json.loads((ROOT/'tests/fixtures/msil/pdb.json').read_text())
        self.page.set_input_files('#file',[{'name':n,'mimeType':'application/octet-stream','buffer':base64.b64decode(v['base64'])} for n,v in f['files'].items() if n.endswith(('.dll','.pdb'))])
        expect(self.page.locator('#method')).to_contain_text('Calculations::Sum',timeout=30000)
        expect(self.page.locator('#invoke')).to_be_enabled(timeout=30000)
        runner=self.page.frame_locator('#preview');expect(runner.locator('#binary-debug-listing')).to_have_value(f['source'])
        runner.locator('#binary-debug-line').fill('10');runner.locator('#binary-debug-breakpoint').click()
        self.choose('Calculations::Sum',[4]);click(self.page,'#invoke')
        expect(runner.locator('#binary-debug-state')).to_have_text('Paused')
        expect(runner.locator('#binary-debug-values')).to_contain_text('"total": 0')
        runner.locator('#binary-debug-local').fill('total');runner.locator('#binary-debug-value').fill('40');runner.locator('#binary-debug-set-local').click()
        runner.locator('#binary-debug-clear').click();runner.locator('#binary-debug-continue').click()
        expect(self.page.locator('#result')).to_have_text('46');self.assertEqual(self.errors,[])

    def test_cancel_binary_call_and_reject_wrong_channel(self):
        runner=self.binary_debug();runner.locator('#binary-debug-entry').check();click(self.page,'#invoke')
        expect(runner.locator('#binary-debug-state')).to_have_text('Paused')
        self.page.frames[-1].evaluate("window.postMessage({kind:'debug-command',channel:'wrong',taskId:1,action:'continue'},'*')")
        expect(runner.locator('#binary-debug-state')).to_have_text('Paused')
        runner.locator('#binary-debug-cancel').click();expect(runner.locator('#binary-debug-state')).to_have_text('cancelled')
        expect(runner.locator('#result')).to_have_text('Cancelled')
        runner.locator('#binary-debug-entry').uncheck();click(self.page,'#invoke');expect(self.page.locator('#result')).to_have_text('42')
        self.assertEqual(self.errors,[])

    def test_studio_steps_source_to_dll_and_back_with_shared_debug_windows(self):
        self.navigate('index.html');self.page.wait_for_selector('#samples option[value="PdbLibrary"]',state='attached')
        select_option(self.page,'#samples','PdbLibrary')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Call library Sum')).to_be_visible(timeout=30000)
        select_option(self.page,'#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        show_tool(self.page,'solution')
        self.page.locator('#files button').filter(has_text='[symbol]').filter(has_text='Calculations.cs').click()
        source=self.page.locator('#editor').input_value();offset=source.index('total += i')
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}',offset);self.page.keyboard.press('F9')
        self.page.frame_locator('#preview').get_by_role('button',name='Call library Sum').click()
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        expect(self.page.locator('#studio-locals')).to_contain_text('total')
        expect(self.page.locator('#studio-execution-line')).to_be_visible()
        self.assertTrue(self.page.locator('#editor').evaluate('e=>e.readOnly'))
        self.page.locator('#studio-locals').get_by_role('button',name='Edit total',exact=True).click()
        fill(self.page,'#studio-local-input','100');click(self.page,'#studio-local-apply')
        show_tool(self.page,'stack');expect(self.page.locator('#studio-stack')).to_contain_text('PdbExamples.Calculations.Sum')
        expect(self.page.locator('#studio-stack')).to_contain_text('PdbLibrary.MainView.Calculate')
        show_tool(self.page,'breakpoints');click(self.page,'#studio-clear-breakpoints')
        self.page.keyboard.press('Shift+F11')
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml.cs')
        self.page.keyboard.press('F5')
        expect(self.page.frame_locator('#preview').get_by_text('Library sum: 145',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_studio_symbol_free_dll_documents_are_labeled_il(self):
        self.navigate('index.html');self.page.wait_for_selector('#samples option[value="BinaryLibrary"]',state='attached')
        select_option(self.page,'#samples','BinaryLibrary')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Call converted DLL')).to_be_visible(timeout=30000)
        select_option(self.page,'#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        show_tool(self.page,'solution')
        item=self.page.locator('#files button').filter(has_text='[IL]').first;expect(item).to_be_visible();item.click()
        self.assertTrue(self.page.locator('#editor').evaluate('e=>e.readOnly'))
        self.assertTrue(self.page.locator('#editor').input_value().startswith('IL_'))
        self.page.frame_locator('#preview').get_by_role('button',name='Call converted DLL').click()
        expect(self.page.frame_locator('#preview').get_by_text('DLL counter: 42; sum: 5050',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
