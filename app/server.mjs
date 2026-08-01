// Production entry: wraps the adapter-node handler so that EVERY response
// (including static assets like the WASM worker script) carries the
// cross-origin-isolation headers. SvelteKit's asset middleware bypasses
// hooks.server.ts, and a worker script served without its own COEP header
// is refused in a cross-origin-isolated page — which would break the
// threaded WASM build. Run with: node server.mjs (after pnpm build).
import { createServer } from 'node:http';
import { handler } from './build/handler.js';

const server = createServer((req, res) => {
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, () => {
	console.log(`napi-rs showcase running on http://localhost:${port}`);
});
