> Execute inline (no sub-agents in this repo). Each step is one reviewable change set; steps use
> checkbox (`- [ ]`) syntax for tracking. Finish every step with `bun fix` and the listed checks.
> Revised 2026-09-29 (fifth revision, after the review the same evening): the stored model is
> `<field>_override` columns, `NULL` = inherit; see "Decisions" and "Steps 1–4 as built".

**Goal:** Let branch settings and subjects flow down the branch tree so that a school or a chain
(Sonans, Akademiet, Ullern) defines each thing once, while every branch always shows where a
value comes from.

**Architecture:** One tree with one root (`Boklisten.no AS`), two layer branches under it
(`Privatist`, `VGS`) and the schools below. Two kinds of inheritance:

- _Scalars are overrides that resolve upward on read._ Each inherited field is stored as
  `<field>_override`: the branch's own value, or `NULL` to inherit the parent's value in force. A
  root always holds a value (check constraint). An override is sticky: whatever changes above,
  the branch keeps it until an admin clears it, even when it happens to equal the parent's.
  Every read through the `Branch` model resolves the values in force over the ancestor chain
  (recursive CTE in an `afterFind`/`afterFetch` hook), and the getters named after the fields
  (`branch.visibility`, …) return them, so no reader changed. The period lists become one such
  unit in Step 5.
- _Subjects are national, offerings are per branch._ A `subjects` registry holds each subject
  name once. A branch _offers_ a subject by choosing books for it. A branch sees every ancestor's
  offerings plus its own, and the nearest offering of a subject wins for that subtree. Nothing is
  hidden: a branch can add or replace, never remove.

One pure resolver in `backend/shared/branch-inheritance.ts` (`resolveInherited`, `descendantIds`,
`overridingDescendants`, `followers`) is used by the model hooks, the migration's `down()` logic
and the frontend, so there is one rule. Nothing in the tree is locked; a child may always
override.

**Tech stack:** AdonisJS 7 + Lucid on Postgres (recursive CTEs, check constraints, advisory
locks), TanStack Start + Mantine v9, Japa/Chai tests, Playwright for UI verification.

## Glossary (use these words, and only these, in code, copy and commits)

| Term        | Meaning                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| value       | The value in force of a field at a branch (`visibility`, `deliveryByMail`, …), what every reader uses. Readers never change.                            |
| override    | What the branch stores in `<field>_override`: its own value, or `NULL` to inherit. Sticky: survives every change above.                                 |
| inherited   | The override is `NULL`: the branch follows the parent's value in force. UI "Arvet fra X".                                                               |
| overridden  | The override is set: the branch's own value, equal to the parent's or not. UI "Overstyrt" (never "deviating").                                          |
| source      | The nearest overriding ancestor (or the root); the branch itself when it overrides.                                                                     |
| followers   | The descendants that take a branch's value through an unbroken chain of `NULL`s, i.e. the ones a change here reaches ("Arves av K av N underfilialer"). |
| layer       | One of the three fixed branches `Boklisten.no AS`, `Privatist`, `VGS` (Step 6).                                                                         |
| container   | A branch with children but no members and no own offerings (Sonans, Akademiet, Ullern VG1). It exists to hold shared values.                            |
| subject     | A national entry in `subjects` ("Spansk 1"). Has a name and nothing else.                                                                               |
| offering    | A row in `branch_subjects`: this branch offers this subject with these books and flags, optionally under an external (upload) name.                     |
| replacing   | An own offering of a subject an ancestor also offers. UI word: "Erstatter valget fra X". (The word "shadow" is not used anywhere.)                      |
| upload name | `externalName ?? subject.name`; what the fagvalg CSV is matched against.                                                                                |

Norwegian UI words: overridden = "Overstyrt" (with ↺ "Arv fra X"); inherited = "Arvet fra X";
followers = "Arves av alle underfilialer" / "Arves av K av N underfilialer" / "Arves av ingen
underfilialer" (always shown under a field with branches below; it opens the tree); reset
descendants = "Tilbakestill alle" (confirm "Tilbakestill <felt> i underfilialer");
every confirm button = "Bekreft"; hoist = "Flytt til X".

## Decisions (two interviews on 2026-09-28; do not re-open without Adrian)

- Override model (fifth revision, 2026-09-29, replaces both the `_own` and the derived model):
  `<field>_override` columns, `NULL` = inherit, resolved on read. An override is sticky: "when a
  value is overridden no change in the parent affects it", and "an overridden descendant can
  carry the same value as a parent, that is fine" (Adrian). The derived model was dropped because
  a parent edit dragging every equal-valued child along felt wrong. `POST inherit_below` clears
  every descendant's override; a `PATCH` with `null` clears one.
- Provenance is always visible, directly under the control (never in a header slot on the
  right: on a wide screen that sat 700 px from the control): the way up, "Arvet fra X" (link)
  when inherited or "Overstyrt ↺" (tooltip "Arv fra X") when overridden; and the way down, on every field
  with branches below, "Arves av alle / K av N / ingen underfilialer" (the followers, i.e. how
  far a change here reaches; orange when a value is decoration). That line is the only way into
  the descendant tree (the grape header button was dropped 2026-09-29). Nobody walks the tree by
  hand.
- No locks/clamps anywhere (GitLab-style "enforce for all subgroups" was considered and rejected).
- Inherited scalars: `visibility`, `deliveryAtBranch`, `deliveryByMail`, `paymentResponsible`,
  `responsibleForDelivery`, `buyoutPercentage`, `sellPercentage`, and the three period lists as
  one unit. Percentages inherit separately from the periods (Sonans Drammen has 0.33 with the
  same periods as its siblings). `name`, `localName`, `childLabel`, `logo`, `region`, `address`
  are never inherited.
- `branches.type` (vgs/privatist) is dropped. The `Privatist` and `VGS` layers replace it; the
  payment form shows all three period lists for every branch (an empty list means "not offered").
- Creating a branch (revised 2026-09-29): the create form has no parent picker; a new branch is a
  root with the column defaults as own values and is placed under a parent on the Relasjoner tab
  afterwards (it keeps its own values when moved). The API still accepts `parentBranchId` on
  create, so a client that sends one gets a branch that inherits everything.
- Re-parenting keeps every override and re-resolves the `NULL`s under the new parent, so an
  inherited value may change while an overridden one never does (Step 11 confirms with the values
  in force that change).
- Editing is direct (Google Workspace model): every control is editable and shows the effective
  value; saving a change makes it own. There is no "Overstyr" mode.
- Orderable online = `public` AND at least one _own_ subject book. This is what the code does
  today and it stays: classes under Ullern VG1 ST do not enter the public picker or the catalog.
  Kasse and the fagvalg upload use effective offerings.
