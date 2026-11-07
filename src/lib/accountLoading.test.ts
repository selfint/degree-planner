import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the layout's actual lifecycle with controlled storage/auth boundaries.
// Browser coverage separately checks the rendered privacy gate and footer.
const source = readFileSync('src/routes/app/+layout.svelte', 'utf8');
const start = source.indexOf('$effect(() => {\n\t\tauthReady = false;');
const end = source.indexOf('\n\t});', start);
if (start < 0 || end < 0) throw new Error('Missing account lifecycle');
const make = new Function(
	'firebase',
	'buildFirebaseStorage',
	'subscribeFirebase',
	'localStorageMethod',
	'setStorage',
	'setUser',
	'window',
	'navigator',
	transpileModule(
		`
 let authReady = false, signedIn = false, offline = false;
 let accountState = 'loading', retryAccount;
 const cleanup = (() => {${source.slice(start + '$effect(() => {'.length, end)}})();
 return {cleanup, retry: () => retryAccount(), state: () => ({authReady,signedIn,offline,accountState})};
 `,
		{ compilerOptions: { target: ScriptTarget.ES2022 } }
	).outputText
);
function deferred() {
	let resolve!: (value: unknown) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
function setup() {
	let callback: (user: object | null) => Promise<void>;
	const auth = {
		currentUser: null as object | null,
		onAuthStateChanged: vi.fn((fn) => {
			callback = fn;
			return vi.fn();
		})
	};
	const reads: ReturnType<typeof deferred>[] = [];
	const setUser = vi.fn();
	const window = new EventTarget();
	const navigator = { onLine: true };
	const unsub = vi.fn();
	const subscribe = vi.fn(() => unsub);
	const app = make(
		{ auth },
		() => ({
			read: () => {
				const read = deferred();
				reads.push(read);
				return read.promise;
			}
		}),
		subscribe,
		{ read: async () => ({ guest: true }) },
		vi.fn(),
		setUser,
		window,
		navigator
	);
	return {
		app,
		reads,
		setUser,
		subscribe,
		unsub,
		window,
		navigator,
		auth: (user: object | null) => {
			auth.currentUser = user;
			return callback(user);
		}
	};
}
describe('account loading lifecycle', () => {
	it('distinguishes pending, failed, retry and ready without applying guest data', async () => {
		const h = setup();
		const loading = h.auth({ uid: 'one' });
		expect(h.app.state()).toMatchObject({
			authReady: true,
			signedIn: true,
			accountState: 'loading'
		});
		expect(h.setUser).not.toHaveBeenCalled();
		h.reads[0].reject(new Error('offline'));
		await loading;
		expect(h.app.state().accountState).toBe('failed');
		h.app.retry();
		expect(h.app.state().accountState).toBe('loading');
		h.reads[1].resolve({ account: true });
		await Promise.resolve();
		expect(h.app.state().accountState).toBe('ready');
		expect(h.setUser).toHaveBeenCalledExactlyOnceWith({ account: true });
		h.app.cleanup();
		expect(h.unsub).toHaveBeenCalledOnce();
	});
	it.each([false, true])(
		'ignores stale completion (failure=%s) after switching or signing out',
		async (fail) => {
			const h = setup();
			const first = h.auth({ uid: 'one' });
			const second = h.auth({ uid: 'two' });
			if (fail) h.reads[0].reject(new Error('stale'));
			else h.reads[0].resolve({ old: true });
			await first;
			expect(h.app.state().accountState).toBe('loading');
			expect(h.setUser).not.toHaveBeenCalled();
			await h.auth(null);
			expect(h.setUser).toHaveBeenCalledExactlyOnceWith({ guest: true });
			h.reads[1].reject(new Error('after signout'));
			await second;
			expect(h.app.state()).toMatchObject({
				authReady: true,
				signedIn: false,
				accountState: 'ready'
			});
			h.app.cleanup();
		}
	);
	it('retries on reconnect and ignores late results after teardown', async () => {
		const h = setup();
		const first = h.auth({ uid: 'one' });
		h.navigator.onLine = false;
		h.window.dispatchEvent(new Event('offline'));
		h.navigator.onLine = true;
		h.window.dispatchEvent(new Event('online'));
		expect(h.reads).toHaveLength(2);
		h.reads[0].resolve({ stale: true });
		await first;
		expect(h.setUser).not.toHaveBeenCalled();
		h.app.cleanup();
		h.reads[1].resolve({ late: true });
		await Promise.resolve();
		expect(h.setUser).not.toHaveBeenCalled();
		expect(h.subscribe).not.toHaveBeenCalled();
	});
});
