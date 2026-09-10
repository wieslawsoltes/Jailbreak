from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Studio integration gates execute the actual compiled app, debugger and binary compiler."""
import unittest, json
from pathlib import Path
import test_development as baseline
from playwright.sync_api import expect

class StudioTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source

    def test_top_debugger_gutter_locals_edit_and_continue_execute_real_csharp(self):
        code=self.source('MainView.axaml.cs').replace('count += 1;', 'int delta = 1;\n        count += delta;')
        self.page.locator('#editor').fill(code)
        select_option(self.page,'#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        offset=code.index('count += delta')
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}',offset)
        self.page.keyboard.press('F9')
        line=code[:offset].count('\n')+1
        expect(self.page.locator(f'.studio-gutter-point[data-line="{line}"]')).to_have_attribute('aria-pressed','true')
        self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        expect(self.page.locator('#studio-locals')).to_contain_text('delta')
        expect(self.page.locator('#studio-execution-line')).to_be_visible()
        self.page.locator('#studio-locals').get_by_role('button',name='Edit delta',exact=True).click()
        fill(self.page,'#studio-local-input','7');click(self.page,'#studio-local-apply')
        expect(self.page.locator('#studio-locals')).to_contain_text('7')
        show_tool(self.page,'stack')
        expect(self.page.locator('#studio-stack')).to_contain_text('Increment')
        click(self.page,'#run')
        expect(self.page.frame_locator('#preview').get_by_text('Count: 7',exact=True)).to_be_visible()
        expect(self.page.locator('#studio-execution-line')).not_to_be_visible()
        self.assertEqual(self.errors,[])

    def test_designer_perspective_properties_and_hot_reload_share_runtime(self):
        click(self.page,'#studio-hot-reload')
        self.page.frame_locator('#preview').get_by_role('textbox').fill('keep this input')
        root=self.page.frames[-1].evaluate('appHandle.root.uid')
        click(self.page,'#studio-view-design')
        self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.get_by_label('Design Content',exact=True)).to_have_value('Increment')
        fill(self.page,'#studio-property-search','Content')
        self.page.get_by_label('Design Content',exact=True).fill('Add one')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button',name='Apply').click()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Add one',exact=True)).to_be_visible()
        expect(self.page.frame_locator('#preview').get_by_role('textbox')).to_have_value('keep this input')
        self.assertEqual(self.page.frames[-1].evaluate('appHandle.root.uid'),root)
        self.assertEqual(self.errors,[])

    def test_embedded_binary_compiler_runs_and_preserves_source_app(self):
        self.page.frame_locator('#preview').get_by_role('textbox').fill('retained UI')
        click(self.page,'#studio-view-binary')
        binary=self.page.frame_locator('#studio-binary-frame')
        expect(binary.locator('#status')).to_have_text('Conversion succeeded',timeout=30000)
        expect(binary.locator('#invoke')).to_be_enabled(timeout=30000)
        binary.locator('#invoke').click()
        expect(binary.locator('#result')).to_have_text('42')
        click(self.page,'#studio-view-split')
        expect(self.page.frame_locator('#preview').get_by_role('textbox')).to_have_value('retained UI')
        click(self.page,'#studio-view-binary')
        expect(binary.locator('#result')).to_have_text('42')
        self.assertEqual(self.page.locator('#studio-binary-frame').get_attribute('sandbox'),'allow-scripts allow-downloads')
        self.assertEqual(self.errors,[])

    def test_close_and_reopen_tabs_does_not_delete_edited_workspace_source(self):
        original=self.source('MainView.axaml.cs')
        self.page.locator('#editor').fill(original+'\n// retained after tab close\n')
        self.page.get_by_role('button',name='Close MainView.axaml.cs',exact=True).click()
        expect(self.page.locator('#tabs [role=tab]').filter(has_text='MainView.axaml.cs')).to_have_count(0)
        self.page.keyboard.press('Control+Shift+t')
        expect(self.page.locator('#editor')).to_have_value(original+'\n// retained after tab close\n')
        with self.page.expect_download() as d:click(self.page,'#save-workspace')
        workspace=json.loads(Path(d.value.path()).read_text())
        self.assertIn('// retained after tab close',workspace['files']['MainView.axaml.cs'])
        self.assertIn('studio',workspace)
        self.assertEqual(self.errors,[])

    def test_error_list_search_and_navigation_use_real_compiler_diagnostics(self):
        code=self.source('MainView.axaml.cs').replace('count += 1','UnavailableApi()')
        self.page.locator('#editor').fill(code);click(self.page,'#run')
        expect(self.page.locator('#studio-session-badge')).to_have_text('Build failed',timeout=30000)
        expect(self.page.locator('.diagnostic-row').first).to_be_visible()
        fill(self.page,'#studio-diagnostic-search','nonexistent-diagnostic')
        self.assertEqual(self.page.locator('.diagnostic-row:visible').count(),0)
        fill(self.page,'#studio-diagnostic-search','UnavailableApi')
        expect(self.page.locator('.diagnostic-row:visible').first).to_be_visible()
        self.page.locator('.diagnostic-row:visible').first.click()
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml.cs')
        self.assertEqual(self.errors,[])

    def test_watch_window_inspects_real_paused_frame_and_rejects_calls(self):
        code=self.source('MainView.axaml.cs')
        select_option(self.page,'#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        offset=code.index('CounterLabel.Text')
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}',offset)
        self.page.keyboard.press('F9')
        self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        show_tool(self.page,'watch')
        fill(self.page,'#studio-watch-input','this.count, this.constructor()');click(self.page,'#studio-evaluate-watches')
        expect(self.page.locator('#studio-watch')).to_contain_text('this.count')
        expect(self.page.locator('#studio-watch')).to_contain_text('only support property paths')
        click(self.page,'#run')
        expect(self.page.frame_locator('#preview').get_by_text('Count: 1',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_breakpoint_and_tool_tabs_support_keyboard_activation(self):
        show_tool(self.page,'outline');show_tool(self.page,'solution')
        self.page.locator('#dock-tab-solution').focus();self.page.keyboard.press('End')
        expect(self.page.locator('#dock-tab-outline')).to_have_attribute('aria-selected','true')
        expect(self.page.locator('#files-panel')).not_to_be_visible()
        show_tool(self.page,'locals');show_tool(self.page,'watch')
        self.page.locator('#dock-tab-watch').focus();self.page.keyboard.press('Home')
        expect(self.page.locator('#dock-tab-locals')).to_have_attribute('aria-selected','true')
        self.assertEqual(self.errors,[])

    def test_mobile_and_light_theme_keep_tools_available_without_overflow(self):
        click(self.page,'#theme');self.page.set_viewport_size({'width':390,'height':844})
        close_settings(self.page)
        expect(self.page.locator('#studio-view-design')).to_be_visible()
        click(self.page,'#studio-view-design')
        expect(self.page.locator('[data-tool-window=properties]')).to_be_visible()
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertEqual(self.errors,[])

    def test_new_file_dialog_builds_solution_tree_and_rejects_unsafe_paths(self):
        click(self.page,'#new-file')
        fill(self.page,'#studio-new-file-name','../outside.cs');click(self.page,'#studio-new-file-create')
        expect(self.page.locator('#studio-new-file-dialog [role=alert]')).to_contain_text('relative')
        fill(self.page,'#studio-new-file-name','Views/Inspector.axaml');click(self.page,'#studio-new-file-create')
        expect(self.page.locator('#studio-new-file-dialog')).not_to_be_visible()
        expect(self.page.locator('#files .studio-folder summary')).to_contain_text('Views')
        expect(self.page.locator('#current-path')).to_have_text('Views/Inspector.axaml')
        self.assertIn('<UserControl',self.page.locator('#editor').input_value())
        self.assertEqual(self.errors,[])

    def test_font_size_and_studio_commands_use_existing_workbench(self):
        select_option(self.page,'#studio-font-size','16')
        self.assertEqual(self.page.locator('#editor').evaluate('e=>getComputedStyle(e).fontSize'),'16px')
        self.page.keyboard.press('Control+Shift+p');fill(self.page,'#wb-palette-query','View Watch window');self.page.keyboard.press('Enter')
        expect(self.page.locator('#dock-tab-watch')).to_have_attribute('aria-selected','true')
        with self.page.expect_download() as d:click(self.page,'#save-workspace')
        workspace=json.loads(Path(d.value.path()).read_text())
        self.assertEqual(workspace['studio']['fontSize'],16)
        self.assertEqual(workspace['studio']['bottom'],'watch')
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
