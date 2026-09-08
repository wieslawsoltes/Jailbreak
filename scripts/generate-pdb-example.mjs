import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBinaryProject } from '../packages/binary-project/index.js';

// Build-time fixture utility, not an implicit network dependency in the IDE.
// Keep the example package, its PDB identity and its original source together.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = 'Probe.1.0.0.nupkg';
const data = (await fs.readFile(path.join(root, 'tests/fixtures/pdb', name + '.base64'), 'utf8')).trim();
const result = await compileBinaryProject([{ name, data }], { debug: true, targetFramework: 'net8.0' });
if (!result.success || !result.debug?.sites?.length || !Object.keys(result.debug.sources ?? {}).length) {
  throw new Error('PDB example fixture did not produce verified source symbols: ' + JSON.stringify(result.diagnostics));
}
const destination = path.join(root, 'examples/PdbLibrary');
await fs.mkdir(destination, { recursive: true });
const file = path.join(destination, 'library.binary.json');
const temporary = file + '.tmp';
await fs.writeFile(temporary, JSON.stringify({ inputs: [{ name, tfm: 'net8.0', data }] }) + '\n');
await fs.rename(temporary, file);
console.log('Generated PdbLibrary from verified fixture: ' + result.debug.sites.length + ' sequence points.');
