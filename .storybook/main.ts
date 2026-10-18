import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { StorybookConfig } from '@storybook/sveltekit';

const mock = (file: string) =>
	fileURLToPath(new URL(`./mocks/${file}`, import.meta.url));
const isolatedModules: Record<string, string> = {
	'stores.svelte': 'stores.svelte.ts',
	'preferences.svelte': 'preferences.svelte.ts',
	theme: 'theme.ts',
	offlineData: 'offlineData.ts',
	'pwa/status': 'pwaStatus.ts',
	planAccess: 'planAccess.ts',
	requirements: 'requirements.ts',
	transcriptParser: 'transcriptParser.ts',
	'firebase.svelte': 'firebase.svelte.ts'
};
const config: StorybookConfig = {
	stories: ['../src/stories/**/*.stories.ts'],
	framework: '@storybook/sveltekit',
	addons: [],
	// Only public branding, never catalogs, real course data or service workers.
	staticDirs: [{ from: '../static/brand', to: '/brand' }],
	core: { disableTelemetry: true },
	async viteFinal(config) {
		config.plugins = [
			{
				name: 'storybook-isolate-planner-state',
				enforce: 'pre',
				resolveId(source, importer) {
					if (source === 'pdfjs-dist/build/pdf.worker.min.mjs?url')
						return mock('pdfWorker.ts');
					const absolute =
						source.startsWith('.') && importer
							? resolve(dirname(importer), source)
							: source;
					const match = absolute.match(
						/(?:^\$lib\/|\/src\/lib\/)(.+?)(?:\.(?:ts|js))?$/
					);
					if (match && isolatedModules[match[1]])
						return mock(isolatedModules[match[1]]);
				},
				transform(source, id) {
					// Keep the real settings UI while making its decorative third-party image local.
					if (id.includes('/settings/+page.svelte'))
						return source.replace(
							'https://www.svgrepo.com/show/355037/google.svg',
							"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext x='2' y='20' font-size='24' fill='%234285f4'%3EG%3C/text%3E%3C/svg%3E"
						);
				},
				generateBundle(_options, bundle) {
					for (const output of Object.values(bundle)) {
						if (output.type !== 'chunk') continue;
						for (const id of Object.keys(output.modules)) {
							if (
								/\/src\/lib\/(?:stores\.svelte|preferences\.svelte|theme|firebase\.svelte|publicData|publicDataStore|requirements|offlineData|transcriptParser)\.ts$/.test(
									id
								) ||
								/\/src\/lib\/pwa\/status\.ts$/.test(id) ||
								/\/node_modules\/(?:@firebase|firebase|pdfjs-dist)\//.test(id)
							)
								this.error(`A live planner module entered Storybook: ${id}`);
						}
					}
				}
			},
			...(config.plugins ?? [])
		];
		config.base = './';
		return config;
	}
};
export default config;
