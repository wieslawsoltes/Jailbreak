import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProject} from '../packages/project-system/index.js';
import {parseColor,PrimitiveSurface,demoScene} from '../packages/renderer/index.js';
import {compileXaml} from '../packages/xaml-compiler/index.js';
import {previewDocument} from '../packages/project-system/preview.js';
import {parseXml} from '../packages/compiler-core/xml.js';

test('requested missing entry views/types fail rather than silently choosing another view',()=>{
  const files={'Main.axaml':'<Window><TextBlock Text="Hello"/></Window>'};
  assert.equal(compileProject(files,{entryXaml:'Missing.axaml'}).diagnostics.some(d=>d.code==='JB4008'),true);
  assert.equal(compileProject(files,{entryType:'Missing'}).diagnostics.some(d=>d.code==='JB4009'),true);
});
test('renderer validates and bounds untrusted scene data before GPU upload',()=>{
  assert.throws(()=>parseColor([1,0,NaN,1]),TypeError);
  assert.deepEqual(parseColor([2,-1,.5,1]),[1,0,.5,1]);
  const surface={invalidate(){}};
  assert.throws(()=>PrimitiveSurface.prototype.setScene.call(surface,[{x:0,y:0,width:Infinity,height:2}]),TypeError);
  assert.throws(()=>PrimitiveSurface.prototype.setScene.call(surface,[{x:0,y:0,width:-1,height:2}]),RangeError);
  PrimitiveSurface.prototype.setScene.call(surface,demoScene(640,320,20));
  assert.equal(surface.commands.length,20);
  assert.ok(surface.commands.every(s=>s.color.length===4));
});
test('preview export has restrictive CSP and escapes embedded script terminators',()=>{
  const r=compileProject({'Main.axaml':'<Window><TextBlock Text="&lt;/script&gt;"/></Window>'});
  assert.equal(r.success,true);
  const html=previewDocument(r,'/* </script><script>throw new Error("bad");</script> */',{title:'<bad>'});
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.equal(html.includes('<script>throw new Error("bad");</script>'),false);
  assert.match(html,/<title>bad<\/title>/);
});
test('unknown property elements fail while supported resource properties compile',()=>{
  assert.equal(compileXaml('<Button><Button.Unknown><TextBlock/></Button.Unknown></Button>').success,false);
  assert.equal(compileXaml('<Button><Button.Content><TextBlock Text="OK"/></Button.Content></Button>').success,true);
});
test('XAML System primitive resources resolve through CLR namespace aliases',()=>{
  const r=compileXaml('<Window xmlns:sys="clr-namespace:System;assembly=System.Runtime" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"><Window.Resources><sys:String x:Key="Title">Hello</sys:String></Window.Resources><TextBlock Text="{StaticResource Title}"/></Window>');
  assert.equal(r.success,true,JSON.stringify(r.diagnostics));
  assert.equal(r.ir.root.children[0].children[0].type,'String');
});
test('XML rejects bare and unterminated entities rather than silently accepting invalid markup',()=>{
  assert.equal(parseXml('<TextBlock Text="A & B"/>').diagnostics.length,1);
  assert.equal(parseXml('<TextBlock>A &broken</TextBlock>').diagnostics.length,1);
});
