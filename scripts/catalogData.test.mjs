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
		raw.push({ track: raw[0].track, tree: {} });
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
