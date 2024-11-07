/// <reference path="../src/app.d.ts"/>

/**
 * @param {number} bytes
 * @param {number} decimals
 * @returns
 */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Request a batch of queries to the Technion SAP API.
 * @param {unknown[]} endpoint
 * @param {unknown[]} queries
 * @returns {Promise<unknown[][] | undefined>} The results of the queries.
 */
async function requestBatch(endpoint, queries) {
	const url =
		'https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/$batch';

	const boundary = 'batch_1d12-afbf-e3c7';
	const headers = {
		'Accept-Language': 'he',
		'User-Agent': '',
		'Content-Type': `multipart/mixed;boundary=${boundary}`
	};

	function buildRequest(query) {
		return [
			'Content-Type: application/http\r\n',
			`GET ${endpoint}?${new URLSearchParams(query).toString()} HTTP/1.1`,
			'Accept: application/json',
			'Accept-Language: he\r\n\r\n\r\n'
		].join('\r\n');
	}

	const body = queries.reduceRight(
		(acc, q) => `--${boundary}\r\n${buildRequest(q)}` + acc,
		`--${boundary}--\r\n`
	);

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body
	});
	const contentLength = response.headers.get('Content-Length');
	const size = formatBytes(parseInt(contentLength, 10));

	console.error(`Got response: status=${response.status} size=${size}`);

	if (!response.ok) {
		console.log(await response.text());
		return undefined;
	}

	const text = await response.text();
	const responseBoundary = response.headers
		.get('Content-Type')
		.split('boundary=')[1];

	const blobs = text.split(`--${responseBoundary}`).slice(1, -1);

	if (blobs.length !== queries.length) {
		throw new Error(text);
	}

	return blobs.map((blob) => {
		const lines = blob.trim().split('\r\n');
		const results = JSON.parse(lines[lines.length - 1]);

		return results['d']['results'];
	});
}

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
 * @returns {Course}
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
 * @param {[string, [string, string, boolean]][]} batch
 * @returns {Promise<Course[] | undefined>}
 */
async function fetchBatch(batch) {
	console.error(`Fetching data for ${batch.length} courses`);

	const queries = batch.map(([code, [peryr, perid]]) => ({
		$expand: 'Responsible,Exams,SmRelations,SmPrereq',
		$filter: `Otjid eq '${code}' and Peryr eq '${peryr}' and Perid eq '${perid}'`,
		$select: [
			'Otjid',
			'Name',
			'Points',
			'StudyContentDescription',
			'ZzOfferpattern',
			'Exams',
			'SmPrereq',
			'SmRelations',
			'OrgText'
		].join(',')
	}));
	const results = await requestBatch('SmObjectSet', queries);
	if (results === undefined) {
		console.error(
			`Failed to fetch data for courses: ${JSON.stringify(batch.map(([code]) => code))}`
		);

		return undefined;
	}

	return await Promise.all(
		results
			.flat()
			.map((course, index) => parseCourse(course, batch[index][1][2]))
	);
}

/**
 *
 * @param {number} skip
 * @param {number} top
 * @returns {Promise<string>}
 */
async function main(skip, top) {
	console.error('Fetching semesters');

	/** @type {[string, string, boolean][]} */
	const filters = await requestBatch('SemesterSet', [
		{
			$select: 'PiqYear,PiqSession,IsCurrent'
		}
	]).then((results) =>
		results[0].map((c) => [
			c.PiqYear,
			c.PiqSession,
			// TODO: what is 208?
			c.IsCurrent !== -1 && c.PiqSession !== '208'
		])
	);

	console.error(`Got ${filters.length} semesters:\n${filters.join('\n')}`);
	console.error('Fetching course codes');

	/** @type {string[][]} */
	const yearCodes = await requestBatch(
		'SmObjectSet',
		filters.map(([peryr, perid]) => ({
			$skip: skip.toString(),
			$top: top.toString(),
			$select: 'Otjid',
			// $filter: `Peryr eq '${peryr}' and Perid eq '${perid}' and Otjid eq 'SM03240033'`
			$filter: `Peryr eq '${peryr}' and Perid eq '${perid}' `
		}))
	).then((results) => results.map((r) => r.map((c) => c.Otjid)));

	/** @type {Map<string, [string, string, boolean]>} */
	const codesMap = new Map();
	for (let i = 0; i < filters.length; i++) {
		const filter = filters[i];
		const courses = yearCodes[i];

		// TODO: Handle multiple filters more elegantly
		for (const code of courses) {
			if (!codesMap.has(code)) {
				codesMap.set(code, filter);
			}
		}
	}

	const codes = Array.from(codesMap.entries());

	console.error(
		`Got ${codes.filter(([, [, , current]]) => current).length} current courses`
	);
	console.error(`Got ${codes.length} total courses`);

	const batchSize = 100;

	const courseData = [];
	for (let i = 0; i < codes.length; i += batchSize) {
		console.error(
			`Fetching batch ${i / batchSize + 1}/${Math.ceil(codes.length / batchSize)}`
		);
		let courses = await fetchBatch(codes.slice(i, i + batchSize));

		let retry = 1;
		let timeoutMS = 1000 * 5;
		const maxRetries = 5;
		while (courses === undefined) {
			console.error(`Retry ${retry}/${maxRetries}, waiting ${timeoutMS}ms`);
			await new Promise((resolve) => setTimeout(resolve, timeoutMS));
			courses = await fetchBatch(codes.slice(i, i + batchSize));

			timeoutMS *= 2;

			retry++;

			if (retry >= maxRetries) {
				throw new Error('Failed to fetch batch');
			}
		}

		console.error(`Got ${courses.length} courses`);
		courseData.push(...courses);
	}

	const uniqueCourses = [...new Set(courseData.map((c) => c.code))];
	uniqueCourses.sort();

	console.error(
		`Generated data for ${uniqueCourses.length} unique courses:\n${uniqueCourses.join(',')}`
	);

	const courseDataMap = [];
	for (const course of courseData) {
		courseDataMap.push([course.code, course]);
	}

	courseDataMap.sort((a, b) => a[0].localeCompare(b[0]));

	return Object.fromEntries(courseDataMap);
}

const args = process.argv.slice(2);
const skip = parseInt(args[0], 10);

const top = parseInt(args[1], 10);

if (isNaN(skip) || isNaN(top)) {
	throw new Error('Invalid arguments');
}

console.log(JSON.stringify(await main(skip, top), null, 1));
