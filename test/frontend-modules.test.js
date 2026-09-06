const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

test('unbundled frontend imports resolve to existing named exports', () => {
    const root = path.resolve(__dirname, '../js');
    const files = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.js'));
    const modules = new Map(files.map(file => {
        const full = path.join(root, file);
        return [full, espree.parse(fs.readFileSync(full, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }).body];
    }));
    for (const [file, body] of modules) {
        for (const entry of body.filter(node => node.type === 'ImportDeclaration' && node.source.value.startsWith('.'))) {
            const target = path.resolve(path.dirname(file), entry.source.value);
            const exports = modules.get(target);
            assert.ok(exports, `${file}: ${entry.source.value}`);
            const names = new Set(exports.flatMap(node => node.type === 'ExportDefaultDeclaration' ? ['default'] : node.type === 'ExportNamedDeclaration'
                ? [...(node.specifiers || []).map(s => s.exported.name), ...(node.declaration?.id ? [node.declaration.id.name] : []), ...(node.declaration?.declarations || []).map(d => d.id.name)] : []));
            for (const specifier of entry.specifiers) {
                if (specifier.type === 'ImportNamespaceSpecifier') continue;
                const name = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
                assert.ok(names.has(name), `${file} imports missing ${name} from ${target}`);
            }
        }
    }
});
