import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	app: {},
	auth: { setPersistence: vi.fn() },
	firestore: {},
	analytics: {},
	isSupported: vi.fn(),
	getAnalytics: vi.fn()
}));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('firebase/app', () => ({ initializeApp: () => mocks.app }));
vi.mock('firebase/auth', () => ({
	getAuth: () => mocks.auth,
	connectAuthEmulator: vi.fn(),
	browserLocalPersistence: {},
	signInWithPopup: vi.fn(),
	GoogleAuthProvider: vi.fn()
}));
vi.mock('firebase/firestore', () => ({
	getFirestore: () => mocks.firestore,
	connectFirestoreEmulator: vi.fn(),
	collection: vi.fn(),
	getDoc: vi.fn(),
	doc: vi.fn(),
	setDoc: vi.fn(),
	onSnapshot: vi.fn()
}));
vi.mock('firebase/analytics', () => ({
	isSupported: mocks.isSupported,
	getAnalytics: mocks.getAnalytics
}));

import { initFirebase, startOptionalAnalytics } from './firebase.svelte';

beforeEach(() => {
	vi.resetAllMocks();
	mocks.auth.setPersistence.mockResolvedValue(undefined);
	mocks.isSupported.mockResolvedValue(false);
	mocks.getAnalytics.mockReturnValue(mocks.analytics);
});

describe('Firebase startup', () => {
	it('does not wait for an analytics support probe that never settles', async () => {
		mocks.isSupported.mockReturnValue(new Promise(() => {}));
		const services = await initFirebase();
		expect(services.auth).toBe(mocks.auth);
		expect(services.firestore).toBe(mocks.firestore);
		expect(mocks.isSupported).not.toHaveBeenCalled();
	}, 250);

	it('does not fail startup when the analytics probe rejects', async () => {
		mocks.isSupported.mockRejectedValue(new Error('IndexedDB unavailable'));
		const services = await initFirebase();
		await expect(startOptionalAnalytics(services)).resolves.toBeUndefined();
		expect(mocks.getAnalytics).not.toHaveBeenCalled();
	});

	it('contains analytics initialization errors', async () => {
		mocks.isSupported.mockResolvedValue(true);
		mocks.getAnalytics.mockImplementation(() => {
			throw new Error('Analytics blocked');
		});
		const services = await initFirebase();
		await expect(startOptionalAnalytics(services)).resolves.toBeUndefined();
	});

	it('still waits for auth persistence instead of assuming a guest session', async () => {
		let resolvePersistence!: () => void;
		mocks.auth.setPersistence.mockReturnValue(
			new Promise<void>((resolve) => {
				resolvePersistence = resolve;
			})
		);
		let ready = false;
		const startup = initFirebase().then((services) => {
			ready = true;
			return services;
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(ready).toBe(false);
		resolvePersistence();
		await startup;
		expect(ready).toBe(true);
	});

	it('does not swallow auth failures or switch storage to a guest account', async () => {
		mocks.auth.setPersistence.mockRejectedValue(new Error('Auth unavailable'));
		await expect(initFirebase()).rejects.toThrow('Auth unavailable');
	});
});
