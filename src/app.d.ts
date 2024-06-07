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

	type Choice = {
		amount: number;
		[option: string]: Requirement;
	};

	type Requirement = {
		courses?: string[];
		points?: number;
		count?: number;
		overflow?: string;
		choice?: Choice;
	};

	type DegreeRequirements = {
		points: number;
		[option: string]: Requirement;
	};

	type ChoiceHeader = {
		amount: null;
		[option: string]: RequirementHeader;
	};

	type RequirementHeader = {
		courses?: null;
		points?: null;
		count?: null;
		overflow?: null;
		choice?: ChoiceHeader;
	};

	type RequirementsHeader = Map<string, RequirementHeader>;

	type DegreeData = {
		recommended: string[][];
		requirements: DegreeRequirements;
	};

	type Course = {
		code: string;
		name: string;
		points: number;
	};
}

export {};
