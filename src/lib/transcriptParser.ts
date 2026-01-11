import * as pdfjs from 'pdfjs-dist';

export type Transcript = {
	semesters: string[][];
	exemptions: string[];
};

export async function parseTranscript(
	getCourseData: GetCourseData,
	buffer: Uint8Array,
	workerSrcUrl: string
): Promise<Transcript | undefined> {
	pdfjs.GlobalWorkerOptions.workerSrc = workerSrcUrl;
	const pdf = await pdfjs.getDocument(buffer).promise;

	// yyyy-yyyy regex
	const yearRegex = /(\d{4}-\d{4})/g;

	// yyyy/yy regex
	const legacyYearRegex = /(\d{4}\/\d{2})/g;

	// course code regex - 6 to 8 digits
	const courseRegex = /(\d{6,8})/g;

	const seasons = [
		'winter',
		'spring',
		'summer',
		'חורף',
		'אביב',
		'קיץ'
	] as const;

	const exemption = ['זיכויים', 'exemptions'] as const;

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

			if (yearRegex.test(str) || legacyYearRegex.test(str)) {
				// extract year
				const year = str.match(yearRegex) || str.match(legacyYearRegex);

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
				// offset by 1 for spring starts
				if (season === 1 && current === undefined) {
					semesters.push([]);
				}

				isExemptions = false;
				currentBasicSemester = [];
				current = { semester: [], year: yearStart, season };
			} else if (courseRegex.test(str)) {
				let code = str.match(courseRegex)!.toString().trim();

				const newCode = code.padStart(8, '0');
				const legacyCode = '0' + code.slice(0, 3) + '0' + code.slice(3);

				// try to validate code as new
				if ((await getCourseData(newCode)).name !== undefined) {
					currentBasicSemester.push(newCode);
					current?.semester.push(newCode);
				}
				// try to validate course as legacy
				else if ((await getCourseData(legacyCode)).name !== undefined) {
					currentBasicSemester.push(legacyCode);
					current?.semester.push(legacyCode);
				}
			} else if (exemption.some((w) => str.includes(w))) {
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
