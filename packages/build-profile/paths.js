/** Virtual absolute paths are reserved for MSBuild's well-known path properties. */
export const virtualRoot = '/__workspace__/';
export function normalizeWorkspacePath(value, base = '') {
  let text = String(value).replace(/\\/g, '/');
  if (text.includes('\0') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(text) || text.startsWith('//')) throw new Error(`External workspace path is not allowed: ${value}`);
  if (text.startsWith(virtualRoot)) { text = text.slice(virtualRoot.length); base = ''; }
  else if (text.startsWith('/')) throw new Error(`Absolute workspace path is not allowed: ${value}`);
  const parts = [];
  for (const part of (base + text).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) throw new Error(`Path escapes the workspace: ${value}`); parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}
export const directory = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
export function globMatcher(pattern) {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') { if (pattern[i + 1] === '*') { i++; if (pattern[i + 1] === '/') { i++; out += '(?:.*/)?'; } else out += '.*'; } else out += '[^/]*'; }
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[\\^$+?.()|{}\[\]]/g, '\\$&');
  }
  return new RegExp(out + '$');
}
export function frameworkSymbols(tfm) {
  const result = [], net = /^net(\d+)\.(\d+)$/.exec(tfm || ''), standard = /^netstandard(\d+)\.(\d+)$/.exec(tfm || '');
  if (net && +net[1] >= 5 && +net[1] <= 30) {
    result.push('NET', 'NETCOREAPP', `NET${net[1]}_${net[2]}`);
    for (let major = 5; major <= +net[1]; major++) result.push(`NET${major}_0_OR_GREATER`);
    for (const version of ['1_0','1_1','2_0','2_1','2_2','3_0','3_1']) result.push(`NETCOREAPP${version}_OR_GREATER`);
  } else if (standard) {
    result.push('NETSTANDARD', `NETSTANDARD${standard[1]}_${standard[2]}`);
    for (const version of ['1_0','1_1','1_2','1_3','1_4','1_5','1_6','2_0','2_1']) {
      const [major, minor] = version.split('_').map(Number);
      if (major < +standard[1] || major === +standard[1] && minor <= +standard[2]) result.push(`NETSTANDARD${version}_OR_GREATER`);
    }
  }
  return result;
}
