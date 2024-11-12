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
	Perid: string;
	Name: I18N;
	OrgId: string;
	OrgText: I18N;
	ZzQualifications: I18N;
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
	Otjid: string;
	Peryr: string;
	Perid: string;
	Name: I18N;
	OrgId: string;
	OrgText: I18N;
	ZzQualifications: I18N;
	tree: {
		courses?: string[];
		children?: Tree[];
	};
};
