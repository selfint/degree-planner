import * as fs from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSAPData } from './refreshSAPData.mjs';
import { readCatalogBaseline } from './catalogBaseline.mjs';
import {
	generateCatalogData,
	readCatalogData
} from './generateCatalogData.mjs';
import {
	assertNotEmptyReplacement,
	exchangeDirectories,
	replaceDirectory
} from './dataOutput.mjs';

const rawFixture = JSON.parse(
	readFileSync(new URL('./fixtures/catalogs.raw.json', import.meta.url), 'utf8')
);
const roots = [];
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'sap-refresh-'));
	roots.push(root);
	mkdirSync(join(root, 'static'));
	const coursesPath = join(root, 'static/courseData.json');
	const catalogsPath = join(root, 'scripts/.cache/catalogs.raw.json');
	mkdirSync(join(root, 'scripts/.cache'), { recursive: true });
	const courses = '{"old":{"name":"Previous course"}}\n';
	const catalogs = JSON.stringify(rawFixture);
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
			expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
			expect(readFileSync(old.catalogsPath, 'utf8')).toBe(old.catalogs);
		}
	);
	test('writes fresh data after successful validation', async () => {
		const old = fixture();
		const courses = { new: { name: 'New course' } };
		const catalogs = structuredClone(rawFixture.slice(0, 1));
		await refreshSAPData({
			root: old.root,
			fetchCourses: async () => courses,
			fetchCatalogs: async () => catalogs
		});
		expect(JSON.parse(readFileSync(old.coursesPath, 'utf8'))).toEqual(courses);
		expect(readFileSync(old.catalogsPath, 'utf8')).toBe(old.catalogs);
		expect(
			readCatalogData(join(old.root, 'static')).requirements.size
		).toBeGreaterThan(0);
	});
	test('publishes official cohort options omitted by SAP, without inheriting old courses', async () => {
		const { root } = fixture();
		const staticDir = join(root, 'static');
		const labels = { en: 'Synthetic group', he: 'קבוצה' };
		const track = (
			year,
			term,
			faculty,
			degree,
			program,
			parent,
			group,
			courses
		) => ({
			track: {
				Otjid: degree,
				OrgId: faculty,
				OrgText: labels,
				ZzQualifications: labels,
				Peryr: year,
				Perid: term
			},
			tree: {
				children: [
					{
						Otjid: program,
						children: [
							{
								Otjid: parent,
								Name: labels,
								children: [
									{
										Otjid: group,
										Name: labels,
										courses: courses.map((code) => 'SM' + code)
									}
								]
							}
						]
					}
				]
			}
		});
		const ee = (
			year,
			term,
			courses,
			program = 'CG00010465',
			parent = 'CG00006318'
		) =>
			track(
				year,
				term,
				'00002050',
				'SC00001397',
				program,
				parent,
				'CG00003701',
				courses
			);
		const bme = (term, courses) =>
			track(
				'2025',
				term,
				'00002330',
				'SC00001356',
				'CG00010646',
				'CG00007948',
				'CG00007949',
				courses
			);
		const springBme = bme('201', ['03360504', '03360545']);
		const catalogs = [
			ee('2022', '200', ['01140252'], 'CG00003697', 'CG00003699'),
			ee('2022', '201', ['01140252'], 'CG00003697', 'CG00003699'),
			ee('2023', '200', ['01140252'], 'CG00006316'),
			ee('2023', '201', ['01140252'], 'CG00006316'),
			ee('2024', '200', ['01140252'], 'CG00006316'),
			ee('2024', '201', ['01140252'], 'CG00006316'),
			ee('2025', '200', ['01140252']),
			ee('2025', '201', ['01140252']),
			ee('2026', '200', ['01140252']),
			springBme,
			bme('200', ['03360504', '03360545'])
		];
		const unchangedInput = structuredClone(catalogs);
		const generated = () => {
			const { requirements } = readCatalogData(staticDir);
			return [...requirements].map(([key, value]) => [
				key,
				value.nested[0].nested[0].courses
			]);
		};
		const refresh = () =>
			refreshSAPData({
				root,
				fetchCourses: async () => ({ fresh: {} }),
				fetchCatalogs: async () => catalogs
			});
		await refresh();
		const springBmeExpected = [
			'2025_201/00002330/SC00001356_CG00010646',
			['03360504', '03360533', '03360545', '03360546']
		];
		const expected = [
			['2022_200/00002050/SC00001397_CG00003697', ['01140252']],
			['2022_201/00002050/SC00001397_CG00003697', ['01140250', '01140252']],
			['2023_200/00002050/SC00001397_CG00006316', ['01140250', '01140252']],
			['2023_201/00002050/SC00001397_CG00006316', ['01140250', '01140252']],
			['2024_200/00002050/SC00001397_CG00006316', ['01140250', '01140252']],
			['2024_201/00002050/SC00001397_CG00006316', ['01140250', '01140252']],
			['2025_200/00002050/SC00001397_CG00010465', ['01140250', '01140252']],
			[
				'2025_200/00002330/SC00001356_CG00010646',
				['03360504', '03360533', '03360545', '03360546']
			],
			['2025_201/00002050/SC00001397_CG00010465', ['01140250', '01140252']],
			springBmeExpected,
			['2026_200/00002050/SC00001397_CG00010465', ['01140252']]
		];
		expect(generated()).toEqual(expected);
		expect(catalogs).toEqual(unchangedInput);

		// A later valid source change still publishes, and reappearing options
		// do not duplicate the entries already certified by the catalog.
		springBme.tree.children[0].children[0].children[0].courses = [
			'SM03360533',
			'SM03360545'
		];
		await refresh();
		springBmeExpected[1] = ['03360533', '03360545', '03360546'];
		expect(generated()).toEqual(expected);
	});

	test('publishes the missing joint Biomedical course only in the verified terms and groups', async () => {
		const { root } = fixture();
		const staticDir = join(root, 'static');
		const labels = { en: 'Synthetic group', he: 'קבוצה' };
		const physics = ['00002330', 'SC00001355', 'CG00010998', ['CG00007979']];
		const medicine = [
			'00002270',
			'SC00001366',
			'CG00010430',
			['CG00006846', 'CG00006847']
		];
		const scopes = [
			['2025', '200', physics, true],
			['2025', '201', physics, true],
			['2025', '200', medicine, true],
			['2025', '201', medicine, true],
			['2024', '201', physics, false],
			['2024', '201', medicine, false]
		];
		const buildTree = ([Otjid, ...children]) => ({
			Otjid,
			Name: labels,
			...(children.length
				? { children: [buildTree(children)] }
				: { courses: ['SM03360504'] })
		});
		const catalogs = scopes.map(
			([Peryr, Perid, [OrgId, Otjid, program, path]]) => {
				return {
					track: {
						Peryr,
						Perid,
						OrgId,
						Otjid,
						OrgText: labels,
						ZzQualifications: labels
					},
					tree: {
						children: [
							{
								Otjid: program,
								children: [
									buildTree(path),
									{ Otjid: 'CG00000002', Name: labels, courses: ['SM03360533'] }
								]
							}
						]
					}
				};
			}
		);
		await refreshSAPData({
			root,
			fetchCourses: async () => ({ fresh: {} }),
			fetchCatalogs: async () => catalogs
		});
		const { requirements } = readCatalogData(staticDir);
		for (const [
			year,
			term,
			[faculty, degree, program, path],
			applies
		] of scopes) {
			const key = `${year}_${term}/${faculty}/${degree}_${program}`;
			const requirement = requirements.get(key);
			const group = path.reduce(
				(node, name) => node.nested.find((child) => child.name === name),
				requirement
			);
			expect(group.courses, key).toEqual(
				applies ? ['03360504', '03360546'] : ['03360504']
			);
			expect(
				requirement.nested.find((child) => child.name === 'CG00000002').courses
			).toEqual(['03360533']);
		}
	});

	test.each([
		['without a prior catalog', false, ['03360205']],
		['with a prior parent entry', true, ['03360205']],
		['with no fresh parent course list', true, undefined],
		[
			'when SAP returns the course at both levels',
			true,
			['03360205', '03360546']
		]
	])(
		'publishes current winter Biomedical ML only as Core %s',
		async (_, seeded, parentCourses) => {
			const { root } = fixture();
			const staticDir = join(root, 'static');
			const labels = { en: 'Synthetic group', he: 'קבוצה' };
			const node = (Otjid, courses, children = []) => ({
				Otjid,
				Name: labels,
				children,
				...(courses === undefined
					? {}
					: { courses: courses.map((code) => 'SM' + code) })
			});
			const wrap = (faculty, degree, program, groups) => ({
				track: {
					OrgId: faculty,
					Otjid: degree,
					Peryr: '2026',
					Perid: '200',
					OrgText: labels,
					ZzQualifications: labels
				},
				tree: { children: [{ Otjid: program, children: groups }] }
			});
			const key = '2026_200/00002330/SC00001356_CG00011002';
			const standalone = (
				courses,
				coreCourses = ['03360023', '03360502', '03360522']
			) =>
				wrap('00002330', 'SC00001356', 'CG00011002', [
					node('CG00007948', undefined, [
						node('CG00007949', courses, [node('CG00007950', coreCourses)])
					])
				]);
			const physics = wrap('00002330', 'SC00001355', 'CG00011001', [
				node(
					'CG00007979',
					['03360205'],
					[node('CG00007980', ['03360023', '03360546'])]
				)
			]);
			const medicine = wrap('00002270', 'SC00001366', 'CG00011055', [
				node('CG00006846', undefined, [
					node(
						'CG00006847',
						['03360205'],
						[node('CG00006848', ['03360023', '03360546'])]
					)
				])
			]);

			if (seeded) {
				generateCatalogData([standalone(['03360540'])], staticDir);
				const output = join(
					staticDir,
					'_catalogs',
					key,
					'requirementsData.json'
				);
				const legacy = JSON.parse(readFileSync(output, 'utf8'));
				const group = legacy.nested[0].nested[0];
				group.courses = ['03360540', '03360546'];
				group.nested[0].courses = ['03360023', '03360502', '03360522'];
				writeFileSync(output, JSON.stringify(legacy));
			}
			await refreshSAPData({
				root,
				fetchCourses: async () => ({ fresh: {} }),
				fetchCatalogs: async () => [
					standalone(
						parentCourses,
						parentCourses?.includes('03360546')
							? ['03360023', '03360502', '03360522', '03360546']
							: undefined
					),
					physics,
					medicine
				]
			});
			const { requirements } = readCatalogData(staticDir);
			const group = requirements.get(key).nested[0].nested[0];
			expect(group.name).toBe('CG00007949');
			expect(group.courses).toEqual(
				parentCourses ? ['03360205'] : ['03360540']
			);
			expect(group.nested[0].name).toBe('CG00007950');
			expect(group.nested[0].courses).toEqual([
				'03360023',
				'03360502',
				'03360522',
				'03360546'
			]);

			const physicsGroup = requirements.get(
				'2026_200/00002330/SC00001355_CG00011001'
			).nested[0];
			const medicineGroup = requirements.get(
				'2026_200/00002270/SC00001366_CG00011055'
			).nested[0].nested[0];
			for (const [joint, child] of [
				[physicsGroup, 'CG00007980'],
				[medicineGroup, 'CG00006848']
			]) {
				expect(joint.courses).toEqual(['03360205']);
				expect(joint.nested[0].name).toBe(child);
				expect(joint.nested[0].courses).toEqual(['03360023', '03360546']);
			}
		}
	);

	const medicineImaging = [
		'00002270',
		'SC00001366',
		['CG00006846', 'CG00006847'],
		'CG00006848',
		'03360546'
	];
	const physicsImaging = [
		'00002330',
		'SC00001355',
		['CG00007979'],
		'CG00007980',
		'03360546'
	];
	test.each([
		[
			'2022_201',
			'CG00001115',
			'core',
			[
				'00002270',
				'SC00001366',
				['CG00001121', 'CG00001138'],
				'CG00001142',
				'03360533'
			]
		],
		['2023_200', 'CG00006842', 'parent', medicineImaging],
		['2024_200', 'CG00006842', 'parent', medicineImaging],
		['2024_200', 'CG00007976', 'parent', physicsImaging],
		['2024_201', 'CG00006842', 'absent', medicineImaging],
		['2024_201', 'CG00007976', 'absent', physicsImaging],
		['2025_202', 'CG00010430', 'absent', medicineImaging],
		['2025_202', 'CG00010998', 'absent', physicsImaging],
		[
			'2025_202',
			'CG00010646',
			'absent',
			[
				'00002330',
				'SC00001356',
				['CG00007948', 'CG00007949'],
				'CG00007950',
				'03360546'
			]
		]
	])(
		'publishes the historical imaging placement for %s %s as %s',
		async (term, program, placement, [OrgId, Otjid, path, core, course]) => {
			const [Peryr, Perid] = term.split('_');
			const { root } = fixture();
			const staticDir = join(root, 'static');
			const key = `${Peryr}_${Perid}/${OrgId}/${Otjid}_${program}`;
			const labels = { en: 'Synthetic group', he: 'קבוצה' };
			const parentCourse = '03360540';
			const coreCourse = '03360502';
			const treeFor = (parentCourses) => {
				const branch = ([name, ...rest]) => ({
					Otjid: name,
					Name: labels,
					...(!rest.length && parentCourses
						? { courses: parentCourses.map((code) => 'SM' + code) }
						: {}),
					children: rest.length
						? [branch(rest)]
						: [{ Otjid: core, Name: labels, courses: ['SM' + coreCourse] }]
				});
				return {
					track: {
						OrgId,
						Otjid,
						Peryr,
						Perid,
						OrgText: labels,
						ZzQualifications: labels
					},
					tree: { children: [{ Otjid: program, children: [branch(path)] }] }
				};
			};
			const findGroup = (requirement) =>
				path.reduce(
					(node, name) => node.nested.find((child) => child.name === name),
					requirement
				);

			if (placement === 'core') {
				// Production had the course in the parent, not the nested Core list.
				generateCatalogData([treeFor([parentCourse])], staticDir);
				const output = join(
					staticDir,
					'_catalogs',
					key,
					'requirementsData.json'
				);
				const legacy = JSON.parse(readFileSync(output, 'utf8'));
				const group = findGroup(legacy);
				group.courses = [course, parentCourse];
				group.nested[0].courses = [coreCourse];
				writeFileSync(output, JSON.stringify(legacy));
			}
			await refreshSAPData({
				root,
				fetchCourses: async () => ({ fresh: {} }),
				fetchCatalogs: async () => [
					treeFor(placement === 'core' ? undefined : [parentCourse])
				]
			});
			const { requirements } = readCatalogData(staticDir);
			const group = findGroup(requirements.get(key));
			expect(group.courses).toEqual(
				placement === 'parent' ? [parentCourse, course] : [parentCourse]
			);
			expect(group.nested[0].name).toBe(core);
			expect(group.nested[0].courses).toEqual(
				placement === 'core' ? [coreCourse, course] : [coreCourse]
			);
		}
	);

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

