/// <reference path="./types.d.ts"/>
import * as sap from './SAPClient.mjs';

import { suite, test } from 'vitest';

suite(
	'SAP Client tests',
	{
		timeout: 60 * 1000
	},
	() => {
		test('Get semesters', async (ctx) => {
			const semesters = await sap.getSemesterYears();

			ctx.expect(semesters).toMatchInlineSnapshot(`
				[
				  {
				    "PiqSession": "200",
				    "PiqYear": "2024",
				  },
				  {
				    "PiqSession": "201",
				    "PiqYear": "2023",
				  },
				  {
				    "PiqSession": "200",
				    "PiqYear": "2023",
				  },
				  {
				    "PiqSession": "201",
				    "PiqYear": "2022",
				  },
				  {
				    "PiqSession": "201",
				    "PiqYear": "2021",
				  },
				  {
				    "PiqSession": "200",
				    "PiqYear": "2021",
				  },
				]
			`);
		});

		test('Get faculties', async (ctx) => {
			const faculties = await sap.getFaculties([
				{
					PiqSession: '200',
					PiqYear: '2024'
				}
			]);

			ctx.expect(faculties).toMatchInlineSnapshot(`
			[
			  {
			    "Name": {
			      "en": "Civil & Environmental Engineering",
			      "he": "הפקולטה להנדסה אזרחית וסביבתית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002010",
			    "ZzOrgName": "Civil & Environmental Engineering",
			  },
			  {
			    "Name": {
			      "en": "Architecture & Town Planning",
			      "he": "הפקולטה לארכיטקטורה ובינוי ערים",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002020",
			    "ZzOrgName": "Architecture & Town Planning",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Mechanical Engineering",
			      "he": "הפקולטה להנדסת מכונות",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002030",
			    "ZzOrgName": "Faculty of Mechanical Engineering",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Materials Science&Engineering",
			      "he": "הפקולטה למדע והנדסה של חומרים",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002040",
			    "ZzOrgName": "Faculty of Materials Science&Engineering",
			  },
			  {
			    "Name": {
			      "en": "Electrical & Computer Engineering",
			      "he": "הפקולטה להנדסת חשמל ומחשבים",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002050",
			    "ZzOrgName": "Electrical & Computer Engineering",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Chemistry",
			      "he": "הפקולטה לכימיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002060",
			    "ZzOrgName": "Faculty of Chemistry",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Chemical Engineering",
			      "he": "הפקולטה להנדסה כימית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002070",
			    "ZzOrgName": "Faculty of Chemical Engineering",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Biotechnology & Food Eng",
			      "he": "הפקולטה להנדסת ביוטכנולוגיה ומזון",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002080",
			    "ZzOrgName": "Faculty of Biotechnology & Food Eng",
			  },
			  {
			    "Name": {
			      "en": "Faculty of  Physics",
			      "he": "הפקולטה לפיזיקה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002090",
			    "ZzOrgName": "Faculty of  Physics",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Mathematics",
			      "he": "הפקולטה למתמטיקה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002100",
			    "ZzOrgName": "Faculty of Mathematics",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Computer Science",
			      "he": "הפקולטה למדעי המחשב",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002120",
			    "ZzOrgName": "Faculty of Computer Science",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Aerospace Engineering",
			      "he": "הפקולטה להנדסת אוירונאוטיקה וחלל",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002160",
			    "ZzOrgName": "Faculty of Aerospace Engineering",
			  },
			  {
			    "Name": {
			      "en": "Data and Decision Sciences",
			      "he": "מדעי הנתונים וההחלטות",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002190",
			    "ZzOrgName": "Data and Decision Sciences",
			  },
			  {
			    "Name": {
			      "en": "Education in Science and Technology",
			      "he": "חינוך למדע וטכנולוגיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002220",
			    "ZzOrgName": "Education in Science and Technology",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Medicine",
			      "he": "הפקולטה לרפואה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002270",
			    "ZzOrgName": "Faculty of Medicine",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Biomedical Engineering",
			      "he": "הפקולטה להנדסה ביו-רפואית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002330",
			    "ZzOrgName": "Faculty of Biomedical Engineering",
			  },
			  {
			    "Name": {
			      "en": "Faculty of Biology",
			      "he": "הפקולטה לביולוגיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002340",
			    "ZzOrgName": "Faculty of Biology",
			  },
			  {
			    "Name": {
			      "en": "Humanities and Arts",
			      "he": "המחלקה ללימודים הומניסטיים ואמנות",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00002200",
			    "ZzOrgName": "Humanities and Arts",
			  },
			  {
			    "Name": {
			      "en": "Applied Mathematics",
			      "he": "מתמטיקה שימושית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050019",
			    "ZzOrgName": "Applied Mathematics",
			  },
			  {
			    "Name": {
			      "en": "Nano-science & Nano-technology",
			      "he": "ננו-מדעים וננו-טכנולוגיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050064",
			    "ZzOrgName": "Nano-science & Nano-technology",
			  },
			  {
			    "Name": {
			      "en": "EDUCATION IN TECHNOLOGY AND SCIENCE",
			      "he": "חינוך למדע וטכנולוגיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050066",
			    "ZzOrgName": "EDUCATION IN TECHNOLOGY AND SCIENCE",
			  },
			  {
			    "Name": {
			      "en": "Biotechnology",
			      "he": "ביוטכנולוגיה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050082",
			    "ZzOrgName": "Biotechnology",
			  },
			  {
			    "Name": {
			      "en": "DESIGN AND MANUFACTURING MANAGEMENT",
			      "he": "ניהול הייצור",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050503",
			    "ZzOrgName": "DESIGN AND MANUFACTURING MANAGEMENT",
			  },
			  {
			    "Name": {
			      "en": "ENERGY",
			      "he": "תוכנית האנרגיה ע"ש גרנד",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050510",
			    "ZzOrgName": "ENERGY",
			  },
			  {
			    "Name": {
			      "en": "AUTONOMOUS SYSTEMS AND ROBOTICS",
			      "he": "מערכות אוטונומיות ורובוטיקה",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050511",
			    "ZzOrgName": "AUTONOMOUS SYSTEMS AND ROBOTICS",
			  },
			  {
			    "Name": {
			      "en": "URBAN ENGINEERING",
			      "he": "הנדסה עירונית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050512",
			    "ZzOrgName": "URBAN ENGINEERING",
			  },
			  {
			    "Name": {
			      "en": "Business Administration",
			      "he": "מנהל עסקים",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050075",
			    "ZzOrgName": "Business Administration",
			  },
			  {
			    "Name": {
			      "en": "Polymer Engineering",
			      "he": "הנדסת פולימרים",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050085",
			    "ZzOrgName": "Polymer Engineering",
			  },
			  {
			    "Name": {
			      "en": "SYSTEMS ENGINEERING",
			      "he": "הנדסת מערכות",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050504",
			    "ZzOrgName": "SYSTEMS ENGINEERING",
			  },
			  {
			    "Name": {
			      "en": "MARINE ENGINEERING",
			      "he": "הנדסה ימית",
			    },
			    "PiqSession": "200",
			    "PiqYear": "2024",
			    "ZzOrgId": "00050520",
			    "ZzOrgName": "MARINE ENGINEERING",
			  },
			]
		`);
		});

		test('Get degrees', async (ctx) => {
			/** @type {Faculty} */
			const faculty = {
				Name: {
					en: 'Faculty of Computer Science',
					he: 'הפקולטה למדעי המחשב'
				},
				PiqSession: '200',
				PiqYear: '2024',
				ZzOrgId: '00002120',
				ZzOrgName: 'Faculty of Computer Science'
			};

			const degrees = await sap.getDegrees([faculty]);

			ctx.expect(degrees).toMatchInlineSnapshot(`
				[
				  [
				    {
				      "Name": {
				        "en": "COMPUTER ENG. (COMPUTER SCIENCE)",
				        "he": "הנ. מחשבים (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001306",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMPUTER ENGINEERING",
				        "he": "מוסמך למדעים בהנדסת מחשבים",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE",
				        "he": "מדעי המחשב",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001313",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMPUTER SCIENCES",
				        "he": "מוסמך למדעים במדעי המחשב",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE",
				        "he": "מדעי המחשב(תכנית תלת שנתית)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001314",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMPUTER SCIENCES (3 YEARS)",
				        "he": "בוגר למדעים בהנדסה במדעי המחשב",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE - PHYSICS",
				        "he": "מדעי המחשב - פיזיקה",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001318",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN PHYSICS (3 YEARS)
				B.SC. IN COMP.SCI.-3Y-B.SC. IN PHYSIC-3Y",
				        "he": "בוגר למדעים בפיזיקה
				ב.למדע בהנד.במ.המחשב - מ.למדע בהנד.בפיזי",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE AND MATHEMATICS(COMPUTER SCIENCE)",
				        "he": "מדעי המחשב-מתמטיקה (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001319",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMP.SCIENCE AND IN MATHEMATIC",
				        "he": "בוגר למדעים במדעי המחשב ובמתמטיקה",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE AND PHYSICS (COMPUTER SCIENCE)",
				        "he": "מדעי המחשב-פיזיקה (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001320",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMPUTER SCIENCE AND IN PHYSICS",
				        "he": "מוסמך למדעים במדעי המחשב ובפיזיקה",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE FOCUS ON BIOINFORMATICS",
				        "he": "מדעי המחשב - ביואינפורמטיקה",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001340",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN COMP.SCI.WITH FOCUS ON BIOINFO",
				        "he": "מוסמך למדעים במ.המחשב עם התמקדות בביואנפ",
				      },
				    },
				    {
				      "Name": {
				        "en": "COMPUTER SCIENCE-MATHEMATICS",
				        "he": "מדעי המחשב-מתמטיקה",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001317",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN MATH(3Y)-B.SC. IN COMP.SCI(3Y)
				B.SC. IN MATHEMATICS (3 YEARS)",
				        "he": "ב.למדע בהנד.במתמט-מ .למדע בהנד.במ.המחשב
				בוגר למדעים בהנדסה במתמטיקה",
				      },
				    },
				    {
				      "Name": {
				        "en": "INFORMATION SYSTEMS ENG. (COMP. SCIENCE)",
				        "he": "הנ.מערכות מידע (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001316",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN INFORMATION SYSTEMS ENGINEERING",
				        "he": "מוסמך למדעים בהנדסת מערכות מידע",
				      },
				    },
				    {
				      "Name": {
				        "en": "INFORMATION SYSTEMS ENG. (COMP.SCIENCE)",
				        "he": "הנ.מערכות מידע (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001312",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN INFORMATION SYSTEMS ENGINEERING",
				        "he": "מוסמך למדעים בהנדסת מערכות מידע",
				      },
				    },
				    {
				      "Name": {
				        "en": "SOFTWARE ENG.(COMPUTER SCIENCE)",
				        "he": "הנ. תכנה (מדעי המחשב)",
				      },
				      "OrgId": "00002120",
				      "OrgText": {
				        "en": "Faculty of Computer Science",
				        "he": "הפקולטה למדעי המחשב",
				      },
				      "Otjid": "SC00001315",
				      "Perid": "200",
				      "Peryr": "2024",
				      "ZzQualifications": {
				        "en": "B.SC. IN SOFTWARE ENGINEERING",
				        "he": "מוסמך למדעים בהנדסת תכנה",
				      },
				    },
				  ],
				]
			`);
		});

		test('Get track trees', async (ctx) => {
			const track = {
				Name: {
					en: 'COMPUTER SCIENCE',
					he: 'מדעי המחשב(תכנית תלת שנתית)'
				},
				OrgText: {
					en: 'Faculty of Computer Science',
					he: 'הפקולטה למדעי המחשב'
				},
				Otjid: 'SC00001314',
				Perid: '200',
				Peryr: '2024',
				ZzQualifications: {
					en: 'B.SC. IN COMPUTER SCIENCES (3 YEARS)',
					he: 'בוגר למדעים בהנדסה במדעי המחשב'
				}
			};

			const trees = await sap.getTrackTrees([track]);

			ctx.expect(trees).toMatchInlineSnapshot(`
				[
				  {
				    "children": [
				      {
				        "Name": {
				          "en": "Version 2023 B.Sc Computer Science",
				          "he": "גרסה 2023 B.Sc מדעי המחשב (תלת שנתי)",
				        },
				        "Otjid": "CG00006245",
				        "children": [
				          {
				            "Name": {
				              "en": "All-Technion Electives",
				              "he": "בחירה כלל טכניונית",
				            },
				            "Otjid": "CG00000170",
				            "children": [
				              {
				                "Name": {
				                  "en": "Community Program",
				                  "he": "תוכנית קהילתית",
				                },
				                "Otjid": "CG00000551",
				                "children": undefined,
				                "courses": undefined,
				              },
				              {
				                "Name": {
				                  "en": "Free Electives",
				                  "he": "בחירה חופשית",
				                },
				                "Otjid": "CG00000175",
				                "children": undefined,
				                "courses": undefined,
				              },
				              {
				                "Name": {
				                  "en": "Malag Courses",
				                  "he": "קורסי מל"ג",
				                },
				                "Otjid": "CG00009076",
				                "children": undefined,
				                "courses": [
				                  "SM01340163",
				                  "SM02070953",
				                  "SM02140120",
				                  "SM03240236",
				                  "SM03240250",
				                  "SM03240261",
				                  "SM03240262",
				                  "SM03240266",
				                  "SM03240269",
				                  "SM03240274",
				                  "SM03240284",
				                  "SM03240292",
				                  "SM03240298",
				                  "SM03240299",
				                  "SM03240305",
				                  "SM03240314",
				                  "SM03240432",
				                  "SM03240439",
				                  "SM03240442",
				                  "SM03240445",
				                  "SM03240454",
				                  "SM03240460",
				                  "SM03240478",
				                  "SM03240518",
				                  "SM03240520",
				                  "SM03240527",
				                  "SM03240528",
				                  "SM03240536",
				                  "SM03240539",
				                  "SM03240697",
				                  "SM03240879",
				                  "SM03240881",
				                  "SM03240908",
				                  "SM03240992",
				                  "SM03250001",
				                  "SM03250002",
				                  "SM03250005",
				                  "SM03250008",
				                  "SM03250009",
				                  "SM03250010",
				                  "SM03250011",
				                  "SM03250012",
				                  "SM03250013",
				                  "SM03250021",
				                  "SM03250022",
				                  "SM03260000",
				                  "SM03260001",
				                  "SM03260002",
				                  "SM03260005",
				                  "SM03260006",
				                  "SM03260008",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "Sports Courses",
				                  "he": "קורסי ספורט",
				                },
				                "Otjid": "CG00000172",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Sport Teams",
				                      "he": "קבוצות ספורט",
				                    },
				                    "Otjid": "CG00000173",
				                    "children": undefined,
				                    "courses": [
				                      "SM03940902",
				                    ],
				                  },
				                ],
				                "courses": [
				                  "SM03940800",
				                  "SM03940801",
				                  "SM03940802",
				                  "SM03940803",
				                  "SM03940804",
				                  "SM03940805",
				                  "SM03940806",
				                  "SM03940807",
				                  "SM03940808",
				                  "SM03940820",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "Choir / Orchestra",
				                  "he": "מקהלה / תזמורת",
				                },
				                "Otjid": "CG00000174",
				                "children": undefined,
				                "courses": [
				                  "SM03940582",
				                  "SM03940587",
				                ],
				              },
				            ],
				            "courses": undefined,
				          },
				          {
				            "Name": {
				              "en": "Path: Compter Science 3 Years",
				              "he": "נתיב: מדעי המחשב תלת שנתי",
				            },
				            "Otjid": "CG00006246",
				            "children": [
				              {
				                "Name": {
				                  "en": "Science Chains Collection",
				                  "he": "אוסף שרשראות מדעיות",
				                },
				                "Otjid": "CG00007018",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Science Courses",
				                      "he": "מקצועות מדעיים",
				                    },
				                    "Otjid": "CG00006977",
				                    "children": undefined,
				                    "courses": [
				                      "SM01140052",
				                      "SM01140054",
				                      "SM01140073",
				                      "SM01140075",
				                      "SM01140101",
				                      "SM01240120",
				                      "SM01240510",
				                      "SM01250001",
				                      "SM01340020",
				                      "SM01340058",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 1 - Physics Chain",
				                      "he": "רשימה 1 - רשימת פיזיקה",
				                    },
				                    "Otjid": "CG00006971",
				                    "children": [
				                      {
				                        "Name": {
				                          "en": "Mandatory options",
				                          "he": "אפשרויות בחירה בחובה",
				                        },
				                        "Otjid": "CG00006972",
				                        "children": [
				                          {
				                            "Name": {
				                              "en": "Option 1",
				                              "he": "אפשרות 1",
				                            },
				                            "Otjid": "CG00006973",
				                            "children": undefined,
				                            "courses": [
				                              "SM01140075",
				                            ],
				                          },
				                          {
				                            "Name": {
				                              "en": "Option 2",
				                              "he": "אפשרות 2",
				                            },
				                            "Otjid": "CG00006974",
				                            "children": undefined,
				                            "courses": [
				                              "SM01140052",
				                              "SM01140054",
				                            ],
				                          },
				                        ],
				                        "courses": undefined,
				                      },
				                    ],
				                    "courses": undefined,
				                  },
				                  {
				                    "Name": {
				                      "en": "List 2 - Biology Chain",
				                      "he": "רשימה 2 - שרשרת ביולוגיה",
				                    },
				                    "Otjid": "CG00006975",
				                    "children": undefined,
				                    "courses": [
				                      "SM01340020",
				                      "SM01340058",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 3 - Chemistry Chain",
				                      "he": "רשימה 3 - רשימת כימיה",
				                    },
				                    "Otjid": "CG00006976",
				                    "children": [
				                      {
				                        "Name": {
				                          "en": "Mandatory options",
				                          "he": "אפשרויות בחירה בחובה",
				                        },
				                        "Otjid": "CG00004331",
				                        "children": undefined,
				                        "courses": [
				                          "SM01240510",
				                        ],
				                      },
				                    ],
				                    "courses": [
				                      "SM01240120",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 4 - Physics & Chemistry Chain",
				                      "he": "רשימה 4 - רשימת פיזיקה וכימיה",
				                    },
				                    "Otjid": "CG00007016",
				                    "children": undefined,
				                    "courses": [
				                      "SM01140052",
				                      "SM01240120",
				                    ],
				                  },
				                ],
				                "courses": undefined,
				              },
				              {
				                "Name": {
				                  "en": "Mathematics Courses",
				                  "he": "קורסים במתמטיקה",
				                },
				                "Otjid": "CG00007050",
				                "children": undefined,
				                "courses": [
				                  "SM01040033",
				                  "SM01040122",
				                  "SM01040135",
				                  "SM01040142",
				                  "SM01040174",
				                  "SM01040285",
				                  "SM01040295",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "Mandatory",
				                  "he": "מקצועות חובה",
				                },
				                "Otjid": "CG00004775",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Mandatory Options",
				                      "he": "אפשרויות בחירה בחובה",
				                    },
				                    "Otjid": "CG00004702",
				                    "children": undefined,
				                    "courses": [
				                      "SM00440252",
				                    ],
				                  },
				                ],
				                "courses": [
				                  "SM00940412",
				                  "SM01040031",
				                  "SM01040032",
				                  "SM01040134",
				                  "SM01040166",
				                  "SM01140071",
				                  "SM02340114",
				                  "SM02340118",
				                  "SM02340123",
				                  "SM02340124",
				                  "SM02340125",
				                  "SM02340129",
				                  "SM02340141",
				                  "SM02340218",
				                  "SM02340247",
				                  "SM02340292",
				                  "SM02360343",
				                  "SM02360360",
				                  "SM03240033",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "Elective Courses - Computer Science",
				                  "he": "קורסי בחירה - מדעי המחשב",
				                },
				                "Otjid": "CG00006247",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "List B - Electives from other faculties",
				                      "he": "רשימה ב' - מקצועות מפקולטות אחרות",
				                    },
				                    "Otjid": "CG00006252",
				                    "children": undefined,
				                    "courses": [
				                      "SM00440105",
				                      "SM00440127",
				                      "SM00440131",
				                      "SM00440137",
				                      "SM00440157",
				                      "SM00440167",
				                      "SM00440169",
				                      "SM00440202",
				                      "SM00460201",
				                      "SM00460206",
				                      "SM00460332",
				                      "SM00460880",
				                      "SM00860761",
				                      "SM00940222",
				                      "SM00940314",
				                      "SM00940423",
				                      "SM00940591",
				                      "SM00960250",
				                      "SM00960411",
				                      "SM00970317",
				                      "SM01040122",
				                      "SM01040135",
				                      "SM01040142",
				                      "SM01040157",
				                      "SM01040158",
				                      "SM01040165",
				                      "SM01040174",
				                      "SM01040177",
				                      "SM01040192",
				                      "SM01040221",
				                      "SM01040279",
				                      "SM01040293",
				                      "SM01140101",
				                      "SM01150204",
				                      "SM01160217",
				                      "SM01160354",
				                      "SM01240120",
				                      "SM01240400",
				                      "SM01240503",
				                      "SM01340019",
				                      "SM01340020",
				                      "SM01340058",
				                      "SM01340082",
				                      "SM01340113",
				                      "SM01340142",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List Elective Courses",
				                      "he": "רשימת קורסי בחירה",
				                    },
				                    "Otjid": "CG00006249",
				                    "children": [
				                      {
				                        "Name": {
				                          "en": "List Projects in Computer Science",
				                          "he": "רשימת פרויקטים במדעי המחשב",
				                        },
				                        "Otjid": "CG00006250",
				                        "children": undefined,
				                        "courses": [
				                          "SM02340302",
				                          "SM02340303",
				                          "SM02340313",
				                          "SM02340326",
				                          "SM02340329",
				                          "SM02360272",
				                          "SM02360323",
				                          "SM02360328",
				                          "SM02360333",
				                          "SM02360340",
				                          "SM02360346",
				                          "SM02360349",
				                          "SM02360361",
				                          "SM02360371",
				                          "SM02360388",
				                          "SM02360502",
				                          "SM02360503",
				                          "SM02360504",
				                          "SM02360524",
				                          "SM02360729",
				                          "SM02360754",
				                          "SM02360828",
				                          "SM02360874",
				                        ],
				                      },
				                      {
				                        "Name": {
				                          "en": "List A - Elective Courses In Computer Sc",
				                          "he": "List A - Elective Courses In Computer Sc",
				                        },
				                        "Otjid": "CG00006251",
				                        "children": undefined,
				                        "courses": [
				                          "SM01040294",
				                          "SM02340291",
				                          "SM02340302",
				                          "SM02340303",
				                          "SM02340313",
				                          "SM02340326",
				                          "SM02340329",
				                          "SM02360201",
				                          "SM02360203",
				                          "SM02360216",
				                          "SM02360267",
				                          "SM02360271",
				                          "SM02360272",
				                          "SM02360299",
				                          "SM02360309",
				                          "SM02360313",
				                          "SM02360322",
				                          "SM02360323",
				                          "SM02360328",
				                          "SM02360332",
				                          "SM02360333",
				                          "SM02360334",
				                          "SM02360340",
				                          "SM02360342",
				                          "SM02360346",
				                          "SM02360349",
				                          "SM02360350",
				                          "SM02360351",
				                          "SM02360360",
				                          "SM02360361",
				                          "SM02360363",
				                          "SM02360370",
				                          "SM02360371",
				                          "SM02360374",
				                          "SM02360379",
				                          "SM02360388",
				                          "SM02360491",
				                          "SM02360501",
				                          "SM02360502",
				                          "SM02360503",
				                          "SM02360504",
				                          "SM02360521",
				                          "SM02360523",
				                          "SM02360524",
				                          "SM02360601",
				                          "SM02360608",
				                          "SM02360620",
				                          "SM02360621",
				                          "SM02360628",
				                          "SM02360634",
				                          "SM02360651",
				                          "SM02360667",
				                          "SM02360700",
				                          "SM02360703",
				                          "SM02360729",
				                          "SM02360754",
				                          "SM02360779",
				                          "SM02360780",
				                          "SM02360781",
				                          "SM02360801",
				                          "SM02360803",
				                          "SM02360813",
				                          "SM02360819",
				                          "SM02360825",
				                          "SM02360828",
				                          "SM02360833",
				                          "SM02360860",
				                          "SM02360861",
				                          "SM02360874",
				                          "SM02360927",
				                          "SM02360990",
				                          "SM02380125",
				                        ],
				                      },
				                    ],
				                    "courses": undefined,
				                  },
				                ],
				                "courses": undefined,
				              },
				            ],
				            "courses": undefined,
				          },
				          {
				            "Name": {
				              "en": "Path: Learning and analyzing information",
				              "he": "נתיב: למידה וניתוח מידע",
				            },
				            "Otjid": "CG00006253",
				            "children": [
				              {
				                "Name": {
				                  "en": "Science Chains Collection",
				                  "he": "אוסף שרשראות מדעיות",
				                },
				                "Otjid": "CG00007018",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Science Courses",
				                      "he": "מקצועות מדעיים",
				                    },
				                    "Otjid": "CG00006977",
				                    "children": undefined,
				                    "courses": [
				                      "SM01140052",
				                      "SM01140054",
				                      "SM01140073",
				                      "SM01140075",
				                      "SM01140101",
				                      "SM01240120",
				                      "SM01240510",
				                      "SM01250001",
				                      "SM01340020",
				                      "SM01340058",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 1 - Physics Chain",
				                      "he": "רשימה 1 - רשימת פיזיקה",
				                    },
				                    "Otjid": "CG00006971",
				                    "children": [
				                      {
				                        "Name": {
				                          "en": "Mandatory options",
				                          "he": "אפשרויות בחירה בחובה",
				                        },
				                        "Otjid": "CG00006972",
				                        "children": [
				                          {
				                            "Name": {
				                              "en": "Option 1",
				                              "he": "אפשרות 1",
				                            },
				                            "Otjid": "CG00006973",
				                            "children": undefined,
				                            "courses": [
				                              "SM01140075",
				                            ],
				                          },
				                          {
				                            "Name": {
				                              "en": "Option 2",
				                              "he": "אפשרות 2",
				                            },
				                            "Otjid": "CG00006974",
				                            "children": undefined,
				                            "courses": [
				                              "SM01140052",
				                              "SM01140054",
				                            ],
				                          },
				                        ],
				                        "courses": undefined,
				                      },
				                    ],
				                    "courses": undefined,
				                  },
				                  {
				                    "Name": {
				                      "en": "List 2 - Biology Chain",
				                      "he": "רשימה 2 - שרשרת ביולוגיה",
				                    },
				                    "Otjid": "CG00006975",
				                    "children": undefined,
				                    "courses": [
				                      "SM01340020",
				                      "SM01340058",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 3 - Chemistry Chain",
				                      "he": "רשימה 3 - רשימת כימיה",
				                    },
				                    "Otjid": "CG00006976",
				                    "children": [
				                      {
				                        "Name": {
				                          "en": "Mandatory options",
				                          "he": "אפשרויות בחירה בחובה",
				                        },
				                        "Otjid": "CG00004331",
				                        "children": undefined,
				                        "courses": [
				                          "SM01240510",
				                        ],
				                      },
				                    ],
				                    "courses": [
				                      "SM01240120",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List 4 - Physics & Chemistry Chain",
				                      "he": "רשימה 4 - רשימת פיזיקה וכימיה",
				                    },
				                    "Otjid": "CG00007016",
				                    "children": undefined,
				                    "courses": [
				                      "SM01140052",
				                      "SM01240120",
				                    ],
				                  },
				                ],
				                "courses": undefined,
				              },
				              {
				                "Name": {
				                  "en": "Mandatory",
				                  "he": "מקצועות חובה",
				                },
				                "Otjid": "CG00004777",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Mandatory Options",
				                      "he": "אפשרויות בחירה בחובה",
				                    },
				                    "Otjid": "CG00004702",
				                    "children": undefined,
				                    "courses": [
				                      "SM00440252",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "Mandatory Options",
				                      "he": "Mandatory Options",
				                    },
				                    "Otjid": "CG00008215",
				                    "children": undefined,
				                    "courses": [
				                      "SM01040134",
				                      "SM01040174",
				                    ],
				                  },
				                ],
				                "courses": [
				                  "SM00940412",
				                  "SM01040031",
				                  "SM01040032",
				                  "SM01040166",
				                  "SM01140071",
				                  "SM02340114",
				                  "SM02340118",
				                  "SM02340123",
				                  "SM02340124",
				                  "SM02340125",
				                  "SM02340129",
				                  "SM02340141",
				                  "SM02340218",
				                  "SM02340247",
				                  "SM02340292",
				                  "SM02360201",
				                  "SM02360343",
				                  "SM03240033",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "List Collection - Learning and analyzing",
				                  "he": "מקצועות בחירה - המגמה ללמידה וניתוח מידע",
				                },
				                "Otjid": "CG00008289",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Core Courses List",
				                      "he": "רשימת קורסי ליבה",
				                    },
				                    "Otjid": "CG00004779",
				                    "children": undefined,
				                    "courses": [
				                      "SM00940423",
				                      "SM02360299",
				                      "SM02360363",
				                      "SM02360370",
				                      "SM02360501",
				                      "SM02360667",
				                      "SM02360781",
				                      "SM02360860",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List Projects in Computer Science",
				                      "he": "רשימת פרויקטים במדעי המחשב",
				                    },
				                    "Otjid": "CG00006250",
				                    "children": undefined,
				                    "courses": [
				                      "SM02340302",
				                      "SM02340303",
				                      "SM02340313",
				                      "SM02340326",
				                      "SM02340329",
				                      "SM02360272",
				                      "SM02360323",
				                      "SM02360328",
				                      "SM02360333",
				                      "SM02360340",
				                      "SM02360346",
				                      "SM02360349",
				                      "SM02360361",
				                      "SM02360371",
				                      "SM02360388",
				                      "SM02360502",
				                      "SM02360503",
				                      "SM02360504",
				                      "SM02360524",
				                      "SM02360729",
				                      "SM02360754",
				                      "SM02360828",
				                      "SM02360874",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List A - Elective Courses In Computer Sc",
				                      "he": "List A - Elective Courses In Computer Sc",
				                    },
				                    "Otjid": "CG00006251",
				                    "children": undefined,
				                    "courses": [
				                      "SM01040294",
				                      "SM02340291",
				                      "SM02340302",
				                      "SM02340303",
				                      "SM02340313",
				                      "SM02340326",
				                      "SM02340329",
				                      "SM02360201",
				                      "SM02360203",
				                      "SM02360216",
				                      "SM02360267",
				                      "SM02360271",
				                      "SM02360272",
				                      "SM02360299",
				                      "SM02360309",
				                      "SM02360313",
				                      "SM02360322",
				                      "SM02360323",
				                      "SM02360328",
				                      "SM02360332",
				                      "SM02360333",
				                      "SM02360334",
				                      "SM02360340",
				                      "SM02360342",
				                      "SM02360346",
				                      "SM02360349",
				                      "SM02360350",
				                      "SM02360351",
				                      "SM02360360",
				                      "SM02360361",
				                      "SM02360363",
				                      "SM02360370",
				                      "SM02360371",
				                      "SM02360374",
				                      "SM02360379",
				                      "SM02360388",
				                      "SM02360491",
				                      "SM02360501",
				                      "SM02360502",
				                      "SM02360503",
				                      "SM02360504",
				                      "SM02360521",
				                      "SM02360523",
				                      "SM02360524",
				                      "SM02360601",
				                      "SM02360608",
				                      "SM02360620",
				                      "SM02360621",
				                      "SM02360628",
				                      "SM02360634",
				                      "SM02360651",
				                      "SM02360667",
				                      "SM02360700",
				                      "SM02360703",
				                      "SM02360729",
				                      "SM02360754",
				                      "SM02360779",
				                      "SM02360780",
				                      "SM02360781",
				                      "SM02360801",
				                      "SM02360803",
				                      "SM02360813",
				                      "SM02360819",
				                      "SM02360825",
				                      "SM02360828",
				                      "SM02360833",
				                      "SM02360860",
				                      "SM02360861",
				                      "SM02360874",
				                      "SM02360927",
				                      "SM02360990",
				                      "SM02380125",
				                    ],
				                  },
				                ],
				                "courses": undefined,
				              },
				            ],
				            "courses": undefined,
				          },
				          {
				            "Name": {
				              "en": "Path: Computer Science and Bioinformatic",
				              "he": "Path: Computer Science and Bioinformatic",
				            },
				            "Otjid": "CG00006222",
				            "children": [
				              {
				                "Name": {
				                  "en": "Elective lists Biology",
				                  "he": "Elective lists Biology",
				                },
				                "Otjid": "CG00006255",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "List A - Biology",
				                      "he": "List A - Biology",
				                    },
				                    "Otjid": "CG00006256",
				                    "children": undefined,
				                    "courses": [
				                      "SM01340082",
				                      "SM01340133",
				                      "SM01340142",
				                    ],
				                  },
				                  {
				                    "Name": {
				                      "en": "List B- Biology",
				                      "he": "List B- Biology",
				                    },
				                    "Otjid": "CG00006257",
				                    "children": undefined,
				                    "courses": [
				                      "SM00660529",
				                      "SM01340082",
				                      "SM01340113",
				                      "SM01340133",
				                      "SM01340142",
				                      "SM01340156",
				                    ],
				                  },
				                ],
				                "courses": undefined,
				              },
				              {
				                "Name": {
				                  "en": "List A - Elective Courses In Computer Sc",
				                  "he": "List A - Elective Courses In Computer Sc",
				                },
				                "Otjid": "CG00006251",
				                "children": undefined,
				                "courses": [
				                  "SM01040294",
				                  "SM02340291",
				                  "SM02340302",
				                  "SM02340303",
				                  "SM02340313",
				                  "SM02340326",
				                  "SM02340329",
				                  "SM02360201",
				                  "SM02360203",
				                  "SM02360216",
				                  "SM02360267",
				                  "SM02360271",
				                  "SM02360272",
				                  "SM02360299",
				                  "SM02360309",
				                  "SM02360313",
				                  "SM02360322",
				                  "SM02360323",
				                  "SM02360328",
				                  "SM02360332",
				                  "SM02360333",
				                  "SM02360334",
				                  "SM02360340",
				                  "SM02360342",
				                  "SM02360346",
				                  "SM02360349",
				                  "SM02360350",
				                  "SM02360351",
				                  "SM02360360",
				                  "SM02360361",
				                  "SM02360363",
				                  "SM02360370",
				                  "SM02360371",
				                  "SM02360374",
				                  "SM02360379",
				                  "SM02360388",
				                  "SM02360491",
				                  "SM02360501",
				                  "SM02360502",
				                  "SM02360503",
				                  "SM02360504",
				                  "SM02360521",
				                  "SM02360523",
				                  "SM02360524",
				                  "SM02360601",
				                  "SM02360608",
				                  "SM02360620",
				                  "SM02360621",
				                  "SM02360628",
				                  "SM02360634",
				                  "SM02360651",
				                  "SM02360667",
				                  "SM02360700",
				                  "SM02360703",
				                  "SM02360729",
				                  "SM02360754",
				                  "SM02360779",
				                  "SM02360780",
				                  "SM02360781",
				                  "SM02360801",
				                  "SM02360803",
				                  "SM02360813",
				                  "SM02360819",
				                  "SM02360825",
				                  "SM02360828",
				                  "SM02360833",
				                  "SM02360860",
				                  "SM02360861",
				                  "SM02360874",
				                  "SM02360927",
				                  "SM02360990",
				                  "SM02380125",
				                ],
				              },
				              {
				                "Name": {
				                  "en": "Mandatory",
				                  "he": "Mandatory",
				                },
				                "Otjid": "CG00006223",
				                "children": [
				                  {
				                    "Name": {
				                      "en": "Mandatory Options",
				                      "he": "אפשרויות בחירה בחובה",
				                    },
				                    "Otjid": "CG00004702",
				                    "children": undefined,
				                    "courses": [
				                      "SM00440252",
				                    ],
				                  },
				                ],
				                "courses": [
				                  "SM00940412",
				                  "SM00940423",
				                  "SM01040031",
				                  "SM01040032",
				                  "SM01040134",
				                  "SM01040166",
				                  "SM01140071",
				                  "SM01340019",
				                  "SM01340020",
				                  "SM01340058",
				                  "SM01340082",
				                  "SM01340113",
				                  "SM02340114",
				                  "SM02340118",
				                  "SM02340123",
				                  "SM02340124",
				                  "SM02340129",
				                  "SM02340141",
				                  "SM02340218",
				                  "SM02340247",
				                  "SM02340292",
				                  "SM02360523",
				                  "SM02360524",
				                  "SM03240033",
				                ],
				              },
				            ],
				            "courses": undefined,
				          },
				        ],
				        "courses": undefined,
				      },
				    ],
				    "courses": undefined,
				  },
				]
			`);
		});
	}
);
