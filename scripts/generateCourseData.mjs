/// <reference path="../src/app.d.ts"/>

import * as sap from './SAPClient.mjs';

/**
 * Get the about information of a course.
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {string} courseSAPInfo.StudyContentDescription - The course description.
 * @returns {string|undefined} The course description or undefined if not found.
 */
export function getAbout(courseSAPInfo) {
	return courseSAPInfo.StudyContentDescription;
}

/**
 * Get the points of a course.
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {string} courseSAPInfo.Points - The course points as a string.
 * @returns {number|undefined} The course points as a number or undefined if not found.
 */
export function getPoints(courseSAPInfo) {
	if (courseSAPInfo.Points === undefined) {
		return undefined;
	} else {
		return parseFloat(courseSAPInfo.Points);
	}
}

/**
 * Get the name of a course.
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {string} courseSAPInfo.Name - The course name.
 * @returns {string|undefined} The course name or undefined if not found.
 */
export function getName(courseSAPInfo) {
	return courseSAPInfo.Name;
}

/**
 * Get the test dates for a course.
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {Array<Object>} courseSAPInfo.Exams.results - The array of exam objects.
 * @param {string} courseSAPInfo.Exams.results[].ExamDate - The exam date in epoch format.
 * @param {string} courseSAPInfo.Exams.results[].CategoryCode - The exam category code.
 * @returns {[Object, Object | undefined]|undefined} An array of two test objects or undefined if not found.
 */
export function getTests(courseSAPInfo) {
	const exams = courseSAPInfo.Exams.results.filter(
		(exam) => exam.ExamDate !== null
	);

	if (exams.length === 0) {
		return undefined;
	}

	const tests = exams
		.map((exam) => {
			const epoch = exam.ExamDate.slice(6, -2);
			const date = new Date(parseInt(epoch));
			return {
				category: exam.CategoryCode,
				year: date.getFullYear(),
				monthIndex: date.getMonth(),
				day: date.getDate()
			};
		})
		.sort((a, b) => {
			if (a.year !== b.year) {
				return a.year - b.year;
			} else if (a.monthIndex !== b.monthIndex) {
				return a.monthIndex - b.monthIndex;
			} else {
				return a.day - b.day;
			}
		});

	const first = tests.filter((test) => test.category === 'FI')[0];
	const second = tests.filter((test) => test.category === 'FB')[0];

	function buildTest(e) {
		return {
			year: e.year,
			monthIndex: e.monthIndex,
			day: e.day
		};
	}

	if (first === undefined) {
		return undefined;
	}

	if (second === undefined) {
		return [buildTest(first), undefined];
	}

	return [buildTest(first), buildTest(second)];
}

/**
 * Get the course connections (prerequisites).
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {Array<Object>} courseSAPInfo.SmPrereq.results - The array of prerequisite objects.
 * @param {string} courseSAPInfo.SmPrereq.results[].ModuleId - The module ID of the prerequisite.
 * @param {string} courseSAPInfo.SmPrereq.results[].Bracket - The bracket indicating groupings.
 * @returns {CourseConnections} The course connections including dependencies, adjacent, and exclusive groups.
 */
export function getConnections(courseSAPInfo) {
	const dependencies = [];
	let dependencyGroup = [];

	for (const prereq of courseSAPInfo.SmPrereq.results) {
		if (prereq.Bracket === '(') {
			if (dependencyGroup.length > 0) {
				dependencies.push(dependencyGroup);
			}

			dependencyGroup = [];
		}

		if (prereq.ModuleId.trim().replace(/0/g, '') === '') {
			continue;
		}

		dependencyGroup.push(prereq.ModuleId);
	}

	if (dependencyGroup.length > 0) {
		dependencies.push(dependencyGroup);
	}

	const exclusive = [];
	for (const relation of courseSAPInfo.SmRelations.results) {
		const relationType = relation.ZzRelationshipKey;
		if (relationType === 'AZEC') {
			exclusive.push(relation.Otjid.slice(2));
		}
	}

	return {
		dependencies,
		adjacent: [],
		exclusive: exclusive
	};
}

/**
 * Get the seasons in which the course is offered.
 * @param {Object} courseSAPInfo - The course SAP information object.
 * @param {string} courseSAPInfo.ZzOfferpattern - The course offer pattern.
 * @returns {Array<string>|undefined} The array of seasons or undefined if not found.
 */
