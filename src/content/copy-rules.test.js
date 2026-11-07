import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Copy rule from the brief: never use an em dash anywhere in the interface or
// content. This scans every source file, plus public files and index.html.
const EM_DASH = String.fromCharCode(0x2014);
const root = join(__dirname, '..', '..');
function files(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : [path];
    });
}
describe('copy rules', () => {
    it('has no em dashes in app text', () => {
        const targets = [...files(join(root, 'src')), ...files(join(root, 'public')), join(root, 'index.html')].filter((f) => /\.(tsx?|css|html|json|svg|txt|md)$/.test(f) || f.endsWith('_headers'));
        const offenders = targets.filter((f) => readFileSync(f, 'utf8').includes(EM_DASH));
        expect(offenders).toEqual([]);
    });
});
