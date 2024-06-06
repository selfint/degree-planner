// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	type Degree = [string, string, string];

	type Requirement = {
		points: number;
		courses: string[];
	};

	type Requirements = Record<string, Requirement[]>;

	type DegreeData = {
		recommended: string[][];
		requirements: Requirements;
	};
}

export {};
