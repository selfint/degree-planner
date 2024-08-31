export type CourseSAPInfo = {
	Otjid: string;
	Points?: string;
	Name?: string;
	StudyContentDescription?: string;
	Exams: {
		results: {
			ExamDate: string;
		}[];
	};
	SmPrereq: {
		results: {
			Bracket: '(' | ')' | '';
			ModuleId: string;
		}[];
	};
};

export async function getCourseInfo(
	course: string
): Promise<CourseSAPInfo | undefined> {
	const url =
		'https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/$batch';

	const boundary = 'batch_1d12-afbf-e3c7';
	const headers = {
		'Accept-Language': 'he',
		'User-Agent': '',
		'Content-Type': `multipart/mixed;boundary=${boundary}`
	};

	const code = `SM${course}`;
	const params = new URLSearchParams({
		$expand: 'Responsible,Exams,SmRelations,SmPrereq',
		$filter: `Otjid eq '${code}'`
		// $select:
		// 	'Otjid,Points,Name,StudyContentDescription,OrgText,ZzAcademicLevelText,ZzSemesterNote,Responsible,Exams,SmRelations,SmPrereq'
	});

	const query = `SmObjectSet?${params.toString()}`;

	const data = `
--${boundary}
Content-Type: application/http

GET ${query} HTTP/1.1
Accept: application/json
Accept-Language: he


--${boundary}--
`.replace(/\n/g, '\r\n');

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: data
	});

	if (!response.ok) {
		return undefined;
	}

	const text = await response.text();

	const results = JSON.parse(
		text.replace(/\r\n/g, '\n').trim().split('\n\n')[2].split('\n', 1)[0]
	);

	return results['d']['results'][0];
}

export function getAbout(courseSAPInfo: CourseSAPInfo): string | undefined {
	return courseSAPInfo.StudyContentDescription;
}

export function getPoints(courseSAPInfo: CourseSAPInfo): number | undefined {
	if (courseSAPInfo.Points === undefined) {
		return undefined;
	} else {
		return parseFloat(courseSAPInfo.Points);
	}
}

export function getName(courseSAPInfo: CourseSAPInfo): string | undefined {
	return courseSAPInfo.Name;
}

export function getTests(
	courseSAPInfo: CourseSAPInfo
): [Test, Test] | undefined {
	// parse dates in format: /Date(1740873600000)/"
	const exams = courseSAPInfo.Exams.results;

	if (exams.length === 0) {
		return undefined;
	}

	const tests = exams
		.map((exam) => {
			const epoch = exam.ExamDate.slice(6, -2);
			const date = new Date(parseInt(epoch));
			return {
				year: date.getFullYear(),
				monthIndex: date.getMonth(),
				day: date.getDate()
			};
		})
		.toSorted((a, b) => {
			if (a.year !== b.year) {
				return a.year - b.year;
			} else if (a.monthIndex !== b.monthIndex) {
				return a.monthIndex - b.monthIndex;
			} else {
				return a.day - b.day;
			}
		});

	return tests.slice(0, 2) as [Test, Test];
}

export function getConnections(
	courseSAPInfo: CourseSAPInfo
): CourseConnections {
	const dependencies = [];
	let dependencyGroup: string[] = [];

	for (const prereq of courseSAPInfo.SmPrereq.results) {
		if (prereq.Bracket === '(') {
			if (dependencyGroup.length > 0) {
				dependencies.push(dependencyGroup);
			}

			dependencyGroup = [];
		}

		// check moduleId is not only 0
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