- Subjects are national (registry), because staging shows the same 30 subjects in 20–33 branches
  each, spelled up to four ways. The root does _not_ hold "all possible books"; the book picker
  suggests what other branches use for the subject, derived at read time.
- Existing duplicated offerings are hoisted by a reviewed command (identical across all children
  → parent). The rule stays strict; the report names the child that blocks each hoist (Akademiet
  Ålesund offers 2 subjects, so Akademiet cannot hoist until an admin adds an intermediate layer
  such as "Akademiet Stor-Oslo").
- No inherit/override toggle: editing a control stores an override, the ↺ next to "Overstyrt"
  stores `NULL`. Single-branch actions (edit, ↺, a row in the tree) never confirm; they are one
  request and undone by one click. Actions that rewrite other branches ("Tilbakestill alle")
  confirm with a Filial | Fra | Til table (decided in the 2026-09-29 review).
- One control per field wherever it appears: the percentage is a whole-percent number field both
  in the card and in the tree (the slider is gone), the four flags a switch, visibility a
  segmented control in the card and a select in a tree row (the only exception, for width).
- Auto-save everywhere on existing entities (pattern already on the Fag tab). See "Global
  constraints".

**Why override columns plus getters rather than own/effective pairs or a view:** thirteen service
files already read `branch.visibility`, `branch.rentPeriods` and friends. Keeping the field names
as getters that return the resolved value, with the override in a renamed column, leaves every
reader, validator and the pricing code unchanged; the ancestor chain is at most four rows and the
whole tree is 115 rows, so resolving in a hook is cheap. `visibleByName` and `orderableByName`
filter in JS for the same reason.

## Staging facts (verified 2026-09-28; do not re-query, update this list if they change)

- 115 branches, 16 roots, max depth 3. Roots with children: Akademiet (11), Sonans (12), Ullern
  videregående skole (5 → 21 → 34 classes), Wang (3), Wang Romerike (6), Wang Ringerike (1),
  Otto Treider (3), Metis (3).
- Container roots have `type = null`, no periods, and column defaults (`deliveryAtBranch` on,
  `deliveryByMail` on, both percentages 1.00) that differ from every child. Nothing inherits
  until Step 6 consolidates.
- Sonans: 9 campuses with 40–42 offerings each, 32 of 44 subject names identical across all 9;
  3 admin-only campuses (Lillestrøm, Sandvika, Ski) with 0 offerings and 2023 period dates.
- Akademiet: 10 campuses with 29–36 offerings, Ålesund with 2. Akademiet NAV Oslo overrides
  all three delivery/payment flags.
- Ullern: subjects live on programme branches (VG1 ST 12, VG2 ST 25, VG3 ST 30 …). VG1 ST is
  `admin`, its 8 classes are `public` with 0 offerings, 0 periods, column-default scalars.
  Classes must stay visible so students can pick them at signup; visibility is therefore excluded
  from consolidation.
- Subjects: 1236 offering rows, 152 distinct normalised names, 65 singletons, 0 external names.
  "Historie" has 11 distinct book sets across 32 branches; "Psykologi 1" has 2 across 31.
- Readers of `type`: `BranchPaymentSettings.tsx` (which lists to show), `info/branch/route.tsx`
  (privatist filter), validators, fixtures, four spec files. Nothing in the backend branches on it.
- `Fri privatist` is hard-linked by id in `SelectOrderBranch.tsx`.

## Global constraints

- Node 24 for backend commands (`fnm exec --using=24 …`); `bun run test`, never `bun test`.
- Imports via `#services/*`, `#models/*`, `#shared/*`; never relative `../../app`.
- Migrations: `cd backend && fnm exec --using=24 node ace migration:run` against staging
  regenerates `database/schema.ts`; the test DB needs `NODE_ENV=test node ace migration:run`
  as well. Next free timestamps: `1792200000000` and up, one per step below.
- `backend/.adonisjs/client/` is generated and committed; regenerate after route/response changes
  by booting the backend dev server once (`generateRegistry` hook in `adonisrc.ts`).
- Every branch write runs inside `Branch.whileLocked(work)`: a transaction holding
  `pg_advisory_xact_lock(hashtext('branches:tree'))` (mirror `Order.whileLocked` in
  `app/models/order.ts`). Two concurrent writes would otherwise each recompute from their own
  snapshot and the later commit could persist stale effective values.
- **Auto-save:** forms on existing entities have no "Lagre" button. Text and number fields save
  on blur, switches/segmented controls/selects/chips save on change, list add/remove saves at
  once. Saves go through one queue, are skipped when the body is unchanged, show one toast with a
  fixed id, and forget the last body on failure so the next change retries. The form's default
  values come from a snapshot taken when the editor opened, never from the live query, so the
  refetch after a save cannot reset what the admin is typing. Step 3 extracts this from
  `BranchSubjectEditor.tsx` into `frontend/src/shared/hooks/useAutoSave.ts`; every later form
  uses the hook. Creation forms keep an explicit "Opprett" button.
- **Confirm dialogs:** `modals.openConfirmModal` (precedent: `BranchMembers.tsx`) before every
  action that deletes rows, changes _several_ other branches' values, or moves data:
  "Tilbakestill alle", removing a period, deleting or moving an offering, renaming a subject
  nationally, re-parenting a branch. Single-branch inheritance actions (edit, ↺, one tree row) do
  not confirm. The dialog shows exactly what changes as a Filial | Fra | Til table and names the
  branches; the confirm button is "Bekreft" (decided 2026-09-29 after trying imperative labels),
  the cancel button "Avbryt". A reset that changes nothing needs no dialog.
- Norwegian UI copy: imperative labels, no trailing period on labels, sentences end with a
  period. Copy in this plan is final unless it reads wrong on screen.
- In-page admin links use the shared `EntityLink` (inherit colour, bold, underline on hover).
- Search params added to admin routes must not collide with names used by other routes.
- No new git branches, no commits, no extra docs files from these steps unless asked.
- Verify UI on 1440 px and 375 px with Playwright before ticking a UI checkbox.

## Review focus

Inputs the design implies but that are easy to break. Each one names the step that owns its test.

1. A root with a `NULL` override must be impossible (check constraint + `E_ROOT_CANNOT_INHERIT`
   422 from `applyOverrides`). Step 2.
2. Re-parenting keeps overrides and re-resolves the `NULL`s under the new parent; a branch that
   becomes a root first gets its values in force written as overrides (`keepValuesInForce`).
   Step 2.
3. A child that inherits `admin` visibility must still be shown to its own member (`?include=`)
   and remain assignable via `updateMe`. Step 2.
4. Consolidation never changes the effective value of a branch that is not a container; the
   report proves it with a count. Step 6.
