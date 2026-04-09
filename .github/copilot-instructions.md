# MHW Builder - Copilot Instructions

This is a Monster Hunter World armor/build planner built with Angular (TypeScript + SCSS).

## Project Structure

- **Angular app** bootstrapped from `src/main.ts`, module in `src/app/app.module.ts`
- **Components** live under `src/app/components/` (item-slot, weapon-list, armor-list, decoration-list, charm-list, kinsect-list, etc.)
- **Services** live under `src/app/services/` and `src/app/providers/`
- **Models** live under `src/app/models/` (runtime models) and `src/app/data/models/` (data-layer models)
- **Data loaders** live under `src/app/data/loaders/` — each loader extends `DataLoader<T>`
- **Data parsers** live under `src/app/data/parsers/` — column-level parsers for TSV files
- **Static game data** lives under `src/assets/` as `.tsv` and `.json` files

## Data Architecture

### Asset Files (`src/assets/`)

| File | Format | Contents |
|---|---|---|
| `weapons.tsv` | TSV | Weapon stats: id, weaponType, rarity, name, baseAttack, baseAffinityPercent, defense, element, ailment, sharpness, slots, skills, etc. |
| `weapons-kulve.tsv` | TSV | Same schema as weapons.tsv but for Kulve Taroth weapons |
| `armor.tsv` | TSV | Armor: id, itemType (Head/Chest/Arms/Waist/Legs), rarity, name, defense, elemental resists, skills, slots, tags |
| `charms.tsv` | TSV | Charms: id, rarity, name, levels, skills |
| `decorations.tsv` | TSV | Decorations: id, rarity, level (jewel size 1–4), priority, name, skills |
| `kinsects.tsv` | TSV | Kinsects: id, rarity, name, attackType, dustEffect, power, speed, heal, elementPower |
| `tools.tsv` | TSV | Mantles/tools with slots |
| `melodies.tsv` | TSV | Hunting Horn melodies: notes, melodies, melodiesEffect |
| `melody-effect.tsv` | TSV | Melody effect descriptions |
| `skills.json` | JSON | Skill definitions with per-level stat bonuses (passiveAttack, passiveAffinity, etc.) |
| `set-bonuses.json` | JSON | Set bonus definitions: piece thresholds linked to skill ids |
| `augmentations.json` | JSON | Augmentation options with per-level stat bonuses |
| `awakenings.json` | JSON | Safi'jiiva awakening options |
| `modifications.json` | JSON | Bowgun/bow mod definitions |
| `upgrades.json` | JSON | Custom upgrade level data |
| `weapon-modifiers.json` | JSON | Per-weapon-type attack multipliers |
| `sharpness-modifiers.json` | JSON | Sharpness color multipliers |
| `ammo-capacities.json` | JSON | Bowgun ammo capacity tables |

### Data Loading Pipeline

All loaders extend `DataLoader<T>` (in `src/app/data/loaders/data.loader.ts`):
- **TSV files**: fetched via `HttpClient`, rows split by `\t`, then run through typed column parsers (`SkillReferencesParser`, `SlotsParser`, `TagsParser`, `ValuesParser`, `OtherDataParser`, `MelodiesParser`, `MelodiesEffectParser`)
- **JSON files**: fetched directly via `http.get`, optionally merged with locale overrides using lodash `assignIn`
- Locale is read from `localStorage['locale']` or `navigator.languages[0]`

`AppDataProvider` (`src/app/providers/app-data.provider.ts`) runs all loaders in **two sequential `Promise.all` batches** at startup:
1. Batch 1 (critical): weapons, armors, charms, decorations, augmentations, modifications, kinsects, skills, set-bonuses, sharpness-modifiers
2. Batch 2 (deferred): weapon-modifiers, ammo-capacities, melodies, melody-effect, tools, upgrades, awakenings

The result is stored in the singleton `AppDataModel`.

### Key Models (`src/app/models/`)

