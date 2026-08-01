import { json, error } from '@sveltejs/kit';
import { renderMarkdown, analyzeText } from '@demo/rust';
import type { RequestHandler } from './$types';

const MAX_CHARS = 200_000;

// Renders markdown and computes text stats in one call — both are
// string/object marshaling demos for the native addon.
export const POST: RequestHandler = async ({ request }) => {
	const text = await request.text();
	if (text.length > MAX_CHARS) error(413, 'text too large');

	const start = performance.now();
	const html = renderMarkdown(text);
	const stats = analyzeText(text);
	const ms = performance.now() - start;

	return json({ html, stats, ms });
};
