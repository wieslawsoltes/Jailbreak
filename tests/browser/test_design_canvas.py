from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Source-backed designer gestures on an actual C#/XAML application, not a mock canvas."""
import unittest,json
from pathlib import Path
import test_development as baseline
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parents[2]
class DesignCanvasTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source
    def setUp(self):
        baseline.DevelopmentTests.setUp(self)
        select_option(self.page,'#samples','DesignerWorkspace')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Preview',exact=True)).to_be_visible(timeout=30000)
        click(self.page,'#studio-view-design')
        expect(self.page.locator('#dev-tree')).to_contain_text('#PreviewAction',timeout=30000)
        click(self.page,'#studio-hot-reload')
        self.preview=self.page.frame_locator('#preview')
    def select(self,name,add=False):
        show_tool(self.page,'outline');self.page.locator('#dev-tree button').filter(has_text='#'+name).click(modifiers=['Shift'] if add else [])
        if not add:expect(self.page.locator('#design-selection-label')).to_have_text(name)
    def test_multiselect_alignment_distribution_is_one_undoable_live_source_edit(self):
        frame=self.page.frames[-1];root=frame.evaluate('appHandle.root.uid')
        click(self.page,'#design-hand');self.preview.get_by_role('textbox').fill('preserve typed value',force=True)
        click(self.page,'#design-select')
        self.select('PreviewAction');self.select('ValidateAction',True);self.select('PublishAction',True)
        expect(self.page.locator('#design-selection-label')).to_have_text('3 visuals selected')
        click(self.page,'#design-align-top')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.assertEqual(frame.evaluate("[appHandle.root.PreviewAction,appHandle.root.ValidateAction,appHandle.root.PublishAction].map(c=>Number(c.GetValue('Canvas.Top')))"),[252,252,252])
        self.assertEqual(frame.evaluate('appHandle.root.uid'),root)
        expect(self.preview.get_by_role('textbox')).to_have_value('preserve typed value')
        click(self.page,'#design-align-distribute-x')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 2',timeout=30000)
        self.assertEqual(frame.evaluate("Number(appHandle.root.ValidateAction.GetValue('Canvas.Left'))"),252)
        click(self.page,'#dev-design-undo')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 3',timeout=30000)
        self.assertEqual(frame.evaluate("Number(appHandle.root.ValidateAction.GetValue('Canvas.Left'))"),240)
        self.assertEqual(self.errors,[])
    def test_zoom_and_device_changes_preserve_application_identity_and_source(self):
        frame=self.page.frames[-1];root=frame.evaluate('appHandle.root.uid');before=self.source('MainView.axaml')
        select_option(self.page,'#design-zoom','.5')
        expect(self.page.locator('#design-artboard-size')).to_contain_text('50%')
        self.assertEqual(frame.evaluate('innerWidth'),960)
        select_option(self.page,'#design-device','390x844')
        # The cross-process iframe resize is asynchronous even after select_option.
        # Require the real logical viewport, not merely its parent's CSS attribute.
        frame.wait_for_function('innerWidth === 390',timeout=5000)
        self.assertEqual(frame.evaluate('innerWidth'),390)
        self.assertEqual(frame.evaluate('appHandle.root.uid'),root)
        self.assertEqual(self.source('MainView.axaml'),before)
        click(self.page,'#studio-view-split');self.assertEqual(frame.evaluate('appHandle.root.uid'),root)
        with self.page.expect_download() as d:click(self.page,'#save-workspace')
        workspace=json.loads(Path(d.value.path()).read_text());self.assertEqual(workspace['studio']['design']['width'],390)
    def test_drag_label_snaps_and_escape_cancels_without_source_change(self):
        self.select('PreviewAction');click(self.page,'#design-snap');click(self.page,'#design-guides')
        handle=self.preview.get_by_role('button',name='Move selected visuals',exact=True)
        box=handle.bounding_box();x=box['x']+15;y=box['y']+8
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+29,y+17,steps=5);self.page.mouse.up()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        frame=self.page.frames[-1]
        self.assertEqual(frame.evaluate("Number(appHandle.root.PreviewAction.GetValue('Canvas.Left'))"),48)
        before=self.source('MainView.axaml');box=handle.bounding_box();x=box['x']+15;y=box['y']+8
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+80,y+20,steps=3);self.page.keyboard.press('Escape');self.page.mouse.up()
        self.assertEqual(self.source('MainView.axaml'),before)
        self.assertEqual(self.errors,[])
    def test_geometry_fields_apply_exact_coordinates_and_dimensions(self):
        self.select('PreviewAction')
        for key,value in [('x','32'),('y','248'),('width','184'),('height','48')]:fill(self.page,'#design-'+key,value)
        click(self.page,'#design-apply-geometry')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.assertEqual(self.page.frames[-1].evaluate("[Number(appHandle.root.PreviewAction.GetValue('Canvas.Left')),appHandle.root.PreviewAction.Width,appHandle.root.PreviewAction.Height]"),[32,184,48])
        self.assertIn('Canvas.Left="32"',self.source('MainView.axaml'))
        self.assertEqual(self.errors,[])
    def test_imperative_csharp_property_targets_last_assignment_and_requires_restart(self):
        self.select('CodeAction')
        expect(self.page.get_by_label('Design Content',exact=True)).to_have_value('Created in C#')
        self.page.get_by_label('Design Content',exact=True).fill('Edited assignment')
        self.page.locator('.dev-property').filter(has_text='Content').get_by_role('button',name='Apply').click()
        expect(self.page.locator('#dev-status')).to_contain_text('Restart required',timeout=30000)
        code=self.source('MainView.axaml.cs');self.assertIn('Content = "Initializer value"',code);self.assertIn('action.Content = "Edited assignment"',code)
        click(self.page,'#dev-restart')
        expect(self.preview.get_by_role('button',name='Edited assignment',exact=True)).to_be_visible(timeout=30000)
        self.assertEqual(self.errors,[])
    def test_cross_parent_selection_disables_layout_and_mobile_has_no_document_overflow(self):
        self.select('PreviewAction');self.select('CodeAction',True)
        expect(self.page.locator('#design-align-top')).to_be_disabled()
        self.page.set_viewport_size({'width':390,'height':844})
        close_settings(self.page)
        click(self.page,'#design-fit')
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertEqual(self.errors,[])
    def test_canvas_shift_click_and_zoomed_drag_use_logical_coordinates(self):
        select_option(self.page,'#design-zoom','.5');click(self.page,'#design-guides')
        # Chromium Playwright's frame locator reports unscaled child bounds for
        # CSS-transformed iframes. Drive the actual physical pixel coordinates.
        def physical(locator):
            r=locator.evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}')
            f=self.page.locator('#preview').bounding_box()
            return f['x']+(r['x']+r['width']/2)*.5,f['y']+(r['y']+r['height']/2)*.5
        self.page.mouse.click(*physical(self.preview.get_by_role('button',name='Preview',exact=True)))
        self.page.keyboard.down('Shift');self.page.mouse.click(*physical(self.preview.get_by_role('button',name='Validate',exact=True)));self.page.keyboard.up('Shift')
        expect(self.page.locator('#design-selection-label')).to_have_text('2 visuals selected')
        handle=self.preview.get_by_role('button',name='Move selected visuals',exact=True)
        x,y=physical(handle)
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+20,y+10,steps=4);self.page.mouse.up()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.assertEqual(self.page.frames[-1].evaluate("[appHandle.root.PreviewAction,appHandle.root.ValidateAction].map(c=>[Number(c.GetValue('Canvas.Left')),Number(c.GetValue('Canvas.Top'))])"),[[56,272],[280,288]])
        self.assertEqual(self.errors,[])
    def test_pan_scrolls_only_workspace_and_stale_source_rejects_layout_edit(self):
        select_option(self.page,'#design-zoom','2');click(self.page,'#design-hand')
        pan=self.page.locator('.design-pan-layer');pan.focus();pan.press('ArrowRight')
        self.assertGreater(self.page.locator('.preview-stage').evaluate('e=>e.scrollLeft'),0)
        pan.press('Escape');expect(pan).not_to_be_visible()
        click(self.page,'#design-fit');self.select('PreviewAction')
        before=self.source('MainView.axaml');changed=before.replace('Text="Design workspace"','Text="Edited source"')
        click(self.page,'#studio-view-split');self.page.locator('#editor').fill(changed);click(self.page,'#studio-view-design')
        fill(self.page,'#design-x','88');click(self.page,'#design-apply-geometry')
        expect(self.page.locator('#dev-status')).to_contain_text('Source differs')
        self.assertEqual(self.source('MainView.axaml'),changed)
        self.assertEqual(self.page.frames[-1].evaluate("Number(appHandle.root.PreviewAction.GetValue('Canvas.Left'))"),16)
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
