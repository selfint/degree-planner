import { JSDOM } from 'jsdom';

function getNameUrl(code: string): string {
	return `https://students.technion.ac.il/local/technionsearch/course/${code}`;
}

export async function getName(code: string): Promise<string | undefined> {
	const nameUrl = getNameUrl(code);
	const response = await fetch(nameUrl);

	const doc = new JSDOM(await response.text()).window.document;
	const links: HTMLAnchorElement[] = Array.from(doc.querySelectorAll('a[aria-current="page"]'));
	const name = links.find((link) => link.href.includes(nameUrl));

	return name?.text;
}
