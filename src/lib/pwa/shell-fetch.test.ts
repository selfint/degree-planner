import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellPreparationError } from './shell-failure';
import { withShellFetchDeadline } from './shell-fetch';

describe('offline shell download deadline', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('returns the completed operation and clears its deadline', async () => {
		let signal: AbortSignal | undefined;
		expect(
			await withShellFetchDeadline(async (current) => {
				signal = current;
				return 'verified body';
			})
		).toBe('verified body');
		expect(signal?.aborted).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['async', 'sync'])(
		'maps a %s native failure to download',
		async (kind) => {
			const result = withShellFetchDeadline(() => {
				const error = new TypeError('Native failure containing a private URL');
				if (kind === 'sync') throw error;
				return Promise.reject(error);
			});
			await expect(result).rejects.toMatchObject({ reason: 'download' });
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it('preserves a validated, stable policy failure', async () => {
		const error = new ShellPreparationError('build-changed');
		await expect(
			withShellFetchDeadline(async () => {
				throw error;
			})
		).rejects.toBe(error);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('bounds a hung operation even when it ignores abort', async () => {
		let signal: AbortSignal | undefined;
		const result = withShellFetchDeadline((current) => {
			signal = current;
			return new Promise<never>(() => {});
		});
		const rejected = expect(result).rejects.toMatchObject({
			reason: 'timeout'
		});
		await vi.advanceTimersByTimeAsync(19_999);
		expect(signal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps a timeout reason when abort synchronously rejects the download', async () => {
		const result = withShellFetchDeadline(
			(signal) =>
				new Promise<never>((_resolve, reject) => {
					signal.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError'))
					);
				}),
			50
		);
		const rejected = expect(result).rejects.toMatchObject({
			reason: 'timeout'
		});
		await vi.advanceTimersByTimeAsync(50);
		await rejected;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps the deadline active while the callback consumes the response body', async () => {
		const response = {
			text: () => new Promise<string>(() => {})
		};
		const result = withShellFetchDeadline(async () => {
			const headersReceived = await Promise.resolve(response);
			return await headersReceived.text();
		}, 50);
		const rejected = expect(result).rejects.toMatchObject({
			reason: 'timeout'
		});
		await vi.advanceTimersByTimeAsync(50);
		await rejected;
	});

	it('observes a late rejection after the timeout has settled', async () => {
		let rejectLate!: (error: Error) => void;
		const result = withShellFetchDeadline(
			() =>
				new Promise<never>((_resolve, reject) => {
					rejectLate = reject;
				}),
			50
		);
		const rejected = expect(result).rejects.toMatchObject({
			reason: 'timeout'
		});
		await vi.advanceTimersByTimeAsync(50);
		await rejected;
		rejectLate(new Error('Download failed after timeout'));
		await vi.runAllTimersAsync();
		expect(vi.getTimerCount()).toBe(0);
	});
});
