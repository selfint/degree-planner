import { isDegreeSelection } from '../src/lib/catalogSelection.ts';
import { afterEach, describe, expect, it } from 'vitest';
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	readdirSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCatalogData, mergeRequirement } from './catalogData.mjs';
import {
	generateCatalogData,
	readCatalogData
} from './generateCatalogData.mjs';
import { legacyCatalogData } from './fixtures/legacyCatalogPipeline.mjs';

const fixture = JSON.parse(
	readFileSync(new URL('./fixtures/catalogs.raw.json', import.meta.url), 'utf8')
);
const directories = [];
function temporaryDirectory() {
	const directory = mkdtempSync(join(tmpdir(), 'catalog-data-'));
	directories.push(directory);
	return directory;
}
afterEach(() =>
	directories
		.splice(0)
		.forEach((directory) => rmSync(directory, { recursive: true, force: true }))
);

describe('direct JSON catalog generation', () => {
	it('matches the former filesystem pipeline for the same bilingual SAP input', () => {
		const original = structuredClone(fixture);
		const expected = legacyCatalogData(fixture, temporaryDirectory());
		const actual = buildCatalogData(fixture);
		expect(actual.catalogs).toEqual(expected.catalogs);
		expect(actual.requirements).toEqual(expected.requirements);
		expect(fixture).toEqual(original);
	});

	it('matches flattened structure wrappers, duplicate groups and empty tracks', () => {
		const raw = structuredClone(fixture.slice(0, 1));
		const root = raw[0].tree.children[0];
		const child = root.children[0];
		root.children = [
			{
				Otjid: 'CG_WRAPPER',
				Name: { en: 'Structure Element 1', he: 'מבנה' },
				children: [child]
			},
			{
				Otjid: child.Otjid,
				Name: { en: 'Updated label', he: 'שם מעודכן' },
				children: [
					{
						Otjid: 'CG_NEW',
						Name: { en: 'New', he: 'חדש' },
						courses: ['SM00104031']
					}
				]
			}
		];
		raw.push({ track: { ...raw[0].track, Otjid: 'SC_UNUSED' }, tree: {} });
		const expected = legacyCatalogData(raw, temporaryDirectory());
		expect(buildCatalogData(raw)).toEqual(expected);
	});

	it('keeps all requirement metadata when refreshing a matching node', () => {
		const previous = {
			name: 'CG_1',
			en: 'Old',
			he: 'ישן',
			points: 12.5,
			count: 3,
			amount: 2,
			overflow: 'CG_2',
			hook: '(semesters, progress) => progress',
			custom: { retained: true },
			courses: ['00104031'],
			nested: []
		};
		const incoming = {
			name: 'CG_1',
			en: 'New',
			he: 'חדש',
			courses: ['00234114'],
			nested: []
		};
		expect(mergeRequirement(previous, incoming)).toEqual({
			...previous,
			...incoming
		});
	});

	it('writes only canonical JSON, preserves historical programs, and is repeatable', () => {
		const directory = temporaryDirectory();
		generateCatalogData(fixture, directory);
		const original = readCatalogData(directory);
		const firstKey = [...original.requirements.keys()][0];
		const file = join(
			directory,
			'_catalogs',
			firstKey,
			'requirementsData.json'
		);
		const requirement = original.requirements.get(firstKey);
		requirement.points = 120;
		requirement.nested[0].count = 2;
		writeFileSync(file, JSON.stringify(requirement));
		generateCatalogData(fixture.slice(0, 1), directory);
		const updated = readCatalogData(directory);
		expect(updated.requirements.size).toBe(original.requirements.size);
		expect(updated.catalogs).toEqual(original.catalogs);
		expect(updated.requirements.get(firstKey).points).toBe(120);
		expect(updated.requirements.get(firstKey).nested[0].count).toBe(2);
		expect(readdirSync(join(directory, '_catalogs', firstKey))).toEqual([
			'requirementsData.json'
		]);
		generateCatalogData(fixture.slice(0, 1), directory);
		expect(readCatalogData(directory)).toEqual(updated);
	});

	it('rejects partial malformed input before changing the previous snapshot', () => {
		const directory = temporaryDirectory();
		generateCatalogData(fixture, directory);
		const previous = readCatalogData(directory);
		const invalid = structuredClone(fixture);
		delete invalid.at(-1).track.OrgText.he;
		expect(() => generateCatalogData(invalid, directory)).toThrow(
			'Missing bilingual labels'
		);
		expect(readCatalogData(directory)).toEqual(previous);
		expect(() => generateCatalogData([], directory)).toThrow('non-empty');
		expect(readCatalogData(directory)).toEqual(previous);
	});

	it('rejects path traversal and malformed course IDs without changing their leading zeroes', () => {
		const invalid = structuredClone(fixture);
		invalid[0].track.OrgId = '../outside';
		expect(() => buildCatalogData(invalid)).toThrow('Invalid faculty ID');
		invalid[0].track.OrgId = '00002120';
		invalid[0].tree.children[0].children[0].courses = ['104031'];
		expect(() => buildCatalogData(invalid)).toThrow('Invalid SAP course codes');
	});

	it('validates every checked-in program and both manifest languages without network access', () => {
		expect(
			readCatalogData(resolve('static')).requirements.size
		).toBeGreaterThan(0);
	});
});

