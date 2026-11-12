<script lang="ts">
	import { onMount } from 'svelte';
	import { loadWasm } from '$lib/wasm';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let browserGreeting = $state('loading WASM module…');
	let wasmReady = $state(false);

	// Event-loop demo state: the pulse dot is moved by requestAnimationFrame,
	// so it freezes whenever the main thread is blocked.
	let dotX = $state(0);
	let asyncResult = $state('');
	let syncResult = $state('');
	let busy = $state(false);

	onMount(() => {
		loadWasm()
			.then((rust) => {
				browserGreeting = rust.greet('the browser');
				wasmReady = true;
			})
			.catch((err) => {
				browserGreeting = `failed to load WASM: ${err.message}`;
			});

		let raf: number;
		const start = performance.now();
		const tick = (t: number) => {
			dotX = (Math.sin((t - start) / 300) + 1) / 2;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	async function runSync() {
		const rust = await loadWasm();
		syncResult = '…';
		busy = true;
		// Give the UI one frame to paint, then block the main thread.
		await new Promise((r) => setTimeout(r, 50));
		const start = performance.now();
		const value = rust.fibonacci(40);
		syncResult = `fib(40) = ${value} in ${(performance.now() - start).toFixed(0)} ms — the dot froze`;
		busy = false;
	}

	async function runAsync() {
		const rust = await loadWasm();
		asyncResult = '…';
		busy = true;
		const start = performance.now();
		const value = await rust.fibonacciAsync(40);
		asyncResult = `fib(40) = ${value} in ${(performance.now() - start).toFixed(0)} ms — the dot kept moving`;
		busy = false;
	}
</script>

<svelte:head>
	<title>napi-rs showcase</title>
</svelte:head>

<section class="hero">
	<h1>One Rust crate.<br />Two targets.</h1>
	<p class="tagline">
		<a href="https://napi.rs">napi-rs</a> compiles the same <code>#[napi]</code> functions to a
		<strong>native Node.js addon</strong> for the server and to <strong>WebAssembly</strong> for the
		browser — TypeScript definitions included.
	</p>
</section>

<section class="proof">
	<div class="card">
		<div class="field-label">Server · native addon · during SSR</div>
		<p class="greeting">“{data.serverGreeting}”</p>
		<p class="muted">
			Produced by <code>greet()</code> from the <code>.node</code> addon while this page was
			server-rendered.
		</p>
	</div>
	<div class="card">
		<div class="field-label">Browser · WebAssembly · after hydration</div>
		<p class="greeting" class:pending={!wasmReady}>“{browserGreeting}”</p>
		<p class="muted">
			The same <code>greet()</code>, from <code>demo.wasm32-wasi.wasm</code> running right here in
			your browser.
		</p>
	</div>
</section>

<section class="card eventloop">
	<h2>AsyncTask → Promise</h2>
	<p>
		A Rust <code>AsyncTask</code> becomes a JavaScript <code>Promise</code>. Its work runs on a
		worker thread — in the threaded WASM build, a Web Worker — so watch the dot: it is moved by
		<code>requestAnimationFrame</code>, so it freezes whenever the main thread is blocked.
	</p>
	<div class="track" aria-hidden="true">
		<div class="dot" style:left="calc({dotX} * (100% - 18px))"></div>
	</div>
	<div class="row">
		<button class="btn" onclick={runSync} disabled={busy || !wasmReady}>
			Blocking <code>fibonacci(40)</code>
		</button>
		<button class="btn primary" onclick={runAsync} disabled={busy || !wasmReady}>
			<code>await fibonacciAsync(40)</code>
		</button>
	</div>
	{#if syncResult}<p class="result">sync: {syncResult}</p>{/if}
	{#if asyncResult}<p class="result">async: {asyncResult}</p>{/if}
</section>

<section class="split">
	<div class="card">
		<h2>The whole trick</h2>
		<pre>{`use napi_derive::napi;

#[napi]
pub fn greet(name: String) -> String {
    format!("Hello {name}, this string was built in Rust 🦀")
}

#[napi]
pub fn fibonacci(n: u32) -> u32 { /* … */ }

#[napi]
pub fn fibonacci_async(n: u32) -> AsyncTask<FibonacciTask> { /* … */ }`}</pre>
		<p class="muted">
			<code>napi build --platform</code> → <code>demo.darwin-arm64.node</code> ·
			<code>napi build --target wasm32-wasip1-threads</code> → <code>demo.wasm32-wasi.wasm</code>
		</p>
	</div>
	<div class="card">
		<h2>Try the demos</h2>
		<ul class="demos">
			<li>
				<a href="/benchmark">Benchmark</a> — the same naive <code>fibonacci</code> raced across
				JavaScript, WASM and the native addon.
			</li>
			<li>
				<a href="/image">Image</a> — grayscale, invert, pixelate and blur an image with the
				<code>image</code> crate, in the browser or on the server.
			</li>
			<li>
				<a href="/text">Text</a> — markdown rendered by <code>pulldown-cmark</code> plus text
				stats returned as a plain JS object, live on every keystroke.
			</li>
		</ul>
	</div>
</section>

<style>
	.hero {
		padding: 1.5rem 0 2rem;
	}

	.hero h1 {
		font-size: clamp(2.2rem, 6vw, 3.6rem);
		letter-spacing: -0.02em;
	}

	.tagline {
		font-size: 1.15rem;
		max-width: 46rem;
		color: var(--ink-2);
	}

	.proof {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.greeting {
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0.5rem 0;
	}

	.greeting.pending {
		color: var(--ink-muted);
		font-weight: 400;
	}

	.eventloop {
		margin-bottom: 1rem;
	}

	.track {
		position: relative;
		height: 26px;
		border: 1px solid var(--hairline);
		border-radius: 999px;
		margin: 1rem 0;
		background: var(--code-bg);
	}

	.dot {
		position: absolute;
		top: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent);
	}

	.row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.result {
		margin: 0.75rem 0 0;
		font-size: 0.95rem;
		color: var(--ink-2);
	}

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}

	.demos {
		margin: 0;
		padding-left: 1.1rem;
	}

	.demos li {
		margin-bottom: 0.75rem;
	}
</style>
