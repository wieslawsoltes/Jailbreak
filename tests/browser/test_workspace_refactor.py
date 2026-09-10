from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Real source/design history, local review and compiler-validated component extraction."""
import unittest,json
from pathlib import Path
import test_development as baseline
from playwright.sync_api import expect
class WorkspaceRefactorTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source
    def grid(self):
        select_option(self.page,'#samples','GridDesigner');self.preview=self.page.frame_locator('#preview')
        expect(self.preview.get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        click(self.page,'#studio-view-design');expect(self.page.locator('#dev-tree')).to_contain_text('#Layout',timeout=30000)
        click(self.page,'#studio-hot-reload')
    def test_source_and_designer_share_undo_redo_chronology(self):
        before=self.source('MainView.axaml.cs');self.page.locator('#editor').fill(before.replace('count += 1','count += 2'));click(self.page,'#run')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        select_control(self.page,'#IncrementButton')
        self.page.get_by_label('Design Content',exact=True).fill('Updated label')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button',name='Apply').click()
        expect(self.preview.get_by_role('button',name='Updated label',exact=True)).to_be_visible(timeout=30000)
        click(self.page,'#source-undo');self.assertIn('Content="Increment"',self.source('MainView.axaml'))
        click(self.page,'#source-undo');self.assertEqual(self.source('MainView.axaml.cs'),before)
        click(self.page,'#source-redo');self.assertIn('count += 2',self.source('MainView.axaml.cs'))
        click(self.page,'#source-redo');self.assertIn('Updated label',self.source('MainView.axaml'))
        self.assertEqual(self.errors,[])
    def test_checkpoint_diff_restore_and_undo(self):
        before=self.source('MainView.axaml.cs');self.page.locator('#editor').fill(before.replace('count += 1','count += 9'))
        click(self.page,'#studio-change-review');expect(self.page.locator('#workspace-change-list')).to_contain_text('MainView.axaml.cs')
        expect(self.page.locator('#workspace-diff .add')).to_contain_text('count += 9')
        expect(self.page.locator('#workspace-diff .remove')).to_contain_text('count += 1')
        self.page.screenshot(path=str(baseline.ROOT/'test-results'/'workspace-change-review.png'),full_page=True)
        click(self.page,'#workspace-restore-file');expect(self.page.locator('#workspace-review-title')).to_have_text('Restore checkpoint')
        click(self.page,'#workspace-apply');click(self.page,'#workspace-review-close')
        self.assertEqual(self.source('MainView.axaml.cs'),before)
        click(self.page,'#source-undo');self.assertIn('count += 9',self.source('MainView.axaml.cs'))
        self.assertEqual(self.errors,[])
    def test_extract_compiles_three_files_then_restarts_explicitly_and_undo_restores(self):
        self.grid();select_control(self.page,'#Sidebar');old=self.source('MainView.axaml');identity=self.page.frames[-1].evaluate('appHandle.root.uid')
        click(self.page,'#studio-extract-component');fill(self.page,'#component-name','SidebarView');click(self.page,'#component-preview')
        expect(self.page.locator('#workspace-review')).to_be_visible(timeout=30000)
        expect(self.page.locator('#workspace-review-summary')).to_contain_text('3 files')
        expect(self.page.locator('#workspace-change-list')).to_contain_text('Components/SidebarView.axaml.cs')
        self.page.screenshot(path=str(baseline.ROOT/'test-results'/'component-extraction-review.png'),full_page=True)
        click(self.page,'#workspace-apply');expect(self.page.locator('#dev-status')).to_contain_text('Restart required',timeout=30000)
        self.assertEqual(self.page.frames[-1].evaluate('appHandle.root.uid'),identity)
        click(self.page,'#dev-restart');expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.assertEqual(self.page.frames[-1].evaluate('appHandle.root.Sidebar.constructor.$fullName'),'GridDesigner.SidebarView')
        self.assertEqual(self.page.locator('#entry').input_value(),'MainView.axaml')
        click(self.page,'#studio-change-review');click(self.page,'#workspace-undo');click(self.page,'#workspace-review-close')
        self.assertEqual(self.source('MainView.axaml'),old)
        self.assertEqual(self.page.locator('#files button').filter(has_text='SidebarView.axaml.cs').count(),0)
        self.assertEqual(self.errors,[])
    def test_extraction_rejects_external_code_ownership_without_touching_source(self):
        self.grid();select_control(self.page,'#ContentCard');before=self.source('MainView.axaml')
        click(self.page,'#studio-extract-component');fill(self.page,'#component-name','UnsafeCard');click(self.page,'#component-preview')
        expect(self.page.locator('#component-message')).to_contain_text('referenced from C#')
        click(self.page,'#component-cancel');self.assertEqual(self.source('MainView.axaml'),before)
        self.assertEqual(self.page.locator('#files button').filter(has_text='UnsafeCard').count(),0)
        self.assertEqual(self.errors,[])
    def test_changes_export_and_reviewed_import_round_trip(self):
        before=self.source('MainView.axaml.cs');after=before.replace('count += 1','count += 4');self.page.locator('#editor').fill(after)
        click(self.page,'#studio-change-review')
        with self.page.expect_download() as d:click(self.page,'#workspace-export-changes')
        text=Path(d.value.path()).read_text();payload=json.loads(text);self.assertEqual(payload['format'],'jailbreak-source-changes-v1');self.assertEqual(payload['changes'][0]['before'],before)
        click(self.page,'#workspace-undo');self.page.set_input_files('#workspace-import-file',{'name':'changes.json','mimeType':'application/json','buffer':text.encode()})
        expect(self.page.locator('#workspace-review-title')).to_have_text('Import reviewed changes');click(self.page,'#workspace-apply');click(self.page,'#workspace-review-close')
        self.assertEqual(self.source('MainView.axaml.cs'),after);self.assertEqual(self.errors,[])
    def test_named_checkpoint_after_edit_is_the_new_comparison_baseline(self):
        before=self.source('MainView.axaml.cs');self.page.locator('#editor').fill(before.replace('count += 1','count += 5'))
        click(self.page,'#studio-change-review');fill(self.page,'#workspace-checkpoint-name','Before layout');click(self.page,'#workspace-checkpoint')
        select_option(self.page,'#workspace-checkpoints',index=1)
        expect(self.page.locator('#workspace-review-summary')).to_contain_text('0 files')
        expect(self.page.locator('#workspace-checkpoints')).to_contain_text('Before layout');self.assertEqual(self.errors,[])
    def test_stale_review_rejects_changes_without_overwriting_newer_source(self):
        original=self.source('MainView.axaml.cs');changed=original.replace('count += 1','count += 6')
        self.page.locator('#editor').fill(changed);click(self.page,'#studio-change-review');click(self.page,'#workspace-restore-all')
        # An async external editor update arrives while the review is open.
        self.page.locator('#editor').evaluate("(e)=>{e.value+='\\n// newer source';e.dispatchEvent(new Event('input'));}")
        click(self.page,'#workspace-apply');expect(self.page.locator('#workspace-review-message')).to_contain_text('Workspace changed after review')
        click(self.page,'#workspace-review-close');self.assertIn('// newer source',self.source('MainView.axaml.cs'));self.assertIn('count += 6',self.page.locator('#editor').input_value())
        self.assertEqual(self.errors,[])
    def test_component_validation_cancel_never_reopens_review(self):
        self.grid();select_control(self.page,'#Sidebar');before=self.source('MainView.axaml')
        # Delay delivery, not compilation/results, to exercise cancellation while the real worker is pending.
        self.page.evaluate("""()=>{const original=Worker.prototype.postMessage;Worker.prototype.postMessage=function(data,...args){if(data.files?.['Components/CancelledView.axaml']){const worker=this;setTimeout(()=>original.call(worker,data,...args),200);return;}return original.call(this,data,...args);};}""")
        click(self.page,'#studio-extract-component');fill(self.page,'#component-name','CancelledView');click(self.page,'#component-preview');click(self.page,'#component-cancel')
        self.page.wait_for_timeout(500);expect(self.page.locator('#workspace-review')).not_to_be_visible();self.assertEqual(self.source('MainView.axaml'),before)
        self.assertEqual(self.page.locator('#files button').filter(has_text='CancelledView').count(),0);self.assertEqual(self.errors,[])
    def test_review_and_component_dialogs_fit_mobile_and_restore_focus(self):
        self.page.set_viewport_size({'width':390,'height':844});close_settings(self.page)
        click(self.page,'#studio-change-review');expect(self.page.locator('#workspace-review')).to_be_visible()
        self.assertLessEqual(self.page.locator('#workspace-review').bounding_box()['width'],390)
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.keyboard.press('Escape');expect(self.page.locator('#studio-change-review')).to_be_focused();self.assertEqual(self.errors,[])
    def test_new_file_validation_is_atomic_and_creation_is_undoable(self):
        before=self.source('MainView.axaml.cs')
        click(self.page,'#new-file')
        for path,expected in [('__proto__/Bad.cs','Invalid relative'),('mainview.axaml.cs','collision')]:
            fill(self.page,'#studio-new-file-name',path);click(self.page,'#studio-new-file-create')
            expect(self.page.locator('#studio-new-file-dialog [role=alert]')).to_contain_text(expected)
        click(self.page,'#studio-new-file-cancel')
        with self.page.expect_download() as d:click(self.page,'#save-workspace')
        files=json.loads(Path(d.value.path()).read_text())['files']
        self.assertNotIn('__proto__/Bad.cs',files);self.assertNotIn('mainview.axaml.cs',files)
        self.assertEqual(files['MainView.axaml.cs'],before)
        click(self.page,'#new-file');fill(self.page,'#studio-new-file-name','Models/Fresh.cs');click(self.page,'#studio-new-file-create')
        expect(self.page.locator('#current-path')).to_have_text('Models/Fresh.cs')
        click(self.page,'#source-undo')
        self.assertEqual(self.page.locator('#files button').filter(has_text='Fresh.cs').count(),0)
        click(self.page,'#source-redo');self.assertIn('class NewClass',self.source('Models/Fresh.cs'))
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
