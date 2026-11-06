import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './ShellPreview.svelte';
const meta = {
	title: 'Components/TitleBar',
	component: Preview,
	parameters: {
		componentPath: 'src/routes/components/TitleBar.svelte',
		covers: ['src/lib/components/BrandTitle.svelte']
	},
	args: { kind: 'TitleBar' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Landing: Story = { args: { state: 'landing' } };
export const Query: Story = { args: { state: 'query' } };
