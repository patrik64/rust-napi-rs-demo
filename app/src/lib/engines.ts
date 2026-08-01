// One entry per execution engine, in fixed display order.
// Colors are fixed per entity (see app.css) and never reassigned.
export type EngineId = 'js-browser' | 'wasm-browser' | 'js-server' | 'native-server';

export const ENGINES: Record<
	EngineId,
	{ label: string; runtime: 'browser' | 'server'; color: string }
> = {
	'js-browser': { label: 'JavaScript', runtime: 'browser', color: 'var(--series-1)' },
	'wasm-browser': { label: 'Rust → WASM', runtime: 'browser', color: 'var(--series-2)' },
	'js-server': { label: 'JavaScript', runtime: 'server', color: 'var(--series-3)' },
	'native-server': { label: 'Rust → native', runtime: 'server', color: 'var(--series-4)' }
};

export const ENGINE_ORDER: EngineId[] = [
	'js-browser',
	'wasm-browser',
	'js-server',
	'native-server'
];
