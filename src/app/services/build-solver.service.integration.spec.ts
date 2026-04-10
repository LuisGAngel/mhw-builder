/**
 * Integration tests for BuildSolverService using real game data.
 *
 * These tests load the actual TSV/JSON asset files via HTTP (served by Karma)
 * and test the solver algorithm against the full MHW dataset.
 */
import { BuildSolverService } from './build-solver.service';
import { DataService } from './data.service';
import { AppDataProvider } from '../providers/app-data.provider';
import { AppDataModel } from '../models/app-data.model';
import { ItemModel } from '../models/item.model';
import { DecorationModel } from '../models/decoration.model';
import { SkillModel } from '../models/skill.model';
import { SolverInputModel } from '../models/solver-input.model';
import { EquipmentCategoryType } from '../types/equipment-category.type';
import { ItemType } from '../types/item.type';
import { ColumnParser } from '../data/models/column-parser.model';
import { SkillReferencesParser } from '../data/parsers/skill-references.parser';
import { SlotsParser } from '../data/parsers/slots.parser';
import { ValuesParser } from '../data/parsers/values.parser';
import { TagsParser } from '../data/parsers/tags.parser';

// ---------------------------------------------------------------------------
// Helpers: replicate DataLoader.parseTextContent for direct file loading
// ---------------------------------------------------------------------------
const DELIMITER = '\t';

function parseTsv<T>(content: string, columnParsers: ColumnParser[] = []): T[] {
	const result: T[] = [];
	const rows = content.split('\n');
	const headerColumns = rows[0].split(DELIMITER);

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row || !row.trim()) continue;
		const rowValues = row.split(DELIMITER);
		const item: any = {};

		for (let j = 0; j < rowValues.length; j++) {
			const columnHeader = headerColumns[j];
			if (!columnHeader) continue;
			const rowValue = rowValues[j];

			const columnParser = columnParsers.find(p => p.columnName === columnHeader);
			if (columnParser) {
				item[columnHeader] = columnParser.parser.parse(rowValue);
			} else if (rowValue) {
				if (!Number.isNaN(Number(rowValue)) && rowValue !== '') {
					item[columnHeader] = Number(rowValue);
				} else if (rowValue.toLowerCase() === 'true' || rowValue.toLowerCase() === 'false') {
					item[columnHeader] = rowValue === 'true';
				} else {
					item[columnHeader] = rowValue;
				}
			}
		}

		result.push(item as T);
	}

	return result;
}

async function fetchText(url: string): Promise<string> {
	const resp = await fetch(url);
	return resp.text();
}

async function fetchJson<T>(url: string): Promise<T> {
	const resp = await fetch(url);
	return resp.json();
}

async function loadArmor(): Promise<ItemModel[]> {
	const content = await fetchText('/assets/armor.tsv');
	const items = parseTsv<ItemModel>(content, [
		{ columnName: 'defense', parser: new ValuesParser() },
		{ columnName: 'slots', parser: new SlotsParser() },
		{ columnName: 'tags', parser: new TagsParser() },
		{ columnName: 'skills', parser: new SkillReferencesParser() },
	]);
	items.forEach(item => { item.equipmentCategory = EquipmentCategoryType.Armor; });
	return items;
}

async function loadDecorations(): Promise<DecorationModel[]> {
	const content = await fetchText('/assets/decorations.tsv');
	return parseTsv<DecorationModel>(content, [
		{ columnName: 'skills', parser: new SkillReferencesParser() },
	]);
}

async function loadCharms(): Promise<ItemModel[]> {
	const content = await fetchText('/assets/charms.tsv');
	const items = parseTsv<ItemModel>(content, [
		{ columnName: 'slots', parser: new SlotsParser() },
		{ columnName: 'tags', parser: new TagsParser() },
		{ columnName: 'skills', parser: new SkillReferencesParser() },
	]);
	items.forEach(item => {
		item.itemType = ItemType.Charm;
		item.equipmentCategory = EquipmentCategoryType.Charm;
	});
	return items;
}