test.each(['generation', 'copy', 'write', 'promotion', 'syscall'])(
	'leaves every live output unchanged on %s failure',
	async (failure) => {
		const old = fixture();
		const staticDir = join(old.root, 'static');
		generateCatalogData(rawFixture, staticDir);
		const previous = readCatalogData(staticDir);
		const fail = () => {
			throw new Error('Injected file failure');
		};
		await expect(
			refreshSAPData({
				root: old.root,
				fetchCourses: async () => ({ fresh: {} }),
				fetchCatalogs: async () => structuredClone(rawFixture),
				...(failure === 'generation'
					? {
							generate(raw, stage) {
								writeFileSync(join(stage, 'catalogs.json'), '{}');
								fail();
							}
						}
					: {}),
				...(failure === 'write'
					? {
							generate(raw, stage) {
								generateCatalogData(raw, stage);
								rmSync(join(stage, 'courseData.json'));
								mkdirSync(join(stage, 'courseData.json'));
							}
						}
					: {}),
				publication:
					failure === 'copy'
						? { operations: { ...fs, cpSync: fail } }
						: failure === 'promotion'
							? { promote: fail }
							: failure === 'syscall'
								? {
										promote: (stage, target) =>
											exchangeDirectories(join(stage, 'missing'), target)
									}
								: {}
			})
		).rejects.toThrow();
		expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
		expect(readFileSync(old.catalogsPath, 'utf8')).toBe(old.catalogs);
		expect(readCatalogData(staticDir)).toEqual(previous);
		expect(
			readdirSync(old.root).filter((name) => name.startsWith('.static-refresh'))
		).toEqual([]);
	}
);

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

