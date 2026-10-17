<script lang="ts">
	import AppFooter from '$lib/components/AppFooter.svelte';
	import LandingInstallInfo from '$lib/components/LandingInstallInfo.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import TitleBar from '../../routes/components/TitleBar.svelte';
	import Nav from '../../routes/components/Nav.svelte';
	import ImgDemo from '../../routes/components/ImgDemo.svelte';
	import picture from '$lib/assets/plan-pic.webp?enhanced';
	let {
		kind = 'AppFooter',
		state: variant = 'default'
	}: { kind?: string; state?: string } = $props();
	let query = $state('');
</script>

{#if kind === 'AppFooter'}<AppFooter
		persistPreferences={false}
		compact={variant === 'compact'}
	/>
{:else if kind === 'LandingInstallInfo'}<LandingInstallInfo />
{:else if kind === 'ThemeToggle'}<ThemeToggle compact={variant === 'compact'} />
{:else if kind === 'TitleBar'}
	<TitleBar
		started={variant !== 'landing'}
		homeHref={variant === 'landing' ? '/' : '/app/'}
		searchQuery={variant === 'query' ? 'Example systems' : ''}
		searchRevision={0}
		onSearch={(value) => (query = value)}
	/>
	<output class="mt-3 block">{query ? `Submitted: ${query}` : ''}</output>
{:else if kind === 'Nav'}<Nav target="plan">Example plan</Nav>
{:else if kind === 'ImgDemo'}<ImgDemo
		src={picture}
		title={variant === 'longText'
			? 'A longer example title to review wrapping and spacing'
			: 'Example planner screenshot'}
		>{variant === 'longText'
			? 'This is a deliberately longer description to review natural wrapping across the available canvas without imposing a device width. '.repeat(
					3
				)
			: 'A public product illustration with an explanatory caption.'}</ImgDemo
	>
{/if}
