import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/sveltekit';

const mock = (file: string) =>
	fileURLToPath(new URL(`./mocks/${file}`, import.meta.url));

const config: StorybookConfig = {
	stories: ['../src/stories/**/*.stories.ts'],
	framework: '@storybook/sveltekit',
	addons: [],
	// Deliberately do not copy the application's catalog, user data or worker.
	staticDirs: [],
	core: { disableTelemetry: true },
	async viteFinal(config) {
		config.plugins = [
			{
				name: 'storybook-isolate-planner-state',
				enforce: 'pre',
				resolveId(source) {
					// Kit's alias plugin resolves $lib before user aliases. Match its
					// absolute paths too, before Vite can load the real state modules.
					if (
						/(?:^\$lib\/|\/src\/lib\/)(?:stores|preferences)\.svelte(?:\.ts)?$/.test(
							source
						)
					) {
						return mock('preferences.svelte.ts');
					}
					if (/(?:^\$lib\/|\/src\/lib\/)theme(?:\.ts)?$/.test(source)) {
						return mock('theme.ts');
					}
				},
				generateBundle(_options, bundle) {
					for (const output of Object.values(bundle)) {
						if (output.type !== 'chunk') continue;
						for (const id of Object.keys(output.modules)) {
							if (
								/\/src\/lib\/(?:stores\.svelte|preferences\.svelte|theme|firebase\.svelte|publicData|publicDataStore|requirements)\.ts$/.test(
									id
								) ||
								/\/node_modules\/(?:@firebase|firebase)\//.test(id)
							) {
								this.error(`A live planner module entered Storybook: ${id}`);
							}
						}
					}
				}
			},
			...(config.plugins ?? [])
		];
		// Every Storybook asset stays relative to /storybook/, including iframe reloads.
		config.base = './';
		return config;
	}
};

export default config;
