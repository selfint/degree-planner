import { describe, expect, it } from 'vitest';
import catalogs from '../../static/catalogs.json';
import { getCatalogFaculty, isDegreeSelection } from './catalogSelection';

describe('catalog selection validation', () => {
	it('narrows a complete selection without changing its identifiers', () => {
		const selection: (string | undefined)[] = [
			'2024_200',
			'00002120',
			'SC00001314_CG00006245'
		];
		if (!isDegreeSelection(catalogs, selection))
			throw new Error('Expected the catalog selection to be valid');
		const degree: Degree = selection;
		expect(degree).toEqual(['2024_200', '00002120', 'SC00001314_CG00006245']);
	});

	it.each([
		[],
		['2024_200'],
		['2024_200', '00002120', undefined],
		['missing', '00002120', 'SC00001314_CG00006245'],
		['2024_200', 'missing', 'SC00001314_CG00006245'],
		['2024_200', '00002080', 'SC00001314_CG00006245'],
		['2021_200', '00002120', 'SC00001314_CG00006245'],
		['2024_200', '00002120', 'en'],
		['2024_200', 'en', 'SC00001314_CG00006245'],
		['__proto__', '00002120', 'SC00001314_CG00006245'],
		['2024_200', '__proto__', 'SC00001314_CG00006245'],
		['2024_200', '00002120', '__proto__']
	])(
		'rejects incomplete, stale, or non-program selection %j',
		(...selection) => {
			expect(isDegreeSelection(catalogs, selection)).toBe(false);
		}
	);

	it('lists the selected faculty and keeps metadata separate from programs', () => {
		const faculty = getCatalogFaculty(catalogs, '2024_200', '00002120');
		expect(faculty?.en).toBe(catalogs['2024_200']['00002120'].en);
		expect(faculty?.SC00001314_CG00006245).toEqual(
			catalogs['2024_200']['00002120']['SC00001314_CG00006245']
		);
		expect(getCatalogFaculty(catalogs, undefined, '00002120')).toBeUndefined();
		expect(getCatalogFaculty(catalogs, '2024_200', 'he')).toBeUndefined();
	});
});
