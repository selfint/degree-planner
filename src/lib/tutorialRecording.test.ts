import { expect, it, vi } from 'vitest';
import { createRecording } from '../../tutorials/helpers/recording';
import type { Browser } from '@playwright/test';

it('records with real workers and closes only the recorded page before persistence verification', async () => {
	const page = {
		addInitScript: vi.fn(),
		route: vi.fn(),
		video: () => null,
		close: vi.fn()
	};
	const context = { newPage: vi.fn(async () => page), close: vi.fn() };
	const browser = { newContext: vi.fn(async () => context) };
	const recording = await createRecording(
		browser as unknown as Browser,
		'http://localhost:4173',
		'en',
		'light',
		[[]]
	);
	expect(browser.newContext).toHaveBeenCalledWith(
		expect.objectContaining({ serviceWorkers: 'allow' })
	);
	await recording.finish('unit-contract');
	expect(page.close).toHaveBeenCalledOnce();
	expect(context.close).not.toHaveBeenCalled();
});

it('seeds only fictional guest context and preserves it on later pages', async () => {
	const storage = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value)
	});
	const page = { addInitScript: vi.fn(), route: vi.fn() };
	const browser = {
		newContext: vi.fn(async () => ({ newPage: async () => page }))
	};
	try {
		await createRecording(
			browser as unknown as Browser,
			'http://localhost:4173',
			'he',
			'dark',
			[[], []],
			{
				degree: null,
				currentSemester: 1,
				wishlist: ['02340114']
			}
		);
		const [initialize, args] = page.addInitScript.mock.calls[0];
		initialize(args);
		expect(JSON.parse(storage.get('userData')!)).toEqual({
			currentSemester: 1,
			semesters: [[], []],
			exemptions: [],
			wishlist: ['02340114']
		});
		expect(storage.get('lang')).toBe('he');
		expect(storage.get('theme')).toBe('dark');
		storage.set('userData', '{"saved":"real UI change"}');
		initialize(args);
		expect(storage.get('userData')).toBe('{"saved":"real UI change"}');
		const [, route] = page.route.mock.calls[0];
		const local = {
			request: () => ({ url: () => 'http://localhost:4173/courseData.json' }),
			continue: vi.fn(),
			abort: vi.fn()
		};
		const external = {
			...local,
			request: () => ({ url: () => 'https://external.invalid/data' }),
			continue: vi.fn(),
			abort: vi.fn()
		};
		route(local);
		route(external);
		expect(local.continue).toHaveBeenCalledOnce();
		expect(external.abort).toHaveBeenCalledOnce();
	} finally {
		vi.unstubAllGlobals();
	}
});