5. The registry migration merges only the names in its reviewed merge table and fails on any
   name it has not seen. Step 7.
6. Catalog and `orderableByName` use own offerings for the gate and effective offerings for the
   content; Kasse `listingAt` and the upload use effective offerings. Step 8.
7. Two ancestors offering the same subject: the nearest wins, and the branch's own offering wins
   over both. The upload resolves the same way as Kasse. Step 8.

---

## Steps 1–4 as built (2026-09-28/29, override model)

The steps below were planned with `<field>_own` columns, rewritten once to a derived model and
then to the override model that exists now. What exists:

**Storage and backend**

- Migration `1792200000000_branch_inherited_overrides.ts`: renames the seven columns to
  `<column>_override`, drops NOT NULL and the default, sets a child's override to `NULL` where it
  equalled its parent's value at migration time, and adds `branches_<column>_override_at_root`
  (`parent_branch_id IS NOT NULL OR <column>_override IS NOT NULL`). `down()` resolves the values
  back with a recursive CTE and renames the columns back.
- `backend/shared/branch-inheritance.ts`: `INHERITED_BRANCH_FIELDS` (the seven scalars),
  `InheritanceInput { id, parentBranchId, override }`, `resolveInherited` (value in force and
  `sourceId` per branch; throws on a partial tree or an inheriting root), `descendantIds`,
  `overridingDescendants`, `followers`; spec `backend/tests/branch_inheritance.spec.ts`.
