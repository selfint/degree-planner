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
	const or = 'או';

	let dependenciesElement: HTMLParagraphElement | undefined = undefined;
	let adjacentElement: HTMLParagraphElement | undefined = undefined;
	let exclusiveElements: HTMLParagraphElement[] | undefined = undefined;

	for (let i = 0; i < generalInformation.children.length; i++) {
		const child = generalInformation.children[i];
		if (child.tagName === 'H5') {
			if (child.textContent?.includes(dependenciesSeparator)) {
				dependenciesElement = generalInformation.children[i + 1] as HTMLParagraphElement;
			} else if (child.textContent?.includes(adjacentSeparator)) {
				adjacentElement = generalInformation.children[i + 1] as HTMLParagraphElement;
			} else if (child.textContent?.includes(exclusiveSeparator)) {
				if (exclusiveElements === undefined) {
					exclusiveElements = [];
				}

				for (let j = i + 1; j < generalInformation.children.length; j++) {
					if (generalInformation.children[j].tagName === 'P') {
						exclusiveElements.push(generalInformation.children[j] as HTMLParagraphElement);
					}
				}
			}
		}
	}

	const dependencies =
		dependenciesElement?.textContent
			?.split(or)
			.map(parseCatalog)
			.map((g) => [...new Set(g)]) ?? [];
	const adjacent = parseCatalog(adjacentElement?.textContent ?? '');
	const exclusive = exclusiveElements?.flatMap((e) => parseCatalog(e.textContent ?? '')) ?? [];

	return {
		dependencies: [...new Set(dependencies)],
		adjacent: [...new Set(adjacent)],
		exclusive: [...new Set(exclusive)]
	};
}
