"""Source-assistance commands use the compiler index and the real editable workspace."""
import unittest
import test_development as baseline
from playwright.sync_api import expect

class SourceToolsTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    def setUp(self):
        baseline.DevelopmentTests.setUp(self)
        self.page.set_default_timeout(8000)
    tearDown=baseline.DevelopmentTests.tearDown
    source=baseline.DevelopmentTests.source

    def caret(self,needle,inside=0):
        text=self.page.locator('#editor').input_value()
        at=text.index(needle)+inside
        self.page.locator('#editor').evaluate('(e,n)=>{e.focus();e.setSelectionRange(n,n);}',at)
        return at

    def test_member_completion_uses_actual_xaml_control_type(self):
        text=self.source('MainView.axaml.cs')
        self.page.locator('#editor').fill(text.replace('CounterLabel.Text','CounterLabel.Te'))
        self.caret('CounterLabel.Te',len('CounterLabel.Te'))
        self.page.keyboard.press('Control+Space')
        expect(self.page.locator('#source-completions')).to_be_visible()
        self.page.screenshot(path=str(baseline.ROOT/'test-results'/'source-completion.png'),full_page=True)
        self.page.locator('#source-completion-list [role=option]').filter(has=self.page.locator('strong',has_text='Text')).first.click()
        self.assertIn('CounterLabel.Text =',self.page.locator('#editor').input_value())
        self.page.click('#run')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.preview.get_by_text('Count: 1',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_definition_navigates_to_xaml_name_and_history_returns(self):
        self.source('MainView.axaml.cs');at=self.caret('CounterLabel.Text',3)
        self.page.keyboard.press('F12')
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml')
        self.assertEqual(self.page.locator('#editor').evaluate('e=>e.value.slice(e.selectionStart,e.selectionEnd)'),'CounterLabel')
        self.page.keyboard.press('Alt+ArrowLeft')
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml.cs')
        self.assertEqual(self.page.locator('#editor').evaluate('e=>e.selectionStart'),at)
        self.page.keyboard.press('Alt+ArrowRight')
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml')

    def test_event_handler_references_include_source_and_xaml(self):
        self.source('MainView.axaml.cs');self.caret('private void Increment',len('private void In'))
        self.page.keyboard.press('Shift+F12')
        expect(self.page.locator('#source-peek-dialog')).to_be_visible()
        expect(self.page.locator('#source-peek-list')).to_contain_text('MainView.axaml:')
        expect(self.page.locator('#source-peek-list')).to_contain_text('MainView.axaml.cs:')
        self.page.locator('#source-peek-list button').filter(has_text='MainView.axaml:').click()
        expect(self.page.locator('#source-peek-code mark')).to_have_text('Increment')
        self.page.click('#source-peek-open')
        expect(self.page.locator('#current-path')).to_have_text('MainView.axaml')
        self.assertEqual(self.errors,[])

    def helper(self):
        text=self.source('MainView.axaml.cs')
        # A helper with no interpolation gives a fully indexed local scope.
        changed=text.replace('count += 1;', 'count += Amount(2);').replace('    private void Increment(', '    private int Amount(int seed) { int delta = seed + 1; return delta + delta; }\n    private void Increment(')
        self.page.locator('#editor').fill(changed)
        self.caret('int delta',len('int de'))
        return changed

    def test_rename_previews_bound_spans_changes_execution_and_is_undoable(self):
        changed=self.helper();self.page.keyboard.press('F2')
        expect(self.page.locator('#source-rename-dialog')).to_be_visible()
        self.page.fill('#source-rename-input','increment')
        self.page.click('#source-rename-check')
        expect(self.page.locator('#source-rename-message')).to_contain_text('3 bound locations')
        expect(self.page.locator('#source-rename-preview')).to_contain_text('delta → increment')
        self.page.screenshot(path=str(baseline.ROOT/'test-results'/'source-rename-preview.png'),full_page=True)
        self.page.click('#source-rename-apply')
        self.assertIn('int increment = seed + 1; return increment + increment;',self.page.locator('#editor').input_value())
        self.page.keyboard.press('Control+z')
        self.assertEqual(self.page.locator('#editor').input_value(),changed)
        self.page.keyboard.press('Control+y')
        self.assertIn('return increment + increment;',self.page.locator('#editor').input_value())
        self.page.click('#run')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.preview.get_by_text('Count: 6',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_rename_collision_leaves_source_unchanged(self):
        changed=self.helper();self.page.keyboard.press('F2');self.page.fill('#source-rename-input','seed');self.page.click('#source-rename-check')
        expect(self.page.locator('#source-rename-message')).to_contain_text('collides')
        expect(self.page.locator('#source-rename-apply')).to_be_disabled()
        self.page.click('#source-rename-cancel')
        self.assertEqual(self.page.locator('#editor').input_value(),changed)

    def test_incomplete_xaml_attribute_completion_keeps_live_app_until_build(self):
        text=self.source('MainView.axaml');self.page.locator('#editor').fill(text.replace('FontSize="28"','FontS'))
        self.caret('FontS ',len('FontS'))
        self.page.keyboard.press('Control+Space')
        expect(self.page.locator('#source-completions')).to_be_visible()
        self.page.locator('#source-completion-list [role=option]').filter(has=self.page.locator('strong',has_text='FontSize')).click()
        self.page.keyboard.type('28')
        self.assertIn('FontSize="28"',self.page.locator('#editor').input_value())
        self.page.click('#run');expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        expect(self.preview.get_by_text('Design. Debug. Reload.',exact=True)).to_be_visible()

    def test_constructor_chain_can_step_into_xaml_and_finish_once(self):
        text=self.source('MainView.axaml.cs')
        self.page.locator('#editor').fill(text.replace('public MainView()','public MainView() : this(1) { count += 4; }\n    public MainView(int initial)'))
        self.page.select_option('#studio-session-mode','cooperative')
        expect(self.page.locator('#preview-state')).to_contain_text('Running',timeout=30000)
        self.caret('InitializeComponent();')
        self.page.keyboard.press('F9');self.page.click('#studio-debug-restart')
        expect(self.page.locator('#studio-session-badge')).to_have_text('Paused',timeout=30000)
        self.page.keyboard.press('F11')
        self.page.click('#studio-tab-stack');expect(self.page.locator('#studio-stack')).to_contain_text('XAML UserControl')
        self.page.click('#studio-tab-breakpoints');self.page.click('#studio-clear-breakpoints');self.page.keyboard.press('F5')
        expect(self.preview.get_by_role('button',name='Increment',exact=True)).to_be_visible(timeout=30000)
        self.preview.get_by_role('button',name='Increment',exact=True).click()
        expect(self.preview.get_by_text('Count: 5',exact=True)).to_be_visible()
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
