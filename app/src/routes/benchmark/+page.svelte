<script lang="ts">
	import { ENGINES, ENGINE_ORDER, type EngineId } from '$lib/engines';
	import { fibonacciJs } from '$lib/fib-js';
	import { loadWasm, timed } from '$lib/wasm';

	type Run = { ms: number; result: number; roundTripMs?: number };

	let n = $state(35);
	let running = $state(false);
	let runs = $state<Partial<Record<EngineId, Run>>>({});
	let errorMsg = $state('');
	let tooltip = $state<{ x: number; y: number; id: EngineId } | null>(null);

	const maxMs = $derived(
		Math.max(...Object.values(runs).map((r) => r?.ms ?? 0), 0.000001)
	);
	const baseline = $derived(runs['js-browser']);

	async function runEngine(id: EngineId) {
		// Let the disabled state and spinner paint before sync work blocks the thread.
		await new Promise((r) => setTimeout(r, 40));
		switch (id) {
			case 'js-browser': {
				runs['js-browser'] = timed(() => fibonacciJs(n));
				break;
			}
			case 'wasm-browser': {
				const rust = await loadWasm();
				runs['wasm-browser'] = timed(() => rust.fibonacci(n));
				break;
			}
			case 'js-server':
			case 'native-server': {
				const engine = id === 'js-server' ? 'js' : 'native';
				const start = performance.now();
				const res = await fetch(`/api/fib?n=${n}&engine=${engine}`);
				const roundTripMs = performance.now() - start;
				if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
				const body = await res.json();
				runs[id] = { ms: body.ms, result: body.result, roundTripMs };
				break;
			}
		}
	}

	async function runBench(ids: EngineId[]) {
		errorMsg = '';
		running = true;
		try {
			for (const id of ids) await runEngine(id);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
		} finally {
			running = false;
		}
	}

	function speedup(id: EngineId): string | null {
		const run = runs[id];
		if (!run || !baseline || baseline.ms <= 0) return null;
		return (baseline.ms / run.ms).toFixed(1);
	}

	function fmtMs(ms: number): string {
		return ms >= 100 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`;
	}
</script>

<svelte:head>
	<title>Benchmark · napi-rs showcase</title>
</svelte:head>

<h1>Benchmark</h1>
<p class="muted intro">
	The same deliberately naive <code>fibonacci(n)</code> — identical algorithm in JavaScript and
	Rust — timed per engine. Server bars show pure compute time as measured on the server; the
	tooltip has the HTTP round-trip.
</p>

<div class="card controls">
	<label>
		<span class="field-label">n = {n}</span>
		<input type="range" min="25" max="40" bind:value={n} disabled={running} />
	</label>
	{#if n >= 38}
		<span class="chip">⚠️ JavaScript will take several seconds at n = {n}</span>
	{/if}
	<div class="buttons">
		<button class="btn primary" onclick={() => runBench(ENGINE_ORDER)} disabled={running}>
			{running ? 'Running…' : 'Run all engines'}
		</button>
	</div>
</div>

{#if errorMsg}
	<p class="error">⚠️ {errorMsg}</p>
{/if}

<div class="card chart" aria-label="Execution time per engine">
	{#each ENGINE_ORDER as id (id)}
		{@const engine = ENGINES[id]}
		{@const run = runs[id]}
		<div
			class="chart-row"
			role="img"
			aria-label={run
				? `${engine.label} (${engine.runtime}): ${fmtMs(run.ms)}`
				: `${engine.label} (${engine.runtime}): not run yet`}
			onmousemove={(e) => {
				if (run) tooltip = { x: e.clientX, y: e.clientY, id };
			}}
			onmouseleave={() => (tooltip = null)}
		>
			<div class="row-label">
				<span class="series-dot" style:background={engine.color}></span>
				<span class="engine-name">{engine.label}</span>
				<span class="runtime muted">{engine.runtime}</span>
				<button
					class="rerun"
					title="Run this engine"
					disabled={running}
					onclick={() => runBench([id])}>▶</button
				>
			</div>
			<div class="bar-lane">
				{#if run}
					<div
						class="bar"
						style:width="max(2px, {(run.ms / maxMs) * 100}%)"
						style:background={engine.color}
					></div>
					<span class="value">{fmtMs(run.ms)}</span>
				{:else}
					<span class="value muted">—</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

{#if tooltip}
	{@const run = runs[tooltip.id]}
	{#if run}
		<div class="tooltip" style:left="{tooltip.x + 14}px" style:top="{tooltip.y + 14}px">
			<strong>{ENGINES[tooltip.id].label}</strong> · {ENGINES[tooltip.id].runtime}<br />
			fib({n}) = {run.result}<br />
			compute: {fmtMs(run.ms)}
			{#if run.roundTripMs}<br />round-trip: {fmtMs(run.roundTripMs)}{/if}
		</div>
	{/if}
{/if}

{#if baseline && (runs['wasm-browser'] || runs['native-server'])}
	<div class="tiles">
		{#if runs['wasm-browser']}
			<div class="card tile">
				<div class="field-label">WASM vs JavaScript</div>
				<div class="big">{speedup('wasm-browser')}×</div>
				<div class="muted">faster in the browser</div>
			</div>
		{/if}
		{#if runs['native-server']}
			<div class="card tile">
				<div class="field-label">Native vs JavaScript</div>
				<div class="big">{speedup('native-server')}×</div>
				<div class="muted">faster on the server</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.intro {
		max-width: 46rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 240px;
	}

	.controls input[type='range'] {
		accent-color: var(--accent);
	}

	.buttons {
		margin-left: auto;
	}

	.error {
		color: var(--series-2);
		font-weight: 600;
	}

	.chart {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.chart-row {
		display: grid;
		grid-template-columns: 15rem 1fr;
		gap: 0.75rem;
		align-items: center;
	}

	.row-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.series-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
	}

	.engine-name {
		font-weight: 600;
		white-space: nowrap;
	}

	.runtime {
		font-size: 0.85rem;
	}

	.rerun {
		font: inherit;
		font-size: 0.7rem;
		color: var(--ink-muted);
		background: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.1rem 0.45rem;
		cursor: pointer;
	}

	.rerun:hover:not(:disabled) {
		color: var(--ink-1);
		border-color: var(--baseline);
	}

	.bar-lane {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		border-left: 2px solid var(--baseline);
		padding-left: 2px;
		min-height: 26px;
	}

	.bar {
		height: 22px;
		border-radius: 0 4px 4px 0;
		transition: width 300ms ease;
		flex: none;
		max-width: calc(100% - 5.5rem);
	}

	.value {
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.tooltip {
		position: fixed;
		z-index: 20;
		background: var(--card);
		border: 1px solid var(--baseline);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
		pointer-events: none;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.tile .big {
		font-size: 2.4rem;
		font-weight: 700;
		line-height: 1.1;
	}

	@media (max-width: 640px) {
		.chart-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
