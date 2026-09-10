"""Navigate current dock windows through real commands; no forced clicks or runtime mocks.

Shared workflow tests retain their compiler assertions, navigating actual tool
windows instead of the retired combined panel. Layout tests use direct actions.
"""
from playwright.sync_api import expect
TITLES={'solution':'Solution Explorer','outline':'Document Outline','properties':'Properties','layout':'Layout','toolbox':'Toolbox','problems':'Error List','output':'Output','stack':'Call Stack','locals':'Locals','watch':'Watch','breakpoints':'Breakpoints','debug-settings':'Debug Settings','debug-console':'Debug Console','tasks':'Tasks','symbols':'Symbols & Sources'}
def command(page,label):
    page.keyboard.press('Control+Shift+p');page.locator('#wb-palette-query').fill(label)
    item=page.locator('#wb-palette-results [role=option]').filter(has=page.locator('.wb-result-label').get_by_text(label,exact=True))
    expect(item).to_have_count(1);item.click()
def show_tool(page,id):
    node=page.locator('[data-tool-window="'+id+'"]')
    if node.count() and node.is_visible():return
    tab=page.locator('#dock-tab-'+id)
    if tab.is_visible():tab.click()
    else:command(page,'View: '+TITLES[id])
    expect(node).to_be_visible()
def reveal(page,selector):
    if not page.locator('body.desktop-ide').count():return selector
    aliases={'#development-tools':'@View: Debug Settings','#save-workspace':'@File: Download workspace','#export':'@File: Export compiled application','#build-profile':'@Project: Startup project and build profile','#dev-debug-into':'#studio-debug-into','#dev-debug-over':'#studio-debug-over','#dev-debug-out':'#studio-debug-out','#dev-debug-continue':'#run','#dev-debug-cancel':'@Debug: Cancel current invocation','#dev-break-next':'#studio-debug-break','#dev-restart':'#studio-debug-restart'}
    selector=aliases.get(selector,selector)
    if selector.startswith('@'):return selector
    node=page.locator(selector)
    if not node.count():return selector
    id=node.first.evaluate('(e)=>e.closest("[data-tool-window]")?.dataset.toolWindow')
    if id:show_tool(page,id)
    for _ in range(4):
        details=node.first.locator('xpath=ancestor::details[not(@open)]').first
        if not details.count():break
        details.locator('summary').first.click()
    return selector

def click(page,selector,**kwargs):
    selector=reveal(page,selector)
    if selector.startswith('@'):return command(page,selector[1:])
    return page.click(selector,**kwargs)
def fill(page,selector,value,**kwargs):return page.fill(reveal(page,selector),value,**kwargs)
def check(page,selector,**kwargs):return page.check(reveal(page,selector),**kwargs)
def uncheck(page,selector,**kwargs):return page.uncheck(reveal(page,selector),**kwargs)
def select_option(page,selector,*args,**kwargs):return page.select_option(reveal(page,selector),*args,**kwargs)
def select_control(page,name):
    show_tool(page,'outline');page.locator('#dev-tree button').filter(has_text=name).click();show_tool(page,'properties')

def close_settings(page):
    show_tool(page,'debug-settings');page.get_by_role('button',name='Close Debug Settings',exact=True).click()
def set_local(page,name,value):
    show_tool(page,'locals');page.locator('#studio-locals').get_by_role('button',name='Edit '+name,exact=True).click()
    page.locator('#studio-local-input').fill(value);page.locator('#studio-local-apply').click()
