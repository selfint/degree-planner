const API = '/api/courseInfo';

export async function getName(course: string): Promise<string | undefined> {
	const response = await fetch(API + '?c=' + course);

	if (!response.ok) {
		console.error(response);
		return undefined;
	} else {
		return (await response.json()).name;
	}
}