- `backend/app/models/branch.ts`: `visibilityOverride` and friends are the columns;
  `afterFind`/`afterFetch` run `resolveInheritedValues` (one recursive query over the ancestor
  chain, through the row's `$trx` so a write reads back what it wrote); getters `visibility`,
  `deliveryByMail`, … return the value in force and throw if the hook did not run; `overrides`
  returns the seven stored values; `whileLocked(work)` runs `work` in a transaction holding
  `pg_advisory_xact_lock(hashtext('branches:tree'))` (never nest); `overrideColumn(field)` maps a
  field to its column. `visibleByName`/`orderableByName` filter in JS.
- `backend/shared/branch.ts`: the DTO carries the values in force under the field names plus
  `overrides: InheritedOverrides` (`{ [field]: T | null }`); `InheritedValues` and
  `InheritedOverrides` are the two shapes.
- `backend/app/services/branch_inheritance_service.ts`: `ROOT_VALUES` (what a new root holds:
  `employee`, both deliveries on, both responsibilities off, both percentages 1),
  `overrideColumns(overrides)` (the model attributes that store them, used by every writer and
  the fixtures), `applyOverrides(branch, changes)` (stores as given, 422 `E_ROOT_CANNOT_INHERIT`
  for `null` at a root), `keepValuesInForce(trx, ids)` (before a branch becomes a root: its
  values in force become its overrides, one update per branch), `inheritBelow(branchId, field)`
  (clears the override on every descendant, behind `POST /branches/:branchId/inherit_below
{ field }`, validator `branchInheritBelowValidator`, client `api.branches.inheritBelow`; the
  controller reads the branch back with `findOrFail`, which is the 404).
- `backend/app/services/branch_service.ts`: `createBranch({ parentBranchId })` (under a parent
  every override is `NULL`, at the root `ROOT_VALUES`), `updateBranch` splits the body into
  plain columns and overrides (`PATCH` accepts each inherited field as value or `null`),
  `updateBranchRelationships` calls `keepValuesInForce` for the branch when it moves to root and
  for children that are dropped from the list. Every write runs in `Branch.whileLocked`.
- Tests: `branch_service.spec.ts` (override, inherit, root refusal, re-parent, inherit_below),
  `branch_model.spec.ts`, fixtures take values in force (`FIXTURE_ROOT_VALUES` at a root).

**Frontend (`frontend/src/features/branches/inheritance/`)**

- `useInheritedField(branchId, field, draft, pending)` resolves the field over the loaded branch
  list with the shared resolver, applying the form's unsaved override (`draft`) and the overrides
  of rows being saved from the tree (`pending`). Returns `{ branch, value, override, parent
(with its value), inherited, descendants: DescendantInheritance[] (localName, parent, value,
parentValue, overridden), descendantCount, followingCount }`.
- `inheritedFields.tsx`: `INHERITED_FIELDS[field] = { label, formatValue, renderEditor }`.
  `formatValue` is the value as text ("På"/"Av", "33 %", "Offentlig") for confirm tables;
  `renderEditor(value, onChange, { label, tone, size })` is the compact control used in a tree
  row (`xs`) and, for percentages, in the card too (`sm`): `ToneSwitch`, `VisibilitySelect`,
  `PercentageInput` (whole percent, commits on blur/Enter).
- `tone.tsx`: `InheritanceTone` = `own` (blue) | `inherited` (a switch that is on fills with faded
  `blue.3`, never grey because grey reads as disabled; a text field or select keeps the default
  frame with dimmed text) | `plain` (a branch outside any tree); `toneColor`,
  `toneInputStyles`, `ToneSwitch` (own-off keeps the grey track inside a 2 px full-blue ring, the switch's counterpart of the own text field's blue frame; a tinted track read as a faded on, a blue thumb dot was rejected).
- `InheritedFieldCard` (usage `<InheritedFieldCard branchId field tab value={override}
onChange={setOverride} description?>{(value, setValue, tone) => control}</InheritedFieldCard>`):
  plain `Stack`, no border. A 2 px margin bar left of the label, blue while overridden. Header
  = the label alone; nothing sits on its right (decided 2026-09-29: a right-hand slot was 700
  px from the control on a desktop). Body: the control, always editable with the value in force,
  then the optional dimmed description, then up to two xs lines. The way up: blue
  `IconBuildingStore` "Overstyrt" + the ↺ `ActionIcon` of the tree rows (tooltip "Arv fra <parent>", = `onChange(null)`, no confirm)
  when overridden, dimmed `IconArrowUp` "Arvet fra <parent>" (the parent's short name, "VG1", as
  the picker shows it; the whole line, icon included, is one link to the parent's same tab) when
  inherited, nothing at a root. The
  way down, on every field with branches below: one grape link with `IconHierarchy3`, "Arves av
  alle underfilialer" / "Arves av K av N underfilialer" (K = followers) / orange "Arves av ingen
  underfilialer"; it opens the tree and there is no other button for it. Both icon links underline
  under their icon too on hover (`InheritedFieldCard.module.css`, a bottom border, since text
  decoration skips an svg).
- `DescendantTree` (in a `Modal`, full screen on a phone): the branch being edited heads it, the
  branches below follow under their short names; every row = chevron | name (link, closes the
  modal) | the field's compact control | ↺ when overridden. Guide line blue beside overriding
  rows, grey elsewhere; a node starts expanded iff an override sits somewhere below it (kept
  after the review: the tree opens down to every override and no further). Rows below are saved
  by the card (`PATCH` per row, `pending` until the refetch); the root row goes through the
  form. Modal title holds "Tilbakestill alle" (only when some descendant overrides) → confirm
  "Tilbakestill <felt> i underfilialer" with "Alle N underfilialer arver <felt> fra <branch>.
  Disse endres:" and a Filial | Fra | Til table of the overriding descendants, "Bekreft" → `POST
inherit_below`; the modal stays open and the tree remounts.
- `VisibilitySelect` (`branchVisibility.tsx`): `leftSectionPointerEvents="none"` so the icon
  opens the dropdown, and a cancelled second mousedown so a double click does not select the
  value text (`user-select: none` is ignored on inputs).
- `useAutoSave` (`frontend/src/shared/hooks/useAutoSave.ts`) shared by the Fag, Generelt and
  Betaling tabs; the Betaling tab auto-saves everything, period removal confirms ("Bekreft").
- Used on the Generelt tab (visibility) and the Betaling tab (four switches, two percentages).
  The Generelt tab's five plain fields are one `withFieldGroup` (`BranchGeneralFields`) shared by
  the editor and the create form, like `SubjectFields`.

**Adding an inherited scalar:** a migration that adds `<column>_override` with the root check,
the field in `INHERITED_BRANCH_FIELDS`, a `declare <field>Override` + getter + entry in
`overrides` on the model, an entry in `ROOT_VALUES`, `.nullable()` in the PATCH validator, an
entry in `INHERITED_FIELDS` (label, `formatValue`, `renderEditor`), and a card in the form.

**Rejected on the way** (do not propose again): bare dimmed captions under the control, "Angitt
her", scope sentences, a "Bruk samme som X" button, status pills/badges/chips, a switch inside
the pill, Paper/Fieldset, collapse/accordion per card, a disabled control, a fourth "Arv"
segment, a "Verdi" sub-label, an inline overrides list, a read-only preview, "Bruk for alle
under" as the bulk label, imperative confirm labels, grey for inherited controls, a grape tree
button in the header (replaced by the always-present followers line), a slider for
the percentages, "never equal to the parent" (auto-clearing equal overrides), carry-down on
write, `<field>_own` columns.

Original step texts follow for the record; their checkboxes reflect the outcome.

## Step 1: The rule as a pure function (groundwork, no schema change)

**Goal:** Write the scalar inheritance rule once, as data-in data-out code shared by backend and
frontend, with tests that double as the specification. Nothing user-visible changes.

**Files:**

- Create: `backend/shared/branch-inheritance.ts`
- Create: `backend/tests/branch_inheritance.spec.ts`

**Interface:**

```ts
// backend/shared/branch-inheritance.ts
export const INHERITED_BRANCH_FIELDS = [
  "visibility",
  "deliveryAtBranch",
  "deliveryByMail",
  "paymentResponsible",
  "responsibleForDelivery",
  "buyoutPercentage",
  "sellPercentage",
  "periods", // the three lists as one unit; the value is the source branch id (Step 5)
] as const;
export type InheritedBranchField = (typeof INHERITED_BRANCH_FIELDS)[number];

/** A branch as the resolver sees it: its parent and what the admin set (`null` = inherit). */
export interface InheritanceInput<T> {
  id: string;
  parentBranchId: string | null;
  own: T | null;
}

export interface Resolved<T> {
  id: string;
  /** The value in force at this branch. */
  effective: T;
  /** The branch whose own value is in force; equals `id` when set here. */
  sourceId: string;
}

/**
 * Resolves one field for every branch, top-down from the roots. Throws when a root has `own ===
 * null` or when a parent is missing from the input, because both mean the caller loaded a partial
 * tree.
 */
export function resolveInherited<T>(branches: InheritanceInput<T>[]): Map<string, Resolved<T>>;

/** The descendants of `branchId` whose own value is set, i.e. those that deviate from it. */
export function deviatingDescendants<T>(
  branches: InheritanceInput<T>[],
  branchId: string,
): string[];
```

**Tests (Chai, no DB):** root value flows to grandchildren; a child that sets its own value wins
for its subtree only; `sourceId` is the nearest ancestor that set a value; a root with `null`
throws; a missing parent throws; `deviatingDescendants` lists only set descendants at any depth;
the input order does not matter.

**Done when:** `cd backend && bun run test --files tests/branch_inheritance.spec.ts` passes and
`bun fix` is clean.

- [x] Resolver and tests written
- [x] `bun fix` clean

## Step 2: Inherit one field end to end: visibility

**Goal:** Establish storage, the write path, the lock and the create-with-parent flow on the
smallest field. After this step the API can express "same as parent" for visibility and the
effective value is always correct. The admin UI still shows the old segmented control (it reads
the effective value, so nothing breaks).

**Files:**

- Create: `backend/database/migrations/1792200000000_branch_visibility_own.ts`
- Create: `backend/app/services/branch_inheritance_service.ts`
- Modify: `backend/database/schema.ts` (regenerated)
- Modify: `backend/app/models/branch.ts` (`visibilityOwn: BranchVisibility | null`, `toDto`,
  `whileLocked`)
- Modify: `backend/shared/branch.ts` (`visibilityOwn` on the DTO with doc comment "`null` = same
  as parent; `visibility` is the value in force")
- Modify: `backend/app/validators/branch.ts` (update: accept `visibilityOwn`, drop `visibility`;
  create: `parentBranchId: objectIdField.nullable()`)
- Modify: `backend/app/services/branch_service.ts` (see below)
- Modify: `backend/tests/branch_fixtures.ts` (`visibilityOwn` defaults to the visibility passed)
- Modify: `backend/tests/branch_service.spec.ts`, `backend/tests/branch_model.spec.ts`
- Modify: `frontend/src/features/branches/BranchGeneralSettings.tsx` (submit `visibilityOwn`
  instead of `visibility`; UI otherwise unchanged until Step 3)

**Migration:**

```ts
this.schema.alterTable("branches", (table) => {
  table.string("visibility_own", 8).nullable();
});
this.defer(async (db) => {
  await db.rawQuery(`UPDATE branches SET visibility_own = visibility`);
  await db.rawQuery(`ALTER TABLE branches ADD CONSTRAINT branches_visibility_own_root_check
    CHECK (parent_branch_id IS NOT NULL OR visibility_own IS NOT NULL)`);
  await db.rawQuery(`ALTER TABLE branches ADD CONSTRAINT branches_visibility_own_check
    CHECK (visibility_own IN ('public','employee','admin'))`);
});
```

**Service interfaces (used by every later scalar step):**

```ts
// backend/app/models/branch.ts
/** Runs `work` in a transaction holding the tree lock; every branch write goes through here. */
static whileLocked<T>(work: (trx: TransactionClientContract) => Promise<T>): Promise<T>;

// backend/app/services/branch_inheritance_service.ts
/**
 * Loads the whole tree inside `trx`, resolves every field in INHERITED_BRANCH_FIELDS with
 * `resolveInherited`, and writes back the effective columns that changed. Called at the end of
 * every branch write. Idempotent. Throws BadRequestException("Filialen er øverst i treet og må ha
 * en egen verdi for <label>") before the constraint fires.
 */
export async function recomputeInheritedFields(trx: TransactionClientContract): Promise<void>;
/** Sets the own column of `field` to null on every descendant of `branchId`, then recomputes. */
export async function inheritBelow(branchId: string, field: InheritedBranchField): Promise<void>;
```

`branch_service.ts` changes: `createBranch` takes `parentBranchId: string | null`; with a parent,
every own column that exists so far is `null`; without, the column defaults are the own values.
`updateBranch`, `updateBranchRelationships` and `createBranch` run inside `Branch.whileLocked`
and end with `recomputeInheritedFields`. `updateBranchRelationships` must, before saving
`parentBranchId: null`, copy each effective value into its `null` own column.

**Tests:** setting a child's `visibilityOwn` to `null` makes its `visibility` equal the parent's;
changing the parent's own value updates grandchildren in the same transaction; a root with
`visibilityOwn: null` is rejected with the readable message; moving a subtree under an `admin`
parent hides it; moving an inheriting branch to root copies the effective value; creating with a
parent yields `visibilityOwn: null` and the parent's effective visibility; creating without a
parent yields the default as own. Existing `visibleByName` tests keep passing untouched, which is
the proof that readers did not change.

**Verify in the browser:** set Sonans Lillestrøm to `visibilityOwn: null` through the form, flip
Sonans to `employee`, confirm `GET /branches` as a guest no longer lists Lillestrøm while a member
of Lillestrøm still sees it via `?include=`.

- [x] Migration run on staging and on the test DB, `schema.ts` regenerated
- [x] Lock, service, create-with-parent, tests
- [x] Form submits `visibilityOwn`
- [x] `bun fix` clean

## Step 3: The UI paradigm, on visibility only

**Goal:** Build the reusable presentation once (inherited-field caption, reset actions, apply-below
dialog, auto-save hook, parent picker) on the one field that supports it, and iterate on it here
before it spreads to seven more places. Use the `frontend-design` skill.

**Files:**

- Create: `frontend/src/shared/hooks/useAutoSave.ts` (extracted from `BranchSubjectEditor.tsx`,
  which then uses it; behaviour unchanged there)
- Create: `frontend/src/features/branches/inheritance/InheritedFieldCaption.tsx`
- Create: `frontend/src/features/branches/inheritance/useBranchInheritance.ts` (wraps
  `resolveInherited` and `deviatingDescendants` from `@boklisten/backend/shared/branch-inheritance`
  over the already-loaded `api.branches.index` list; returns per field `{ effective, own,
source: { id, name }, deviating: { id, name }[] }`)
- Create: `frontend/src/features/branches/inheritance/ApplyBelowModal.tsx`
- Modify: `frontend/src/features/branches/BranchGeneralSettings.tsx` (auto-save, caption on
  visibility, parent picker in create mode using `toBranchTreeNodeData` from
  `shared/utils/branchTree.ts`, no "Lagre" button in edit mode)
- Modify: `frontend/src/features/branches/BranchManager.tsx` (the "Opprett filial" modal passes
  the selected branch as the default parent)
- Modify: `backend/start/routes.ts`, `backend/app/controllers/branches/branches_controller.ts`
  (`POST /branches/:branchId/inherit_below` with body `{ field: InheritedBranchField }`)
- Test: `backend/tests/branch_service.spec.ts` (`inheritBelow` resets only descendants)

**Presentation (as planned; superseded by "Steps 1–4 as built" above):**

- The control is always editable and shows the effective value. Under it, one quiet caption line:
  inherited → "Arvet fra Sonans" (name is an `EntityLink` to that branch's same tab); own with a
  parent → "Angitt her" followed by a subtle button "Bruk samme som Sonans"; own at a root →
  "Angitt her".
- Changing the control saves the own value (auto-save). "Bruk samme som Sonans" saves `null`;
  when the effective value would change it first confirms: "Synlighet endres fra Ansatte til
  Offentlig." / confirm "Bruk samme som Sonans".
- When own and descendants deviate, a second caption line: "3 filialer under angir egen verdi:
  Sandnes, Bergen, Oslo" with links, then the button "Bruk for alle under".
- `ApplyBelowModal` lists every deviating descendant with its current effective value and the
  value it will get, e.g. "Akademiet NAV Oslo: Ansatte → Offentlig", and says "Disse filialene
  vil arve Synlighet fra Sonans." Confirm label "Bruk for alle under". Confirm calls
  `inherit_below`.
- Create mode: a "Under" tree picker (default: the branch the modal was opened from, clearable
  for a new root), name, logo, region, address, "Opprett".

**Verify in the browser:** on `/admin/database/filialer?filial=<Sonans>&filialFane=general`
confirm the deviation line lists the three admin-only campuses; run "Bruk for alle under" and
read the preview; open Sonans Lillestrøm and confirm "Arvet fra Sonans" with a working link;
create a branch under Sonans and confirm it inherits.

- [x] `useAutoSave` extracted, Fag tab unchanged in behaviour
- [x] Endpoint + service + test
- [x] Caption, reset actions, apply-below preview, parent picker
- [x] Reviewed on desktop and phone widths
- [x] `bun fix` clean

## Step 4: The four flags and the two percentages

**Goal:** Prove the mechanism generalises by adding `deliveryAtBranch`, `deliveryByMail`,
`paymentResponsible`, `responsibleForDelivery`, `buyoutPercentage`, `sellPercentage` with the same
pattern and almost no new code.

**Files:**

- Create: `backend/database/migrations/1792300000000_branch_scalars_own.ts` (six nullable
  `*_own` columns, backfilled from the current values, root check constraints)
- Modify: `backend/database/schema.ts`, `backend/app/models/branch.ts`, `backend/shared/branch.ts`,
  `backend/app/validators/branch.ts`, `backend/tests/branch_fixtures.ts`
- Modify: `backend/app/services/branch_inheritance_service.ts` (register the six fields)
- Modify: `frontend/src/features/branches/BranchPaymentSettings.tsx` (auto-save; caption on each
  switch and percentage field; no "Lagre" button)
- Test: `backend/tests/branch_service.spec.ts` (one table-driven test over the six fields)

**Done when:** each control sits in the card, the "Overstyrt" pill and "Fjern alle
overstyringer" work per field, the service has no field-specific code paths, and the "Gratis
postlevering" switch still only shows when `deliveryByMail` is on.

- [x] No migration needed (derived model); validator unchanged; fixtures unchanged
- [x] UI cards on the six controls, auto-save
- [x] `bun fix` clean

## Step 5: The period lists as one inherited unit

**Goal:** Inherit the three period lists together without copying rows, and stop gating the form
on `type`.

**Design (revised 2026-09-29 for the override model):** the three lists are one inherited unit
whose "override" is the branch's own rows. One column, `branches.periods_override boolean NOT
NULL`, says whether the rows in `branch_periods` for this branch are its own (`true`, possibly
zero rows: "offers nothing") or whether it inherits (`false`, no rows of its own). A root always
has `true` (check constraint, like the scalars). The value in force is resolved like the scalars:
the nearest ancestor with `periods_override = true` is the source, and `periodsSourceId` (the
source's id) is exposed on the DTO next to `overrides.periods: boolean`. The model reads the rows
of the source. A `@hasMany` with `localKey: "periodsSourceId"` cannot do that (verified in Lucid
22.4 on 2026-09-29: `execQuery` runs the preloader before the `afterFetch`/`afterFind` hooks, so
`periodsSourceId` is not set yet when the relation loads). Instead the `beforeFetch`/`beforeFind`
preload of `periods` goes, and `resolveInheritedValues` loads the rows of every source id in one
query (`BranchPeriod.query().whereIn("branch_id", sourceIds).orderBy("id")`, through the same
client) and hands each branch its source's rows with `branch.$setRelated("periods", rows)`. The
`periodsOf` getters then keep working unchanged, so `branch.rentPeriods` and every
pricing/validation reader do too. `InheritedOverrides` becomes the seven scalars plus
`periods: boolean`, and the frontend's `useInheritedField` stays typed on the scalars; the
periods card gets its own small hook over `periodsSourceId`.

Writes: `createBranch` sets `periods_override` to `false` under a parent and `true` at a root.
`updateBranch` with a period list on an inheriting branch first copies all three lists from the
source into own rows and sets `periods_override = true`, then replaces the given kind, so the
other kinds keep their rows (sticky, like a scalar override). Sending `periods: null` deletes
the branch's rows and sets `false` (confirm, since rows are deleted: "Periodene som er angitt
her slettes, og filialen bruker periodene fra Sonans."). `inheritBelow("periods")` does the same
for every descendant, behind the existing endpoint.

**UI:** this is the first field where "edit = override" cannot hold in a tree row. The Betaling
tab gets one `InheritedFieldCard` around the whole "Perioder" fieldset ("Arvet fra X" /
"Overstyrt ↺" in its header like any card; the ↺ confirms here because rows are deleted). In the
descendant tree the row control is a summary ("3 låne, 2 forlenging") with the ↺, not an editor;
an inheriting branch gets a "Velg egne perioder" button in the card that copies the source's rows
(the first edit does the same implicitly). `type` gating goes: all three lists always show.

**Files:**

- Create: `backend/database/migrations/1792400000000_branch_periods_source.ts`
- Modify: `backend/app/models/branch.ts`, `backend/app/models/branch_period.ts` (doc),
  `backend/shared/branch.ts` (`overrides.periods: boolean`, `periodsSourceId: string`),
  `backend/app/validators/branch.ts`, `backend/app/services/branch_service.ts`,
  `backend/app/services/branch_inheritance_service.ts`, `backend/tests/branch_fixtures.ts`
- Modify: `frontend/src/features/branches/BranchPaymentSettings.tsx` (one caption for the
  "Perioder" fieldset; all three lists always shown; each card field auto-saves on blur, add and
  remove save at once, remove confirms "Perioden fjernes.")
- Test: `backend/tests/branch_model.spec.ts` (periods read through the source),
  `backend/tests/branch_service.spec.ts` (first edit copies the other kinds), and one test in
  `backend/tests/cart_service.spec.ts` that prices a book at an inheriting child and gets the
  parent's rent options.

**Verify in the browser:** Sonans defines the periods, Sonans Oslo inherits; the Oslo catalog
shows the same partly-payment options; editing one Oslo period turns the whole unit own.

- [ ] Migration (`periods_override` + root check) + relation via `localKey`
- [ ] Payment tab caption, auto-save, type gating removed
- [ ] Pricing test at an inheriting child
- [ ] `bun fix` clean

## Step 6: Layers, drop `type`, consolidate scalars (reviewed data change)

**Goal:** Give the tree its single root and two layers, remove `type`, and make inheritance
actually carry values by moving shared scalars up to containers, with a report to read first.

**Part A, migration `1792500000000_branch_layers.ts` (runs in predeploy on every environment):**

- Inserts `Boklisten.no AS` (root, `admin`, region "Norge"), `Privatist` and `VGS` (children,
  `admin`) with fixed ids exported as `BRANCH_LAYER_IDS` from `backend/shared/branch.ts`
  (generate three with `newObjectId()` once and paste them). Skips rows that already exist.
- Re-parents every existing root by name: privatist → ASK Undervisning, Bjørknes privatskole, Fri
  privatist, K2 Undervisning, Metis, NKI Nettstudier, Oslo innsamling (confirm with Adrian),
  Restesalg, Sonans, Akademiet; vgs → Flåklypa VGS, Otto Treider, Ullern videregående skole,
  Wang, Wang Ringerike, Wang Romerike. Throws on a root not in the table (production must be
  checked against this list before deploy).
- Drops `branches.type`. The moved roots keep their overrides (a root always holds every
  field), so no value in force changes; they simply stop being roots.
- After this, `Boklisten.no AS` is the only root: `updateBranchRelationships` refuses
  `parentBranchId: null` for any other branch, and `keepValuesInForce` becomes dead code and is
  removed together with its test.
- Code in the same change: `BRANCH_TYPES`/`BranchType` removed from `shared/branch.ts`, validators,
  fixtures and the four spec files; `info/branch/route.tsx` filters `descendantsOf(branches,
BRANCH_LAYER_IDS.privatist)` instead of `type === "privatist"`; the Type select leaves the
  General tab.

**Part B, command `backend/commands/branches_consolidate.ts` (`node ace branches:consolidate
[--apply] [--reset-unconfigured]`), run by hand after Part A:**

- Fields: every inherited field except `visibility` (kept explicit everywhere; see Staging facts).
- Pass 1, bottom-up over containers: a container's override per field becomes the majority of
  its children's values in force (ties → keep). Only containers change values in force.
- Pass 2 (back under the override model, 2026-09-29): every child whose override equals the new
  value in force of its parent gets `NULL`. Without it nothing would inherit, since an override
  is sticky and the migration only nulled equal values once, at migration time.
- Pass 3, only with `--reset-unconfigured`: a leaf with members, no offerings, no own periods and
  column-default scalars (the Ullern classes) gets `null` for every field except visibility.
- Report (dry run is the default): per branch and field, old override → new override, and every
  change of a value in force with its branch. Last line: "Changes in force outside containers:
  N" (must be 0 without `--reset-unconfigured`). Pure planning function with a spec over fixture
  rows.

**Procedure:** migrate staging, run the dry run, paste the report into the review, `--apply` on
staging, spot-check Sonans Oslo (all scalars "Arvet fra Sonans") and Akademiet NAV Oslo (flags
"Overstyrt"), then production after Adrian's go.

**Files:** migration above; `backend/commands/branches_consolidate.ts`;
`backend/tests/branches_consolidate.spec.ts`; `backend/shared/branch.ts`; the readers of `type`
listed in Staging facts.

- [ ] Layer migration + `type` removal, readers switched
- [ ] Consolidate command + planning test
- [ ] Staging dry run reviewed, applied
- [ ] Production run agreed and done

## Step 7: National subject registry (reviewed data change)

**Goal:** Give every subject one identity so inheritance, uploads and hoisting key on an id, not on
a spelling.

**Schema (migration `1792600000000_subject_registry.ts`):**

- `subjects(id serial PK, name text NOT NULL, created_at, updated_at)` with a unique index on
  `lower(regexp_replace(name, '\s', '', 'g'))` (the same rule as `normalizeSubjectName`).
- `branch_subjects`: add `subject_id int NOT NULL REFERENCES subjects(id)`, drop `name`, unique
  `(branch_id, subject_id)`, keep `external_name` with its per-branch unique index on
  `lower(external_name)`. The old `(branch_id, lower(coalesce(external_name, name)))` index goes;
  the service enforces upload-name uniqueness over the effective list (Step 8).
- Data: the migration holds a reviewed `MERGES` table mapping normalised names to a canonical
  name (e.g. "Matematikk 1P-Y EL", "Matematikk 1P-Y elektro og data", "Matematikk for yrkesfag,
  elektro- og datateknologi" → "Matematikk 1P-Y Elektro og datateknologi"). Every distinct
  normalised name must be either canonical or in the table; the migration throws otherwise. A
  branch that ends up with two offerings of one subject after a merge is reported and stops the
  migration; fix the data by hand first.
- Report first: `node ace subjects:registry_report` (`backend/commands/subjects_registry_report.ts`)
  prints the 152 names with branch counts and groups candidates that share the first word and a
  number, so the merge table can be written from the output.

**API:**

- `GET /subjects` (admin) → `{ id, name, offeringCount }[]` for the picker.
- `GET /subjects/:subjectId/books` (admin) → the union of books other branches use for it, with
  usage counts, for the picker's suggestions.
- `PATCH /subjects/:subjectId` body `{ name }` (admin): national rename; refuses a name that
  normalises to another subject.
- `POST /branches/:branchId/subjects` body `{ subjectId } | { newSubjectName }` plus
  `externalName`, `books`; `PUT` keeps `externalName` and `books` only (the subject of an
  offering never changes; delete and add instead).
- The offering response gains `subject: { id, name }`; `name` is removed.

**Frontend:** `SubjectFields.tsx` replaces the name text field with a searchable `Select` over
`GET /subjects` that offers "Opprett «Spansk 3»" for an unknown value; the book `MultiSelect`
shows a "Brukt av andre filialer" group first. The editor gets a menu item "Gi nytt navn (gjelder
alle filialer)" with a confirm that names the count of branches affected.

**Files:** migration and command above; `backend/app/models/subject.ts` (new);
`backend/app/models/branch_subject.ts`; `backend/app/services/branch_subjects_service.ts`;
`backend/app/services/subjects_service.ts` (new); `backend/app/controllers/subjects_controller.ts`
(new); `backend/app/validators/branch_subjects.ts`, `backend/app/validators/subjects.ts` (new);
`backend/start/routes.ts`; `backend/shared/branch-subject.ts` (new, the response types);
`frontend/src/features/branches/subjects/*`; tests `backend/tests/branch_subjects_service.spec.ts`,
`backend/tests/subjects_service.spec.ts`, `backend/tests/subject_choices_service.spec.ts`.

**Procedure:** run the report on staging, write the merge table, migrate staging, check Sonans
Oslo's Fag tab lists the same subjects with the canonical spellings, then production.

- [ ] Report command, merge table written and reviewed
- [ ] Migration, models, services, routes, registry regenerated
- [ ] Picker with inline create, suggestions, national rename with confirm
- [ ] `bun fix` clean

## Step 8: Effective offerings read model

**Goal:** Make every reader that should see inherited subjects use the effective list: nearest
offering per subject, own first. The public gate stays own-only. No UI change yet.

**Files:**

- Modify: `backend/app/models/branch.ts` (`ancestorChain(branchId)`: recursive CTE upward,
  nearest first, including self)
- Modify: `backend/app/services/branch_subjects_service.ts` (`listEffective`,
  `listEffectiveForUpload`, upload-name validation over the effective list)
- Modify: `backend/app/models/branch_subject_book.ts` (`listingAt` over effective offerings)
- Modify: `backend/app/controllers/branches/branch_catalog_controller.ts` (gate on
  `Branch.orderableByName` semantics, i.e. public and an own book, then list effective offerings)
- Modify: `backend/app/services/subject_choices_service.ts` (`resolveSubjectItems` stops walking
  `parentByBranchId`; it reads the class's effective list from `listEffectiveForUpload` and
  matches the CSV fagnavn against upload names)
- Modify: `backend/shared/branch-subject.ts` (`EffectiveOffering` below)
- Test: `backend/tests/branch_subjects_service.spec.ts`, `backend/tests/subject_choices_service.spec.ts`,
  `backend/tests/branch_model.spec.ts`

**Interface:**

```ts
export interface EffectiveOffering {
  id: number;
  subject: { id: number; name: string };
  externalName: string | null;
  books: SubjectBookResponse[];
  /** The branch whose offering is in force. */
  source: { branchId: string; branchName: string };
  /** True when `source.branchId` is the requested branch. */
  own: boolean;
  /** For an own offering: the ancestor offering it replaces, if any. */
  replaces: { offeringId: number; branchId: string; branchName: string } | null;
  /** For an offering viewed at its own branch: descendants that replace it. */
  replacedBy: { branchId: string; branchName: string }[];
}

BranchSubjectsService.listEffective(branchId: string): Promise<EffectiveOffering[]>;
BranchSubjectsService.listEffectiveForUpload(branchIds: string[]): Promise<Map<string, SubjectForUpload[]>>;
```

**Resolution (in TypeScript, one rule):** load the ancestor chain, load every offering on it,
keep the first offering per `subject_id` in chain order. The chain is at most four branches, so
no SQL `DISTINCT ON` is needed and the rule reads as code.

**Validation:** an own offering's upload name must not equal the upload name of another
_effective_ offering of a different subject. Replacing the same subject is fine.

**Tests:** grandchild sees the root's offerings; an own offering replaces the ancestor's books;
two ancestors offering the same subject → nearest wins; `listingAt` at a class returns the
programme's listing; `orderableByName` still excludes a public class with zero own books; the
catalog of a class is `{}`; the fagvalg upload resolves a class's "Spansk 1" to the class's own
offering when present and to the programme's otherwise; an upload-name collision is rejected.

**Verify in the browser:** `/admin/kasse?kunde=<a Ullern VG1 ST A student>` scan a book listed
only on Ullern VG1 ST and confirm Kasse offers it; `/bestilling` still lists no classes.

- [ ] Ancestor chain + effective list
- [ ] Catalog, Kasse, upload switched; validation
- [ ] Tests
- [ ] `bun fix` clean

## Step 9: Fag tab shows the effective list

**Goal:** The admin sees one list per branch: inherited offerings read-only with their source, own
offerings editable, replacements explicit, plus "choose own books" and "move up". Use the
`frontend-design` skill.

**Files:**

- Modify: `frontend/src/features/branches/subjects/BranchSubjectSettings.tsx`,
  `BranchSubjectEditor.tsx`, `BranchSubjectModal.tsx`
- Modify: `backend/start/routes.ts`, `backend/app/controllers/branches/branch_subjects_controller.ts`
  (`POST /branches/:branchId/subjects/:offeringId/move_up`)
- Modify: `backend/app/services/branch_subjects_service.ts` (`moveUp(branchId, offeringId)`:
  re-parents the row to `parentBranchId`; refuses when the parent already offers the subject)
- Test: `backend/tests/branch_subjects_service.spec.ts`

**Presentation:**

- Inherited rows: muted, badge "Fra Sonans" (link), books read-only, one button "Velg egne bøker"
  that creates an own offering prefilled with the inherited books and expands it for editing.
- Own rows: editable with auto-save, as today. If it replaces an ancestor's: caption "Erstatter
  valget fra Ullern VG1 ST" (link) and "Bruk samme som Ullern VG1 ST" (deletes the own offering;
  confirm: "Bøkene som er valgt her slettes, og filialen bruker valget fra Ullern VG1 ST.").
- On the source branch, a replaced offering shows a chip per descendant: "Egne bøker i F" (link).
- Own row menu: "Flytt til Sonans" (only with a parent). Confirm: "Faget flyttes til Sonans og
  gjelder da alle filialer under."; "Slett faget" keeps its confirm.
- Empty own list under a parent with offerings: the inherited list is the content. The empty
  state for a branch with nothing effective reads "Denne filialen har ingen fag ennå. Legg til
  fag." (the reference to the removed Bøker tab goes).

**Verify in the browser:** Sonans Oslo's Fag tab after moving one offering up by hand; Ullern VG1
ST F after "Velg egne bøker" on Spansk 1; the chip on Ullern VG1 ST.

- [ ] Endpoint + service + test
- [ ] Tab redesign with auto-save and confirms
- [ ] `bun fix` clean

## Step 10: Hoist the duplicated offerings (reviewed data migration)

**Goal:** Remove the copies that exist today by moving offerings that are identical across all of
a parent's children to the parent, with a report to read before anything is written.

**Files:**

- Create: `backend/commands/subjects_hoist.ts` (`node ace subjects:hoist [--apply]`)
- Test: `backend/tests/subjects_hoist.spec.ts` (pure planning function over fixture rows)

**Rule:** for each parent, take the children that have at least one offering. An offering is
hoistable when every such child offers the same `subject_id` with the same `externalName`, the
same set of item ids and the same six booleans per book. Hoisting creates the row on the parent
and deletes the children's copies in one transaction, inside `Branch.whileLocked`.

**Report (dry run, default):** per parent: hoisted subjects; kept-because-different subjects with
the child that differs; "blocked by" (the child with the fewest offerings, and how many subjects
would hoist without it, so an admin can decide whether an intermediate layer is worth it);
children with zero offerings that will start inheriting (Sonans Lillestrøm, Sandvika, Ski).
Totals last.

**Procedure:** dry run on staging, paste the report into the review, `--apply` on staging,
spot-check Sonans Oslo and Akademiet Bergen in the catalog, then production after Adrian's go.

- [ ] Command + planning test
- [ ] Staging dry run reviewed, applied
- [ ] Production run agreed and done

## Step 11: Tree overview and leftovers

**Goal:** Close the loop on "inspect the tree" and remove what the earlier steps made redundant.

**Files:**

- Modify: `frontend/src/features/branches/BranchRelationshipSettings.tsx` (per child row, a small
  count of overridden fields, e.g. "2 overstyrt", linking to the child's general tab;
  re-parenting confirms with a Filial | Felt | Fra | Til table of the values in force that change
  for the moved subtree: overrides stay, `NULL`s re-resolve under the new parent)
- Modify: `backend/app/services/subject_choices_service.ts` (delete the tree-walk helpers and
  their tests if Step 8 left any)
- Modify: `CLAUDE.md` Playwright playbook: one line each for the `*_override` columns (`NULL` =
  inherit, `overrides` on the DTO), the layer ids and the effective-offerings rule.

- [ ] Deviation counts and re-parent confirm on the relationship tab
- [ ] Dead code removed
- [ ] `bun fix` clean

---

## Rollback notes

Steps 2–4 are one migration (`1792200000000_branch_inherited_overrides`) whose `down()` writes
the values in force back into the original columns and restores NOT NULL and the defaults; an
override that equalled the parent's value is indistinguishable from an inherited one after that,
which is what the columns meant before. Step 5 adds `periods_override`, dropped on rollback
(inherited branches must get their source's rows copied first). Step 6 Part A is reversible by
deleting the three layer rows and setting the moved roots' `parent_branch_id` back to null (the
migration's name table is the record); `type` can be restored from the layer a branch sits
under. Step 6 Part B and Step 10 move data; their reports
are the record, and "Velg egne bøker" restores any single hoisted case. Step 7 is the one change
that is not mechanically reversible (names are merged); its merge table is the record.
