import { error } from '@sveltejs/kit';
import { grayscale, invert, pixelate, blur } from '@demo/rust';
import type { RequestHandler } from './$types';

const MAX_BYTES = 20 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, url }) => {
	const op = url.searchParams.get('op') ?? 'grayscale';
	const arg = Number(url.searchParams.get('arg') ?? 0);
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length === 0) error(400, 'empty request body');
	if (bytes.length > MAX_BYTES) error(413, 'image too large');

	const start = performance.now();
	let out: Uint8Array;
	try {
		switch (op) {
			case 'grayscale':
				out = grayscale(bytes);
				break;
			case 'invert':
				out = invert(bytes);
				break;
			case 'pixelate':
				out = pixelate(bytes, arg || 16);
				break;
			case 'blur':
				out = blur(bytes, arg || 4);
				break;
			default:
				error(400, `unknown op: ${op}`);
		}
	} catch (err) {
		error(422, err instanceof Error ? err.message : 'image processing failed');
	}
	const ms = performance.now() - start;

	return new Response(out as BodyInit, {
		headers: {
			'content-type': 'image/png',
			'x-compute-ms': ms.toFixed(2)
		}
	});
};
