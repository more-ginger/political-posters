<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="w-sm h-screen m-auto">
	<div class="absolute top-0 w-sm h-10 z-2 bg-white border-b">header</div>
	{@render children()}
</div>

