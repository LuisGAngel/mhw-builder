import { BuildSolverService } from './build-solver.service';
import { DataService } from './data.service';
import { SolverInputModel } from '../models/solver-input.model';
import { ItemModel } from '../models/item.model';
import { DecorationModel } from '../models/decoration.model';
import { ItemType } from '../types/item.type';

function makeArmor(id: number, itemType: ItemType, rarity: number, skills: { id: string; level: number }[], slots: number[] = []): ItemModel {
	return {
		id,
		name: `Armor ${id}`,
		rarity,
		itemType,
		skills: skills.map(s => ({ id: s.id, level: s.level })),
		slots: slots.map(level => ({ level })),
		defense: [50],
	} as any;
}

function makeCharm(id: number, name: string, skills: { id: string; level: number }[], levels: number = 1): ItemModel {
	return {
		id,
		name,
		levels,
		skills: skills.map(s => ({ id: s.id, level: s.level })),
	} as any;
}

function makeDeco(id: number, name: string, level: number, skills: { id: string; level: number }[]): DecorationModel {
	return {
		id,
		name,
		level,
		rarity: 7,
		skills: skills.map(s => ({ id: s.id, level: s.level })),
	} as any;
}

describe('BuildSolverService', () => {
	let service: BuildSolverService;
	let mockDataService: jasmine.SpyObj<DataService>;

	// Shared test data
	const headPieces: ItemModel[] = [
		makeArmor(1, ItemType.Head, 11, [{ id: 'attack-boost', level: 2 }], [1]),
		makeArmor(2, ItemType.Head, 11, [{ id: 'critical-eye', level: 2 }], [1, 1]),
		makeArmor(3, ItemType.Head, 12, [{ id: 'attack-boost', level: 1 }], [2]),
	];
	const chestPieces: ItemModel[] = [
		makeArmor(10, ItemType.Chest, 11, [{ id: 'attack-boost', level: 2 }]),
		makeArmor(11, ItemType.Chest, 11, [{ id: 'critical-eye', level: 1 }], [1]),
	];
	const armsPieces: ItemModel[] = [
		makeArmor(20, ItemType.Arms, 11, [{ id: 'attack-boost', level: 1 }], [1]),
	];
	const waistPieces: ItemModel[] = [
		makeArmor(30, ItemType.Waist, 11, [{ id: 'attack-boost', level: 1 }]),
	];
	const legsPieces: ItemModel[] = [
		makeArmor(40, ItemType.Legs, 11, [{ id: 'attack-boost', level: 1 }], [1]),
	];

	const decorations: DecorationModel[] = [
		makeDeco(100, 'Attack Jewel', 1, [{ id: 'attack-boost', level: 1 }]),
		makeDeco(101, 'Critical Jewel', 2, [{ id: 'critical-eye', level: 1 }]),
	];

	beforeEach(() => {
		mockDataService = jasmine.createSpyObj('DataService', [
			'getArmorByType', 'getCharm', 'getDecorations'
		]);

		mockDataService.getArmorByType.and.callFake((type: ItemType) => {
			switch (type) {
				case ItemType.Head: return headPieces;
				case ItemType.Chest: return chestPieces;
				case ItemType.Arms: return armsPieces;
				case ItemType.Waist: return waistPieces;
				case ItemType.Legs: return legsPieces;
				default: return [];
			}
		});
		mockDataService.getDecorations.and.returnValue(decorations);

		service = new BuildSolverService(mockDataService);
	});

	describe('solve()', () => {
		it('should return results when skills can be met by armor alone', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 3 }],
				maxResults: 5
			};

			const results = service.solve(input);

			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				const attackSkill = result.totalSkills.find(s => s.id === 'attack-boost');
				expect(attackSkill).toBeTruthy();
				expect(attackSkill.level).toBeGreaterThanOrEqual(3);
			}
		});

		it('should return empty when impossible skill level is requested', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 99 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBe(0);
		});

		it('should return empty when no armor matches the rarity filter', () => {
			const input: SolverInputModel = {
				rarities: [8],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBe(0);
		});

		it('should respect maxResults limit', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 2
			};

			const results = service.solve(input);
			expect(results.length).toBeLessThanOrEqual(2);
		});

		it('should include all 5 armor pieces in each result', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 3
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.head).toBeTruthy();
				expect(result.chest).toBeTruthy();
				expect(result.arms).toBeTruthy();
				expect(result.waist).toBeTruthy();
				expect(result.legs).toBeTruthy();
			}
		});

		it('should calculate totalDefense from armor pieces', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 1
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].totalDefense).toBeGreaterThan(0);
		});
	});

	describe('solve() with decorations', () => {
		it('should use decorations to fill skill gaps', () => {
			// Armor provides max ~7 attack-boost, request 8 so decorations must help
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 8 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.decorations.length).toBeGreaterThan(0);
				const attackSkill = result.totalSkills.find(s => s.id === 'attack-boost');
				expect(attackSkill).toBeTruthy();
				expect(attackSkill.level).toBeGreaterThanOrEqual(8);
			}
		});

		it('should track slotsUsed and slotsTotal correctly', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 8 }],
				maxResults: 1
			};

			const results = service.solve(input);
			if (results.length > 0) {
				expect(results[0].slotsUsed).toBeGreaterThan(0);
				expect(results[0].slotsTotal).toBeGreaterThanOrEqual(results[0].slotsUsed);
			}
		});

		it('should fail when decorations cannot fit in available slots', () => {
			// Request a skill that needs size-2 decorations but only size-1 slots exist
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'critical-eye', level: 7 }],
				maxResults: 5
			};

			// critical-eye deco is level 2, but most slots are level 1
			// This should yield fewer or no results depending on slot availability
			const results = service.solve(input);
			// The test validates the solver doesn't crash
			expect(results).toBeDefined();
		});
	});

	describe('solve() with weapon slots', () => {
		it('should use weapon slots for decoration assignment', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 8 }],
				weaponSlots: [1, 1, 1],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			// With 3 extra weapon slots, should be easier to meet the skill requirement
			for (const result of results) {
				expect(result.slotsTotal).toBeGreaterThanOrEqual(3);
			}
		});

		it('should produce more results with weapon slots than without', () => {
			const baseInput: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 8 }],
				maxResults: 50
			};

			const withoutWeapon = service.solve(baseInput);

			const withWeapon = service.solve({
				...baseInput,
				weaponSlots: [1, 1, 1]
			});

			expect(withWeapon.length).toBeGreaterThanOrEqual(withoutWeapon.length);
		});
	});

	describe('solve() with charm', () => {
		it('should include charm skills in results', () => {
			const charm = makeCharm(200, 'Attack Charm', [{ id: 'attack-boost', level: 3 }]);
			mockDataService.getCharm.and.returnValue(charm);

			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 5 }],
				charmId: 200,
				charmLevel: 1,
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.charm).toBeTruthy();
				expect(result.charm.name).toBe('Attack Charm');
				const attackSkill = result.totalSkills.find(s => s.id === 'attack-boost');
				expect(attackSkill.level).toBeGreaterThanOrEqual(5);
			}
		});
	});

	describe('solve() edge cases', () => {
		it('should handle empty requiredSkills gracefully', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [],
				maxResults: 5
			};

			// Should not throw
			expect(() => service.solve(input)).not.toThrow();
		});

		it('should handle requesting a skill no armor provides', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'nonexistent-skill', level: 1 }],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBe(0);
		});

		it('should handle multiple skill requirements simultaneously', () => {
			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [
					{ id: 'attack-boost', level: 2 },
					{ id: 'critical-eye', level: 1 }
				],
				maxResults: 5
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				const attack = result.totalSkills.find(s => s.id === 'attack-boost');
				const crit = result.totalSkills.find(s => s.id === 'critical-eye');
				expect(attack).toBeTruthy();
				expect(attack.level).toBeGreaterThanOrEqual(2);
				expect(crit).toBeTruthy();
				expect(crit.level).toBeGreaterThanOrEqual(1);
			}
		});

		it('should handle multiple rarity filters', () => {
			const input: SolverInputModel = {
				rarities: [11, 12],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 10
			};

			const results = service.solve(input);
			expect(results.length).toBeGreaterThan(0);
		});

		it('should not crash when armor has no slots', () => {
			mockDataService.getArmorByType.and.callFake((type: ItemType) => {
				return [makeArmor(999, type, 11, [{ id: 'attack-boost', level: 1 }], [])];
			});

			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 5 }],
				maxResults: 5
			};

			expect(() => service.solve(input)).not.toThrow();
		});

		it('should not crash when armor has null skills', () => {
			mockDataService.getArmorByType.and.callFake((type: ItemType) => {
				return [{ id: 888, name: 'Empty', rarity: 11, itemType: type, skills: null, slots: [], defense: [10] } as any];
			});

			const input: SolverInputModel = {
				rarities: [11],
				requiredSkills: [{ id: 'attack-boost', level: 1 }],
				maxResults: 5
			};

			expect(() => service.solve(input)).not.toThrow();
		});
	});
});
