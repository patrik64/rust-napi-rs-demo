import type { Handle } from '@sveltejs/kit';

// SharedArrayBuffer (used by the threaded WASM build) requires
// cross-origin isolation. Setting the headers here covers SvelteKit
// responses in dev and the adapter-node production server alike.
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};
