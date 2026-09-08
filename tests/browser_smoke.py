"""Behavioral tests against the real, built browser IDE and its compiled applications.

python -m pip install playwright==1.57.0
python -m playwright install chromium
python tests/browser_smoke.py --browser-path /usr/bin/chromium

Offline set_content exercises the self-contained distribution without a development
server. --url can exercise a served deployment instead. GPU absence is recorded,
not relabeled as a successful GPU execution.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--site', type=Path, default=ROOT / 'site')
parser.add_argument('--browser-path', default=os.environ.get('CHROMIUM_PATH'))
parser.add_argument('--url')
parser.add_argument('--report', type=Path, default=ROOT / 'test-results/browser.json')
args = parser.parse_args()
args.report.parent.mkdir(parents=True, exist_ok=True)
report = {'schema': 1, 'mode': 'served' if args.url else 'offline-set-content', 'checks': [], 'errors': [], 'webgpu': 'not-exercised'}

def passed(name: str) -> None:
    report['checks'].append({'name': name, 'passed': True})
    print('PASS:', name, flush=True)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser_path, headless=True, args=['--no-sandbox'])
        report['browser'] = browser.version
        page = browser.new_page(viewport={'width': 1500, 'height': 1000}, accept_downloads=True)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        page.on('dialog', lambda dialog: dialog.accept())
        if args.url:
            page.goto(args.url, wait_until='load')
        else:
            page.set_content((args.site / 'index.html').read_text(), wait_until='load')
        expect(page.locator('#preview-state')).to_contain_text('Running', timeout=20000)
        def frame():
            return page.frame_locator('#preview')
        def sample(name: str):
            page.locator('#samples').select_option(name)
            expect(page.locator('#preview-state')).to_contain_text('Running', timeout=20000)
        passed('offline IDE initializes compiler worker and compiles its catalog')
        f = frame()
        expect(f.get_by_role('tab')).to_have_count(4)
        f.get_by_role('button', name='Primary action', exact=True).click()
        expect(f.locator('[data-name="ActionCount"]')).to_have_text('1 actions handled by C#')
        passed('C# event handler updates the bound catalog display')
        tri = f.locator('[data-name="ThreeState"] input')
        for state in [[False, False], [True, False], [False, True]]:
            tri.click()
            assert tri.evaluate('(x)=>[x.checked,x.indeterminate]') == state
        passed('three-state checkbox cycles null, false, true, null')
        for _ in range(3):
            f.get_by_role('tab', name='Input', exact=True).click()
            f.get_by_role('tab', name='Buttons', exact=True).click()
        f.get_by_role('tab', name='Input', exact=True).click()
        f.locator('[data-name="CatalogName"]').fill('Ada')
        expect(f.locator('[data-name="CatalogGreeting"]')).to_have_text('Hello, Ada')
        passed('tab elements survive pointer events and two-way text binding works')
        f.get_by_role('tab', name='Layout', exact=True).click()
        expect(f.locator('svg')).to_have_count(3)
        passed('SVG vector shapes mount without runtime errors')
        page.screenshot(path=str(args.report.parent / 'ide.png'))
        sample('Collections')
        f = frame()
        expect(f.locator('.jb-list-row')).to_have_count(3)
        f.get_by_role('button', name='Add item', exact=True).click()
        expect(f.locator('.jb-list-row')).to_have_count(4)
        f.locator('.jb-list-row').last.click()
        f.get_by_role('button', name='Remove selected', exact=True).click()
        expect(f.locator('.jb-list-row')).to_have_count(3)
        passed('ObservableCollection changes rebuild templates and selection removes the selected object')
        sample('DataBinding')
        f = frame()
        f.get_by_role('button', name='Replace values from C#', exact=True).click()
        expect(f.locator('[data-name="NameInput"]')).to_have_value('Grace Hopper')
        expect(f.locator('[data-name="LevelSlider"]')).to_have_value('85')
        f.locator('[data-name="SourceText"]').fill('Element source changed')
        expect(f.locator('[data-name="ElementOutput"]')).to_have_text('Element source changed')
        passed('model-to-control and ElementName binding update in the browser')
        sample('UpstreamCheckBox')
        f = frame()
        boxes = f.locator('input[type="checkbox"]')
        expect(boxes).to_have_count(8)
        assert boxes.nth(3).is_disabled() and boxes.nth(7).is_disabled()
        assert boxes.nth(2).evaluate('(x)=>x.indeterminate')
        boxes.nth(4).check()
        assert boxes.nth(4).is_checked()
        passed('unchanged upstream CheckBoxPage XAML and C# execute with the documented host adapter')
        sample('WebGPU')
        f = frame()
        surface = f.locator('[data-name="Surface"]')
        expect(surface).to_have_attribute('data-renderer', __import__('re').compile('WebGPU|Canvas2D'), timeout=15000)
        status = surface.get_attribute('data-renderer')
        report['rendererStatus'] = status
        report['webgpu'] = 'executed' if status.startswith('WebGPU') else 'not-exercised-no-adapter'
        expect(surface.locator('canvas')).to_have_count(1)
        app_frame = page.locator('#preview').element_handle().content_frame()
        if not status.startswith('WebGPU'):
            colored = surface.locator('canvas').evaluate('(c)=>{const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0);}')
            assert colored, 'Canvas fallback must draw pixels, not only show a canvas'
        f.get_by_role('button', name='25,000', exact=True).click()
        expect(f.locator('[data-name="CountInput"]')).to_have_value('25000')
        passed('primitive surface draws and reports its actual rendering backend')
        assert app_frame.evaluate('()=>{try{parent.document.body;return "unsafe";}catch(e){return e.name;}}') == 'SecurityError'
        passed('opaque-origin preview cannot read the IDE document')
        page.screenshot(path=str(args.report.parent / 'renderer.png'))
        sample('Counter')
        f = frame()
        f.get_by_role('button', name='+ Add one', exact=True).click()
        expect(f.locator('[data-name="CounterText"]')).to_have_text('1')
        with page.expect_download() as download_info:
            page.locator('#export').click()
        download = download_info.value
        exported = args.report.parent / 'exported-counter.html'
        download.save_as(str(exported))
        export_page = browser.new_page()
        export_page.on('pageerror', lambda e: report['errors'].append(str(e)))
        export_page.set_content(exported.read_text(), wait_until='load')
        export_page.get_by_role('button', name='+ Add one', exact=True).click()
        expect(export_page.locator('[data-name="CounterText"]')).to_have_text('1')
        export_page.close()
        passed('standalone HTML export executes without imports or a .NET runtime')
        page.locator('.file-row[title="MainWindow.axaml.cs"]').click()
        source = page.locator('#editor').input_value()
        page.locator('#editor').fill(source.replace('Count++;', 'Count += 2;'))
        page.locator('#run').click()
        expect(page.locator('#preview-state')).to_contain_text('Running', timeout=20000)
        frame().get_by_role('button', name='+ Add one', exact=True).click()
        expect(frame().locator('[data-name="CounterText"]')).to_have_text('2')
        passed('editing C# recompiles behavior instead of using fixed demo handlers')
        page.locator('#editor').fill('record Unsupported(int Value);')
        page.locator('#run').click()
        expect(page.locator('#preview-state')).to_have_text('Build failed', timeout=20000)
        assert int(page.locator('#problem-count').inner_text()) > 0
        expect(page.locator('#preview-empty')).to_be_visible()
        passed('unsupported C# stops execution and produces visible source diagnostics')
        workspace = {'name': 'Imported project', 'files': {'Demo.csproj': '<Project/>', 'View.axaml': '<UserControl><TextBlock Text="Imported source"/></UserControl>'}}
        page.locator('#file-input').set_input_files({'name': 'import.jailbreak.json', 'mimeType': 'application/json', 'buffer': json.dumps(workspace).encode()})
        expect(page.locator('#preview-state')).to_contain_text('Running', timeout=20000)
        expect(frame().get_by_text('Imported source', exact=True)).to_be_visible()
        passed('local workspace import loads a project and compiles its source')
        page.locator('#theme').click()
        assert page.locator('body').evaluate('(x)=>x.classList.contains("light")')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(args.report.parent / 'mobile.png'))
        passed('light theme and mobile workbench remain within the viewport')
        assert not report['errors'], report['errors']
        report['passed'] = True
        browser.close()
except Exception as error:
    report['passed'] = False
    report['failure'] = str(error)
    raise
finally:
    args.report.write_text(json.dumps(report, indent=2) + '\n')
