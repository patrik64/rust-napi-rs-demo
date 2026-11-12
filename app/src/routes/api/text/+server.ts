import { json, error } from '@sveltejs/kit';
import { renderMarkdown, analyzeText } from '@demo/rust';
import type { RequestHandler } from './$types';

// Generous on purpose: the demo invites pasting huge documents. Production
// also needs BODY_SIZE_LIMIT large enough for this (see server.mjs).
const MAX_CHARS = 50_000_000;

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