- **`AppDataModel`** — top-level container: `weapons[]`, `armors[]`, `charms[]`, `tools[]`, `decorations[]`, `skills[]`, `setBonuses[]`, `augmentations[]`, `modifications[]`, `kinsects[]`, `ammoCapacities[]`, `melodies[]`, `melodyEffect[]`, `upgrades[]`, `awakenings[]`, `weaponModifiers[]`, `sharpnessModifiers[]`
- **`BuildModel`** — URL-hash-serializable build. Only stores IDs. Slots: `weapon`, `head`, `chest`, `hands`, `legs`, `feet`, `charm`, `tool1`, `tool2` — each a `BuildItemModel`
- **`BuildItemModel`** — `itemId`, `decorationIds[]`, `augmentationIds[]`, `upgradeLevels[]`, `kinsectId`, `awakenings[][]`, `modificationIds[]`, `setbonusId`, `level`, `elementId`, `ailmentId`
- **`ItemModel`** — unified model for weapons/armor/charms/tools. Has common fields (id, name, rarity, itemType, equipmentCategory, slots, skills, tags, active) plus weapon-specific (weaponType, baseAttack, sharpness, element, ailment, etc.) and armor-specific (resist values)
- **`DecorationModel`** — `id`, `name`, `level` (jewel size), `rarity`, `priority`, `skills: SkillReferenceModel[]`. At runtime gains `itemId`/`itemType` to track which slot it belongs to

### Services

| Service | Role |
|---|---|
| `DataService` | Typed getters over `AppDataModel` (e.g., `getWeapons()`, `getDecorations(level?)`, `getSkill()`) |
| `SlotService` | Holds all slot component refs; emits RxJS `Subject`s for user interactions (`itemSelected$`, `decorationSelected$`, etc.) |
| `EquipmentService` | Runtime state: live arrays of `items[]`, `decorations[]`, `augmentations[]`, `awakenings[]`, `modifications[]`, `kinsect` |
| `SkillService` | Aggregates skills from all equipped items/decorations/augmentations into `EquippedSkillModel[]` and `EquippedSetBonusModel[]` |
| `StatService` + `CalculationService` | Full stat computation from equipped gear. Produces attack/defense calcs, sharpness bar, extra data |
| `BuildService` | Serializes/deserializes builds to/from URL hash (`#v3i...`). Subscribes to slot events for auto-update |
| `SetService` | Persists named build sets to `localStorage['mhwSets']` as `SavedSetModel[]` |
| `TooltipService` | Manages hover tooltips for items/decorations/skills |

### Data Flow

```
Assets (TSV/JSON)
  → DataLoader<T> (HTTP fetch + parse)
    → AppDataProvider.load() [two Promise.all batches]
      → AppDataModel singleton
        → DataService (typed getters)
          → UI List Components (weapon-list, armor-list, decoration-list, etc.)
            → User picks item/decoration/augmentation
              → SlotService Subject events
                → EquipmentService (live equipment arrays)
                  → SkillService.updateSkills()
                    → StatService.update()
                      → CalculationService (math)
                        → statsUpdated$ → UI stat panels
                → BuildService.updateBuildId() → URL hash
```

### Build Persistence

- **Active build**: serialized as a URL hash string (`#v3i...`) containing only IDs
- **Saved sets**: stored in `localStorage['mhwSets']` via `SetService`
- Everything is reconstructed at load time by looking up IDs against the in-memory `AppDataModel`

## Conventions

- TSV column parsers are in `src/app/data/parsers/` and implement `DataParser<T>`
- Equipment categories: `Weapon`, `Armor`, `Charm`, `Tool`
- Item types for armor: `Head`, `Chest`, `Arms`, `Waist`, `Legs`
- Decoration `level` = jewel size (1–4), matched against slot sizes on equipment
- Skills are referenced by `SkillReferenceModel` (skill ID + level) throughout the codebase
