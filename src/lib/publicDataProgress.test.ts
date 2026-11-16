import { describe, expect, it } from 'vitest';
import {
	readJsonWithProgress,
	type PublicDataReadProgress
} from './publicDataProgress';

function streamed(headers: HeadersInit = {}) {
	const source = new TextEncoder().encode(
		JSON.stringify({ name: 'קורס', value: 42 })
	);
	let finish!: () => void;
	const response = new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				// Deliberately split a UTF-8 character across chunks.
				controller.enqueue(source.slice(0, 11));
				finish = () => {
					controller.enqueue(source.slice(11));
					controller.close();
				};
			}
		}),
		{ headers }
	);
	return { source, response, finish: () => finish() };
}

describe('decoded public-data byte progress', () => {
	it.each<HeadersInit>([
		{},
		{ 'content-length': '35' },
		{ 'content-encoding': 'gzip', 'content-length': '10' }
	])(
		'reports real streamed bytes without trusting a length/encoding header: %j',
		async (headers) => {
			const stream = streamed(headers);
			const progress: PublicDataReadProgress[] = [];
			const reading = readJsonWithProgress(stream.response, (p) =>
				progress.push(p)
			);
			await Promise.resolve();
			expect(progress.at(-1)).toEqual({ activity: 'reading', bytesRead: 11 });
			stream.finish();
			expect(await reading).toEqual({ name: 'קורס', value: 42 });
			expect(progress.at(-1)).toEqual({
				activity: 'processing',
				bytesRead: stream.source.length
			});
			expect(progress.every((p) => !('totalBytes' in p))).toBe(true);
			expect(stream.response.body!.locked).toBe(false);
		}
	);
	it('retains JSON errors and releases the reader', async () => {
		const response = new Response('invalid');
		await expect(readJsonWithProgress(response, () => {})).rejects.toThrow();
		expect(response.body!.locked).toBe(false);
	});
	it('does not turn stream failures into a completed download', async () => {
		const response = new Response(
			new ReadableStream({
				start(controller) {
					controller.error(new Error('disconnected'));
				}
			})
		);
		const progress: PublicDataReadProgress[] = [];
		await expect(
			readJsonWithProgress(response, (p) => progress.push(p))
		).rejects.toThrow('disconnected');
		expect(progress).toEqual([{ activity: 'reading', bytesRead: 0 }]);
		expect(response.body!.locked).toBe(false);
	});
});
