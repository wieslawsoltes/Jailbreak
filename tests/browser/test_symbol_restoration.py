"""Controlled HTTPS responses use original SDK bytes; no substitute runtime or source implementation."""
import unittest,json,base64
from pathlib import Path
import test_development as baseline
from desktop_ui import show_tool,command
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parents[2]
class SymbolRestorationTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source
    def prepare(self,bad_source=False):
        fixture=json.loads((ROOT/'tests/fixtures/msil/pdb.json').read_text());self.requests=[]
        def serve(route):
            url=route.request.url;self.requests.append(url)
            payload=base64.b64decode(fixture['files']['Jailbreak.PdbExamples.pdb']['base64']) if url.endswith('.pdb') else (fixture['source']+('// changed' if bad_source else '')).encode()
            route.fulfill(body=payload,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/octet-stream'})
        self.page.route('https://symbols.example/**',serve);self.page.route('https://raw.githubusercontent.com/**',serve)
        show_tool(self.page,'symbols');self.page.set_input_files('#symbols-file',{'name':'Jailbreak.PdbExamples.dll','mimeType':'application/octet-stream','buffer':base64.b64decode(fixture['files']['Jailbreak.PdbExamples.dll']['base64'])})
        expect(self.page.locator('#symbols-report')).to_contain_text('Jailbreak.PdbExamples')
        self.page.fill('#symbols-servers','https://symbols.example/store');self.page.fill('#symbols-origins','https://raw.githubusercontent.com');self.page.check('#symbols-refresh')
        return fixture
    def test_explicit_restore_attach_original_sources_and_execute_real_library(self):
        fixture=self.prepare();self.page.click('#symbols-inspect');self.assertEqual(self.requests,[]);expect(self.page.locator('#symbols-restore')).to_be_disabled()
        self.page.check('#symbols-consent');self.page.click('#symbols-restore');expect(self.page.locator('#symbols-status')).to_contain_text('Verified 1 original',timeout=30000)
        self.assertEqual(len(self.requests),2);expect(self.page.locator('#symbols-attach')).to_be_enabled();self.page.click('#symbols-attach')
        expect(self.page.locator('#symbols-status')).to_contain_text('Verified symbols attached',timeout=30000)
        expect(self.preview.get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        show_tool(self.page,'solution');symbol=self.page.locator('#files button').filter(has_text='[symbol]').filter(has_text='Calculations.cs');expect(symbol).to_be_visible(timeout=30000);symbol.click()
        self.assertTrue(self.page.locator('#editor').evaluate('e=>e.readOnly'));self.assertEqual(self.page.locator('#editor').input_value(),fixture['source'])
        code=self.source('MainView.axaml.cs').replace('count += 1','count = PdbExamples.Calculations.Sum(10)');self.page.locator('#editor').fill(code);self.page.click('#run')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000);self.preview.get_by_role('button',name='Increment',exact=True).click();expect(self.preview.get_by_text('Count: 45',exact=True)).to_be_visible()
        with self.page.expect_download() as d:command(self.page,'File: Download workspace')
        saved=json.loads(Path(d.value.path()).read_text());record=json.loads(saved['files']['libraries/Jailbreak.PdbExamples.dll.binary.json']);self.assertEqual(base64.b64decode(record['symbols']['pdb']),base64.b64decode(fixture['files']['Jailbreak.PdbExamples.pdb']['base64']));self.assertEqual(list(record['symbols']['sources'].values()),[fixture['source']]);self.assertEqual(self.errors,[])
    def test_source_checksum_failure_preserves_workspace_and_running_input(self):
        self.preview.get_by_role('textbox').fill('preserve on failure');self.prepare(bad_source=True);self.page.check('#symbols-consent');self.page.click('#symbols-restore')
        expect(self.page.locator('#symbols-status')).to_contain_text('checksum mismatch',timeout=30000);expect(self.page.locator('#symbols-attach')).to_be_disabled()
        expect(self.preview.get_by_role('textbox')).to_have_value('preserve on failure')
        with self.page.expect_download() as d:command(self.page,'File: Download workspace')
        saved=json.loads(Path(d.value.path()).read_text());self.assertNotIn('libraries/Jailbreak.PdbExamples.dll.binary.json',saved['files']);self.assertEqual(self.errors,[])
    def test_source_origin_needs_separate_approval_and_policy_changes_revoke_consent(self):
        self.prepare();self.page.check('#symbols-consent');self.page.fill('#symbols-origins','');expect(self.page.locator('#symbols-consent')).not_to_be_checked();self.page.check('#symbols-consent');self.page.click('#symbols-restore')
        expect(self.page.locator('#symbols-status')).to_contain_text('Approve Source Link origin',timeout=30000);self.assertEqual(len(self.requests),1);self.assertTrue(self.requests[0].endswith('.pdb'));expect(self.page.locator('#symbols-attach')).to_be_disabled();self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
