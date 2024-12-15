type TreeOnDemandSetResponse = {
	ParentStext: string;
	Short: string;
	HasChildren: boolean;
	HasDetails: boolean;
	IsNotApplicable: boolean;
	SpecialInfo: string;
	HasModules: boolean;
	Otjid: string;
	ParentOtjid: string;
	Otype: string;
	Objid: string;
	Stext: string;
	Cgcat: string;
	Ects: string;
	Invisible: string;
	Vpriox: string;
	Peryr: string;
	Perid: string;
	Orgid: string;
};

type Track = {
	Otjid: string;
	Peryr: string;
	Perid: SemesterNumber;
	Name: I18N;
	OrgId: string;
	OrgText: I18N;
	ZzQualifications: I18N;
};

type TreeHead = {
	courses?: string[];
	children?: Tree[];
};

type Tree = {
	Otjid: string;
	Name: I18N;
	courses?: string[];
	children?: Tree[];
};

type I18N = {
	en: string;
	he: string;
};

type Catalog = {
	track: Track;
	tree: TreeHead;
};

type Track = {
	Otjid: string;
	Peryr: string;
	Perid: string;
	Name: string;
	OrgId: string;
	OrgText: string;
	ZzQualifications: string;
};

type Degree = Track[];

type Faculty = {
	Name: I18N;
	PiqYear: string;
	PiqSession: string;
	ZzOrgId: string;
	ZzOrgName: string;
};

type SemesterNumber = '200' | '201' | '202';

type SemesterYear = {
	PiqSession: SemesterNumber;
	PiqYear: string;
};
