import { expect, it } from 'vitest';
import { handle } from './hooks.server';

it('preserves public-cache metadata through hydration without serializing auth headers', async () => {
	const event = {} as Parameters<typeof handle>[0]['event'];
	await handle({
		event,
		resolve: async (_, options) => {
			const include = options!.filterSerializedResponseHeaders!;
			for (const header of [
				'Cache-Control',
				'content-type',
				'ETag',
				'last-modified'
			]) {
				expect(include(header, 'value')).toBe(true);
			}
			for (const header of [
				'set-cookie',
				'authorization',
				'www-authenticate',
				'x-user-id'
			]) {
				expect(include(header, 'value')).toBe(false);
			}
			return new Response('ok');
		}
	});
});
