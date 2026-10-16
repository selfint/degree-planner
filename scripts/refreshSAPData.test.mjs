import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSAPData } from './refreshSAPData.mjs';
import { readCatalogBaseline } from './catalogBaseline.mjs';
import { assertNotEmptyReplacement } from './dataOutput.mjs';

const roots = [];
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'sap-refresh-'));
	roots.push(root);
	mkdirSync(join(root, 'static'));
	const coursesPath = join(root, 'static/courseData.json');
	const catalogsPath = join(root, 'catalogs.json');
	const courses = '{"old":{"name":"Previous course"}}\n';
	const catalogs = '[{"track":{"Otjid":"Old track"},"tree":{}}]\n';
	writeFileSync(coursesPath, courses);
	writeFileSync(catalogsPath, catalogs);
	return { root, coursesPath, catalogsPath, courses, catalogs };
}
afterEach(() => {
	roots
		.splice(0)
		.forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('SAP refresh failures and validation (offline)', () => {
	test.each(['courses', 'catalogs'])(
		'rejects when %s fetch fails instead of returning old data',
		async (failure) => {
			const old = fixture();
			const fetchCourses = vi.fn(async () => {
				if (failure === 'courses') throw new Error('SAP RFC_FAILURE');
				return { new: { name: 'New course' } };
			});
			const fetchCatalogs = vi.fn(async () => {
				throw new Error('Incomplete Hebrew faculty');
			});
			await expect(
				refreshSAPData({ root: old.root, fetchCourses, fetchCatalogs })
			).rejects.toThrow();
			if (failure === 'courses') expect(fetchCatalogs).not.toHaveBeenCalled();
		}
	);
	test('writes fresh data after successful validation', async () => {
		const old = fixture();
		const courses = { new: { name: 'New course' } };
		const catalogs = [{ track: { Otjid: 'New track' }, tree: {} }];
		await refreshSAPData({
			root: old.root,
			fetchCourses: async () => courses,
			fetchCatalogs: async () => catalogs
		});
		expect(JSON.parse(readFileSync(old.coursesPath, 'utf8'))).toEqual(courses);
		expect(JSON.parse(readFileSync(old.catalogsPath, 'utf8'))).toEqual(
			catalogs
		);
	});
	test('rejects an unexplained total wipe but allows normal removals', async () => {
		const old = fixture();
		await expect(
			refreshSAPData({
				root: old.root,
				fetchCourses: async () => ({}),
				fetchCatalogs: async () => []
			})
		).rejects.toThrow('verify the upstream removal');
		expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
		expect(() =>
			assertNotEmptyReplacement({ a: {}, b: {} }, { b: {} }, 'courses')
		).not.toThrow();
		expect(() =>
			assertNotEmptyReplacement([{}, {}], [{}], 'catalogs')
		).not.toThrow();
		expect(() => assertNotEmptyReplacement([], [], 'catalogs')).not.toThrow();
	});
	test('uses deployed catalog directories as baseline when raw catalogs are untracked', async () => {
		const old = fixture();
		rmSync(old.catalogsPath);
		mkdirSync(join(old.root, 'static/_catalogs/2024_200'), { recursive: true });
		await expect(
			refreshSAPData({
				root: old.root,
				fetchCourses: async () => ({ old: {} }),
				fetchCatalogs: async () => []
			})
		).rejects.toThrow('existing catalogs');
		expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
	});
});

test('rejects write failures without a staging or rollback transaction', async () => {
	const old = fixture();
	const courses = { new: {} };
	await expect(
		refreshSAPData({
			root: old.root,
			fetchCourses: async () => courses,
			fetchCatalogs: async () => {
				// Make the second output unwritable after its baseline was read.
				rmSync(old.catalogsPath);
				mkdirSync(old.catalogsPath);
				return [{ track: { Otjid: 'New track' }, tree: {} }];
			}
		})
	).rejects.toThrow();
	// The failed job is the publication gate; the first direct write need not roll back.
	expect(JSON.parse(readFileSync(old.coursesPath, 'utf8'))).toEqual(courses);
});

test('CLI reports a persistent SAP failure and exits with status 1', () => {
	const old = fixture();
	const preload = join(old.root, 'fail-sap.mjs');
	writeFileSync(
		preload,
		`import { multipart, sapError } from ${JSON.stringify(new URL('./fixtures/sap/responses.mjs', import.meta.url).href)};
globalThis.fetch = async () => multipart([sapError('RFC_FAILURE')]);`
	);
	const result = spawnSync(
		process.execPath,
		[
			'--import',
			preload,
			fileURLToPath(new URL('./refreshSAPData.mjs', import.meta.url))
		],
		{ cwd: old.root, encoding: 'utf8', timeout: 10000 }
	);
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(1);
	expect(result.stdout).toBe('');
	expect(result.stderr).toContain('SAP refresh stopped;');
	expect(result.stderr).toContain('RFC_FAILURE');
});

test('derives populated scopes from existing static catalogs without freezing membership/counts', () => {
	const old = fixture();
	rmSync(old.catalogsPath);
	mkdirSync(
		join(old.root, 'static/_catalogs/2024_200/00002120/SC00001314_CG001'),
		{ recursive: true }
	);
	mkdirSync(join(old.root, 'static/_catalogs/2025_200/00002120'), {
		recursive: true
	});
	const baseline = readCatalogBaseline(old.root);
	expect([...baseline.semesters]).toEqual(['2024/200']);
	expect([...baseline.faculties]).toEqual(['2024/200/00002120']);
	expect([...baseline.tracks]).toEqual(['2024/200/SC00001314']);
});

test('derives raw catalog scopes without treating already-empty roots as populated', () => {
	const old = fixture();
	writeFileSync(
		old.catalogsPath,
		JSON.stringify([
			{
				track: { Peryr: '2024', Perid: '200', OrgId: 'FAC', Otjid: 'SC1' },
				tree: { courses: ['SM1'] }
			},
			{
				track: { Peryr: '2024', Perid: '201', OrgId: 'FAC', Otjid: 'SC2' },
				tree: {}
			}
		])
	);
	const baseline = readCatalogBaseline(old.root);
	expect([...baseline.semesters]).toEqual(['2024/200', '2024/201']);
	expect([...baseline.faculties]).toEqual(['2024/200/FAC', '2024/201/FAC']);
	expect([...baseline.tracks]).toEqual(['2024/200/SC1']);
});
