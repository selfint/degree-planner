// SAP is the default source, but a populated SAP group can omit options that
// the official undergraduate catalog explicitly lists for the same cohort.
const catalog2025 =
	'https://ugportal.technion.ac.il/wp-content/uploads/2025/11/catalog2025-26.pdf';

const eePhysicsOptions = {
	path: ['CG00006318', 'CG00003701'],
	courses: ['01140250', '01140252'],
	source: `${catalog2025}#page=185`
};

const bmeImagingOptions = {
	path: ['CG00007948', 'CG00007949'],
	courses: ['03360533', '03360546'],
	source: `${catalog2025}#page=307`
};

const bmeChapter2025 =
	'https://ugportal.technion.ac.il/wp-content/uploads/2025/09/33-%D7%94%D7%A0%D7%93%D7%A1%D7%94-%D7%91%D7%99%D7%95-%D7%A8%D7%A4%D7%95%D7%90%D7%99%D7%AA-%D7%AA%D7%A9%D7%A4%D7%95.pdf';

// Both joint programs use the shared Biomedical imaging electives (chapter p. 6).
// Only 03360546 was verified as missing program-wide in these exact SAP scopes.
const bmeMedicineImaging = {
	path: ['CG00006846', 'CG00006847'],
	courses: ['03360546'],
	source: `${bmeChapter2025}#page=6`
};

const bmePhysicsImaging = {
	path: ['CG00007979'],
	courses: ['03360546'],
	source: `${bmeChapter2025}#page=4`
};

const catalogCourses = new Map([
	[
		'2024_201/00002050/SC00001397_CG00006316',
		{
			...eePhysicsOptions,
			source:
				'https://ugportal.technion.ac.il/wp-content/uploads/2024/12/%D7%A7%D7%98%D7%9C%D7%95%D7%92-%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%D7%9D-%D7%AA%D7%A9%D7%A4%D7%94-2024.2025.pdf#page=177'
		}
	],
	['2025_200/00002050/SC00001397_CG00010465', eePhysicsOptions],
	['2025_201/00002050/SC00001397_CG00010465', eePhysicsOptions],
	['2025_200/00002330/SC00001356_CG00010646', bmeImagingOptions],
	['2025_201/00002330/SC00001356_CG00010646', bmeImagingOptions],
	['2025_200/00002270/SC00001366_CG00010430', bmeMedicineImaging],
	['2025_201/00002270/SC00001366_CG00010430', bmeMedicineImaging],
	['2025_200/00002330/SC00001355_CG00010998', bmePhysicsImaging],
	['2025_201/00002330/SC00001355_CG00010998', bmePhysicsImaging]
]);

/** Materialize published options on the freshly fetched snapshot, even without a baseline. */
export function reconcileCatalogCourses(key, requirement) {
	const evidence = catalogCourses.get(key);
	if (!evidence) return;
	let group = requirement;
	for (const name of evidence.path) {
		group = group.nested?.find((child) => child.name === name);
		if (!group) {
			throw new Error(
				`Cannot apply catalog courses to ${key}/${evidence.path.join('/')}: missing ${name}. See ${evidence.source}`
			);
		}
	}
	const supplied = group.courses ?? [];
	if (evidence.courses.every((code) => supplied.includes(code))) return;
	group.courses = [...new Set([...supplied, ...evidence.courses])].sort();
}
