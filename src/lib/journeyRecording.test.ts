import { expect, it, vi } from 'vitest';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { JourneyRecording } from '../../tests/helpers/journey-recording';
const info = {
	project: { use: { colorScheme: 'light' } },
	status: 'passed'
} as unknown as TestInfo;
it('leaves normal functional tests completely untouched', async () => {
	const context = { addInitScript: vi.fn() };
	const recording = new JourneyRecording(info, false);
	await recording.install(context as unknown as BrowserContext);
	await recording.finish();
	expect(context.addInitScript).not.toHaveBeenCalled();
	expect(recording.theme).toBe('dark');
});
it('installs capture hooks on the context so reloads, popups and new pages inherit them', async () => {
	const context = { addInitScript: vi.fn() };
	const recording = new JourneyRecording(info, true);
	await recording.install(context as unknown as BrowserContext);
	expect(context.addInitScript).toHaveBeenCalledWith(expect.any(Function), {
		theme: 'light'
	});
	expect(context.addInitScript.mock.calls[0][0].toString()).toContain(
		'DOMContentLoaded'
	);
});
it('fails closed when a passing test has no captured page', async () => {
	await expect(new JourneyRecording(info, true).finish()).rejects.toThrow(
		'Incomplete journey'
	);
});
it('never publishes metadata after a failed assertion', async () => {
	await expect(
		new JourneyRecording(
			{ ...info, status: 'failed' } as TestInfo,
			true
		).finish()
	).resolves.toBeUndefined();
});

it('adds readable holds only at capture-mode checkpoints', async () => {
	const page = { waitForTimeout: vi.fn() };
	await new JourneyRecording(info, false).checkpoint(page as unknown as Page);
	expect(page.waitForTimeout).not.toHaveBeenCalled();
	await new JourneyRecording(info, true).checkpoint(page as unknown as Page);
	expect(page.waitForTimeout).toHaveBeenCalledExactlyOnceWith(2400);
});