export function getSeasons(courseSAPInfo) {
	const seasons = courseSAPInfo.ZzOfferpattern;

	switch (seasons) {
		case 'WSSS':
			return ['Winter', 'Spring', 'Summer'];
		case 'WI':
			return ['Winter'];
		case 'WISP':
			return ['Winter', 'Spring'];
		case 'SP':
			return ['Spring'];
		default:
			return undefined;
	}
}

/**
 * Fetches the median score for a course from a remote source.
 * @param {string} course - The course code.
 * @returns {Promise<number|undefined>} A promise that resolves to the median score or undefined if not available.
 */
export async function getMedian(course) {
	// Remove first leading zero and remove character at index 6
	const code = course.slice(3, 6) + course.slice(7);

	const url = `https://michael-maltsev.github.io/technion-histograms/${code}/index.min.json`;
	const response = await fetch(url);

	if (!response.ok) {
		return undefined;
	}

	const info = await response.json();
	let medians = 0;
	let count = 0;

	// Iterate over the last 5 semesters to calculate the average median score
	for (const semester of Object.values(info).slice(-5)) {
		const median = semester.Finals?.median;
		if (median !== undefined) {
			medians += parseFloat(median);
			count++;
		}
	}

	// If no medians were found, return undefined; otherwise, return the average median
	if (count === 0) {
		return undefined;
	} else {
		// Round to one decimal place
		return parseFloat((medians / count).toFixed(1));
	}
}

/**
 *
 * @param {Object} course raw course object
 * @param {boolean} current is the course in the current semester
 * @returns {Promise<Course>}
 */
async function parseCourse(course, current) {
	const code = course.Otjid;

	try {
		return {
			code: code.slice(2),
			median: await getMedian(code),
			about: getAbout(course),
			points: getPoints(course),
			name: getName(course),
			tests: getTests(course),
			connections: getConnections(course),
			seasons: getSeasons(course),
			faculty: course.OrgText,
			current
		};
	} catch (error) {
		throw new Error(
			`Failed to parse course ${code}: ${error}\n${JSON.stringify(course)}`
		);
	}
}

/**
 *
 * @param {number} top
 * @returns {Promise<string>}
 */
async function main(top) {
	console.error('Fetching semesters');

	const semesterYears = await sap.getSemesterYears();
	console.error(
		semesterYears.length,
		`Semester years: ${semesterYears.map(({ PiqSession, PiqYear }) => `${sap.getSemesterName(PiqSession).en} ${PiqYear}`).join(', ')}`
	);
	const currentYear = semesterYears.find(({ IsCurrent }) => IsCurrent === 0);

	let courseHeaders = (await sap.getCourses(semesterYears, top)).flat();
	console.error(courseHeaders.length, `Total course IDs`);

	// deduplicate course headers, keep latest (year, semester) for each Otjid
	/** @type {Map<string, CourseHeader>} */
	const codesMap = new Map();
	for (const header of courseHeaders) {
		const value = codesMap.get(header.Otjid);
		if (value === undefined) {
			codesMap.set(header.Otjid, header);
		} else {
			const { Peryr: currentYear, Perid: currentSession } = value;

			// update if (header > current)
			if (
				currentYear < header.Peryr ||
				(currentYear === header.Peryr && currentSession < header.Perid)
			) {
				codesMap.set(header.Otjid, header);
			}
		}
	}
	courseHeaders = Array.from(codesMap.values());

	console.error(
		courseHeaders.length,
		`Unique course IDs: ${courseHeaders.map(({ Otjid }) => Otjid).join(', ')}`
	);

	const rawData = (await sap.getCourseData(courseHeaders)).flat();

	const courseData = await Promise.all(
		rawData.map(async (raw) => {
			const current =
				currentYear !== undefined &&
				raw.Peryr === currentYear.Peryr &&
				raw.Perid === currentYear.Perid;
			const course = await parseCourse(raw, current);
			return course;
		})
	);

	console.error(
		courseData.length,
		`Parsed courses: ${courseData.map(({ code }) => code).join(', ')}`
	);

	console.error('SAP Usage:', JSON.stringify(sap.getUsage()));

	const courseDataMap = [];
	for (const course of courseData) {
		courseDataMap.push([course.code, course]);
	}

	courseDataMap.sort((a, b) => a[0].localeCompare(b[0]));

	return Object.fromEntries(courseDataMap);
}

const args = process.argv.slice(2);
const top = parseInt(args[0], 10);
// const top = 10;

if (isNaN(top)) {
	throw new Error('Invalid arguments');
}

console.log(JSON.stringify(await main(top), null, 1));
