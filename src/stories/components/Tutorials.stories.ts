import type { Meta, StoryObj } from '@storybook/sveltekit';
import Tutorials from '../../routes/components/Tutorials.svelte';

const meta = {
	title: 'Components/Tutorials',
	component: Tutorials,
	parameters: {
		componentPath: 'src/routes/components/Tutorials.svelte',
		covers: ['src/routes/components/TutorialVideo.svelte']
	}
} satisfies Meta<typeof Tutorials>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
