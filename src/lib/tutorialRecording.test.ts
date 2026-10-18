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
