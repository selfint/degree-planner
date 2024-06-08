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
		options: Map<string, Requirement>;
	};

	type ChoiceProgress = {
		amount: [number, number];
		options: Map<string, [Requirement, RequirementProgress]>;
	};

	type Requirement = {
		courses?: string[];
		points?: number;
		count?: number;
		overflow?: string;
		choice?: Choice;
	};

	type RequirementProgress = {
		courses?: string[];
		points?: number;
		count?: number;
		overflow?: [string, 'points' | 'count', number];
		choice?: ChoiceProgress;
	};

	type DegreeRequirements = {
		points: number;
		requirements: Map<string, Requirement>;
	};

	type DegreeProgress = {
		points: [number, number];
		requirements: Map<string, [Requirement, RequirementProgress]>;
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

	type CourseConnections = {
		dependencies: string[][];
		adjacent: string[];
		exclusive: string[];
	};

	type Course = {
		code: string;
		name?: string;
		points?: number;
		median?: number;
		connections?: CourseConnections;
	};

	type CourseData = Map<string, Promise<Course>>;
}

export {};