it('prunes only confirmed unavailable semesters and preserves historical scopes and metadata', () => {
	const directory = temporaryDirectory();
	const raw = structuredClone(fixture.slice(0, 1));
	const otherSemester = structuredClone(raw[0]);
	otherSemester.track.Perid = '201';
	const another = structuredClone(raw[0]);
	another.track.Otjid = 'SC99999999';
	const peers = Array.from({ length: 19 }, (_, index) => {
		const peer = structuredClone(another);
		peer.track.Otjid = `SC${String(90000000 + index)}`;
		return peer;
	});
	generateCatalogData([...raw, otherSemester, ...peers], directory);
	const before = readCatalogData(directory);
	const retained = [...before.requirements.keys()].find((key) =>
		key.startsWith('2024_201/')
	);
	const removed = [...before.requirements.keys()].find(
		(key) => key.includes(raw[0].track.Otjid) && key.startsWith('2024_200/')
	);
	writeFileSync(
		join(directory, '_catalogs', retained, 'requirementsData.json'),
		JSON.stringify({ ...before.requirements.get(retained), points: 123 })
	);
	raw[0].tree = {};
	generateCatalogData([...raw, ...peers], directory);
	const after = readCatalogData(directory);
	expect(after.requirements.has(removed)).toBe(false);
	expect(isDegreeSelection(after.catalogs, removed.split('/'))).toBe(false);
	expect(isDegreeSelection(after.catalogs, retained.split('/'))).toBe(true);
	expect(after.requirements.get(retained).points).toBe(123);
	expect(after.requirements.size).toBe(before.requirements.size - 1);
	expect(() =>
		readFileSync(join(directory, '_catalogs', removed, 'requirementsData.json'))
	).toThrow();
	generateCatalogData([...raw, ...peers], directory);
	expect(readCatalogData(directory)).toEqual(after);
});

it.each([
	undefined,
	null,
	{ children: 'invalid' },
	{ courses: ['SM00123456'] }
])('rejects malformed root %j instead of pruning', (tree) => {
	const raw = structuredClone(fixture);
	raw[0].tree = tree;
	expect(() => buildCatalogData(raw)).toThrow();
});

it('standalone catalog generation also rejects broad root disappearance', () => {
	const directory = temporaryDirectory();
	generateCatalogData(fixture, directory);
	const before = readCatalogData(directory);
	const raw = structuredClone(fixture);
	raw[0].tree = {};
	expect(() => generateCatalogData(raw, directory)).toThrow(
		'Broad SAP root disappearance'
	);
	expect(readCatalogData(directory)).toEqual(before);
});
