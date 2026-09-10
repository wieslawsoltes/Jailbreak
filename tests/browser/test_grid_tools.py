from desktop_ui import click,fill,check,uncheck,select_option,command,show_tool,select_control,reveal,close_settings,set_local
"""Track editing and placement in the real running source application."""
import unittest
import test_development as baseline
from playwright.sync_api import expect
class GridToolsTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source
    def setUp(self):
        baseline.DevelopmentTests.setUp(self)
        select_option(self.page,'#samples','GridDesigner')
        self.preview=self.page.frame_locator('#preview')
        expect(self.preview.get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        click(self.page,'#studio-view-design')
        expect(self.page.locator('#dev-tree')).to_contain_text('#Layout',timeout=30000)
        click(self.page,'#studio-hot-reload')
    def select(self,name):
        show_tool(self.page,'outline');self.page.locator('#dev-tree button').filter(has_text='#'+name).click()
        show_tool(self.page,'layout');expect(self.page.locator('#grid-designer')).to_be_visible()
    def test_track_insert_cell_edit_and_undo_preserve_live_state(self):
        frame=self.page.frames[-1];identity=frame.evaluate('appHandle.root.uid')
        click(self.page,'#design-interact');self.preview.get_by_role('textbox').fill('retain this')
        self.preview.get_by_role('button',name='Increment',exact=True).click();expect(self.preview.get_by_text('Count: 1',exact=True)).to_be_visible();click(self.page,'#design-select')
        self.select('Layout');fill(self.page,'#grid-rows-index','1');fill(self.page,'#grid-rows-size','32');click(self.page,'#grid-insert-rows')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.assertEqual(frame.evaluate('appHandle.root.Layout.RowDefinitions'),'64,32,Auto,*,48')
        self.assertEqual(frame.evaluate("Number(appHandle.root.Input.GetValue('Grid.Row'))"),2)
        self.select('Input');click(self.page,'#grid-cell-1-1')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 2',timeout=30000)
        expect(self.preview.get_by_role('textbox')).to_have_value('retain this')
        self.assertEqual(frame.evaluate('appHandle.root.count'),1);self.assertEqual(frame.evaluate('appHandle.root.uid'),identity)
        click(self.page,'#dev-design-undo')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 3',timeout=30000)
        self.assertEqual(frame.evaluate("Number(appHandle.root.Input.GetValue('Grid.Row'))"),2)
        self.assertEqual(self.errors,[])
    def test_track_sizes_spacing_and_rendered_bounds(self):
        self.select('Layout');fill(self.page,'#grid-columns','200,2*,180');click(self.page,'#grid-apply-columns')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        self.select('Input');fill(self.page,'#grid-row-gap','20');fill(self.page,'#grid-column-gap','10');click(self.page,'#grid-apply-gaps')
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 2',timeout=30000)
        frame=self.page.frames[-1];self.assertEqual(frame.evaluate("getComputedStyle(appHandle.root.Layout.element).columnGap"),'10px')
        self.assertEqual(frame.evaluate("getComputedStyle(appHandle.root.Input.element).gridColumnStart"),'1')
        self.assertEqual(frame.evaluate('Math.round(appHandle.root.Input.element.getBoundingClientRect().width)'),200)
        self.assertEqual(self.errors,[])
    def test_invalid_track_input_leaves_source_and_preview_intact(self):
        self.select('Layout');before=self.source('MainView.axaml');fill(self.page,'#grid-rows','*,var(--bad)');click(self.page,'#grid-apply-rows')
        expect(self.page.locator('#grid-message')).to_contain_text('Grid tracks require')
        self.assertEqual(self.source('MainView.axaml'),before)
        self.assertEqual(self.page.frames[-1].evaluate('appHandle.root.Layout.RowDefinitions'),'64,Auto,*,48')
        self.assertEqual(self.errors,[])
    def test_defaults_overlap_and_clamped_spans_do_not_create_implicit_tracks(self):
        frame=self.page.frames[-1]
        actual=frame.evaluate("""()=>{const JB=Jailbreak,g=new JB.Grid();g.ColumnDefinitions='100,100';g.RowDefinitions='40,40';const a=new JB.Button(),b=new JB.Button();g.Children.Add(a);g.Children.Add(b);g.mount(document.body);JB.flushLayout();const defaults=[a.element.style.gridRow,b.element.style.gridRow];a.SetValue('Grid.Column',99);a.SetValue('Grid.ColumnSpan',99);JB.flushLayout();const column=a.element.style.gridColumn;g.Dispose();return {defaults,column};}""")
        self.assertEqual(actual['defaults'],['1 / span 1','1 / span 1']);self.assertEqual(actual['column'],'2 / span 1')
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
