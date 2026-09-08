import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {compileProject} from '../packages/project-system/index.js';
import {compileWorkspace} from '../browser/packages/project/index.js';
const base=new URL('../browser/fixtures/control-catalog/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',base),'utf8'));

test('requested Avalonia fork fixtures are pinned and byte-exact',async()=>{
  assert.equal(manifest.repository,'wieslawsoltes/Avalonia');
  assert.equal(manifest.commit,'b709c58c6b1b8aa3b90866c7c001b7bf82b6353b');
  assert.equal(manifest.fullControlCatalogPassed,false);
  for(const fixture of manifest.fixtures)for(const [path,sha]of Object.entries(fixture.files)){
    const bytes=await fs.readFile(new URL(path,base));
    const actual=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(actual,sha,path);
  }
  assert.match(await fs.readFile(new URL(manifest.license,base),'utf8'),/Copyright \(c\) AvaloniaUI/);
});
for(const fixture of manifest.fixtures)test(`both compilers retain unchanged ${fixture.page} sources`,async()=>{
  const files=Object.fromEntries(await Promise.all(Object.keys(fixture.files).map(async path=>[path,await fs.readFile(new URL(path,base),'utf8')])));
  const root=compileProject(files),browser=compileWorkspace(files);
  assert.equal(root.success,true,JSON.stringify(root.diagnostics));assert.equal(browser.ok,true,JSON.stringify(browser.diagnostics));
});
