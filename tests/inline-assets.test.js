import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {inlineAssetJson} from '../scripts/html-assets.mjs';

function decodeScript(html) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(matches.length, 1, 'Asset data must not add or end script elements');
  const scope = {};
  new vm.Script(matches[0][1]).runInNewContext(scope);
  return scope.payload;
}

test('inline asset JSON cannot terminate its surrounding script', () => {
  const text = '</script><script>globalThis.injected = true</script><!--';
  const literal = inlineAssetJson({text});
  assert.equal(literal.includes('<'), false);
  assert.equal(JSON.parse(literal).text, text);
  assert.equal(decodeScript('<script>globalThis.payload=' + literal + ';</script>').text, text);
});

test('nested offline Binary Studio HTML survives IDE asset encoding exactly', () => {
  const source = 'public string Label => "</script> Ł 😀";';
  const binary = '<!doctype html><script>globalThis.payload=' + inlineAssetJson({source}) + ';</script>';
  const ide = '<!doctype html><script>globalThis.payload=' + inlineAssetJson({binaryHtml:binary}) + ';</script>';
  const decoded = decodeScript(ide);
  assert.equal(decoded.binaryHtml, binary);
  assert.equal(decodeScript(decoded.binaryHtml).source, source);
});

test('inline assets preserve literal backslashes, quotes and source line endings', () => {
  const data = {text: '\\u003c\r\n"quotes"\nC:\\source\\Main.cs', value: 42};
  assert.deepEqual(JSON.parse(inlineAssetJson(data)), data);
  assert.throws(() => inlineAssetJson(undefined), TypeError);
});
