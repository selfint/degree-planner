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
 * @param {unknown[]} queries
 * @returns {Promise<unknown[] | undefined>} The results of the queries.
 */
async function requestBatch(queries) {
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
			`GET SmObjectSet?${new URLSearchParams(query).toString()} HTTP/1.1`,
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

	return blobs.flatMap((blob) => {
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
	const exams = courseSAPInfo.Exams.results;

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
 * @returns {Object} The course connections including dependencies, adjacent, and exclusive groups.
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

	return {
		dependencies,
		adjacent: [],
		exclusive: []
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
		return medians / count;
	}
}

async function parseCourse(course) {
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
			seasons: getSeasons(course)
		};
	} catch (error) {
		throw new Error(`Failed to parse course ${code}: ${error}`);
	}
}

/**
 *
 * @param {number} skip
 * @param {number} top
 * @returns {Promise<string>}
 */
async function main(skip, top) {
	console.error('Fetching course codes');
	const filters = [
		['2024', '200'],
		// ['2024', '201'],
		['2024', '208'],
		['2023', '200'],
		['2023', '201'],
		['2023', '208'],
		// ['2022', '200'],
		['2022', '201'],
		['2022', '208'],
		['2021', '200'],
		['2021', '201'],
		['2021', '208']
	];

	let codes = await requestBatch(
		filters.map(([peryr, perid]) => ({
			$skip: skip.toString(),
			$top: top.toString(),
			$select: 'Otjid',
			$filter: `Peryr eq '${peryr}' and Perid eq '${perid}'`
		}))
	).then((results) => results.map((r) => r['Otjid']));

	codes = [...new Set(codes)];

	console.error(`Got ${codes.length} unique course codes`);

	const batchSize = 100;

	const courseData = [];
	for (let i = 0; i < codes.length; i += batchSize) {
		console.error(
			`Fetching batch ${i / batchSize + 1}/${Math.ceil(codes.length / batchSize)}`
		);

		const queries = codes.slice(i, i + batchSize).map((code) => ({
			$expand: 'Responsible,Exams,SmRelations,SmPrereq',
			$filter: `Otjid eq '${code}'`,
			$select:
				'Otjid,Name,Points,StudyContentDescription,ZzOfferpattern,Exams,SmPrereq'
		}));
		const results = await requestBatch(queries);
		const courses = await Promise.all(results.map(parseCourse));

		courseData.push(...courses);
	}

	const courseDataMap = {};
	for (const course of courseData) {
		courseDataMap[course.code] = course;
	}

	return courseDataMap;
}

const args = process.argv.slice(2);
const skip = parseInt(args[0], 10);
const top = parseInt(args[1], 10);

if (isNaN(skip) || isNaN(top)) {
	throw new Error('Invalid arguments');
}

console.log(JSON.stringify(await main(skip, top), null, 1));
