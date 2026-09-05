const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('router accepts malformed escapes and preserves equals and plus in query values', async () => {
    const source = await fs.readFile(`${__dirname}/../js/core/Router.js`, 'utf8');
    const { Router } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const previous = global.window;
    try {
        global.window = { location: { hash: '#search?q=a%3Db+c&bad=%E0%A4%A' } };
        assert.deepEqual(Router.prototype.getQueryParams(), { q: 'a=b c', bad: '�%A' });
        global.window.location.hash = '#library';
        assert.deepEqual(Router.prototype.getQueryParams(), {});
    } finally {
        global.window = previous;
    }
});