test('fetches once and publishes public JSON without a separate raw-cache write', async () => {
	const old = fixture();
	const staticDir = join(old.root, 'static');
	generateCatalogData(rawFixture, staticDir);
	const previous = readCatalogData(staticDir);
	const key = [...previous.requirements.keys()][0];
	const path = join(staticDir, '_catalogs', key, 'requirementsData.json');
	writeFileSync(
		path,
		JSON.stringify({ ...previous.requirements.get(key), points: 120 })
	);
	// A clean checkout has committed public JSON, but no local SAP response cache.
	rmSync(join(old.root, 'scripts/.cache'), { recursive: true });
	const catalogs = structuredClone(rawFixture.slice(0, 1));
	catalogs[0].track.ZzQualifications.en = 'Updated program';
	const fetchCourses = vi.fn(async () => ({ fresh: { name: 'Fresh course' } }));
	const fetchCatalogs = vi.fn(async () => catalogs);
	await refreshSAPData({ root: old.root, fetchCourses, fetchCatalogs });
	expect(existsSync(old.catalogsPath)).toBe(false);
	const updated = readCatalogData(staticDir);
	expect(fetchCourses).toHaveBeenCalledTimes(1);
	expect(fetchCatalogs).toHaveBeenCalledExactlyOnceWith({ root: old.root });
	expect(existsSync(join(old.root, 'catalogs.json'))).toBe(false);
	expect(updated.requirements.size).toBe(previous.requirements.size);
	expect(updated.requirements.get(key)).toMatchObject({
		en: 'Updated program',
		points: 120
	});
	expect(readdirSync(join(staticDir, '_catalogs', key))).toEqual([
		'requirementsData.json'
	]);
});

