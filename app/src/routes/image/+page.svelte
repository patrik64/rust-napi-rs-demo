<script lang="ts">
	import { onMount } from 'svelte';
	import { ENGINES, type EngineId } from '$lib/engines';
	import { loadWasm, timed } from '$lib/wasm';

	type Op = 'grayscale' | 'invert' | 'pixelate' | 'blur';
	type HistoryEntry = {
		op: Op;
		engine: EngineId;
		param: number | null;
		computeMs: number;
		roundTripMs: number | null;
	};

	const OPS: { id: Op; label: string }[] = [
		{ id: 'grayscale', label: 'Grayscale' },
		{ id: 'invert', label: 'Invert' },
		{ id: 'pixelate', label: 'Pixelate' },
		{ id: 'blur', label: 'Blur' }
	];

	let sourceBytes = $state<Uint8Array | null>(null);
	let sourceUrl = $state('/sample.png');
	let sourceName = $state('sample.png');
	let resultUrl = $state<string | null>(null);
	let op = $state<Op>('grayscale');
	let engine = $state<Extract<EngineId, 'wasm-browser' | 'native-server'>>('wasm-browser');
	let blockSize = $state(16);
	let sigma = $state(4);
	let running = $state(false);
	let errorMsg = $state('');
	let lastRun = $state<HistoryEntry | null>(null);
	let history = $state<HistoryEntry[]>([]);

	const param = $derived(op === 'pixelate' ? blockSize : op === 'blur' ? sigma : null);

	onMount(async () => {
		const res = await fetch('/sample.png');
		sourceBytes = new Uint8Array(await res.arrayBuffer());
	});

	function pickFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		file.arrayBuffer().then((buf) => {
			sourceBytes = new Uint8Array(buf);
			sourceUrl = URL.createObjectURL(file);
			sourceName = file.name;
			resultUrl = null;
		});
	}

	async function run() {
		if (!sourceBytes) return;
		const bytes = sourceBytes;
		errorMsg = '';
		running = true;
		try {
			// Let the button state paint before sync WASM work blocks the thread.
			await new Promise((r) => setTimeout(r, 40));
			let out: Uint8Array;
			let computeMs: number;
			let roundTripMs: number | null = null;

			if (engine === 'wasm-browser') {
				const rust = await loadWasm();
				const ops = {
					grayscale: () => rust.grayscale(bytes),
					invert: () => rust.invert(bytes),
					pixelate: () => rust.pixelate(bytes, blockSize),
					blur: () => rust.blur(bytes, sigma)
				};
				({ result: out, ms: computeMs } = timed(ops[op]));
			} else {
				const query = param === null ? `op=${op}` : `op=${op}&arg=${param}`;
				const start = performance.now();
				const res = await fetch(`/api/image?${query}`, {
					method: 'POST',
					// Without an explicit content-type, SvelteKit reads the body as empty.
					headers: { 'content-type': 'application/octet-stream' },
					body: bytes as BodyInit
				});
				roundTripMs = performance.now() - start;
				if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
				computeMs = Number(res.headers.get('x-compute-ms'));
				out = new Uint8Array(await res.arrayBuffer());
			}

			if (resultUrl) URL.revokeObjectURL(resultUrl);
			resultUrl = URL.createObjectURL(new Blob([out as BlobPart], { type: 'image/png' }));
			lastRun = { op, engine, param, computeMs, roundTripMs };
			history = [lastRun, ...history].slice(0, 12);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
		} finally {
			running = false;
		}
	}

	function fmtMs(ms: number): string {
		return ms >= 100 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`;
	}
</script>

<svelte:head>
	<title>Image · napi-rs showcase</title>
</svelte:head>

<h1>Image processing</h1>
<p class="muted intro">
	The Rust <code>image</code> crate, called with a plain <code>Uint8Array</code>. Run it on the
	same photo in the browser (WASM) or on the server (native addon) and compare timings.
</p>

<div class="card controls">
	<div class="group">
		<span class="field-label">Operation</span>
		<div class="seg" role="group" aria-label="Operation">
			{#each OPS as candidate (candidate.id)}
				<button aria-pressed={op === candidate.id} onclick={() => (op = candidate.id)}>
					{candidate.label}
				</button>
			{/each}
		</div>
	</div>

	{#if op === 'pixelate'}
		<label class="group">
			<span class="field-label">Block size: {blockSize}px</span>
			<input type="range" min="4" max="64" bind:value={blockSize} />
		</label>
	{:else if op === 'blur'}
		<label class="group">
			<span class="field-label">Sigma: {sigma}</span>
			<input type="range" min="1" max="12" bind:value={sigma} />
		</label>
	{/if}

	<div class="group">
		<span class="field-label">Engine</span>
		<div class="seg" role="group" aria-label="Engine">
			<button aria-pressed={engine === 'wasm-browser'} onclick={() => (engine = 'wasm-browser')}>
				Browser · WASM
			</button>
			<button aria-pressed={engine === 'native-server'} onclick={() => (engine = 'native-server')}>
				Server · native
			</button>
		</div>
	</div>

	<button class="btn primary" onclick={run} disabled={running || !sourceBytes}>
		{running ? 'Processing…' : 'Run'}
	</button>
</div>

{#if errorMsg}
	<p class="error">⚠️ {errorMsg}</p>
{/if}

<div class="panels">
	<div class="card panel">
		<div class="panel-head">
			<span class="field-label">Original — {sourceName}</span>
			<label class="btn small">
				Choose image…
				<input type="file" accept="image/png,image/jpeg" onchange={pickFile} />
			</label>
		</div>
		<img src={sourceUrl} alt="Source" />
	</div>
	<div class="card panel">
		<div class="panel-head">
			<span class="field-label">Result</span>
			{#if lastRun}
				<span class="chip">
					<span class="dot" style:background={ENGINES[lastRun.engine].color}></span>
					{fmtMs(lastRun.computeMs)} compute
					{#if lastRun.roundTripMs !== null}
						· {fmtMs(lastRun.roundTripMs)} round-trip
					{/if}
				</span>
			{/if}
		</div>
		{#if resultUrl}
			<img src={resultUrl} alt="Processed result" />
		{:else}
			<div class="placeholder muted">Press <strong>Run</strong> to process the image.</div>
		{/if}
	</div>
</div>

{#if history.length > 0}
	<div class="card">
		<h2>Runs</h2>
		<table>
			<thead>
				<tr><th>Operation</th><th>Engine</th><th>Compute</th><th>Round-trip</th></tr>
			</thead>
			<tbody>
				{#each history as entry, i (i)}
					<tr>
						<td>{entry.op}{entry.param !== null ? ` (${entry.param})` : ''}</td>
						<td>
							<span class="dot" style:background={ENGINES[entry.engine].color}></span>
							{ENGINES[entry.engine].label} · {ENGINES[entry.engine].runtime}
						</td>
						<td class="num">{fmtMs(entry.computeMs)}</td>
						<td class="num">{entry.roundTripMs === null ? '—' : fmtMs(entry.roundTripMs)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.intro {
		max-width: 46rem;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	input[type='range'] {
		accent-color: var(--accent);
		min-width: 160px;
	}

	.error {
		color: var(--series-2);
		font-weight: 600;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		min-height: 2rem;
	}

	.panel img {
		width: 100%;
		border-radius: 8px;
		display: block;
	}

	.placeholder {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px dashed var(--baseline);
		border-radius: 8px;
	}

	.btn.small {
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		position: relative;
		overflow: hidden;
	}

	.btn.small input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 0.3ch;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	th {
		text-align: left;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-muted);
		border-bottom: 1px solid var(--hairline);
		padding: 0.4rem 0.75rem 0.4rem 0;
	}

	td {
		border-bottom: 1px solid var(--hairline);
		padding: 0.45rem 0.75rem 0.45rem 0;
	}

	td.num {
		font-variant-numeric: tabular-nums;
	}
</style>
