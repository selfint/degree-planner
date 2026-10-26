import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
	);
}
export const sourceComponents = files(join(root, 'src'))
	.filter((path) => path.endsWith('.svelte') && !path.includes('/stories/'))
	.map((path) => relative(root, path))
	.sort();
export const storyFiles = files(join(root, 'src/stories'))
	.filter((path) => path.endsWith('.stories.ts'))
	.sort();
export const coverage = storyFiles.map((file) => {
	const source = readFileSync(file, 'utf8');
	const path = source.match(/componentPath:\s*['"]([^'"]+)['"]/)?.[1];
	const covers = [
		...(source.match(/covers:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(
			/['"]([^'"]+)['"]/g
		)
	].map((match) => match[1]);
	const title = source.match(/title:\s*['"]([^'"]+)['"]/)?.[1];
	const stories = [
		...source.matchAll(/export const (\w+)\s*:\s*Story\s*=/g)
	].map((match) => match[1]);
	return { file: relative(root, file), path, covers, title, stories, source };
});
// These files do not define independently renderable UI. All their visible children
// have individual stories; importing their lifecycle would activate real services.
export const exclusions: Record<string, string> = {
	'src/routes/+layout.svelte':
		'Root routing and lifecycle scaffold; TitleBar, AppFooter, ConsoleLoading and route pages are covered separately.',
	'src/routes/app/+layout.svelte':
		'Console bootstrap, authentication, service worker and context lifecycle; account/offline/auth notices and exceptional PWA details are covered by ConsoleAccountStatus and PwaStatusDetails without starting services.',
	'src/routes/app/+page.svelte':
		'Empty route entry; server/client loader redirects to a plan or settings.',
	'src/routes/[...legacy]/+page.svelte': 'Empty legacy redirect placeholder.',
	'src/routes/en/+page.svelte':
		'Language-setting redirect without visible UI; importing it would write actual browser preferences.'
};
