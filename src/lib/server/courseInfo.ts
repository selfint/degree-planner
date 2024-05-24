import { JSDOM } from 'jsdom';

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

export async function getName(
	code: string,
	doc: Document | undefined
): Promise<string | undefined> {
	if (doc === undefined) {
		return undefined;
	}

	const nameUrl = getNameUrl(code);
	const links: HTMLAnchorElement[] = Array.from(doc.querySelectorAll('a[aria-current="page"]'));
	const name = links.find((link) => link.href.includes(nameUrl));

	return name?.text;
}
