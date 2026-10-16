/// <reference path="./types.d.ts"/>
import { requestBatch, validateCollection } from './SAPTransport.mjs';
export { getUsage, formatBytes } from './SAPTransport.mjs';

function requireStrings(row, fields) {
	for (const field of fields) {
		if (typeof row?.[field] !== 'string')
			throw new Error(`Missing string field ${field}`);
	}
}

function requireIdentity(row, expected) {
	for (const [field, value] of Object.entries(expected)) {
		if (!value || row?.[field] !== value)
			throw new Error(`Expected ${field}=${value}, received ${row?.[field]}`);
	}
}

function validateRows(rows, fields, expected) {
	const ids = new Set();
	for (const row of rows) {
		requireStrings(row, fields);
		requireIdentity(row, expected);
		const id = row.Otjid ?? row.ZzOrgId ?? `${row.PiqYear}/${row.PiqSession}`;
		if (!id || ids.has(id))
			throw new Error(`Missing or duplicate identity ${id}`);
		ids.add(id);
	}
}

function requirePreviouslyPopulated(rows, key, previouslyPopulated) {
	if (rows.length === 0 && previouslyPopulated.has(key)) {
		throw new Error(
			`Previously populated scope ${key} is empty; verify upstream removal before refreshing`
		);
	}
}

function requireOne(rows) {
	if (rows.length !== 1)
		throw new Error(
			`Expected exactly one matching record, received ${rows.length}`
		);
}

/**
 *
 * @param {{Otjid: string, Peryr: string, Perid: string}[]} batch
 * @returns {Promise<TreeHead[]>}
 */
