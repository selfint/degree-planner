import * as pdfjs from 'pdfjs-dist';

import { getCourseData } from '$lib/courseData';

export type Transcript = {
	semesters: string[][];
	exemptions: string[];
};

export async function parseTranscript(
	buffer: Uint8Array,
	workerSrcUrl: string
): Promise<Transcript | undefined> {
	pdfjs.GlobalWorkerOptions.workerSrc = workerSrcUrl;
	const pdf = await pdfjs.getDocument(buffer).promise;

	// yyyy-yyyy regex
	const yearRegex = /(?:\d{4})-(?:\d{4})/g;

	// course code regex - 6 to 8 digits
	const courseRegex = /(\d{6,8})/g;

	const seasons = ['winter', 'spring', 'summer', 'חורף', 'אביב', 'קיץ'];

	const exemption = ['זיכויים', 'exemptions'];

	let basicSemesters = [];

	let exemptions: string[] = [];
	let semesters: string[][] = [];
	let currentBasicSemester: string[] = [];
	type Current = {
		semester: string[];
		season: number;
		year: number;
	};
	let current: Current | undefined = undefined;
	let isExemptions = false;

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const textContent = await page.getTextContent();

		for (const item of textContent.items) {
			//@ts-expect-error we don't have TextMarkedContent
			let str: string = item.str.toLowerCase().trim();

			if (yearRegex.test(str)) {
				// extract year
				const year = str.match(yearRegex);
				const season = seasons.findIndex((season) => str.includes(season)) % 3;
				const yearStart = parseInt(year![0].split('-')[0]);

				// add previous semester
				if (currentBasicSemester.length > 0) {
					basicSemesters.push([...new Set(currentBasicSemester)]);
				}

				if (isExemptions) {
					exemptions = [...new Set(currentBasicSemester)];
				} else if (current !== undefined) {
					semesters.push([...new Set(current.semester)]);

					// get distance to previous semester
					const yearDistance = yearStart - current.year;
					const semesterDistance = season - current.season;
					const distance = yearDistance * 3 + semesterDistance;
					for (let i = 0; i < distance - 1; i++) {
						semesters.push([]);
					}
				}

				isExemptions = false;
				currentBasicSemester = [];
				current = { semester: [], year: yearStart, season };
			} else if (courseRegex.test(str)) {
				let code = str.match(courseRegex)!.toString().trim();
				code = code.padStart(8, '0');
				if (getCourseData(code).name !== undefined) {
					currentBasicSemester.push(code);
					current?.semester.push(code);
				}
			} else if (exemption.some((exempt) => str.includes(exempt))) {
				isExemptions = true;
			}
		}
	}
	if (current !== undefined) {
		semesters.push([...new Set(current.semester)]);
	}

	// if (semesters.length < 20 && semesters.length > 0) {
	return { semesters, exemptions };
	// } else {
	// 	return { semesters: basicSemesters, exemptions: [] };
	// }
}
