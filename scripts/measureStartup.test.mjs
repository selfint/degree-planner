import { describe, expect, it } from 'vitest';
import {
	moduleCategory,
	readRoutes,
	staticClosure
} from './measureStartup.mjs';

describe('startup measurement', () => {
	it('deduplicates static dependencies and excludes dynamic imports', () => {
		const manifest = {
			start: { imports: ['shared'] },
			app: { imports: ['shared'], dynamicImports: ['optional'] },
			page: { imports: ['feature', 'shared'] },
			feature: { imports: ['shared'] },
			shared: { imports: ['app'] },
			optional: {}
		};
		expect(staticClosure(manifest, ['start', 'app', 'page']).sort()).toEqual(
			['start', 'app', 'page', 'shared', 'feature'].sort()
		);
		expect(() => staticClosure(manifest, ['missing'])).toThrow(
			'Missing manifest dependency'
		);
	});

	it('parses route groups, sparse layouts and server-load leaf markers', () => {
		expect(
			readRoutes(`export const dictionary = {
			"/": [4],
			"/(landing)/en": [12,[2]],
			"/app/(withData)/plan": [-8,[,3,5]],
			"/app/course/[code]": [9,[3]]
		};`)
		).toEqual([
			{ id: '/', path: '/', nodes: [0, 4] },
			{ id: '/(landing)/en', path: '/en', nodes: [0, 2, 12] },
			{ id: '/app/(withData)/plan', path: '/app/plan', nodes: [0, 3, 5, 7] },
			{ id: '/app/course/[code]', path: '/app/course/[code]', nodes: [0, 3, 9] }
		]);
		expect(() => readRoutes('unknown format')).toThrow('route dictionary');
	});

	it('labels vendor source attribution without equating it to transfer bytes', () => {
		for (const name of ['auth', 'firestore', 'analytics']) {
			expect(
				moduleCategory(`/repo/node_modules/@firebase/${name}/dist/index.js`)
			).toBe(`firebase/${name}`);
		}
		expect(
			moduleCategory('/repo/node_modules/@firebase/app/dist/index.js')
		).toBe('firebase/shared-and-other');
		expect(
			moduleCategory('/repo/node_modules/@vercel/analytics/dist/index.js')
		).toBe('vercel/analytics');
		expect(
			moduleCategory('/repo/node_modules/@vercel/speed-insights/dist/index.js')
		).toBe('vercel/speed-insights');
		expect(moduleCategory('/repo/node_modules/svelte/internal.js')).toBe(
			'other-dependencies'
		);
		expect(moduleCategory('/repo/src/lib/firebase.svelte.ts')).toBe(
			'application-and-generated'
		);
	});
});
