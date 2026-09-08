/** Case-insensitive MSBuild properties, without JavaScript prototype lookup. */
export function propertyValue(properties, name) {
  if (properties instanceof Map) return String(properties.get(name.toLowerCase()) ?? '');
  const key = Object.keys(properties).find(key => key.toLowerCase() === name.toLowerCase());
  return key === undefined ? '' : String(properties[key]);
}
export function expandProperties(text, properties) {
  const result = String(text).replace(/\$\(([^()]*)\)/g, (_, name) => {
    if (!/^[A-Za-z_][\w]*$/.test(name)) throw new Error(`Unsupported MSBuild property expression $(${name})`);
    return propertyValue(properties, name);
  });
  if (/\$\(|@\(|%\(/.test(result)) throw new Error('Property functions, item transforms and item batching are not supported');
  if (result.length > 1_000_000) throw new Error('Expanded property exceeds the size budget');
  return result;
}

/** Parse conditions before expanding operands: a property value cannot inject operators. */
export function evaluateCondition(text, { properties = {}, exists = () => false, maxDepth = 128 } = {}) {
  if (text == null || text.trim() === '') return true;
  const tokens = []; let i = 0, depth = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    const c = text[i];
    if (c === "'" || c === '"') {
      const start = ++i; while (i < text.length && text[i] !== c) i++;
      if (i === text.length) throw new Error('Unclosed quoted MSBuild condition operand');
      tokens.push({ kind: 'value', value: expandProperties(text.slice(start, i++), properties) }); continue;
    }
    const operator = /^(?:==|!=|<=|>=|[!()<>])/.exec(text.slice(i));
    if (operator) { tokens.push({ kind: 'op', value: operator[0] }); i += operator[0].length; continue; }
    let value = '';
    while (i < text.length && !/[\s!()<>='"]/.test(text[i])) {
      if (text.startsWith('$(', i)) { const end = text.indexOf(')', i + 2); if (end < 0) throw new Error('Unclosed MSBuild property'); value += text.slice(i, end + 1); i = end + 1; }
      else value += text[i++];
    }
    if (!value) throw new Error(`Unexpected condition character at column ${i + 1}`);
    const keyword = /^(and|or|exists|hastrailingslash)$/i.test(value);
    tokens.push({ kind: keyword ? 'op' : 'value', value: keyword ? value.toLowerCase() : expandProperties(value, properties) });
  }
  if (tokens.length > 2048) throw new Error('Condition token budget exceeded');
  tokens.push({ kind: 'op', value: '<end>' }); i = 0;
  const take = value => tokens[i].kind === 'op' && tokens[i].value === value ? (++i, true) : false;
  function boolean(value) { if (/^(true|false)$/i.test(String(value))) return String(value).toLowerCase() === 'true'; throw new Error(`Condition operand '${value}' is not Boolean`); }
  function atom() {
    if (++depth > maxDepth) throw new Error('Condition nesting budget exceeded');
    let value;
    if (take('!')) { const operand = atom(); value = () => !boolean(operand()); }
    else if (take('(')) { value = or(); if (!take(')')) throw new Error('Expected ) in condition'); }
    else if (tokens[i].kind === 'op' && ['exists', 'hastrailingslash'].includes(tokens[i].value)) {
      const fn = tokens[i++].value; if (!take('(')) throw new Error('Expected ( after condition function');
      const arg = tokens[i++]; if (arg.kind !== 'value' || !take(')')) throw new Error('Condition function requires one path operand');
      value = () => fn === 'exists' ? exists(arg.value) : /[\\/]$/.test(arg.value);
    } else { const token = tokens[i++]; if (token.kind !== 'value') throw new Error('Expected condition operand'); value = () => token.value; }
    depth--; return value;
  }
  function compareValues(left, right, op) {
    if (op === '==' || op === '!=') { const equal = String(left).toLowerCase() === String(right).toLowerCase(); return op === '==' ? equal : !equal; }
    const numeric = /^[+-]?(?:0x[\da-f]+|\d+(?:\.\d+)?)$/i, version = /^\d+(?:\.\d+){1,3}$/;
    let a, b;
    if (numeric.test(left) && numeric.test(right)) { a = [Number(left)]; b = [Number(right)]; }
    else if (version.test(left) && version.test(right)) { a = left.split('.').map(Number); b = right.split('.').map(Number); }
    else throw new Error(`Relational condition requires numbers or compatible versions, found '${left}' and '${right}'`);
    let order = 0; for (let j = 0; j < Math.max(a.length, b.length); j++) { const x = a[j] ?? -1, y = b[j] ?? -1; if (x !== y) { order = x < y ? -1 : 1; break; } }
    return op === '<' ? order < 0 : op === '>' ? order > 0 : op === '<=' ? order <= 0 : order >= 0;
  }
  function compare() {
    const left = atom(), op = tokens[i].value;
    if (!['==', '!=', '<', '>', '<=', '>='].includes(op)) return () => boolean(left());
    i++; const right = atom(); return () => compareValues(String(left()), String(right()), op);
  }
  function and() { let value = compare(); while (take('and')) { const left = value, right = compare(); value = () => left() && right(); } return value; }
  function or() { let value = and(); while (take('or')) { const left = value, right = and(); value = () => left() || right(); } return value; }
  const value = or(); if (tokens[i].value !== '<end>') throw new Error(`Unexpected condition token ${tokens[i].value}`);
  return value();
}
