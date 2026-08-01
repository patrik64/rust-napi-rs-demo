import { json, error } from '@sveltejs/kit';
import { fibonacci } from '@demo/rust';
import { fibonacciJs } from '$lib/fib-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const n = Number(url.searchParams.get('n') ?? 30);
	if (!Number.isInteger(n) || n < 1 || n > 42) {
		error(400, 'n must be an integer between 1 and 42');
	}
	const engine = url.searchParams.get('engine') === 'js' ? 'js' : 'native';
	const run = engine === 'js' ? fibonacciJs : fibonacci;

	const start = performance.now();
	const result = run(n);
	const ms = performance.now() - start;

	return json({ result, ms, engine });
};
