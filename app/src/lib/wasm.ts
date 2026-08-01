import { browser } from '$app/environment';

type RustModule = typeof import('@demo/rust/wasm');

let wasmModule: Promise<RustModule> | undefined;

// Lazily load the WASM build (fetch + instantiate happens on first call,
// inside the module's own top-level await). Import it dynamically so SSR
// never touches the browser-only loader.
export function loadWasm(): Promise<RustModule> {
	if (!browser) return Promise.reject(new Error('WASM engine is browser-only'));
	wasmModule ??= import('@demo/rust/wasm');
	return wasmModule;
}

/** Time a synchronous function call in milliseconds. */
export function timed<T>(fn: () => T): { result: T; ms: number } {
	const start = performance.now();
	const result = fn();
	return { result, ms: performance.now() - start };
}