test.each(['unusable tree', 'malformed bilingual label'])(
	'rejects %s before replacing any raw or public output',
	async (kind) => {
		const old = fixture();
		const staticDir = join(old.root, 'static');
		generateCatalogData(rawFixture, staticDir);
		const previous = readCatalogData(staticDir);
		const catalogs = structuredClone(rawFixture);
		if (kind === 'unusable tree')
			catalogs.forEach((catalog) => {
				catalog.tree = {};
			});
		else delete catalogs.at(-1).track.OrgText.he;
		await expect(
			refreshSAPData({
				root: old.root,
				fetchCourses: async () => ({ fresh: {} }),
				fetchCatalogs: async () => catalogs
			})
		).rejects.toThrow();
		expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
		expect(readFileSync(old.catalogsPath, 'utf8')).toBe(old.catalogs);
		expect(readCatalogData(staticDir)).toEqual(previous);
	}
);

test('combines committed JSON scopes with cached raw scopes without requiring text-file scaffolding', () => {
	const old = fixture();
	generateCatalogData(rawFixture, join(old.root, 'static'));
	// No directory scan is necessary when the canonical manifest exists.
	rmSync(join(old.root, 'static/_catalogs'), { recursive: true });
	writeFileSync(
		old.catalogsPath,
		JSON.stringify([
			{
				track: { Peryr: '2025', Perid: '201', OrgId: 'FAC', Otjid: 'SC123' },
				tree: {}
			}
		])
	);
	const baseline = readCatalogBaseline(old.root);
	expect(baseline.semesters).toEqual(new Set(['2025/201', '2024/200']));
	expect(baseline.faculties).toEqual(
		new Set(['2025/201/FAC', '2024/200/00002120'])
	);
	expect(baseline.tracks).toEqual(
		new Set(['2024/200/SC00001314', '2024/200/SC00001320'])
	);
});

