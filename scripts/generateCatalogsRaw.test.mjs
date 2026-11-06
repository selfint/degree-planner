import { afterEach, expect, test, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sap from './SAPClient.mjs';
import { generateCatalogs } from './generateCatalogsRaw.mjs';
import {
	generateCatalogData,
	readCatalogData
} from './generateCatalogData.mjs';

const roots = [];
afterEach(() => {
	vi.restoreAllMocks();
	roots
		.splice(0)
		.forEach((root) => rmSync(root, { recursive: true, force: true }));
});

test('passes the committed direct-JSON baseline through every SAP query level', async () => {
	const root = mkdtempSync(join(tmpdir(), 'catalog-fetch-'));
	roots.push(root);
	const raw = JSON.parse(
		readFileSync(
			new URL('./fixtures/catalogs.raw.json', import.meta.url),
			'utf8'
		)
	);
	generateCatalogData(raw, join(root, 'static'));
	const previous = readCatalogData(join(root, 'static'));
	const semesters = [{ PiqYear: '2024', PiqSession: '200' }];
	const faculties = [{ PiqYear: '2024', PiqSession: '200', OrgId: '00002120' }];
	// An individually removed track remains allowed; only still-requested scopes
	// are held for review if their previously populated response disappears.
	const tracks = [raw[0].track];
	const trees = [raw[0].tree];
	vi.spyOn(sap, 'getSemesterYears').mockResolvedValue(semesters);
	const getFaculties = vi
		.spyOn(sap, 'getFaculties')
		.mockResolvedValue(faculties);
	const getDegrees = vi.spyOn(sap, 'getDegrees').mockResolvedValue([tracks]);
	const getTrackTrees = vi.spyOn(sap, 'getTrackTrees').mockResolvedValue(trees);
	const actual = await generateCatalogs({ root });
	expect(actual).toEqual(raw.slice(0, 1));
	expect(getFaculties).toHaveBeenCalledExactlyOnceWith(
		semesters,
		new Set(['2024/200'])
	);
	expect(getDegrees).toHaveBeenCalledExactlyOnceWith(
		faculties,
		new Set(['2024/200/00002120'])
	);
	expect(getTrackTrees).toHaveBeenCalledExactlyOnceWith(
		tracks,
		new Set(['2024/200/SC00001314', '2024/200/SC00001320'])
	);
	expect(readCatalogData(join(root, 'static'))).toEqual(previous);
	getTrackTrees.mockRejectedValueOnce(
		new Error('Previously populated scope returned no rows')
	);
	await expect(generateCatalogs({ root })).rejects.toThrow(
		'Previously populated scope'
	);
	expect(readCatalogData(join(root, 'static'))).toEqual(previous);
});
