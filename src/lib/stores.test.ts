import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deployment = vi.hoisted(() => ({ PUBLIC_DEPLOYMENT_ENV: 'production' }));
vi.mock('$env/static/public', () => deployment);

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
	deployment.PUBLIC_DEPLOYMENT_ENV = 'production';
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

describe('legacy three-year CS plans', () => {
	const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
	const affected: UserData = {
		...plan,
		exemptions: ['01040031'],
		semesters: [['02340124', '02340124'], [], ['02340141']],
		currentSemester: 2,
		degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
		path: 'CG00006246'
	};

	it.each([0, 1])(
		'migrates original v%s three-year input to the actual CS degree',
		async (version) => {
			const legacy = {
				semesters: affected.semesters,
				currentSemester: affected.currentSemester,
				wishlist: affected.wishlist,
				degree: ['2023_2024', 'computer_science', '3_year'],
				username: 'Guest'
			};
			values.set('version', String(version));
			if (version === 0) {
				values.delete('userData');
				for (const [key, value] of Object.entries(legacy)) {
					values.set(
						key,
						typeof value === 'string' ? value : JSON.stringify(value)
					);
				}
			} else values.set('userData', JSON.stringify(legacy));
			const { user } = await import('./stores.svelte');
			expect(user.d).toEqual({ ...affected, exemptions: [], degree });
			expect(JSON.parse(values.get('userData')!)).toEqual({
				...affected,
				exemptions: [],
				degree
			});
		}
	);

	it.each([0, 1, 2, 3])(
		'keeps v%s storage untouched when migrating offline',
		async (version) => {
			network.onLine = false;
			values.set('version', String(version));
			if (version < 2) {
				const legacy = {
					...affected,
					degree: ['2023_2024', 'computer_science', '3_year'],
					username: 'Guest'
				};
				values.set('userData', JSON.stringify(legacy));
				if (version === 0) {
					for (const [key, value] of Object.entries(legacy)) {
						values.set(
							key,
							typeof value === 'string' ? value : JSON.stringify(value)
						);
					}
				}
			} else values.set('userData', JSON.stringify(affected));
			const before = new Map(values);
			const { user } = await import('./stores.svelte');
			expect(user.d).toEqual({
				...affected,
				exemptions: version === 0 ? [] : affected.exemptions,
				degree
			});
			expect(values).toEqual(before);
			expect(storage.setItem).not.toHaveBeenCalled();
			expect(storage.removeItem).not.toHaveBeenCalled();
		}
	);

	it.each([2, 3])(
		'repairs an affected v%s plan while retaining its contents on normal migration',
		async (version) => {
			values.set('version', String(version));
			values.set('userData', JSON.stringify(affected));
			const { user } = await import('./stores.svelte');
			expect(user.d).toEqual({ ...affected, degree });
			expect(JSON.parse(values.get('userData')!)).toEqual({
				...affected,
				degree
			});
			expect(values.get('version')).toBe('4');
		}
	);

	it.each([true, false])(
		'repairs v4 in memory without rewriting storage (online=%s)',
		async (online) => {
			values.set('userData', JSON.stringify(affected));
			network.onLine = online;
			const before = new Map(values);
			const { user, readStorage } = await import('./stores.svelte');
			expect(user.d).toEqual({ ...affected, degree });
			await expect(readStorage()).resolves.toEqual({ ...affected, degree });
			expect(values).toEqual(before);
			expect(storage.setItem).not.toHaveBeenCalled();
			expect(storage.removeItem).not.toHaveBeenCalled();
		}
	);

	it('repairs account reads and snapshots without writing to either account or guest storage', async () => {
		const { setStorage, readStorage, setUser, user, writeStorage } =
			await import('./stores.svelte');
		const account = structuredClone(affected);
		const before = new Map(values);
		const adapter = {
			read: vi.fn().mockResolvedValue(account),
			write: vi.fn(async (data) => data)
		};
		setStorage(adapter);
		const result = await readStorage();
		expect(result).toEqual({ ...affected, degree });
		setUser(account);
		expect(user.d).toEqual(result);
		expect(account).toEqual(affected);
		expect(adapter.write).not.toHaveBeenCalled();
		expect(values).toEqual(before);
		expect(storage.setItem).not.toHaveBeenCalled();
		await writeStorage(result);
		expect(adapter.write).toHaveBeenCalledWith(result);
		expect(values).toEqual(before);
	});
});

describe('future-version read compatibility', () => {
	it.each([true, false])(
		'normalizes the initial read without downgrading or writing (online=%s)',
		async (online) => {
			network.onLine = online;
			const future = {
				...plan,
				degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
				path: 'CG00006246',
				futureField: { retain: true }
			};
			values.set('version', '5');
			values.set('userData', JSON.stringify(future));
			const before = new Map(values);
			const { user, readStorage } = await import('./stores.svelte');
			const expected = {
				...future,
				degree: ['2024_200', '00002120', 'SC00001314_CG00006245']
			};
			expect(user.d).toEqual(expected);
			await expect(readStorage()).resolves.toEqual(expected);
			expect(values).toEqual(before);
			expect(storage.setItem).not.toHaveBeenCalled();
			expect(storage.removeItem).not.toHaveBeenCalled();
		}
	);
});

it('staging does not read, migrate or overwrite production guest plans', async () => {
	deployment.PUBLIC_DEPLOYMENT_ENV = 'staging';
	values.set('username', 'production legacy guest');
	const production = new Map(values);
	const { user, writeLocalStorage } = await import('./stores.svelte');
	expect(user.d.wishlist).toEqual([]);
	await writeLocalStorage(plan);
	for (const [key, value] of production) expect(values.get(key)).toBe(value);
	expect(values.get('planit.staging.userData')).toBe(JSON.stringify(plan));
	expect(values.get('planit.staging.version')).toBe('4');
	vi.resetModules();
	const reloaded = await import('./stores.svelte');
	expect(reloaded.user.d).toEqual(plan);
});
