<script lang="ts">
	import { ENGINES, type EngineId } from '$lib/engines';
	import { loadWasm, timed } from '$lib/wasm';
	// The initial editor content — a copy of the project README.
	import SAMPLE from '$lib/sample.md?raw';

	type Stats = { chars: number; words: number; lines: number; mostCommonWord: string };

	let markdown = $state(SAMPLE);
	let engine = $state<Extract<EngineId, 'wasm-browser' | 'native-server'>>('wasm-browser');
	let html = $state('');
	let stats = $state<Stats | null>(null);
	let ms = $state<number | null>(null);
	let errorMsg = $state('');

	let renderToken = 0;

	async function render(text: string, target: typeof engine) {
		const token = ++renderToken;
		try {
			if (target === 'wasm-browser') {
				const rust = await loadWasm();
				const run = timed(() => ({
					html: rust.renderMarkdown(text),
					stats: rust.analyzeText(text)
				}));
				if (token !== renderToken) return;
				html = run.result.html;
				stats = run.result.stats;
				ms = run.ms;
			} else {
				const res = await fetch('/api/text', { method: 'POST', body: text });
				if (token !== renderToken) return;
				if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
				const body = await res.json();
				html = body.html;
				stats = body.stats;
				ms = body.ms;
			}
			errorMsg = '';
		} catch (err) {
			if (token === renderToken) {
				errorMsg = err instanceof Error ? err.message : String(err);
			}
		}
	}

	// Debounced live re-render on every input or engine change.
	$effect(() => {
		const text = markdown;
		const target = engine;
		const timer = setTimeout(() => render(text, target), 120);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Text · napi-rs showcase</title>
</svelte:head>

<h1>Markdown &amp; text stats</h1>
<p class="muted intro">
	<code>renderMarkdown()</code> returns a string, <code>analyzeText()</code> returns a
	<code>#[napi(object)]</code> struct as a plain JS object — re-run on every keystroke to show the
	call overhead is negligible either way.
</p>

<div class="card controls">
	<div class="seg" role="group" aria-label="Engine">
		<button aria-pressed={engine === 'wasm-browser'} onclick={() => (engine = 'wasm-browser')}>
			Browser · WASM
		</button>
		<button aria-pressed={engine === 'native-server'} onclick={() => (engine = 'native-server')}>
			Server · native
		</button>
	</div>
	{#if ms !== null}
		<span class="chip">
			<span class="dot" style:background={ENGINES[engine].color}></span>
			parsed + analyzed in {ms.toFixed(2)} ms
		</span>
	{/if}
	{#if errorMsg}
		<span class="chip">⚠️ {errorMsg}</span>
	{/if}
</div>

{#if stats}
	<div class="tiles">
		<div class="card tile">
			<div class="field-label">Characters</div>
			<div class="big">{stats.chars.toLocaleString()}</div>
		</div>
		<div class="card tile">
			<div class="field-label">Words</div>
			<div class="big">{stats.words.toLocaleString()}</div>
		</div>
		<div class="card tile">
			<div class="field-label">Lines</div>
			<div class="big">{stats.lines.toLocaleString()}</div>
		</div>
		<div class="card tile">
			<div class="field-label">Most common word</div>
			<div class="big word">{stats.mostCommonWord || '—'}</div>
		</div>
	</div>
{/if}

<div class="panes">
	<textarea bind:value={markdown} spellcheck="false" aria-label="Markdown input"></textarea>
	<!-- Demo-only: renders HTML straight from pulldown-cmark without sanitizing. -->
	<div class="card rendered">{@html html}</div>
</div>

<style>
	.intro {
		max-width: 46rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	textarea {
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--ink-1);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1.25rem;
		min-height: 420px;
		resize: vertical;
	}

	textarea:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}

	.rendered {
		overflow-x: auto;
	}

	.rendered :global(h1) {
		margin-top: 0;
	}

	.rendered :global(pre) {
		background: var(--code-bg);
		border-radius: 8px;
		padding: 0.75rem 1rem;
	}

	.rendered :global(blockquote) {
		margin: 0.75rem 0;
		padding-left: 1rem;
		border-left: 3px solid var(--accent);
		color: var(--ink-2);
	}

	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.tile .big {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.tile .big.word {
		font-size: 1.6rem;
	}

	@media (max-width: 760px) {
		.panes {
			grid-template-columns: 1fr;
		}
	}
</style>
