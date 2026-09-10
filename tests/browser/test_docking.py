"""Real menus and movable tool views over the existing compiled application and debugger."""
import unittest
import test_development as baseline
from desktop_ui import command,show_tool,select_control,close_settings
from playwright.sync_api import expect
class DockingTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source
    def window_menu(self,title,choice):
        self.page.get_by_role('button',name=title+' window options',exact=True).click()
        self.page.locator('.dock-menu').get_by_role('menuitem',name=choice,exact=True).click()
    def test_text_only_panels_removed_and_menu_opens_real_nested_commands(self):
        self.assertEqual(self.page.locator('#help-panel,#about-panel,.activity,.wb-tools-dock').count(),0)
        self.page.keyboard.press('Alt+v')
        menu=self.page.get_by_role('menu',name='View menu',exact=True)
        expect(menu).to_be_visible();expect(self.page.locator('#wb-palette')).not_to_be_visible()
        menu.get_by_role('menuitem',name='Tool Windows',exact=True).click()
        self.page.get_by_role('menu',name='Tool Windows',exact=True).get_by_role('menuitem',name='Document Outline',exact=True).click()
        expect(self.page.locator('[data-tool-window=outline]')).to_be_visible()
        self.assertEqual(self.errors,[])
    def test_float_redock_hide_and_reopen_retains_selected_visual_and_live_input(self):
        self.preview.get_by_role('textbox').fill('retained while docking');uid=self.page.frames[-1].evaluate('appHandle.root.uid')
        select_control(self.page,'#IncrementButton');self.window_menu('Properties','Float')
        floating=self.page.get_by_role('region',name='Properties floating window',exact=True)
        expect(floating.get_by_label('Design Content',exact=True)).to_have_value('Increment')
        floating.get_by_role('button',name='Dock Properties',exact=True).click()
        self.window_menu('Properties','Close');expect(self.page.locator('[data-tool-window=properties]')).not_to_be_visible()
        command(self.page,'View: Properties');expect(self.page.get_by_label('Design Content',exact=True)).to_have_value('Increment')
        expect(self.preview.get_by_role('textbox')).to_have_value('retained while docking');self.assertEqual(uid,self.page.frames[-1].evaluate('appHandle.root.uid'));self.assertEqual(self.errors,[])
    def test_auto_hide_flyout_pin_and_keyboard_splitter(self):
        show_tool(self.page,'solution');self.window_menu('Solution Explorer','Auto Hide')
        tab=self.page.locator('.dock-auto-tab[data-window=solution]');tab.click()
        expect(self.page.locator('.dock-flyout #files')).to_contain_text('MainView.axaml')
        self.page.get_by_role('button',name='Pin Solution Explorer',exact=True).click()
        splitter=self.page.get_by_role('separator',name='Resize right tool windows',exact=True);before=float(splitter.get_attribute('aria-valuenow'));splitter.focus();splitter.press('Shift+ArrowLeft')
        self.assertEqual(float(splitter.get_attribute('aria-valuenow')),before+10)
        self.assertEqual(self.errors,[])
    def test_header_pointer_drag_moves_window_between_regions_without_cloning(self):
        select_control(self.page,'#IncrementButton');header=self.page.locator('#dock-zone-right-lower .dock-titlebar strong');r=header.bounding_box()
        self.page.mouse.move(r['x']+15,r['y']+8);self.page.mouse.down();self.page.mouse.move(r['x']-20,r['y']+35,steps=4)
        target=self.page.locator('#dock-drop-overlay [data-target=bottom-right]');expect(target).to_be_visible();t=target.bounding_box();self.page.mouse.move(t['x']+t['width']/2,t['y']+t['height']/2,steps=6);self.page.mouse.up()
        expect(self.page.locator('#dock-zone-bottom-right #dev-property-panel')).to_be_visible()
        expect(self.page.get_by_label('Design Content',exact=True)).to_have_value('Increment');self.assertEqual(self.page.locator('#dev-property-panel').count(),1);self.assertEqual(self.errors,[])
    def test_named_layout_restore_and_reset_do_not_restart_the_app(self):
        self.preview.get_by_role('textbox').fill('still the same app');uid=self.page.frames[-1].evaluate('appHandle.root.uid')
        command(self.page,'Window: Save or restore named layout');self.page.fill('#desktop-layout-name','My editing layout');self.page.click('#desktop-save-layout');self.page.click('#desktop-close-layouts')
        self.page.select_option('#desktop-layout-preset','debug');expect(self.page.locator('#studio-stack')).to_be_visible();expect(self.page.locator('#studio-locals')).to_be_visible()
        command(self.page,'Window: Save or restore named layout');self.page.locator('#desktop-layout-dialog').get_by_role('button',name='My editing layout',exact=True).click()
        expect(self.page.locator('#studio-stack')).not_to_be_visible();expect(self.preview.get_by_role('textbox')).to_have_value('still the same app');self.assertEqual(uid,self.page.frames[-1].evaluate('appHandle.root.uid'));self.assertEqual(self.errors,[])
    def test_toolbox_invokes_existing_source_edit_and_hot_reload(self):
        self.page.click('#studio-hot-reload');select_control(self.page,'#Panel');show_tool(self.page,'toolbox')
        self.page.locator('.studio-toolbox-tiles').get_by_role('button',name='CheckBox',exact=True).click()
        expect(self.page.locator('#dev-status')).to_contain_text('Hot reload 1',timeout=30000)
        expect(self.preview.get_by_role('checkbox')).to_be_visible();self.assertIn('<CheckBox',self.source('MainView.axaml'));self.assertEqual(self.errors,[])
    def test_integrated_binary_session_routes_top_toolbar_and_shared_stack(self):
        self.preview.get_by_role('textbox').fill('source session kept');self.page.click('#studio-view-binary')
        binary=self.page.frame_locator('#studio-binary-frame');expect(binary.locator('#status')).to_have_text('Conversion succeeded',timeout=30000)
        self.page.select_option('#studio-session-mode','cooperative');expect(binary.locator('#runtime-state')).to_have_text('Ready',timeout=30000)
        self.page.click('#studio-debug-break');self.page.click('#run');expect(self.page.locator('#studio-session-badge')).to_have_text('Paused',timeout=30000)
        expect(self.page.locator('#studio-stack')).to_contain_text('Add');expect(self.page.locator('#studio-locals')).to_contain_text('40')
        old=self.page.locator('#studio-stack').inner_text();self.page.keyboard.press('F10')
        expect(self.page.locator('#studio-stack')).not_to_have_text(old)
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused')
        self.page.keyboard.press('F5');expect(binary.locator('#result')).to_have_text('42')
        self.page.click('#studio-view-split');expect(self.preview.get_by_role('textbox')).to_have_value('source session kept');self.assertEqual(self.errors,[])
    def test_mobile_menus_remain_accessible_and_perspectives_not_covered(self):
        close_settings(self.page);self.page.set_viewport_size({'width':390,'height':844});self.page.click('#theme')
        self.page.get_by_role('menubar').get_by_role('menuitem',name='Window',exact=True).click();expect(self.page.get_by_role('menu',name='Window menu',exact=True)).to_be_visible();self.page.keyboard.press('Escape')
        self.page.click('#studio-view-design');expect(self.page.locator('#design-canvas-toolbar')).to_be_visible()
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
