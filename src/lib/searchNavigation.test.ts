import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { createSearchNavigation } from './searchNavigation.svelte';
import { readSearchFilters, type SearchFilters } from './search';

function harness() {
	let pageUrl = new URL('https://example.com/search?q=1040&keep=yes');
	const requests: {
		url: URL;
		finish: () => void;
		abort: () => void;
		fail: () => void;
	}[] = [];
	const navigation = createSearchNavigation(
		() => pageUrl,
		(url) => {
			navigation.observeNavigation(url, 'goto');
			return new Promise<void>((resolve, reject) =>
				requests.push({
					url,
					finish: () => {
						pageUrl = url;
						resolve();
					},
					abort: resolve,
					fail: () => reject(new Error('navigation failed'))
				})
			);
		}
	);
	return {
		navigation,
		requests,
		external(url: string) {
			navigation.observeNavigation(new URL(url), 'popstate');
			pageUrl = new URL(url);
		}
	};
}

function permutations<T>(items: T[]): T[][] {
	return items.length
		? items.flatMap((item, index) =>
				permutations(items.filter((_, i) => i !== index)).map((rest) => [
					item,
					...rest
				])
			)
		: [[]];
}

describe('search navigation', () => {
	it('preserves all five filter patches in every one of the 120 rapid orders', async () => {
		const target: SearchFilters = {
			available: true,
			faculty: 'Math',
			pointsMin: 3.2,
			pointsMax: 5,
			medianMin: 85.1
		};
		for (const order of permutations(
			Object.keys(target) as (keyof SearchFilters)[]
		)) {
			const { navigation, requests } = harness();
			const edits = order.map((key) =>
				navigation.updateFilters({ [key]: target[key] }, 20)
			);
			expect(readSearchFilters(navigation.url.searchParams, 20)).toEqual(
				target
			);
			expect(navigation.url.searchParams.get('keep')).toBe('yes');
			for (const [index, request] of requests.entries()) {
				(index === requests.length - 1 ? request.finish : request.abort)();
				await edits[index];
				expect(readSearchFilters(navigation.url.searchParams, 20)).toEqual(
					target
				);
			}
		}
	});

	it('merges queries and filter changes while earlier navigation is pending', async () => {
		const { navigation, requests } = harness();
		const edits = [
			navigation.updateFilters({ pointsMin: 3.2 }, 20),
			navigation.search('A&B + #?'),
			navigation.updateFilters({ available: true }, 20)
		];
		expect(Object.fromEntries(navigation.url.searchParams)).toEqual({
			q: 'A&B + #?',
			keep: 'yes',
			pointsMin: '3.2',
			available: ''
		});
		requests.forEach((request, index) =>
			(index === requests.length - 1 ? request.finish : request.abort)()
		);
		await Promise.all(edits);
		expect(navigation.url.searchParams.get('q')).toBe('A&B + #?');
	});

	it('does not let late completion of an older request clear the latest optimistic URL', async () => {
		const { navigation, requests } = harness();
		const first = navigation.updateFilters({ pointsMin: 3 }, 20);
		const second = navigation.updateFilters({ available: true }, 20);
		requests[0].abort();
		await first;
		expect(navigation.url.searchParams.has('available')).toBe(true);
		requests[1].finish();
		await second;
		expect(navigation.url.searchParams.get('pointsMin')).toBe('3');
	});

	it('clears pending filters synchronously and preserves subsequent edits and query', async () => {
		const { navigation, requests } = harness();
		const edits = [
			navigation.updateFilters({ pointsMin: 3, medianMin: 85 }, 20),
			navigation.updateFilters(undefined, 20),
			navigation.updateFilters({ faculty: 'Math' }, 20)
		];
		expect(Object.fromEntries(navigation.url.searchParams)).toEqual({
			q: '1040',
			keep: 'yes',
			faculty: 'Math'
		});
		requests.forEach((request, index) =>
			(index === requests.length - 1 ? request.finish : request.abort)()
		);
		await Promise.all(edits);
	});

	it('restores external back/forward URLs instead of pending state', async () => {
		const { navigation, requests, external } = harness();
		const pending = navigation.updateFilters({ pointsMin: 3 }, 20);
		external('https://example.com/search?q=other&pointsMax=4');
		expect(Object.fromEntries(navigation.url.searchParams)).toEqual({
			q: 'other',
			pointsMax: '4'
		});
		// A superseded goto resolves without replacing the newer browser navigation.
		requests[0].abort();
		await pending;
		expect(navigation.url.searchParams.get('pointsMax')).toBe('4');
	});

	it('ignores delayed beforeNavigate callbacks from superseded own requests', async () => {
		let pageUrl = new URL('https://example.com/search?q=1040');
		const finish: (() => void)[] = [];
		const urls: URL[] = [];
		const navigation = createSearchNavigation(
			() => pageUrl,
			(url) => {
				urls.push(url);
				return new Promise<void>((resolve) =>
					finish.push(() => {
						pageUrl = url;
						resolve();
					})
				);
			}
		);
		const first = navigation.updateFilters({ pointsMin: 3 }, 20);
		const second = navigation.updateFilters({ available: true }, 20);
		navigation.observeNavigation(urls[0], 'goto');
		expect(navigation.url.searchParams.has('available')).toBe(true);
		expect(navigation.externalRevision).toBe(0);
		navigation.observeNavigation(urls[1], 'goto');
		finish[0]();
		await first;
		finish[1]();
		await second;
		expect(navigation.url.searchParams.get('pointsMin')).toBe('3');
	});

	it('reconciles an external completion when its before callback was skipped', async () => {
		let pageUrl = new URL('https://example.com/search?q=1040&pointsMin=3');
		let resolve!: () => void;
		const navigation = createSearchNavigation(
			() => pageUrl,
			() =>
				new Promise<void>((r) => {
					resolve = r;
				})
		);
		const pending = navigation.updateFilters({ available: true }, 20);
		pageUrl = new URL('https://example.com/search?q=1040&pointsMin=3');
		navigation.observeNavigation(pageUrl, 'popstate');
		expect(navigation.externalRevision).toBe(1);
		resolve();
		await pending;
		expect(navigation.url.searchParams.has('available')).toBe(false);
	});

	it('ignores blur commits caused by external navigation and accepts new edits after rendering', async () => {
		let pageUrl = new URL(
			'https://example.com/search?q=1040&available=&pointsMin=3'
		);
		const requests: URL[] = [];
		const navigation = createSearchNavigation(
			() => pageUrl,
			async (url) => {
				requests.push(url);
				pageUrl = url;
			}
		);
		const previous = new URL('https://example.com/search?q=1040&pointsMin=3');
		navigation.observeNavigation(previous, 'popstate');
		await navigation.updateFilters({ pointsMin: 4.2 }, 20);
		expect(requests).toHaveLength(0);
		pageUrl = previous;
		navigation.observeNavigation(previous, 'popstate', true);
		await navigation.updateFilters({ pointsMin: 4.2 }, 20);
		expect(requests).toHaveLength(0);
		await tick();
		await navigation.updateFilters({ pointsMin: 3.5 }, 20);
		expect(requests).toHaveLength(1);
		expect(navigation.url.searchParams.has('available')).toBe(false);
	});

	it('restores the actual page after a rejected latest navigation', async () => {
		const { navigation, requests } = harness();
		const pending = navigation.updateFilters({ pointsMin: 3 }, 20);
		requests[0].fail();
		await expect(pending).rejects.toThrow('navigation failed');
		expect(navigation.url.searchParams.has('pointsMin')).toBe(false);
	});
});
