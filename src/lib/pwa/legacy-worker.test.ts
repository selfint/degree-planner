import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = readFileSync('static/legacy-service-worker.js', 'utf8');
function dispatch(path: string, mode = 'navigate', method = 'GET') {
	let listener: (event: unknown) => void = () => {};
	let response: Promise<Response> | undefined;
	runInNewContext(source, {
		URL,
		Response,
		self: {
			location: { origin: 'https://example.test' },
			addEventListener: (_: string, callback: typeof listener) => {
				listener = callback;
			}
		}
	});
	listener({
		request: { url: new URL(path, 'https://example.test').href, mode, method },
		respondWith: (value: Promise<Response>) => {
			response = value;
		}
	});
	return response;
}
describe('legacy installed launch bridge', () => {
	it('redirects an old launch to the console without network or cache access', async () => {
		const response = await dispatch('/plan?source=installed');
		expect(response?.status).toBe(302);
		expect(response?.headers.get('location')).toBe(
			'https://example.test/app/plan?source=installed'
		);
	});
	it('does not intercept landing, current console, auth, data or other origins', () => {
		for (const path of [
			'/',
			'/en',
			'/app/plan',
			'/__auth/handler',
			'/courseData.json',
			'https://other.test/plan',
			'/planet'
		])
			expect(dispatch(path)).toBeUndefined();
		expect(dispatch('/plan', 'cors')).toBeUndefined();
		expect(dispatch('/plan', 'navigate', 'POST')).toBeUndefined();
	});
	it('does not force existing windows to reload or take over', () => {
		expect(source).not.toContain('skipWaiting(');
		expect(source).not.toContain('clients.claim(');
		expect(source).not.toContain('caches.');
	});
});
