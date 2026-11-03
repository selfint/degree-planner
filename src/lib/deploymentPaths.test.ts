import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('$app/paths', () => ({ base: '/degree-planner' }));
import { withBase, withoutBase } from './deploymentPaths';
import { browserShareDestination, consolePathname } from './browserShareRoutes';
import { legacyConsoleDestination } from './consoleRoutes';
import { createSearchUrl } from './search';
import { createPublicDataRepository } from './publicData';

describe('project deployment prefix', () => {
	it('prefixes links and media while preserving root deployments', () => {
		expect(withBase('/app/plan')).toBe('/degree-planner/app/plan');
		expect(withBase('/brand/planit-logo.webp')).toBe(
			'/degree-planner/brand/planit-logo.webp'
		);
		expect(withBase('/app/plan', '')).toBe('/app/plan');
		expect(withoutBase('/degree-planner/app/plan')).toBe('/app/plan');
		expect(withoutBase('/degree-planner-other/app/plan')).toBe(
			'/degree-planner-other/app/plan'
		);
	});
	it('preserves prefixed browser shares, legacy links and search filters', () => {
		expect(browserShareDestination('/degree-planner/share/a/b/c')).toBe(
			'/degree-planner/app/preview/a/b/c'
		);
		expect(consolePathname('/degree-planner/share/a/b/c')).toBe(
			'/app/preview/a/b/c'
		);
		expect(
			legacyConsoleDestination(
				new URL('https://example.test/degree-planner/plan?x=1#saved')
			)
		).toBe('/degree-planner/app/plan?x=1#saved');
		const url = createSearchUrl(
			new URL('https://example.test/degree-planner/app/search?faculty=Math'),
			'algebra'
		);
		expect(url.pathname).toBe('/degree-planner/app/search');
		expect(url.searchParams.get('faculty')).toBe('Math');
	});
	it('prefixes network requests without changing canonical cache/validation keys', async () => {
		const fetcher = vi.fn(
			async () => new Response(readFileSync('static/catalogs.json', 'utf8'))
		);
		const repository = createPublicDataRepository({
			store: null,
			bypassServiceWorker: () => false
		});
		await repository.get('/catalogs.json', fetcher);
		expect(fetcher).toHaveBeenCalledWith(
			'/degree-planner/catalogs.json',
			expect.objectContaining({ credentials: 'omit' })
		);
	});
});
