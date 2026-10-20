import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('./requirements', () => ({
	loadDegreeName: vi.fn(),
	loadRequirement: vi.fn()
}));

const plan = {
	exemptions: [],
	semesters: [['02340124'], []],
	currentSemester: 0,
	wishlist: ['02340141']
} as UserData;
let values: Map<string, string>;
let storage: {
	getItem: ReturnType<typeof vi.fn>;
	setItem: ReturnType<typeof vi.fn>;
	removeItem: ReturnType<typeof vi.fn>;
};
let network: { onLine: boolean };
beforeEach(() => {
	vi.resetModules();
	network = { onLine: true };
	values = new Map([
		['lang', 'en'],
		['version', '4'],
		['userData', JSON.stringify(plan)]
	]);
	storage = {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		removeItem: vi.fn((key: string) => values.delete(key))
	};
	vi.stubGlobal('navigator', network);
	vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('offline plan storage', () => {
	it('reads cached guest plans without writing while offline', async () => {
		network.onLine = false;
		const { user, readStorage } = await import('./stores.svelte');
		expect(user.d).toEqual(plan);
		await expect(readStorage()).resolves.toEqual(plan);
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	it('rejects both write entrypoints and leaves the saved guest plan unchanged', async () => {
		const { writeStorage, writeLocalStorage, user } =
			await import('./stores.svelte');
		const before = new Map(values);
		network.onLine = false;
		for (const write of [writeStorage, writeLocalStorage]) {
			await expect(write({ ...plan, wishlist: [] })).rejects.toMatchObject({
				name: 'OfflinePlanWriteError'
			});
		}
		expect(values).toEqual(before);
		expect(user.d).toEqual(plan);
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	it('rejects a custom account adapter before invoking its write, while allowing reads', async () => {
		const { setStorage, writeStorage, readStorage } =
			await import('./stores.svelte');
		const adapter = {
			read: vi.fn().mockResolvedValue(plan),
			write: vi.fn().mockResolvedValue(plan)
		};
		setStorage(adapter);
		network.onLine = false;
		await expect(writeStorage(plan)).rejects.toMatchObject({
			name: 'OfflinePlanWriteError'
		});
		expect(adapter.write).not.toHaveBeenCalled();
		await expect(readStorage()).resolves.toEqual(plan);
		network.onLine = true;
		await expect(writeStorage(plan)).resolves.toEqual(plan);
		expect(adapter.write).toHaveBeenCalledTimes(1);
	});

	it('preserves the guest version4 format when online', async () => {
		const { writeLocalStorage } = await import('./stores.svelte');
		const next = { ...plan, wishlist: [] };
		await expect(writeLocalStorage(next)).resolves.toBe(next);
		expect(values.get('version')).toBe('4');
		expect(values.get('userData')).toBe(JSON.stringify(next));
	});

	it('migrates legacy guest data only in memory offline, then persists normally online', async () => {
		values.delete('version');
		values.delete('userData');
		values.set('username', 'Guest');
		values.set('semesters', JSON.stringify(plan.semesters));
		values.set('currentSemester', '0');
		values.set('wishlist', JSON.stringify(plan.wishlist));
		const before = new Map(values);
		network.onLine = false;
		const { user, readStorage } = await import('./stores.svelte');
		expect(user.d).toMatchObject(plan);
		expect(values).toEqual(before);
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(storage.removeItem).not.toHaveBeenCalled();
		network.onLine = true;
		await readStorage();
		expect(values.get('version')).toBe('4');
		expect(JSON.parse(values.get('userData')!)).toEqual(plan);
		expect(values.has('username')).toBe(false);
		expect(values.has('semesters')).toBe(false);
	});
});

describe('degree requirement selection', () => {
	it.each([undefined, 'CG00006253'])(
		'decodes the selected path %s before loading requirements',
		async (path) => {
			const degree: Degree = [
				'2024_200',
				'00002120',
				path === undefined ? 'SC00001320_CG00006382' : 'SC00001314_CG00006245'
			];
			values.set('userData', JSON.stringify({ ...plan, degree, path }));
			const { loadRequirement } = await import('./requirements');
			vi.mocked(loadRequirement).mockClear();
			const { requirement } = await import('./stores.svelte');
			requirement();
			expect(loadRequirement).toHaveBeenCalledWith(degree, path);
		}
	);
});
