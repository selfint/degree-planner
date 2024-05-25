import { JSDOM } from 'jsdom';
import { parseCatalog } from '$lib/catalogParser';

function getNameUrl(code: string): string {
	return `https://students.technion.ac.il/local/technionsearch/course/${code}`;
}

export async function getStudentsPage(code: string): Promise<Document | undefined> {
	const nameUrl = getNameUrl(code);
	const response = await fetch(nameUrl);
	if (response.ok) {
		return new JSDOM(await response.text()).window.document;
	} else {
		return undefined;
	}
}

export function getPoints(doc: Document | undefined): number | undefined {
	const semesterInfo = doc?.querySelector('#semester_information');
	if (semesterInfo === undefined || semesterInfo === null) {
		return undefined;
	}

	const text = semesterInfo.textContent;
	if (text === null) {
		return undefined;
	}

	const match = text.match(/(\d+)\s+נקודות אקדמיות/);

	if (match) {
		const points = match[1];
		return Number(points);
	} else {
		return undefined;
	}
}

export function getName(code: string, doc: Document | undefined): string | undefined {
	if (doc === undefined) {
		return undefined;
	}

	const nameUrl = getNameUrl(code);
	const links: HTMLAnchorElement[] = Array.from(doc.querySelectorAll('a[aria-current="page"]'));
	const name = links.find((link) => link.href.includes(nameUrl));

	return name?.text;
}

export function getConnections(doc: Document | undefined): CourseConnections | undefined {
	const generalInformation: HTMLDivElement | null | undefined =
		doc?.querySelector('#general_information');
	if (generalInformation === null || generalInformation === undefined) {
		return undefined;
	}

	const dependenciesSeparator = 'מקצועות קדם';
	const adjacentSeparator = 'מקצועות צמודים';
	const exclusiveSeparator = 'מקצועות ללא זיכוי נוסף';

	const text = generalInformation.textContent ?? '';
	const dependenciesStart = text.indexOf(dependenciesSeparator);
	const adjacentStart = text.indexOf(adjacentSeparator);
	const exclusiveStart = text.indexOf(exclusiveSeparator);

	const dependencies = text.slice(
		dependenciesStart,
		Math.min(
			adjacentStart === -1 ? text.length : adjacentStart,
			exclusiveStart === -1 ? text.length : exclusiveStart
		)
	);
	const adjacent = text.slice(adjacentStart, exclusiveStart);
	const exclusive = text.slice(exclusiveStart);

	const extractContentBetweenParentheses = (text: string): string[] => {
		const regex = /\(([^)]+)\)/g;
		const matches = [];
		let match;
		while ((match = regex.exec(text)) !== null) {
			matches.push(match[1]);
		}
		const result = [...new Set(matches)];
		if (result.length === 0) {
			return [text];
		} else {
			return result;
		}
	};

	const dependenciesList = extractContentBetweenParentheses(dependencies).map(parseCatalog);
	const adjacentList = parseCatalog(adjacent);
	const exclusiveList = parseCatalog(exclusive);

	return {
		dependencies: dependenciesList,
		adjacent: adjacentList,
		exclusive: exclusiveList
	};
}
