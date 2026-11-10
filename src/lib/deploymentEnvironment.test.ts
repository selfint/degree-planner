import { afterEach, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ PUBLIC_DEPLOYMENT_ENV: 'production' }));
vi.mock('$env/static/public', () => env);

afterEach(() => {
	vi.resetModules();
	env.PUBLIC_DEPLOYMENT_ENV = 'production';
});

it('preserves all production keys and analytics behavior by default', async () => {
	const policy = await import('./deploymentEnvironment');
	expect(policy.analyticsEnabled).toBe(true);
	expect(policy.isStaging).toBe(false);
	for (const key of [
		'userData',
		'version',
		'lang',
		'theme',
		'degree-planner-courses'
	])
		expect(policy.storageKey(key)).toBe(key);
});

it('isolates staging app storage and disables analytics', async () => {
	env.PUBLIC_DEPLOYMENT_ENV = 'staging';
	const policy = await import('./deploymentEnvironment');
	expect(policy.analyticsEnabled).toBe(false);
	expect(policy.isStaging).toBe(true);
	for (const key of [
		'userData',
		'version',
		'lang',
		'theme',
		'degree-planner-courses'
	])
		expect(policy.storageKey(key)).toBe(`planit.staging.${key}`);
});

it('opens separate staging IndexedDB databases without changing production stores', async () => {
	env.PUBLIC_DEPLOYMENT_ENV = 'staging';
	const { IDBFactory } = await import('fake-indexeddb');
	const factory = new IDBFactory();
	const open = vi.spyOn(factory, 'open');
	const { createCourseDataStore } = await import('./courseDataStore');
	const { createIndexedDbStore } = await import('./publicDataStore');
	const courses = createCourseDataStore({ factory });
	const resources = createIndexedDbStore({ factory });
	try {
		await Promise.all([courses.getMetadata(), resources.get('a')]);
		expect(open.mock.calls).toEqual([
			['planit.staging.degree-planner-courses', 1],
			['planit.staging.degree-planner-public-data', 1]
		]);
	} finally {
		courses.close();
		resources.close();
	}
});
