import type { Meta, StoryObj } from '@storybook/sveltekit';
import OfflinePage from '../../routes/app/offline/+page.svelte';
import { routeState } from './fixtures';

const meta = {
	title: 'Pages/Offline',
	component: OfflinePage,
	parameters: {
		componentPath: 'src/routes/app/offline/+page.svelte',
		planner: { online: false },
		sveltekit_experimental: routeState('/app/offline')
	}
} satisfies Meta<typeof OfflinePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
