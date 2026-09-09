"""Functional editor commands and responsive docked tools over the actual compiler IDE."""
import unittest
import test_development as baseline
from playwright.sync_api import expect

class WorkbenchTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source

    def palette(self,shortcut,text):
        self.page.keyboard.press(shortcut)
        expect(self.page.locator('#wb-palette')).to_be_visible()
        self.page.fill('#wb-palette-query',text)

    def test_file_and_parsed_symbol_navigation(self):
        self.palette('Control+p','MainView.axaml.cs')
        self.page.locator('#wb-palette-results [role=option]').first.click()
        expect(self.page.locator('#editor')).to_have_value(__import__('re').compile('public partial class MainView'))
        self.palette('Control+Shift+o','Increment')
        self.page.locator('#wb-palette-results [role=option]').first.click()
        expect(self.page.locator('#wb-palette')).not_to_be_visible()
        at=self.page.locator('#editor').evaluate('(e)=>e.selectionStart')
        text=self.page.locator('#editor').input_value()
        self.assertIn('Increment',text[at:at+100])
        self.assertGreater(at,0)
        self.assertEqual(self.errors,[])

    def test_workspace_search_selects_original_source_span(self):
        self.palette('Control+Shift+f','count += 1')
        self.page.locator('#wb-palette-results [role=option]').first.click()
        self.assertEqual(self.page.locator('#editor').evaluate('(e)=>e.value.slice(e.selectionStart,e.selectionEnd)'),'count += 1')

    def test_find_replace_changes_actual_compiled_handler(self):
        self.source('MainView.axaml.cs')
        self.page.keyboard.press('Control+h')
        self.page.fill('#wb-find','count += 1');self.page.fill('#wb-replace','count += 7')
        self.page.click('#wb-replace-all');self.page.click('#wb-find-close');self.page.click('#run')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.frame_locator('#preview').get_by_text('Count: 7',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_generated_javascript_is_searchable_but_not_replaced(self):
        self.palette('Control+Shift+p','View Generated JavaScript')
        self.page.locator('#wb-palette-results [role=option]').first.click()
        self.assertTrue(self.page.locator('#editor').evaluate('e=>e.readOnly'))
        before=self.page.locator('#editor').input_value()
        self.page.keyboard.press('Control+h');self.page.fill('#wb-find','function');self.page.fill('#wb-replace','bad')
        expect(self.page.locator('#wb-replace-all')).to_be_disabled()
        self.page.click('#wb-find-close');self.page.locator('#editor').focus();self.page.keyboard.press('Tab')
        self.assertEqual(self.page.locator('#editor').input_value(),before)

    def test_caret_restore_go_to_line_and_comment_transaction(self):
        text=self.source('MainView.axaml.cs')
        self.page.keyboard.press('Control+g');self.page.fill('#wb-palette-query','16:9');self.page.keyboard.press('Enter')
        start=self.page.locator('#editor').evaluate('e=>e.selectionStart')
        self.assertEqual(start,len('\n'.join(text.split('\n')[:15]))+1+8)
        self.source('MainView.axaml');self.source('MainView.axaml.cs')
        self.assertEqual(self.page.locator('#editor').evaluate('e=>e.selectionStart'),start)
        self.page.keyboard.press('Control+/');self.assertIn('// count += 1;',self.page.locator('#editor').input_value())
        self.page.keyboard.press('Control+/');self.assertEqual(self.page.locator('#editor').input_value(),text)

    def test_keyboard_splitters_dock_and_reset_layout(self):
        self.assertTrue(self.page.locator('.wb-tools-dock #development-panel').is_visible())
        resize=self.page.get_by_role('separator',name='Resize explorer',exact=True)
        before=int(resize.get_attribute('aria-valuenow'));resize.focus();resize.press('Shift+ArrowRight')
        self.assertEqual(int(resize.get_attribute('aria-valuenow')),before+10)
        self.palette('Control+Shift+p','View Reset tool-window layout');self.page.keyboard.press('Enter')
        self.assertEqual(int(resize.get_attribute('aria-valuenow')),230)
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),1600)

    def test_profile_command_executes_existing_profile_inspector(self):
        self.palette('Control+Shift+p','Build Project profiles');self.page.keyboard.press('Enter')
        expect(self.page.locator('#build-profile-dialog')).to_be_visible()

    def test_mobile_palette_and_preview_have_no_document_overflow(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#development-panel header button').filter(has_text='Close').click()
        self.page.select_option('#wb-view-mode','preview')
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.palette('Control+Shift+p','View Code only')
        self.assertLessEqual(self.page.locator('#wb-palette').bounding_box()['width'],390)
        self.page.keyboard.press('Enter')
        expect(self.page.locator('.preview-pane')).not_to_be_visible()
        expect(self.page.locator('#editor')).to_be_visible()
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
