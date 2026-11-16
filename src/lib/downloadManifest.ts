import { withBase } from './deploymentPaths';
const lengths = new WeakMap<Response, number>();
export const decodedResponseLength = (response: Response) =>
	lengths.get(response);
type Manifest = Record<string, { url: string; bytes: number }>;

/** Optional latest snapshot metadata. Failure always keeps canonical data available. */
export async function progressFetcher(
	fetcher: typeof fetch
): Promise<typeof fetch> {
	let manifest: Manifest;
	try {
		const response = await fetcher(withBase('/_data/manifest.json'), {
			credentials: 'omit',
			redirect: 'error',
			cache: 'no-cache',
			signal: AbortSignal.timeout(2000)
		});
		if (!response.ok) return fetcher;
		manifest = await response.json();
		for (const key of ['/courseData.json', '/catalogs.json']) {
			const item = manifest[key];
			if (
				!item ||
				!/^\/_data\/[a-f0-9]{64}\.json$/.test(item.url) ||
				!Number.isSafeInteger(item.bytes) ||
				item.bytes <= 0
			)
				return fetcher;
		}
	} catch {
		return fetcher;
	}
	return async (input, init) => {
		const path = typeof input === 'string' ? input.split('?')[0] : '';
		const key = ['/courseData.json', '/catalogs.json'].find(
			(key) => withBase(key) === path
		);
		if (!key) return fetcher(input, init);
		const item = manifest[key];
		try {
			const response = await fetcher(withBase(item.url), init);
			if (response.ok || response.status === 304) {
				lengths.set(response, item.bytes);
				return response;
			}
		} catch (error) {
			if (init?.signal?.aborted) throw error;
		}
		// A stale manifest can refer to an asset removed by the next deployment.
		return fetcher(input, init);
	};
}