async function loadChildren(
	batch,
	ancestors = batch.map(() => new Set()),
	previouslyPopulated = new Set()
) {
	if (batch.length === 0) return [];
	const queries = batch.map(({ Otjid, Peryr, Perid }) => ({
		'sap-client': '700',
		$filter: `ParentOtjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
		$orderby: 'Otjid asc',
		$select: 'Stext,Otjid,Peryr,Perid,ParentOtjid'
	}));
	const validate = (rows, index) => {
		const { Otjid, Peryr, Perid } = batch[index];
		requirePreviouslyPopulated(
			rows,
			`${Peryr}/${Perid}/${Otjid}`,
			previouslyPopulated
		);
		validateRows(rows, ['Stext', 'Otjid', 'Peryr', 'Perid', 'ParentOtjid'], {
			ParentOtjid: Otjid,
			Peryr,
			Perid
		});
	};
	const english = await requestBatch('TreeOnDemandSet', queries, 'en', {
		validate
	});
	const contradictedEnglish = new Set();
	const hebrew = await requestBatch('TreeOnDemandSet', queries, 'he', {
		validate(rows, index) {
			validate(rows, index);
			const ids = new Set(rows.map((row) => row.Otjid));
			const englishIds = new Set(english[index].map((row) => row.Otjid));
			if (rows.some((row) => !englishIds.has(row.Otjid)))
				contradictedEnglish.add(index);
			if (contradictedEnglish.has(index))
				throw new Error(
					'Incomplete English tree collection: Hebrew returned additional IDs; retry the whole refresh'
				);

			if (
				rows.length !== english[index].length ||
				english[index].some((row) => !ids.has(row.Otjid))
			) {
				throw new Error(
					'Incomplete bilingual tree: English and Hebrew child identities differ'
				);
			}
		}
	});
	const groups = english.map((rows) =>
		rows.filter((row) => !row.Otjid.startsWith('SM'))
	);
	const nextAncestors = groups.flatMap((rows, index) =>
		rows.map((row) => {
			const parent = batch[index];
			const key = `${parent.Peryr}/${parent.Perid}/${parent.Otjid}`;
			const path = new Set([...ancestors[index], key]);
			if (path.has(`${row.Peryr}/${row.Perid}/${row.Otjid}`))
				throw new Error(`Cyclic SAP tree at ${key}`);
			return path;
		})
	);
	const childTrees = await loadChildren(groups.flat(), nextAncestors);
	let offset = 0;
	return english.map((rows, index) => {
		const names = new Map(hebrew[index].map((row) => [row.Otjid, row.Stext]));
		const courses = rows
			.filter((row) => row.Otjid.startsWith('SM'))
			.map((row) => row.Otjid);
		const children = groups[index].map((row) => ({
			Otjid: row.Otjid,
			Name: { en: row.Stext, he: names.get(row.Otjid) },
			...childTrees[offset++]
		}));
		return {
			courses: courses.length ? courses : undefined,
			children: children.length ? children : undefined
		};
	});
}

/**
 * Get populated semester years in SAP
 * @returns {Promise<SemesterYear[]>}
 */
export async function getSemesterYears() {
	const [semesters] = await requestBatch(
		'SemesterSet',
		[
			{
				$skip: '0',
				$top: '10000',
				$select: 'PiqYear,PiqSession,IsCurrent',
				$inlinecount: 'allpages'
			}
		],
		'en',
		{
			validate(rows) {
				validateRows(rows, ['PiqYear', 'PiqSession'], {});
				if (
					!rows.some((row) => ['200', '201', '202'].includes(row.PiqSession))
				) {
					throw new Error('Missing required academic semesters');
				}
			}
		}
	);
	return semesters
		.map(({ __metadata, ...semester }) => semester)
		.filter((semester) => ['200', '201', '202'].includes(semester.PiqSession));
}

/**
 * @param {SemesterYear[]} semesterYears to get faculties for
 * @returns {Promise<Faculty[]>}
 */
export async function getFaculties(
	semesterYears,
	previouslyPopulated = new Set()
) {
	// SAP ignores ZzOrgId filtering on this entity: fetch one collection per
	// semester/language, then match identities within that exact result slot.
	const queries = semesterYears.map(({ PiqYear, PiqSession }) => ({
		$skip: '0',
		$top: '10000',
		$orderby: 'Prio asc',
		$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}'`,
		$inlinecount: 'allpages',
		$select: 'ZzOrgId,ZzOrgName,PiqYear,PiqSession'
	}));
	const validate = (rows, index) => {
		const { PiqYear, PiqSession } = semesterYears[index];
		requirePreviouslyPopulated(
			rows,
			`${PiqYear}/${PiqSession}`,
			previouslyPopulated
		);
		validateRows(rows, ['ZzOrgId', 'ZzOrgName', 'PiqYear', 'PiqSession'], {
			PiqYear,
			PiqSession
		});
	};
	const english = await requestBatch('StudyFieldTilesSet', queries, 'en', {
		validate
	});
	const contradictedEnglish = new Set();
	const hebrew = await requestBatch('StudyFieldTilesSet', queries, 'he', {
		validate(rows, index) {
			validate(rows, index);
			const ids = new Set(rows.map((row) => row.ZzOrgId));
			const englishIds = new Set(english[index].map((row) => row.ZzOrgId));
			if (rows.some((row) => !englishIds.has(row.ZzOrgId)))
				contradictedEnglish.add(index);
			// A later empty Hebrew response must not validate an English collection
			// already contradicted by Hebrew records earlier in this operation.
			if (contradictedEnglish.has(index))
				throw new Error(
					'Incomplete English faculty collection: Hebrew returned additional IDs; retry the whole refresh'
				);

			const missing = english[index]
				.filter((row) => !ids.has(row.ZzOrgId))
				.map((row) => row.ZzOrgId);
			if (rows.length !== english[index].length || missing.length) {
				throw new Error(
					`Incomplete bilingual faculties: English and Hebrew identities differ; missing Hebrew IDs: ${missing.join(',') || 'none (extra Hebrew IDs)'}`
				);
			}
		}
	});
	return english.flatMap((rows, index) => {
		const names = new Map(
			hebrew[index].map((row) => [row.ZzOrgId, row.ZzOrgName])
		);
		return rows.map(({ __metadata, ...faculty }) => ({
			...faculty,
			Name: { en: faculty.ZzOrgName, he: names.get(faculty.ZzOrgId) }
		}));
	});
}

/**
 * @param {Faculty[]} faculties faculties to get degrees for
 * @returns {Promise<Degree[][]>}
 */
