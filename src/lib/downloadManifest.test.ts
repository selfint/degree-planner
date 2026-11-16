import { expect, it, vi } from 'vitest';
import { progressFetcher, decodedResponseLength } from './downloadManifest';
import { readJsonWithProgress } from './publicDataProgress';
const url = `/_data/${'a'.repeat(64)}.json`;
const manifest = {
	'/courseData.json': { url, bytes: 7 },
	'/catalogs.json': { url, bytes: 7 }
};
it('uses exact snapshot bytes even with compressed Content-Length', async () => {
	const response = new Response('{"a":1}', {
		headers: { 'content-encoding': 'gzip', 'content-length': '2' }
	});
	const fetcher = vi
		.fn<typeof fetch>()
		.mockResolvedValueOnce(Response.json(manifest))
		.mockResolvedValueOnce(response);
	const fetchProgress = await progressFetcher(fetcher);
	const result = await fetchProgress('/courseData.json');
	expect(fetcher.mock.calls[1][0]).toBe(url);
	expect(decodedResponseLength(result)).toBe(7);
	const progress = vi.fn();
	expect(await readJsonWithProgress(result, progress)).toEqual({ a: 1 });
	expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({
		bytesRead: 7,
		totalBytes: 7
	});
});
it('falls back when a snapshot disappeared after deployment', async () => {
	const canonical = Response.json({ a: 1 });
	const fetcher = vi
		.fn<typeof fetch>()
		.mockResolvedValueOnce(Response.json(manifest))
		.mockResolvedValueOnce(new Response(null, { status: 404 }))
		.mockResolvedValueOnce(canonical);
	const fetchProgress = await progressFetcher(fetcher);
	expect(await fetchProgress('/courseData.json')).toBe(canonical);
	expect(decodedResponseLength(canonical)).toBeUndefined();
	expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/courseData.json');
});
it.each([
	{},
	{ '/courseData.json': { url: 'https://invalid.example/test', bytes: 7 } },
	null
])('ignores malformed metadata %j', async (value) => {
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
	expect(await progressFetcher(fetcher)).toBe(fetcher);
});
it('keeps canonical data available when metadata is offline', async () => {
	const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
	expect(await progressFetcher(fetcher)).toBe(fetcher);
});
it('rejects mismatched snapshot lengths rather than reporting completed data', async () => {
	const fetcher = vi
		.fn<typeof fetch>()
		.mockResolvedValueOnce(Response.json(manifest))
		.mockResolvedValueOnce(Response.json({ longer: 123 }));
	const fetchProgress = await progressFetcher(fetcher);
	await expect(
		readJsonWithProgress(await fetchProgress('/courseData.json'), () => {})
	).rejects.toThrow('length mismatch');
});
