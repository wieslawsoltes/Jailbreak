"""The IDE remains interactive while real compiled constructors/XAML are paused."""
import unittest
import test_development as baseline
from playwright.sync_api import expect

class XamlConstructionTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    setUp=baseline.DevelopmentTests.setUp
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source

    def pause_in_xaml(self):
        self.page.check('#dev-cooperative')
        expect(self.page.locator('#dev-tree')).to_contain_text('#IncrementButton',timeout=30000)
        text=self.source('MainView.axaml')
        line=text[:text.index('<TextBox')].count('\n')+1
        self.page.fill('#dev-breakpoint-line',str(line))
        self.page.click('#dev-add-breakpoint')
        self.page.click('#dev-restart')
        expect(self.page.locator('#dev-pause-state')).to_contain_text('Paused',timeout=30000)
        expect(self.page.locator('#dev-frames option').first).to_contain_text('XAML TextBox')
        return self.page.frames[-1]

    def test_xaml_pause_step_and_constructor_tail_in_live_ide(self):
        frame=self.pause_in_xaml()
        self.assertIsNone(frame.evaluate('appHandle.root'))
        self.assertEqual(frame.locator('#app .jb-control').count(),0)
        self.page.click('#dev-debug-into')
        expect(self.page.locator('#dev-frames option').first).to_contain_text('XAML TextBlock')
        self.assertIsNone(frame.evaluate('appHandle.root'))
        self.page.click('#dev-debug-continue')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Built in C#',exact=True)).to_be_visible(timeout=30000)
        self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True).click()
        expect(self.page.frame_locator('#preview').get_by_text('Count: 1',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_cancel_does_not_mount_a_partially_constructed_app(self):
        frame=self.pause_in_xaml()
        self.page.click('#dev-debug-cancel')
        expect(self.page.locator('#dev-pause-state')).to_have_text('cancelled')
        self.assertIsNone(frame.evaluate('appHandle.root'))
        self.assertTrue(frame.evaluate('appHandle.cancelled'))
        self.assertEqual(frame.locator('#app').inner_html(),'')
        self.page.locator('#dev-breakpoints button').first.click()
        self.page.click('#dev-restart')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        self.assertEqual(self.errors,[])

    def test_source_constructor_pause_precedes_initialize_component(self):
        self.page.check('#dev-cooperative')
        expect(self.page.locator('#dev-tree')).to_contain_text('#IncrementButton',timeout=30000)
        text=self.source('MainView.axaml.cs')
        line=text[:text.index('InitializeComponent();')].count('\n')+1
        self.page.fill('#dev-breakpoint-line',str(line));self.page.click('#dev-add-breakpoint');self.page.click('#dev-restart')
        expect(self.page.locator('#dev-pause-state')).to_contain_text('Paused',timeout=30000)
        expect(self.page.locator('#dev-frames option').first).to_contain_text('.ctor')
        self.page.click('#dev-debug-into')
        expect(self.page.locator('#dev-frames option').first).to_contain_text('XAML UserControl')
        self.page.click('#dev-debug-out')
        expect(self.page.locator('#dev-frames option').first).to_contain_text('.ctor')
        self.page.click('#dev-debug-continue')
        expect(self.page.frame_locator('#preview').get_by_role('button',name='Built in C#',exact=True)).to_be_visible(timeout=30000)
        self.assertEqual(self.errors,[])

if __name__=='__main__': unittest.main(verbosity=2)
