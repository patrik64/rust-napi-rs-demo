<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Overview' },
		{ href: '/benchmark', label: 'Benchmark' },
		{ href: '/image', label: 'Image' },
		{ href: '/text', label: 'Text' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<nav class="container">
		<a href="/" class="brand">🦀 napi-rs <span class="muted">showcase</span></a>
		<div class="nav-links">
			{#each links as link (link.href)}
				<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
					{link.label}
				</a>
			{/each}
		</div>
	</nav>
</header>

<main class="container">
	{@render children()}
</main>

<footer class="container muted">
	One Rust crate, compiled to a native Node.js addon <em>and</em> WebAssembly —
	<code>native/src/lib.rs</code> is the single source of truth.
</footer>

<style>
	header {
		border-bottom: 1px solid var(--hairline);
		background: var(--card);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.7rem;
		padding-bottom: 0.7rem;
	}

	.brand {
		font-weight: 700;
		text-decoration: none;
		color: var(--ink-1);
	}

	.nav-links {
		display: flex;
		gap: 0.25rem;
	}

	.nav-links a {
		color: var(--ink-2);
		text-decoration: none;
		font-weight: 500;
		padding: 0.35rem 0.8rem;
		border-radius: 8px;
	}

	.nav-links a:hover {
		background: var(--code-bg);
	}

	.nav-links a[aria-current='page'] {
		color: var(--accent-ink);
		background: var(--accent);
	}

	main {
		padding-top: 2rem;
		padding-bottom: 3rem;
	}

	footer {
		border-top: 1px solid var(--hairline);
		padding-top: 1rem;
		padding-bottom: 2rem;
		font-size: 0.9rem;
	}
</style>
