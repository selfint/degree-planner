type FacultyCatalog = I18N & {
	[program: string]: I18N | string | undefined;
};
type YearCatalog = I18N & {
	[faculty: string]: FacultyCatalog | string | undefined;
};

/** A selector can contain incomplete or stale strings, unlike a saved Degree. */
export function getCatalogFaculty(
	catalogs: Catalogs,
	year?: string,
	faculty?: string
): FacultyCatalog | undefined {
	if (year === undefined || faculty === undefined) return undefined;
	const manifest: Record<string, YearCatalog | undefined> = catalogs;
	if (!Object.hasOwn(manifest, year)) return undefined;
	const yearCatalog = manifest[year];
	if (yearCatalog === undefined || !Object.hasOwn(yearCatalog, faculty))
		return undefined;
	const result = yearCatalog[faculty];
	return typeof result === 'object' && result !== null ? result : undefined;
}

/** Validate the entire tuple together so program/faculty/year stay correlated. */
export function isDegreeSelection(
	catalogs: Catalogs,
	selection: readonly (string | undefined)[]
): selection is Degree {
	if (selection.length !== 3) return false;
	const [year, faculty, program] = selection;
	if (program === undefined) return false;
	const facultyCatalog = getCatalogFaculty(catalogs, year, faculty);
	if (facultyCatalog === undefined || !Object.hasOwn(facultyCatalog, program))
		return false;
	const result = facultyCatalog[program];
	return typeof result === 'object' && result !== null;
}
