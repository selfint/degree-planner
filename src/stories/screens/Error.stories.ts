import type { Meta, StoryObj } from '@storybook/sveltekit';
import ErrorPage from '../../routes/+error.svelte';
import { routeState } from './fixtures';

const meta = {
	title: 'Pages/Error',
	component: ErrorPage,
	parameters: {
		componentPath: 'src/routes/+error.svelte',
		sveltekit_experimental: routeState('/missing-page', {}, 404)
	}
} satisfies Meta<typeof ErrorPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = {};
export const LoadFailed: Story = {
	parameters: {
		sveltekit_experimental: routeState('/app/catalog', {}, 500)
	}
};
export const ServiceUnavailable: Story = {
	parameters: {
		sveltekit_experimental: routeState('/app/search', {}, 503)
	}
};
