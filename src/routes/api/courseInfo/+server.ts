import { error, json } from '@sveltejs/kit';

import { JSDOM } from 'jsdom';

function getNameUrl(code: string): string {
	return `https://students.technion.ac.il/local/technionsearch/course/${code}`;
}

export const GET = async ({ url }) => {
	const code = url.searchParams.get('c');
	if (code === null) {
		return error(422, 'Missing c (code) query parameter');
	}

	const nameUrl = getNameUrl(code);
	const response = await fetch(nameUrl);

	const doc = new JSDOM(await response.text()).window.document;
	const links: HTMLAnchorElement[] = Array.from(doc.querySelectorAll('a[aria-current="page"]'));
	const name = links.find((link) => link.href.includes(nameUrl));

	return json({
		name: name?.text
	});
};
