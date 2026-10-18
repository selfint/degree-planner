<script lang="ts">
	import { setContext, untrack, type Snippet } from 'svelte';
	import { cms } from '../src/lib/content';
	import { content } from './mocks/preferences.svelte';
	import { user, scenario } from './mocks/stores.svelte';
	import { planOnline } from './mocks/planAccess';
	import { makeUser } from './fixtures';
	import { PERSONAL_PLAN_READY } from '../src/lib/pwa/plan-visibility';
	import {
		createSearchNavigation,
		searchNavigationContext
	} from '../src/lib/searchNavigation.svelte';
	let {
		theme,
		language,
		direction,
		storyId,
		planner = {},
		pageUrl,
		children
	}: {
		theme: string;
		language: string;
		direction: string;
		storyId: string;
		planner: {
			plan?: string;
			online?: boolean;
			loading?: boolean;
			noDegree?: boolean;
			user?: Partial<UserData>;
			personalPlanReady?: boolean;
			transcript?: string;
			signInError?: boolean;
			pathChoices?: boolean;
		};
		pageUrl?: URL;
		children: Snippet;
	} = $props();
	let initialized = $state(false);
	let searchUrl = $state(
		new URL('https://storybook.invalid/app/search?q=Example')
	);
	setContext(PERSONAL_PLAN_READY, () => planner.personalPlanReady !== false);
	setContext(
		searchNavigationContext,
		createSearchNavigation(
			() => searchUrl,
			async (url) => {
				searchUrl = url;
			}
		)
	);
	$effect.pre(() => {
		storyId;
		const p = planner;
		const url = pageUrl;
		untrack(() => {
			user.d = { ...makeUser(p.plan === 'empty'), ...p.user };
			scenario.loading = !!p.loading;
			scenario.noDegree = !!p.noDegree;
			scenario.transcript = p.transcript ?? 'default';
			scenario.signInError = !!p.signInError;
			scenario.pathChoices = !!p.pathChoices;
			planOnline.set(p.online !== false);
			searchUrl = new URL(
				url ?? 'https://storybook.invalid/app/search?q=Example'
			);
			initialized = true;
		});
	});
	$effect.pre(() => {
		const selected = language === 'he' ? cms.he : cms.en;
		const dir =
			direction === 'rtl'
				? 'rtl'
				: direction === 'ltr'
					? 'ltr'
					: language === 'he'
						? 'rtl'
						: 'ltr';
		// Preserve the underlying CMS object identity used by the footer's select.
		// Direction is changed only through the isolated Svelte proxy, not the CMS object.
		untrack(() => {
			content.lang = selected;
			Object.assign(content.lang, { dir });
		});
		document.documentElement.dataset.theme =
			theme === 'light' ? 'light' : 'dark';
		document.documentElement.lang = selected.lang;
		document.documentElement.dir = dir;
	});
</script>

{#if initialized}
	<div data-story-ready={storyId} class="min-w-0 text-content-primary">
		{@render children()}
	</div>
{/if}