export async function getDegrees(faculties, previouslyPopulated = new Set()) {
	const degrees = await requestBatch(
		'ScObjectSet',
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			'sap-client': '700',
			$skip: '0',
			$top: '10000',
			$orderby: 'ZzAcademicLevel asc,Name asc',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}' and OrgId eq '${ZzOrgId}' and ZzAcademicLevel eq '1'`,
			$select: 'Name,OrgText,ZzQualifications,Otjid,OrgId,Peryr,Perid',
			$inlinecount: 'allpages'
		})),
		'en',
		{
			validate(rows, index) {
				const faculty = faculties[index];
				requirePreviouslyPopulated(
					rows,
					`${faculty.PiqYear}/${faculty.PiqSession}/${faculty.ZzOrgId}`,
					previouslyPopulated
				);
				validateRows(rows, ['Name', 'OrgText', 'ZzQualifications', 'Otjid'], {
					Peryr: faculty.PiqYear,
					Perid: faculty.PiqSession,
					OrgId: faculty.ZzOrgId
				});
			}
		}
	);
	const tracks = degrees.flat();
	const hebrew = await requestBatch(
		'ScObjectSet',
		tracks.map(({ Otjid, Peryr, Perid, OrgId }) => ({
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}' and OrgId eq '${OrgId}'`,
			$select: 'Name,OrgText,ZzQualifications,Otjid,OrgId,Peryr,Perid'
		})),
		'he',
		{
			validate(rows, index) {
				requireOne(rows);
				const { Otjid, Peryr, Perid, OrgId } = tracks[index];
				validateRows(rows, ['Name', 'OrgText', 'ZzQualifications'], {
					Otjid,
					Peryr,
					Perid,
					OrgId
				});
			}
		}
	);
	let index = 0;
	return degrees.map((rows) =>
		rows.map(({ __metadata, ...track }) => {
			const translation = hebrew[index++][0];
			return {
				...track,
				Name: { en: track.Name, he: translation.Name },
				OrgText: { en: track.OrgText, he: translation.OrgText },
				ZzQualifications: {
					en: track.ZzQualifications,
					he: translation.ZzQualifications
				}
			};
		})
	);
}

/**
 * @param {Track[]} tracks tracks to get trees for
 * @returns {Promise<TreeHead[]>}
 */
export async function getTrackTrees(tracks, previouslyPopulated = new Set()) {
	return await loadChildren(tracks, undefined, previouslyPopulated);
}

/**
 *
 * @param {SemesterNumber} semester to get name
 * @returns {I18N} i18n name of semester
 */
export function getSemesterName(semester) {
	const semesterNames = new Map([
		['200', { en: 'Winter', he: 'חורף' }],
		['201', { en: 'Spring', he: 'אביב' }],
		['202', { en: 'Summer', he: 'קיץ' }]
	]);

	return semesterNames.get(semester);
}

/**
 *
 * @param {SemesterYear[]} semesterYears
 * @param {number} top
 * @returns {Promise<CourseHeader[][]>}
 */
export async function getCourses(semesterYears, top = 10000) {
	return requestBatch(
		'SmObjectSet',
		semesterYears.map(({ PiqYear, PiqSession }) => ({
			$skip: '0',
			$top: String(top),
			$inlinecount: 'allpages',
			$select: 'Otjid,Peryr,Perid',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}'`
		})),
		'en',
		{
			allowLimitedResults: top < 10000,
			validate(rows, index) {
				const { PiqYear, PiqSession } = semesterYears[index];
				validateRows(rows, ['Otjid'], { Peryr: PiqYear, Perid: PiqSession });
			}
		}
	).then((results) =>
		results.map((rows) => rows.map(({ __metadata, ...row }) => row))
	);
}

/** Fetch exactly the course/version identified by each header. */
export async function getCourseData(courses) {
	const expansions = ['Exams', 'SmRelations', 'SmPrereq', 'SmOfferedPeriodSet'];
	return requestBatch(
		'SmObjectSet',
		courses.map(({ Otjid, Peryr, Perid }) => ({
			$expand: expansions.join(','),
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$select: [
				'Otjid',
				'Peryr',
				'Perid',
				'Name',
				'Points',
				'StudyContentDescription',
				'ZzOfferpattern',
				'OrgText',
				...expansions
			].join(',')
		})),
		'he',
		{
			maxBatchSize: 100,
			validate(rows, index) {
				requireOne(rows);
				const { Otjid, Peryr, Perid } = courses[index];
				validateRows(rows, ['Name', 'Points', 'OrgText'], {
					Otjid,
					Peryr,
					Perid
				});
				if (!rows[0].Points.trim() || !Number.isFinite(Number(rows[0].Points)))
					throw new Error('Invalid course points');
				for (const field of expansions) {
					try {
						validateCollection(rows[0][field]);
					} catch (error) {
						throw new Error(`Incomplete ${field}: ${error.message}`);
					}
				}
			}
		}
	).then((results) =>
		results.map((rows) =>
			rows.map(({ __metadata, Peryr, Perid, ...row }) => row)
		)
	);
}
