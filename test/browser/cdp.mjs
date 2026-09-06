import { writeFile } from 'node:fs/promises';

export async function browser() {
    const debugUrl = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9227';
    if (!['127.0.0.1', 'localhost'].includes(new URL(debugUrl).hostname)) throw new Error('Only a local test browser is supported.');
    const pages = await (await fetch(`${debugUrl}/json`)).json();
    const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener('message', event => {
        const msg = JSON.parse(event.data);
        if (msg.id) {
            const p = pending.get(msg.id);
            if (!p) return;
            pending.delete(msg.id);
            clearTimeout(p.timeout);
            msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const next = ++id;
        const timeout = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
        pending.set(next, { resolve, reject, timeout });
        ws.send(JSON.stringify({ id: next, method, params }));
    });
    const run = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true, replMode: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const until = async expression => {
        for (let i = 0; i < 100; i++) {
            try { if (await run(expression)) return; }
            catch (error) {
                if (!/context.*(destroyed|not found)|Cannot find context/i.test(error.message)) throw error;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error(`Timed out: ${expression}`);
    };
    await send('Runtime.enable');
    await send('Page.enable');
    const reload = async () => {
        const marker = crypto.randomUUID();
        await run(`window.__reloadMarker = ${JSON.stringify(marker)}`);
        await send('Page.reload');
        await until(`window.__reloadMarker !== ${JSON.stringify(marker)} && Boolean(window.router)`);
    };
    return { send, run, until, reload, errors, close: () => ws.close(),
        screenshot: async path => {
            const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            await writeFile(path, Buffer.from(data, 'base64'));
        }
    };
}
