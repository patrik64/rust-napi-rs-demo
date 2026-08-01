import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

// The threaded WASM build uses SharedArrayBuffer, which browsers only
// expose in a cross-origin-isolated context (see also hooks.server.ts).
const isolationHeaders = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp'
};

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// The native addon runs in the Node server, so we deploy with adapter-node.
			adapter: adapter()
		})
	],
	server: {
		headers: isolationHeaders,
		// The WASM loader lives in ../native (the linked workspace package) —
		// allow serving files from the whole monorepo in dev.
		fs: { allow: [searchForWorkspaceRoot(process.cwd())] }
	},
	preview: { headers: isolationHeaders },
	optimizeDeps: {
		// Serve the WASM loader and its runtime as real modules so their
		// worker + .wasm asset URLs stay intact.
		exclude: ['@napi-rs/wasm-runtime', '@demo/rust']
	},
	ssr: {
		// The native addon is a CJS package loading a .node binary —
		// let Node require it directly instead of bundling it.
		external: ['@demo/rust']
	}
});