async function loadSkills(): Promise<SkillModel[]> {
	return fetchJson<SkillModel[]>('/assets/skills.json');
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('BuildSolverService (integration with real data)', () => {
	let service: BuildSolverService;
	let dataService: DataService;
	let appData: AppDataModel;

	beforeAll(async () => {
		// Load all real game data once
		appData = new AppDataModel();
		appData.armors = await loadArmor();
		appData.decorations = await loadDecorations();
		appData.charms = await loadCharms();
		appData.skills = await loadSkills();

		// Create a mock AppDataProvider that holds the real data
		const mockProvider = { appData } as AppDataProvider;
		dataService = new DataService(mockProvider);
		service = new BuildSolverService(dataService);
	});

	it('should load real game data successfully', () => {
		expect(appData.armors.length).toBeGreaterThan(100);
		expect(appData.decorations.length).toBeGreaterThan(100);
		expect(appData.charms.length).toBeGreaterThan(10);
		expect(appData.skills.length).toBeGreaterThan(10);
	});

	it('should have armor pieces with skills and slots', () => {
		const withSkills = appData.armors.filter(a => a.skills && a.skills.length > 0);
		const withSlots = appData.armors.filter(a => a.slots && a.slots.length > 0);
		expect(withSkills.length).toBeGreaterThan(100);
		expect(withSlots.length).toBeGreaterThan(50);
	});

	describe('basic searches with real data', () => {
		it('should find builds for Attack Boost Lv7 with R11-R12 armor', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 7 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				const skill = result.totalSkills.find(s => s.id === 'attackBoost');
				expect(skill).toBeTruthy();
				expect(skill.level).toBeGreaterThanOrEqual(7);
			}
		});

		it('should find builds for Critical Eye Lv3 with R11-R12 armor', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'criticalEye', level: 3 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				const skill = result.totalSkills.find(s => s.id === 'criticalEye');
				expect(skill).toBeTruthy();
				expect(skill.level).toBeGreaterThanOrEqual(3);
			}
		});

		it('should find builds for Weakness Exploit Lv3', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'weaknessExploit', level: 3 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe('multi-skill searches', () => {
		it('should find builds with Attack Boost 4 + Critical Eye 3', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [
					{ id: 'attackBoost', level: 4 },
					{ id: 'criticalEye', level: 3 }
				],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				const attack = result.totalSkills.find(s => s.id === 'attackBoost');
				const crit = result.totalSkills.find(s => s.id === 'criticalEye');
				expect(attack).toBeTruthy();
				expect(attack.level).toBeGreaterThanOrEqual(4);
				expect(crit).toBeTruthy();
				expect(crit.level).toBeGreaterThanOrEqual(3);
			}
		});

		it('should find builds with Weakness Exploit 3 + Critical Boost 3', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [
					{ id: 'weaknessExploit', level: 3 },
					{ id: 'criticalBoost', level: 3 }
				],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe('search with charm', () => {
		it('should find builds using a real charm', () => {
			// Find an Attack Boost charm from real data
			const attackCharm = appData.charms.find(c =>
				c.skills && c.skills.some(s => s.id === 'attackBoost')
			);
			expect(attackCharm).toBeTruthy('No Attack Boost charm found in data');

			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 7 }],
				charmId: attackCharm.id,
				charmLevel: attackCharm.levels || 1,
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.charm).toBeTruthy();
			}
		});
	});

	describe('search with weapon slots', () => {
		it('should find more results with weapon slots', () => {
			const baseInput: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 7 }],
				maxResults: 20
			};

			const withoutWeapon = service.solve(baseInput);
			const withWeapon = service.solve({
				...baseInput,
				weaponSlots: [3, 2, 1]
			});

			expect(withWeapon.length).toBeGreaterThanOrEqual(withoutWeapon.length);
		});
	});

	describe('performance and crash prevention', () => {
		it('should log candidate counts for debugging', () => {
			// Check how many candidates per slot for a broad search
			const armorSlots = [ItemType.Head, ItemType.Chest, ItemType.Arms, ItemType.Waist, ItemType.Legs];
			for (const type of armorSlots) {
				const all = dataService.getArmorByType(type);
				const r9to12 = all.filter(a => [9, 10, 11, 12].includes(a.rarity));
				const r11to12 = all.filter(a => [11, 12].includes(a.rarity));
				// Just log counts — high counts = slow solver
				console.log(`${type}: total=${all.length}, R9-12=${r9to12.length}, R11-12=${r11to12.length}`);
			}
			expect(true).toBeTruthy();
		});

		it('should complete a broad search without crashing (R9-R12, easy skill)', () => {
			const input: SolverInputModel = {
				rarities: [9, 10, 11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 4 }],
				maxResults: 10
			};

			const start = Date.now();
			const results = service.solve(input);
			const elapsed = Date.now() - start;

			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
			// Should complete in a reasonable time (under 30 seconds)
			expect(elapsed).toBeLessThan(30000);
		});

		it('should complete a narrow impossible search without hanging', () => {
			const input: SolverInputModel = {
				rarities: [9, 10, 11, 12],
				requiredSkills: [{ id: 'nonExistentSkill', level: 1 }],
				maxResults: 10
			};

			const start = Date.now();
			const results = service.solve(input);
			const elapsed = Date.now() - start;

			expect(results.length).toBe(0);
			// An impossible search should prune quickly
			expect(elapsed).toBeLessThan(5000);
		});

		it('should handle a complex multi-skill search across all rarities without crashing', () => {
			const input: SolverInputModel = {
				rarities: [9, 10, 11, 12],
				requiredSkills: [
					{ id: 'attackBoost', level: 4 },
					{ id: 'criticalEye', level: 4 },
					{ id: 'weaknessExploit', level: 3 }
				],
				maxResults: 5
			};

			const start = Date.now();
			let results: any[];
			expect(() => {
				results = service.solve(input);
			}).not.toThrow();
			const elapsed = Date.now() - start;

			expect(results).toBeDefined();
			expect(elapsed).toBeLessThan(60000);
		});

		it('should handle maxResults=1 efficiently (stop early)', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 3 }],
				maxResults: 1
			};

			const start = Date.now();
			const results = service.solve(input);
			const elapsed = Date.now() - start;

			expect(results.length).toBe(1);
			expect(elapsed).toBeLessThan(5000);
		});

		it('should not crash with all 4 rarities and a very common skill', () => {
			// This tests the combinatorial explosion scenario
			const input: SolverInputModel = {
				rarities: [9, 10, 11, 12],
				requiredSkills: [{ id: 'healthBoost', level: 3 }],
				maxResults: 10
			};

			const start = Date.now();
			let results: any[];
			expect(() => {
				results = service.solve(input);
			}).not.toThrow();
			const elapsed = Date.now() - start;

			expect(results).toBeDefined();
			expect(elapsed).toBeLessThan(60000);
		});

		it('should respect iteration budget and return partial results for huge search space', () => {
			// A very broad search with a common low-level skill across all rarities
			// Without the iteration budget, this would hang the browser
			const input: SolverInputModel = {
				rarities: [9, 10, 11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 1 }],
				maxResults: 100
			};

			const start = Date.now();
			const results = service.solve(input);
			const elapsed = Date.now() - start;

			expect(results).toBeDefined();
			expect(results.length).toBeGreaterThan(0);
			// Must finish in reasonable time regardless of search space size
			expect(elapsed).toBeLessThan(10000);
		});
	});

	describe('result correctness', () => {
		it('should produce results with valid armor piece types', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 3 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.head.itemType).toBe(ItemType.Head);
				expect(result.chest.itemType).toBe(ItemType.Chest);
				expect(result.arms.itemType).toBe(ItemType.Arms);
				expect(result.waist.itemType).toBe(ItemType.Waist);
				expect(result.legs.itemType).toBe(ItemType.Legs);
			}
		});

		it('should not assign decorations to slots that are too small', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 7 }],
				maxResults: 5
			};

			const results = service.solve(input);
			for (const result of results) {
				for (const da of result.decorations) {
					expect(da.slotSize).toBeGreaterThanOrEqual(da.decoration.level);
				}
			}
		});

		it('should produce correct totalDefense values', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attackBoost', level: 3 }],
				maxResults: 3
			};

			const results = service.solve(input);
			for (const result of results) {
				let expected = 0;
				const pieces = [result.head, result.chest, result.arms, result.waist, result.legs];
				for (const piece of pieces) {
					if (piece.defense && piece.defense.length > 0) {
						expected += piece.defense[0];
					}
				}
				expect(result.totalDefense).toBe(expected);
			}
		});
	});
});
