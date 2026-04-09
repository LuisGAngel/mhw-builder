# MHW Build Solver — Implementation Plan

## Goal

Given a set of inputs (rarity filter, required skills), return all valid armor + decoration combinations that satisfy the constraints. Prioritize skills from armor first, then fill remaining requirements with decorations.

## Research: Armor First, Then Decorations

Armor pieces first, then decorations is the standard strategy used by MHW optimizers. The reasoning:

- Armor pieces provide **both** skills **and** decoration slots
- Decorations can only be placed into slots that armor provides
- The number and size of available slots depends entirely on which armor you choose
- Armor skills are "free" (no opportunity cost), while decorations consume limited slot space
- Therefore: maximize skills from armor, then fill remaining requirements with decorations

## Data Scale & Feasibility

| Metric | Value |
|---|---|
| Total armor pieces | 789 (5 types × ~158 each) |
| Rarity 11+12 per slot | ~79 pieces → **3 billion** brute-force combos |
| Rarity 12 only per slot | ~41 pieces → **113 million** combos |
| Decorations | 412 (58 size-1, 29 size-2, 13 size-3, 312 size-4) |
| Charms | 106 |
| Skill format | `skillId-level` semicolon-separated on each piece |
| Slot format | Semicolon-separated sizes (e.g., `4;1` = one size-4 + one size-1 slot) |

3 billion combinations is too large for brute force, but with aggressive pruning the search becomes very tractable.

### Pruning Strategy

1. **Pre-filter by rarity** — reduces to 40-80 pieces per slot
2. **Pre-filter per slot type** — only keep pieces that contribute at least one requested skill. For niche skills like Speed Eating, maybe 3-5 pieces per slot have it → the search space collapses dramatically
3. **Include "wildcard" pieces** — pieces with 0 target skills but large decoration slots (β+ pieces) are worth keeping for their slot capacity
4. **Early termination per branch** — while iterating Head→Chest→Arms→Waist→Legs, if accumulated skills + max possible from remaining slots can't meet the target, prune that branch
5. **Decoration feasibility check** — after picking 5 armor pieces, verify remaining skill gaps can be filled by decorations that fit available slots (a simple greedy bin-packing)

With pruning, typical searches should evaluate thousands to tens of thousands of combinations, not billions.

## Inputs

| Input | Required | Description |
|---|---|---|
| Rarity list | Yes | e.g., `[11, 12]` — only consider armor of these rarities |
| Required skills | Yes | e.g., `[{id: 'speedEating', level: 2}, {id: 'stunResistance', level: 3}]` |
| Weapon slots | No | Weapon decoration slot sizes (adds to available slot budget) |
| Charm | No | If specified, its skills are subtracted from requirements |
| Max results | No | Cap on number of valid results returned (default 50) |

## Outputs

Each result contains:

- 5 armor pieces (Head, Chest, Arms, Waist, Legs)
- Optional charm
- Decoration assignments (which decoration goes in which slot)
- Total skills summary (all skills the build provides, not just requested ones)
- Total defense
- Slot usage (used vs total)

---

## Phase 1: Solver Models

**Files:** `src/app/models/solver-input.model.ts`, `src/app/models/solver-result.model.ts`

```ts
interface SolverInput {
  rarities: number[];
  requiredSkills: SkillRequirement[];   // { id: string, level: number }
  weaponSlots?: number[];
  charmId?: number;
  charmLevel?: number;
  maxResults?: number;                  // default 50
}

interface SolverResult {
  head: ItemModel;
  chest: ItemModel;
  arms: ItemModel;
  waist: ItemModel;
  legs: ItemModel;
  charm?: ItemModel;
  decorations: DecorationAssignment[];  // { slotSource: ItemType, decoration: DecorationModel }
  totalSkills: SkillSummary[];
  totalDefense: number;
  slotsUsed: number;
  slotsTotal: number;
}
```

**Complexity:** Low

## Phase 2: Solver Core Service

**File:** `src/app/services/build-solver.service.ts`

### Step 2a — Pre-filtering

1. Filter armor by allowed rarities via `DataService`
2. Group by item type (Head / Chest / Arms / Waist / Legs)
3. For each group, keep:
   - Pieces with ≥1 target skill ("skill-relevant")
   - Pieces with 0 target skills but large slot capacity ("wildcard / β+ pieces")
4. Load all decorations that grant requested skills
5. If charm specified, compute its skill contribution and reduce target requirements

### Step 2b — Recursive Backtracking Search

```
search(slotIndex, accumulatedSkills, accumulatedSlots):
  if slotIndex == 5:
    return decorationCheck(accumulatedSkills, accumulatedSlots)
  for piece in candidates[slotIndex]:
    newSkills = merge(accumulatedSkills, piece.skills)
    newSlots = merge(accumulatedSlots, piece.slots)
    if canPossiblyMeetTarget(newSkills, remaining slots):
      search(slotIndex + 1, newSkills, newSlots)
```

- Order: Head → Chest → Arms → Waist → Legs
- At each level, tracks cumulative skills and remaining slot capacity
- **Prune** branches where `skills_so_far + max_possible_remaining < target`
- Collect valid results up to `maxResults`

### Step 2c — Decoration Assignment Check

After selecting 5 armor pieces:

1. Compute remaining skill requirements after armor + charm
2. For each remaining skill need, find the smallest decoration that provides it
3. Sort available slots descending by size, sort decoration needs descending by jewel size
4. Greedily assign decorations to slots (a decoration of size N fits any slot ≥ N)
5. If all remaining skills satisfied → valid build; otherwise → reject

This is O(slots × skills) — negligible cost.

**Complexity:** High (core logic)

## Phase 3: Unit Tests

Test the solver against known-good builds:

- Simple case: 1 skill at level 1 with wide rarity filter → many results
- Tight case: 3+ skills that require specific pieces → few results
- Impossible case: incompatible skills/rarity → 0 results
- Decoration-dependent case: skills not available on armor, must come from decorations
- Charm case: charm satisfies part of the requirements, reducing armor constraints

**Complexity:** Medium

## Phase 4: UI Component

**Directory:** `src/app/components/build-solver/`

- Multi-select rarity checkboxes (9, 10, 11, 12)
- Skill search/add list (autocomplete from `DataService.getSkills()`) with level spinner
- Optional charm selector dropdown
- "Search" button → calls `BuildSolverService`
- Results table showing each valid combination with armor pieces, decorations, and total skills
- Click a result → load it into the existing builder via `SlotService` events

**Complexity:** Medium

## Phase 5: Integration

- Register `BuildSolverService` in `app.module.ts`
- Add the solver component to the app layout (new tab/section)
- Wire result selection to populate the existing build slots via `SlotService`

**Complexity:** Low

---

## Execution Order

| Step | Deliverable | Depends On |
|---|---|---|
| 1 | Solver input/result models | — |
| 2 | `BuildSolverService` (pre-filter + search + decoration check) | Step 1 |
| 3 | Unit tests for solver | Step 2 |
| 4 | UI component for inputs and results | Step 2 |
| 5 | Integration with existing build system | Steps 2, 4 |
