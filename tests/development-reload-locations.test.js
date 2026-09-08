import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProject} from '../packages/project-system/index.js';
import {planReload} from '../packages/development/reload.js';
import {updateGeneratedLocations} from '../packages/development/source-map.js';

const source='public class A { public int Edit() { return 1; } } public class B { public B() { int b=2; } public int Value {get { return 42; }} }';
function build(text){const r=compileProject({'C.cs':text},{debug:true});assert.equal(r.success,true,JSON.stringify(r.diagnostics));return r;}

test('reload rejects shifted constructor/accessor debug ids rather than silently misbinding breakpoints',()=>{
  const before=build(source),after=build(source.replace('return 1;','int added=1; return added;'));
  assert.deepEqual(before.debug.typeShapes,after.debug.typeShapes);
  const plan=planReload(before,after);
  assert.equal(plan.compatible,false);
  assert.ok(plan.reasons.some(r=>r.includes('retained constructors or accessors')));
});

test('reload rejects moved retained source locations even when site ids do not change',()=>{
  const before=build(source),after=build(source.replace('return 1;','return 100;'));
  assert.deepEqual(before.debug.sites.map(s=>s.id),after.debug.sites.map(s=>s.id));
  assert.equal(planReload(before,after).compatible,false);
});

test('same-width method changes remain reloadable when retained code identities stay fixed',()=>{
  const before=build(source),after=build(source.replace('return 1;','return 2;'));
  updateGeneratedLocations(before.code,before.debug);
  updateGeneratedLocations('\n\n'+after.code,after.debug);
  const plan=planReload(before,after);
  assert.equal(plan.compatible,true,JSON.stringify(plan.reasons));
});
