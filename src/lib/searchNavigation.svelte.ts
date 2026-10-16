import { tick } from 'svelte';
import {
	createSearchUrl,
	readSearchFilters,
	searchFilterKeys,
	writeSearchFilters,
	type SearchFilters
} from '$lib/search';

export const searchNavigationContext = Symbol('search navigation');

/** Share the latest intended URL between the header and filters, including in-flight edits. */
export function createSearchNavigation(
	getPageUrl: () => URL,
	navigate: (url: URL) => Promise<void>
) {
	let intendedUrl = $state<URL>();
	let revision = 0;
	const inFlight = new Map<number, string>();
	let externalRevision = $state(0);
	let externalNavigation = false;
	const currentUrl = () => intendedUrl ?? getPageUrl();

	async function commit(url: URL) {
		if (url.href === currentUrl().href) return;
		const ownRevision = ++revision;
		externalNavigation = false;
		intendedUrl = url;
		inFlight.set(ownRevision, url.href);
		try {
			// SvelteKit supersedes older navigations; never queue stale URLs behind a newer edit.
			await navigate(url);
		} finally {
			inFlight.delete(ownRevision);
			if (revision === ownRevision) intendedUrl = undefined;
		}
	}

	return {
		get url() {
			return currentUrl();
		},
		get externalRevision() {
			return externalRevision;
		},
		observeNavigation(to: URL | undefined, type: string, completed = false) {
			// beforeNavigate may run after a newer goto has already been requested.
			const ownNavigation =
				type === 'goto' && [...inFlight.values()].includes(to?.href ?? '');
			if (!ownNavigation) {
				externalNavigation = true;
				const externalToken = ++revision;
				++externalRevision;
				intendedUrl = undefined;
				if (completed) {
					// Removing/focusing controls during history navigation can emit blur.
					// Discard that old draft until the new page has finished rendering.
					void tick().then(() => {
						if (revision === externalToken) externalNavigation = false;
					});
				}
			}
		},
		search(query: string) {
			return commit(createSearchUrl(currentUrl(), query));
		},
		updateFilters(
			patch: Partial<SearchFilters> | undefined,
			maxPoints: number
		) {
			if (externalNavigation) return Promise.resolve();
			const url = new URL(currentUrl());
			if (patch) {
				writeSearchFilters(
					url.searchParams,
					{
						...readSearchFilters(url.searchParams, maxPoints),
						...patch
					},
					maxPoints
				);
			} else {
				searchFilterKeys.forEach((key) => url.searchParams.delete(key));
			}
			return commit(url);
		}
	};
}

export type SearchNavigation = ReturnType<typeof createSearchNavigation>;