test('keeps the legacy raw response as a validation baseline without writing to it', async () => {
	const old = fixture();
	const legacyPath = join(old.root, 'catalogs.json');
	writeFileSync(legacyPath, old.catalogs);
	rmSync(old.catalogsPath);
	expect(readCatalogBaseline(old.root).tracks).toEqual(
		new Set(['2024/200/SC00001314', '2024/200/SC00001320'])
	);
	await refreshSAPData({
		root: old.root,
		fetchCourses: async () => ({ fresh: {} }),
		fetchCatalogs: async () => structuredClone(rawFixture.slice(0, 1))
	});
	expect(readFileSync(legacyPath, 'utf8')).toBe(old.catalogs);
	expect(existsSync(old.catalogsPath)).toBe(false);
});

test('fails closed on an existing publication lock without deleting another writer lock', () => {
	const old = fixture();
	const lock = join(old.root, '.static-refresh-lock');
	mkdirSync(lock);
	expect(() => replaceDirectory(join(old.root, 'static'), () => {})).toThrow();
	expect(existsSync(lock)).toBe(true);
	expect(readFileSync(old.coursesPath, 'utf8')).toBe(old.courses);
});

test('cleanup failure after atomic promotion leaves the complete new snapshot', async () => {
	const old = fixture();
	const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await refreshSAPData({
			root: old.root,
			fetchCourses: async () => ({ fresh: {} }),
			fetchCatalogs: async () => structuredClone(rawFixture),
			publication: {
				operations: {
					...fs,
					rmSync() {
						throw new Error('cleanup failure');
					}
				}
			}
		});
		expect(JSON.parse(readFileSync(old.coursesPath, 'utf8'))).toEqual({
			fresh: {}
		});
		expect(
			readCatalogData(join(old.root, 'static')).requirements.size
		).toBeGreaterThan(0);
		expect(warning).toHaveBeenCalled();
	} finally {
		warning.mockRestore();
	}
});
