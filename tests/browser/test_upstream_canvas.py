"""Unchanged pinned CanvasPage rendered by its compiled source, with pixel checks."""
import unittest,base64,json
from pathlib import Path
import test_development as baseline
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parents[2]
class UpstreamCanvasTests(unittest.TestCase):
    setUpClass=classmethod(baseline.DevelopmentTests.setUpClass.__func__)
    tearDownClass=classmethod(baseline.DevelopmentTests.tearDownClass.__func__)
    tearDown=baseline.DevelopmentTests.tearDown
    def setUp(self):
        baseline.DevelopmentTests.setUp(self)
        self.page.select_option('#samples','UpstreamCanvas');self.preview=self.page.frame_locator('#preview')
        expect(self.preview.locator('.jb-Canvas svg')).to_have_count(8,timeout=30000)
    def test_original_mask_colors_geometry_and_polylines_are_rendered(self):
        canvas=self.preview.locator('.jb-Canvas');svg=canvas.locator('svg')
        self.assertEqual(svg.nth(4).locator('path').get_attribute('d'),'M 0,0 Q 50,0 50,-50 Q 100,-50 100,0 L 50,0 L 50,50 Z')
        self.assertEqual(svg.nth(1).locator('rect').last.get_attribute('fill'),'rgba(32,32,186,0.9)')
        self.assertEqual(svg.nth(7).locator('polyline').get_attribute('points'),'0,0 65,0 78,-26 91,39 104,-39 117,13 130,0 195,0')
        self.assertEqual(svg.nth(0).locator('mask').evaluate('e=>e.style.maskType'),'alpha')
        png=canvas.screenshot();(ROOT/'test-results'/'upstream-canvas-vectors.png').write_bytes(png)
        # Decode the actual browser screenshot using native Canvas. No optional
        # image library is needed by CI and no source graphics are substituted.
        pixels=self.page.evaluate("""async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {width:c.width,height:c.height,points:[[117,129],[49,41],[94,62],[2,2],[80,270],[230,270]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3))};}""",base64.b64encode(png).decode())
        self.assertEqual(canvas.bounding_box()['width'],300);self.assertIn(pixels['width'],[300,301]);self.assertEqual(pixels['height'],400)
        green,near,far,yellow,orange,orangeRed=pixels['points']
        self.assertEqual(green,[0,128,0]);self.assertGreater(near[2],far[2]+100);self.assertGreater(far[0],near[0]+100)
        self.assertEqual(yellow,[255,255,0]);self.assertEqual(orange,[255,165,0]);self.assertEqual(orangeRed,[255,69,0])
        self.assertEqual(self.errors,[])
    def test_attached_edges_precedence_dynamic_paint_and_resources_do_not_leak(self):
        f=self.page.frames[-1]
        result=f.evaluate('''()=>{const J=Jailbreak,c=appHandle.root.Content.Children[1],v=c.Children[0];J.Canvas.SetRight(v,8);J.Canvas.SetLeft(v,NaN);J.Canvas.SetBottom(v,9);J.Canvas.SetTop(v,NaN);J.flushLayout();const edge=[v.element.offsetLeft,v.element.getBoundingClientRect().left-c.element.getBoundingClientRect().left,v.element.getBoundingClientRect().top-c.element.getBoundingClientRect().top];J.Canvas.SetLeft(v,17);J.Canvas.SetTop(v,23);J.flushLayout();const pos=[v.element.style.left,v.element.style.right,v.element.style.top,v.element.style.bottom];for(let i=0;i<20;i++){v.Opacity=.9+i*.001;J.flushLayout();}const defs=v.element.querySelectorAll('defs').length,gradients=v.element.querySelectorAll('linearGradient').length;v.OpacityMask=null;J.flushLayout();return {edge,pos,defs,gradients,mask:v.shape.getAttribute('mask'),retained:c.Children[0]===v};}''')
        self.assertAlmostEqual(result['edge'][1],229,delta=.1);self.assertAlmostEqual(result['edge'][2],350,delta=.1)
        self.assertEqual(result['pos'],['17px','','23px','']);self.assertEqual(result['defs'],1);self.assertEqual(result['gradients'],1)
        self.assertIsNone(result['mask']);self.assertTrue(result['retained']);self.assertEqual(self.errors,[])
    def test_original_page_exports_offline_and_remains_source_debuggable(self):
        self.page.select_option('#studio-session-mode','cooperative')
        expect(self.preview.locator('.jb-Canvas svg')).to_have_count(8,timeout=30000)
        self.page.click('#studio-view-design');self.page.click('#design-fit')
        expect(self.page.locator('#dev-tree')).to_contain_text('Polyline')
        self.page.locator('#dev-tree button').filter(has_text='Polyline').click()
        expect(self.page.get_by_label('Design Points',exact=True)).to_have_value('0,0 65,0 78,-26 91,39 104,-39 117,13 130,0 195,0')
        with self.page.expect_download() as d:self.page.click('#export')
        page=self.browser.new_page();requests=[];page.on('request',lambda r:requests.append(r.url))
        try:
            page.set_content(Path(d.value.path()).read_text(),wait_until='load');expect(page.locator('.jb-Canvas svg')).to_have_count(8)
            self.assertEqual(requests,[])
        finally:page.close()
        self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
