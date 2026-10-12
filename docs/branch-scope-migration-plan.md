# Branch scope: one tree for everything

Status: plan, agreed with Adrian on 2026-10-11 and hole-checked the same day. Nothing below is
implemented yet. Read the whole document before starting a step; the steps only make sense against
the target architecture in part 1. Each step is meant to be one reviewable change that leaves the
product better on its own, in the order given. Do not combine steps.

## 1. Target architecture

### 1.1 The idea in one paragraph

The admin tool thinks of everything as a tree. The branch tree gets a single real root above the
two companies. Every customer belongs to exactly one node, and "no school" is the root. Every
user has one home node; for staff it bounds what they can see and touch (the subtree below it),
for customers and guests it is the root. A node is either public (everyone sees it) or staff-only.
Every list in the admin answers the question "what is at or below node X", through one shared
scope rule in the backend, and the Filialer page is the one place to choose X and look at what
lives there. Pages that used to be flat lists (Signaturer, Brukere) become tabs on a node.

### 1.2 Vocabulary

- **Root**: the one branch with `parent_branch_id IS NULL`. There is never more than one. It is a
  real row so no query has a null special case; "root" is derived (no parent), never a flag or a
  hard-coded id. Its name is "Alle filialer" (Adrian, 2026-10-12; "Alle" was the first choice), its `childLabel` "selskap".
- **Node**: any branch, root included.
- **Subtree of X**: X and every descendant of X.
- **Visibility**: one boolean, `visibleToCustomers` (column `visible_to_customers_override`):
  customers and guests see the node when it is true, staff see every node. Inherited down the
  tree as today. The root is not visible to customers but is returned to every viewer anyway (it
  is the "no school" option). Done in step 1 (2026-10-11).
- **Membership** (`users.branch_membership_id`): the node a user belongs to. Never null. For a
  customer with no school it is the root.
- **Home node** (`users.employee_branch_id`): the node a user works from. Never null and it means the
  same thing for everyone: customers and guests have the root, admins have the root, employees
  have whatever head office sets. Only employees ever hold anything but the root. The column and
  the DTO field (`employeeBranchId`) are named after the one role that holds a value, so a reader
  sees at once that it is a staff attribute and not a second membership (Adrian, 2026-10-12;
  `scope_branch_id` was the first name). A future `manager` permission (someone who manages the
  branches in their scope, where an employee only does the operational work) will reuse the same
  column; "employee" is then read as the umbrella word for staff below admin.
- **Selectable set of a viewer**: the subtree of their home node, filtered by what their
  permission may see, plus the root. This is the one formula behind both the tree and the guard:
  - guest or customer: root + every node visible to customers;
  - employee homed at Ullern: Ullern and everything below it (staff see both visibilities, so
    nothing inside a staff subtree is ever hidden);
  - admin or employee homed at the root: every node.
- **Connectors**: the ancestors of a staff viewer's home node, shown greyed and not clickable so
  inherited values have a visible source. Customers get no connectors: a public school whose
  parent is staff-only is simply a top-level node under its full name, as today.
- **Slice of a viewer**: connectors + selectable set. The tree endpoint returns exactly this with
  a `selectable` flag per node.
- **In scope of X**: what a list for node X contains. Two rules, see 1.4.
- **People-anchored** entity: follows its customer (signatures, message logs, invoices by customer,
  the customer itself).
- **Place-anchored** entity: has its own `branch_id` (orders, customer items via
  `handout_branch_id`, deliveries, match rounds, waiting list, opening hours, subjects, periods).

### 1.3 Invariants the finished system holds

1. Exactly one root (partial unique index). The root cannot be re-parented or created twice.
2. Visibility is the boolean `visibleToCustomers`. `admin` does not exist in the database, the DTO
   or the UI.
3. `users.branch_membership_id` and `users.employee_branch_id` are NOT NULL foreign keys.
4. The user DTO exposes `branchMembershipId: string` and `employeeBranchId: string`; null is gone
   from validators, DTOs and frontend forms.
5. Admins have `employee_branch_id = root`; the service keeps it so on promotion.
6. One function, `BranchScope.selectableIds(viewer)`, decides both what the tree endpoint returns
   as selectable and what the guard lets through. They can never disagree.
7. Every scoped endpoint takes a node (`branchId`), requires it to be selectable for the caller,
   and lists by the scope rule. Omitting the node means the caller's home node.
8. Every branch id a staff request writes (URL param, query or body) must be selectable for the
   caller. An unchanged value always passes.
9. No endpoint writes its own scope SQL: it uses `BranchScope`.
10. The root is never a step in the public order walk and never a valid place for an order, a
    customer item, a delivery, a stand or a waiting-list entry.

### 1.4 The scope rule

Implemented once, in `backend/app/services/branch_scope.ts` (new):

- `subtreeIds(nodeId)`: ids of the subtree (node included), via a recursive CTE like
  `Branch.walkDescendants` in `app/models/branch.ts`.
- `selectableIds(viewer)`: `subtreeIds(viewer.employeeBranchId)` filtered by
  `canSeeBranch(viewer.permission, visibleToCustomers)`, plus the root. Guests count as a customer homed at
  the root.
- `assertSelectable(viewer, nodeId)`: throws (403 on a URL param, 400 on a body value) unless the
  node is in `selectableIds`.
- `customersInScope(subtreeIds)`: a subquery of `users` ids (synchronous, over the ids from
  `subtreeIds`, because a Lucid builder is a thenable) that holds a user when
  - the user's `branch_membership_id` is in the subtree, **or**
  - the user has an order whose `branch_id` is in the subtree, **or**
  - the user has a customer item whose `handout_branch_id` is in the subtree.

  Activity is unbounded in time and state: a cancelled order or a book returned years ago still
  counts. This is "membership or activity" (chosen over membership-only so that a stand employee
  at Ullern can see and fix a privatist who ordered at Ullern but never picked a school).

- Place-anchored lists filter by `branch_id IN subtreeIds`.

Scope is **not a partition**. A Nydalen pupil who ordered at Ullern is in scope of both schools,
and the customer counts of sibling nodes do not sum to their parent's. Every list and metric in
the admin uses this one population, so the numbers on one page always agree with each other.
Head office on the root gets everything either way. One exception: the Signering tab lists direct
and indirect **members** only, because its status summary counts members and the two sections of
one tab must agree (Adrian, 2026-10-12, step 4).

### 1.5 Enforcement

- A Bouncer ability `selectable(viewer, nodeId)` in `app/abilities/main.ts` that calls
  `BranchScope.assertSelectable`.
- A route middleware `scope` (new, `app/middleware/scope_middleware.ts`) for authenticated routes
  with a `:branchId` param: authorizes `selectable(ctx.authUser, param)`, otherwise 403. Pattern
  follows `can_middleware.ts`. It is registered inside the employee and admin route groups only.
  The public branch routes (`GET /branches/:branchId`, `/catalog`, `/opening_hours`) have no
  authenticated user and keep their visibility check.
- Endpoints without a branch param (`/users/search`, `/orders`, `/blids`, Kasse lookups, …) take an
  optional `branchId` query, default the caller's home node, and pass it through
  `customersInScope` / `subtreeIds`. A `branchId` query that is not selectable is a 403.
- Branch ids in request bodies (order branch, stand branch, waiting-list branch, membership
  target, provisioning target) go through `assertSelectable` in the service. One rule for every
  move: the **target** must be selectable for the caller; the current value is not checked, so an
  Ullern employee can pull in a Nydalen pupil who ordered at Ullern, and nobody but head office can
  move anyone to the root.
- Entity endpoints (`/users/:userId`, `/customer_items/:id`, `/orders/:orderId`, `/blids/:blid`)
  check that the entity is in scope of the caller's home node; a miss is a 404, so an out-of-scope
  blid looks exactly like an unknown one.
- Writes follow the same rule as reads: an employee may edit a customer or a book that is in scope.
- `GET /branches?include=` keeps returning the named branch when the caller's permission may see
  it, even outside the slice, so a form can show the current membership of an activity-scoped
  customer by name. That shows a school's name, nothing else.
- Admins are root-scoped, so for them every check is a no-op; the guard still runs so a scoped
  admin would need no new code later.

### 1.6 The Filialer workspace (frontend)

- `SelectBranchTreeView` renders the viewer's slice from the server's `selectable` flag:
  connectors as a greyed, non-clickable path at the top, then the home node and its descendants.
  Head office has no connectors and sees the root as the top node. The frontend computes nothing
  about scope.
- The page opens on the home node when the URL has no `filial`. A `filial` outside the slice falls
  back to the home node.
- "Opprett filial" is an action on the selected node, labelled from its `childLabel` ("Ny klasse",
  "Ny skole", "Nytt selskap", else "Ny filial"), and always creates a child of it. There is no
  global create; the root comes from the migration.
- Tabs on a node: **Innhold** (Brukere, Ansatte, Signering, Aktive bøker, Bestilte bøker,
  Overleveringer, Innsikt) and **Innstillinger** (Generelt, Relasjoner, Betaling, Fag,
  Åpningstider). Content tabs are employee-level within scope; settings tabs stay admin. On the
  root the settings group shows only Generelt.
- **Brukere** on a node lists the customers in scope of the node, paged, with a membership column,
  and the metrics and duplicate finder over the same population. A "Bare medlemmer her" filter
  narrows the list to direct members (that is the class list a teacher wants). The two member
  removal actions ("fjern direkte / indirekte medlemmer") move people to the root and are hidden
  on the root. Class-list upload stays on the tab.
- **Ansatte** on a node lists staff whose home node is in the subtree. Staff also appear in
  Brukere wherever their membership is; the two tabs answer different questions.
- Signaturer and Brukere stop existing as routes. No redirects (Adrian: backwards compatibility is
  irrelevant). The members tab keeps one generic name, "Brukere", at every level.
- Filialer is the only place to **choose a working node**. Other pages work from the home node
  implicitly; their branch filters (Ordreoversikt, reports, spotlight) only narrow within the
  slice and are fed by the same tree endpoint.

### 1.7 The customer's school field

- The tree data (`api.branches.index`) now contains the root for every viewer. `SelectBranchField`
  renders it as the first option, labelled "Ingen skole" (Adrian, 2026-10-12; "Jeg går ikke på noen
  skole" was the first choice, too long), and `clearable` is off.
  New customers start on it. The customer can always switch school, never clear.
- The label is field copy, not the root's name. Admins see the root as "Alle filialer".
- Customers never see a company: their result has no connectors, and `toBranchTreeNodeData`
  already promotes a node whose parent is absent to a top-level node under its full name.
- The public order walk is unchanged: `Branch.publicTree` already skips non-public nodes (the root
  and the company level are not visible to customers) and derives `topLabel` from the nearest hidden ancestor
  with a `childLabel`. Do **not** replace `topLabel` with the root's `childLabel`; the company
  level sits between them.

### 1.8 Decisions already made (do not reopen)

| Question                  | Decision                                                                          | Why                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Virtual or real root      | Real row                                                                          | No null special case in any query; membership can be NOT NULL                                                             |
| Root name                 | "Alle filialer", children "selskap"                                               | Reads as "everything" in Filialer, not as a company                                                                       |
| Visibility levels         | One boolean `visibleToCustomers`; `admin` and `employee` both became `false`      | Home nodes already hide everything above a school employee; a third level was a second boundary with its own guard        |
| "No school" for customers | Root membership shown as a named, unremovable option                              | Empty required field reads as a mistake; privatists are the main funnel                                                   |
| Employee scope storage    | Separate `employee_branch_id`, one node per user; named for the role, not "scope" | Membership (teacher at a class) and scope (works for the school) are different things; the name must say it is staff-only |
| Scope rule                | Membership or activity, activity unbounded; Signering tab = members only          | Stand staff must see privatists who ordered at their school, including old history; Signering matches its summary         |
| Brukere population        | Customers in scope, paged, direct members as a filter                             | One "who is here" per node; root must not render 11k rows                                                                 |
| Connectors                | Ancestors of the home node, staff only                                            | Explains inherited values; customers must not see the companies                                                           |
| Move rule                 | Target must be selectable; current value unchecked                                | Stand staff fix the common "picked the wrong school" case; root is head office only                                       |
| Message log               | Feed, metrics and sendouts page admin-only; per-customer tab stays for employees  | The page is a head-office view; a customer in scope is fully visible                                                      |
| Where to pick a node      | Filialer only; operational pages use the home node implicitly                     | One workspace, no hidden global state                                                                                     |
| Old routes                | Deleted, no redirects                                                             | Adrian                                                                                                                    |
| Members tab name          | "Brukere" at every level                                                          | Adrian                                                                                                                    |
| Create button             | On the selected node only                                                         | Adrian                                                                                                                    |

## 2. Current state (verified 2026-10-11 on staging)

- Two roots today: Boklisten.no AS (5 children) and Bokflyt.no AS (0 children), both
  `visibility_override = 'admin'`. Under Boklisten.no AS sit two public groupers, Privatist and
  VGS, and the schools below them.
- Eight other nodes are `admin`: ASK Undervisning and K2 Undervisning (under Privatist), Sonans
  Lillestrøm, Sandvika and Ski, Ullern Øvrige (6 children) and Ullern VG2 UTL. Nothing else sets
  an override except Privatist and VGS (`public`).
- Visibility is enforced by `branches_visibility_check` (migration `1792000000000`), the shared
  `BRANCH_VISIBILITIES` in `shared/branch-visibility.ts`, the branch validator, and the option list
  in `frontend/src/features/branches/branchVisibility.tsx`.
- Users: 16 691 customers, 11 123 without membership. Staff: 3 admins (no membership), 63
  employees (43 without membership).
- Permission is flat (`customer` < `employee` < `admin`, `shared/user-permission.ts`); nothing
  scopes an employee today. An employee sees every customer.
- Tables with a branch foreign key: `branch_periods`, `branch_subjects`, `branches.parent_branch_id`,
  `customer_items.handout_branch_id` and `return_branch_id` (handout 100 % filled),
  `deliveries`, `invoices`, `match_round_stand_branches`, `match_rounds`, `opening_hours`,
  `orders`, `users.branch_membership_id`, `waiting_list_customers`.
- Branches have no delete endpoint; nothing to decide about members of a deleted branch.
- `BranchRelationshipService.getNestedChildBranchIds` is a thin wrapper around
  `Branch.descendantIds`; six files use it (`branch_members_controller`, `subject_choices_service`,
  `branch_insights_service`, `branch_signature_status_service`, `branch_books_service`,
  `branch_relationship_service`). The scope helper replaces it.
- `GET /branches` (`BranchesController.index`) returns `Branch.visibleByName(permission)` plus one
  `include`d branch (the picker's current value, possibly hidden).
- `GET /branches/:branchId`, `/catalog` and `/opening_hours` are public routes (no auth).
- `BranchMembersController.index` lists direct members unpaged; `destroyDirect` and
  `destroyIndirect` set `branchMembershipId` to null.
- `assertMembershipAllowed` (`app/services/user_service.ts`) already passes an unchanged value and
  checks only a changed target against visibility.
- Employee-level routes that are global today and touch people or places: `/users/search`,
  `/users/:userId*`, `/signatures/:userId*`, `/orders*`, `/stand_cart/*`, `/bulk_collection*`,
  `/blids*`, `/waiting_list_customers*`, `/message_logs/feed|metrics|sendouts`. Matches, match
  rounds, invoices, reports and `/users/employees|metrics|duplicates` are admin-level.
- `branchCreateValidator.parentBranchId` is nullable: null creates a root. `BranchManager` has a
  global "Opprett filial" button.
- Consumers of `api.branches.index` in the frontend (each will now receive the root as the single
  top-level node; see step 2): `order/orderTree.ts`, `matches/rounds/PlannedRoundCard.tsx`,
  `PlanRoundModal.tsx`, `standRules/StandBranchesField.tsx`, `customer-search/useHandoutRows.ts`,
  `search/SearchSpotlight.tsx`, `stand-cart/useStandCart.ts`, `waiting-list/WaitingList.tsx`,
  `CreateWaitingListEntry.tsx`, `info/openingHoursWalk.ts`, `branches/BranchRelationshipSettings.tsx`,
  `BranchPaymentSettings.tsx`, `BranchGeneralSettings.tsx`, `BranchManager.tsx`,
  `inheritance/InheritedFieldCard.tsx`, `useInheritedField.ts`, `branch-books/BranchBooksEditModal.tsx`,
  `user-management/useBranchNames.ts`, `order-manager/OrderFilters.tsx`,
  `reports/BranchMultiSelect.tsx`, `form/fields/complex/SelectBranchField.tsx`,
  `SelectBranchesField.tsx`, `hooks/useAutoSave.ts`, `corrections/ChangeBranchModal.tsx`,
  `routes/sitemap[.]xml.ts`.
- User creation paths that must set defaults: `UserService.createVippsUser`, `createSmsUser`,
  `createProvisionedUser` (`app/services/user_service.ts`). Employees cannot create customers
  outside class-list provisioning, so a customer created by staff is always a member of a node
  in the creator's scope.
- Signaturer: `GET /signatures/gallery` (admin, cursor paged, `SignatureGalleryService`), rendered by
  `features/signatures/SignatureGallery.tsx`, route `admin/database/signaturer.tsx`.
- Brukere: `features/user-management/UserManager.tsx` with tabs `kunder` (metrics +
  `DuplicateCustomers`) and `ansatte` (`/users/employees`, `/users/permission`,
  `AddEmployeesModal`), route `admin/database/brukere.tsx`.
- Filialer: `features/branches/BranchManager.tsx`, tree in
  `shared/components/SelectBranchTreeView.tsx`, tree building in `shared/utils/branchTree.ts`
  (orphans become top-level nodes), tabs in `branchManagerTabs.ts`. The members tab
  (`BranchMembers`) lists direct members and counts the subtree.
- Playbook for testing is in `CLAUDE.md` (programmatic SMS login, SQL on staging). An employee
  persona with a home node is created by SQL once step 5 exists.

## 3. Steps

Every step ends with `vpr fix` clean, Japa green, and a Playwright check of the behaviour named
under "Verify". A step's "Not in this step" list is binding.

### Step 1. Visible to customers (done 2026-10-11)

**Value**: one boundary fewer. Visibility only says whether customers see a node; who among the
staff sees it is the home node's job (steps 4 to 7). Adrian chose a boolean over a two-value enum
so the data model says exactly what the switch says.

Backend

- Migration `1793000000000_visible_to_customers`: `visibility_override` text becomes the boolean
  `visible_to_customers_override` (`'public'` → true, `'employee'` and `'admin'` → false, NULL
  stays NULL), the three-value check is dropped and the `*_override_at_root` check re-created
  under the new name. `down()` restores the text column and the three-value check (former `admin`
  rows come back as `employee`).
- `shared/branch-visibility.ts` keeps only `canSeeBranch(permission, visibleToCustomers)`: true
  when the branch is visible to customers or the viewer is staff. `BRANCH_VISIBILITIES`,
  `BranchVisibility` and `visibilitiesFor` are gone.
- `shared/branch.ts`: `visibleToCustomers: boolean` replaces `visibility`;
  `INHERITED_BRANCH_FIELDS` names it. The validator takes `visibleToCustomers` as a nullable
  boolean. `ROOT_VALUES.visibleToCustomers` is `false`.
- `Branch.visibleByName`, `mayBeShown`, `assertMembershipAllowed`, `publicTree`, the catalog and
  `OrderService.createFromCart` read the boolean; no logic change.

Frontend

- `branchVisibility.tsx` is deleted. `BranchGeneralSettings` renders "Synlig for kunder" as a
  `ToneSwitch` in an `InheritedFieldCard` (På/Av, no explanatory line), and the descendant tree
  uses the shared on/off editor like the other switches.

Verified: Filialer → Generelt on Ullern VG2 UTL shows the switch off and "Overstyrt"; toggling
auto-saves the override; an employee (not admin) gets all 119 branches from `GET /branches`,
including the eight former admin nodes; a guest gets 101, none hidden; `/branches/public` and
`/bestilling` are unchanged (Privatist and VGS at the top).

Not in this step: the root, users.

### Step 2. One root (done 2026-10-11)

**Value**: the tree has a single top node, so "everything" is a node you can select in Filialer,
and new branches are always created under a parent.

Backend

- Migration `create_root_branch`:
  - Insert the root (`newObjectId()`, name "Alle filialer", `local_name NULL`, `child_label 'selskap'`,
    `visible_to_customers_override false`, every other `*_override` set to today's Boklisten.no AS
    values so the `branches_*_override_at_root` checks hold; the companies keep their own
    overrides, so nothing they inherit changes).
  - `UPDATE branches SET parent_branch_id = <root> WHERE parent_branch_id IS NULL AND id <> <root>`.
  - `CREATE UNIQUE INDEX branches_single_root ON branches ((parent_branch_id IS NULL)) WHERE parent_branch_id IS NULL`.
  - `down()`: drop the index, detach the children, delete the root.
- `branchCreateValidator.parentBranchId` becomes required. `createBranch` has no root path.
- `updateBranchRelationships` refuses to change the root's parent (it is null and stays null) and
  refuses to make any node parentless.
- `Branch.visibleByName` returns the root for every viewer regardless of visibility.
  `mayBeShown` is true for the root.
- `Branch.publicTree`: confirm by test that the root never appears and `topLabel` is unchanged.
- New model helper `Branch.root()` (the row with no parent) used by later steps.
- Place-anchored writes reject the root: add `assertNotRoot(branchId)` in the branch service and
  call it where an order branch, delivery branch, stand branch, waiting-list branch or match-round
  branch is set. Grep `branchId` in the validators for those controllers.

Frontend

- `toBranchTreeNodeData` is unchanged: the root becomes the single top-level node automatically
  for staff; customers still get the root plus the public nodes, with Privatist and VGS as
  top-level siblings of the root because their parent is hidden.
- Review each consumer in part 2 and decide: **scope pickers** (Filialer tree, order filters,
  reports multi-select, spotlight) keep the root selectable; **place pickers** (stand branches,
  change order branch, waiting-list entry, handout rows) exclude it. Add one helper
  `withoutRoot(branches)` in `shared/utils/branchTree.ts` for the second group. The sitemap
  excludes it.
- `BranchManager`: remove the header button. Add "Ny <childLabel>" on the selected node (next to
  the title) that opens `BranchGeneralSettings` with the parent fixed to the selected node. The
  parent field in that modal is read-only.
- `BranchRelationshipSettings`: the root shows no parent picker.

Verified: Filialer shows "Alle filialer" (button "Nytt selskap") with both companies under it; "Nytt
årskull" on Ullern created a child with Ullern as parent and every field inherited; `/bestilling`
unchanged (Privatist and VGS at the top, `topLabel` null); a guest's `GET /branches` has 102
branches: the root, the public ones and no company. Detaching a child, moving the root and
creating without a parent are refused (422); a waiting-list entry at the root is refused (400).

As built: `publicTreeTo` skips the root when deriving `topLabel` (Boklisten.no AS has no child
label, so the walk would otherwise reach the root's "selskap"); `keepValuesInForce` is gone
(nothing can become a root); test fixtures put every parentless fixture under one test root
(`rootBranch()` in `tests/branch_fixtures.ts`); the migration hard-codes the root's override
values, not ids; `assertNotRoot` also guards opening hours. The staging branch "Steg 2
testklasse" under Ullern is left over from the check (staging resets nightly).

Not in this step: anything about users.

### Step 3. Membership is never empty (done 2026-10-12)

**Value**: null membership disappears from the codebase; privatists are an explicit, visible state
instead of a missing one.

Backend

- Migration `membership_not_null`: `UPDATE users SET branch_membership_id = <root> WHERE NULL`,
  then `ALTER COLUMN SET NOT NULL`. `down()` sets root members back to NULL.
- `shared/user.ts`: `branchMembershipId: string`. `User.toDto` follows.
- Validators (`app/validators/users.ts`): `branchMembershipId` is a string, never null. On the two
  update endpoints it is required (the form always holds a value). On registration it is optional
  and the service fills in the root. `userFieldsFrom` and every `?? null` on it go away.
- `createVippsUser` (Vipps gives no branch), `createSmsUser` (when registration omits it),
  `createProvisionedUser` (when the class list gives none): default to `Branch.root()`.
- `assertMembershipAllowed`: the root is always an allowed target; otherwise unchanged.
- `BranchMembersController.destroyDirect` / `destroyIndirect`: set the root instead of null, and
  refuse on the root (there is nothing above it to move people to).
- `SignaturesController.sendLink`: `branch?.name ?? "en filial"` becomes the branch name; on the
  root keep the copy "en filial" (Adrian, 2026-10-12; "Boklisten" read as "fra Boklisten via
  Boklisten.no").

Frontend

- `SelectBranchField`: `clearable` off; render the root node first with the label "Ingen skole"
  (as a leaf of its own, since a parent node in `TreeSelect` only expands); the hint text stays.
  Default value for new forms is the root id (take it from the loaded branches).
- Remove `branchMembership: user.branchMembershipId ?? ""` fallbacks in `UserSettingsForm`,
  `AdministrateUserForm`, and `values.branchMembership || null` in `UserInfoFields`.
- `IdentityBadge`, `CustomerHeader`, `SearchSpotlight`, `useStandCart`: wherever "no branch" is
  rendered or branched on, treat root membership the same way the old null was treated (the
  display copy may stay "Ingen skole").
- `useMembershipBranch`: a root member walks up to `parentBranchId === null` and returns null; the
  walk then shows no shortcut, as for null today. Verify, no change expected.
- `BranchMembers` on the root: hide the two removal actions. The list itself is replaced in
  step 6; until then the root's direct-member list is long, which is acceptable for an admin-only
  page for a few days.

Verify: a new SMS sign-up without choosing a school lands on the root; the tasks page shows "Ingen
skole" selected and offers no clear button; switching to Ullern VG1 and back works; "fjern direkte
medlemmer" on Ullern VG1 moves the pupils to the root.

Verified: an SMS sign-up with the school left as is lands on the root; the sign-up form and the
tasks page show "Ingen skole" selected with no clear button (the task asks a root member about
their school, as it asked a customer without one); switching to Ullern VG1 ST A and back
auto-saves both ways; "Fjern medlemmer" on Ullern VG1 ST H moved its pupil to the root (restored
by SQL); the root's Elever tab shows no removal buttons and the endpoint answers 400 on the root.

As built: the root is offered as a leaf of its own above the companies and schools (a parent node
in `TreeSelect` only expands), labelled "Ingen skole" for both perspectives; the migration skips
an empty tree (a truncated test database has no root); `BranchMembershipService.moveMembersToRoot`
holds the two removal actions; `Branch.schoolNamesByIds` (root left out) names memberships in the
signature gallery and the active-books rows, the users and order-manager reports join the
membership name with `parent_branch_id IS NOT NULL`, `useBranchNames` and the spotlight leave the
root out, and the match cohort tiebreak and the stand statistics treat a root member as having no
class; `userFieldsFrom` no longer touches the membership (the two update validators require it,
registration takes it optionally); test fixtures default every user to the test root. After the
fresh review (2026-10-12): `OrderService.createFromCart` calls `assertNotRoot` on the order's branch
(the visibility loop skips extend/buyout lines, so a crafted cart could otherwise land at the root);
the membership foreign key is `ON DELETE RESTRICT` (it was `SET NULL`, which a NOT NULL column cannot
honour); the sign-up form and the tasks page show an error with "Prøv igjen" when the branch list
fails instead of an endless skeleton.

Not in this step: scope, Signaturer, Brukere.

### Step 4. Signaturer becomes the Signering tab (done 2026-10-12)

**Value**: the first scoped list. Signatures are looked at per node, and the standalone page is
gone. This is the change that started the whole plan.

Backend

- `GET /signatures/gallery` moves to `GET /branches/:branchId/signatures` (admin group for now;
  step 7 opens it to employees). `SignatureGalleryService.getPage(cursor, branchId)` filters by
  `customersInScope(branchId)`. Introduce `backend/app/services/branch_scope.ts` here with
  `subtreeIds` and `customersInScope` only (the rest comes in step 7). Replace
  `getNestedChildBranchIds` with `subtreeIds` in `branch_signature_status_service.ts` as the first
  user; leave the other five for step 7.
- Japa: `customersInScope` finds a member of a descendant, a root member with an order at a
  descendant, a root member with a customer item handed out at a descendant, a member of a
  sibling school with a cancelled order at a descendant, and nothing for a customer whose only
  activity is elsewhere.

Frontend

- `BranchSignatureStatus` panel gets the gallery below the status summary, fed by the new endpoint
  with the node id. `SignatureGallery` takes `branchId` as a prop; its card and infinite-query
  logic stay as they are.
- Delete `routes/(administrasjon)/admin/database/signaturer.tsx` and its nav entry. No redirect.

Verify: root → Signering shows the same cards the old page showed; Ullern → Signering shows only
Ullern's subtree. (A privatist who ordered at Ullern was to appear under Ullern; dropped, see
"As built".)

Verified: root → Signering shows the status summary (16 757 members) and the same newest-first
cards the old page showed; Ullern → Signering shows only Ullern members (every membership badge
an Ullern class); `/admin/database/signaturer` is a 404 and the nav entry is gone.

As built: the gallery lists the **members** of the subtree, not `customersInScope` (Adrian,
2026-10-12): the signature status above it counts members, and the two sections of one tab must
agree; the activity rule is for finding and serving customers (steps 6 and 9), not for this
overview. `BranchScope.customersInScope(subtreeIds)` is still introduced here, tested, and first
used by the Brukere tab in step 6. It is synchronous and takes the ids from `subtreeIds(nodeId)`
(a Lucid builder is a thenable, so an async function returning one would run it instead of
returning it); callers write `customersInScope(await subtreeIds(id))`. The route is
`GET /branches/:branchId/signatures` on `SignaturesController.gallery` (Tuyau name unchanged,
`api.signatures.gallery`), declared next to `signature_status`. The tab stacks the status summary
over the gallery under the heading "Signaturer", with no intro text.

Not in this step: home nodes, enforcement, Brukere.

### Step 5. Home node column

**Value**: head office can record which node each employee works from, visible on the employee
list. Nothing is enforced yet, so nobody's access changes.

Backend

- Migration `user_employee_branch`: `employee_branch_id string(24) NOT NULL` FK to branches, filled with
  the root for every row, indexed. `down()` drops it.
- `shared/user.ts`: `employeeBranchId: string`; `User.toDto` follows.
- `PUT /users/permission` (`setPermission`) takes an optional `employeeBranchId`; promoting to `admin`
  forces the root; demoting to `customer` resets to the root. New endpoint not needed.
- `/users/employees` returns `employeeBranchId`.
- Japa: admin always root; employee keeps a set node; customer reset.

Frontend

- `EmployeesTab`: a "Filial" column with the home node's name (`useBranchNames`), and a picker in
  the row (the existing `SelectBranchField` pattern, root selectable, labelled "Alle filialer" here)
  that calls `setPermission` with the node. Admin rows show the root, disabled.
- `AddEmployeesModal`: optional home node, default root.

Verify: set an employee to Ullern, reload, the column shows Ullern; promote to admin, it snaps back
to the root.

Not in this step: any read or write restriction.

### Step 6. Brukere becomes Filialer tabs

**Value**: the last flat user page is folded into the tree. "Brukere" on a node = the customers in
scope of it and their metrics; "Ansatte" on a node = the staff whose home node is in the subtree.

Backend

- New `GET /branches/:branchId/customers`: cursor paged (same pattern as the signature gallery),
  `customersInScope(branchId)`, ordered by name, each row with id, name, year of birth and
  `branchMembershipId`; a `direct=true` query narrows to `branch_membership_id = branchId`.
  Replaces `BranchMembersController.index`, which goes away with its unpaged list. The subtree
  count becomes the page's total.
- `GET /users/metrics` and `GET /users/duplicates` take a required `branchId` and scope to
  `customersInScope`. `GET /users/employees` takes a required `branchId` and returns employees
  whose `employee_branch_id` is in `subtreeIds`.

Frontend

- Tab `members` is renamed `users` with the label "Brukere" and holds: the paged customer list
  with a membership column (`useBranchNames`) and a "Bare medlemmer her" filter, the two removal
  actions (hidden on the root), `UploadBranchUsers`, then the metrics and `DuplicateCustomers` for
  the node.
- New tab `employees` ("Ansatte") holding `EmployeesTab` for the node, including
  `AddEmployeesModal` with the home node defaulting to the selected node.
- Delete `routes/(administrasjon)/admin/database/brukere.tsx`, `UserManager.tsx`,
  `userManagerTabs.ts` and the nav entry. No redirect. Fix the search-param names: `filialFane`
  values gain `users` and `employees`; `kunder`/`ansatte` go away.

Verify: root → Brukere pages through every customer and shows the old Kunder metrics; Ullern →
Brukere lists a privatist who ordered at Ullern with membership "Ingen skole", and the filter
drops them; root → Ansatte shows the old Ansatte list; Ullern → Ansatte shows only employees homed
at or below Ullern.

Not in this step: enforcement.

### Step 7. Scope guard and slice endpoint

**Value**: the backend enforces the home node on everything addressed by a branch id, and the tree
endpoint returns each viewer's slice. After this step an employee with a home node below the root
is already confined wherever a branch id is in the URL, whether or not the UI knows.

Backend

- `BranchScope.selectableIds(viewer)` and `assertSelectable(viewer, nodeId)` per 1.4. Guests are
  treated as a customer homed at the root.
- Ability `selectable` and middleware `scope` per 1.5. Register the middleware in
  `start/kernel.ts` next to `can`; apply it to every route with `:branchId` inside the employee
  and admin groups, and to `/match_rounds/:id*` by the round's branch (look it up in the
  controller; rounds are place-anchored). The three public branch routes are untouched.
- Replace the remaining `getNestedChildBranchIds` calls with `BranchScope.subtreeIds` and delete
  the wrapper.
- `GET /branches` returns the viewer's slice: `selectableIds` plus, for staff, the ancestors of
  the home node, each row carrying `selectable: boolean`. `include` keeps working per 1.5.
  Customers and guests get root + public nodes, exactly as after step 2, all selectable.
- Body branch ids: `assertSelectable` in `assertMembershipAllowed` (target only),
  `Orders.updateBranch`, stand-cart checkout, waiting-list store and provisioning.
- Route groups: move the content endpoints (`customers`, `signatures`, `signature_status`,
  `active_books` read, `ordered_books` read, `insights`, `/users/employees` read, `/users/metrics`,
  `/users/duplicates`) from the admin group to the employee group. Writes under `/branches` stay
  admin. Move `/message_logs/feed`, `/metrics` and `/sendouts` the other way, into the admin
  group, and gate the Meldinger page to admins. Keep the group-ordering rule in
  `start/routes.ts` in mind (specific before parametric).
- Japa: an employee homed at Ullern gets 403 on a sibling school's customers, 200 on an Ullern
  class, 400 when moving a customer to a sibling school and 200 when moving a Nydalen pupil with
  an Ullern order into Ullern VG1; the slice for that employee contains the root, the company and
  VGS as non-selectable ancestors and no sibling schools; an admin's slice is everything,
  selectable; a customer's slice has no company and no `selectable: false` row.

Frontend: types compile; `SelectBranchField` and the place pickers ignore the flag. The Filialer
tree still assumes a full tree; step 8 fixes that.

Verify: with an employee persona homed at Ullern (SQL), `GET /branches` returns the slice and
`GET /branches/<other school>/customers` is 403.

Not in this step: endpoints without a branch id (`/users/search`, `/orders`, `/blids`, Kasse).

### Step 8. Filialer shows the slice

**Value**: an employee opens Filialer, sees Ullern with the path above it greyed out, and works in
their subtree with the same page head office uses.

Frontend

- `SelectBranchTreeView` renders nodes with `selectable: false` as the breadcrumb path: no
  chevron, muted text, not clickable, always expanded. Nothing is computed client-side.
- Default `filial` to `user.employeeBranchId`; clamp a `filial` that is not selectable to the home
  node.
- Tabs: settings tabs (`general`, `relationships`, `payment`, `subjects`, `hours`) render only for
  admins; content tabs for employees too. On the root, settings show only `general`.
- Navigation: Filialer moves out of the admin-only database group into the employee-level
  navigation (check `routes/(administrasjon)/admin/route.tsx` and the nav config for the gating,
  and the memory note on `features/nav`). Remove `AuthGuard requiredPermission="admin"` on the
  route if present.
- "Ny <childLabel>" shows only for admins (writes stay admin).

Verify: employee persona homed at Ullern sees "Alle filialer", the company and VGS greyed, Ullern selected,
classes below; cannot click the company; sees Brukere, Signering, Aktive bøker; sees no Betaling
tab. Admin persona is unchanged.

Not in this step: scoping of search, orders, blids, Kasse.

### Step 9. People-anchored endpoints respect the home node

**Value**: an employee can only find, open and edit customers in their scope. This is the core
promise of the model ("Ullern staff see Ullern").

Backend

- `GET /users/search`: filter by `customersInScope(home)`.
- `GET/PATCH /users/:userId`, `confirm_email`, `/users/:userId/customer_items`, `/orders`,
  `/placed_orders`, `/matches`, `/message_logs`, `/signatures/:userId` and its `send`/`link`:
  404 unless the customer is in scope of the caller's home node. Implement once as
  `BranchScope.assertCustomerInScope(viewer, customerId)` and call it at the top of each. The
  per-customer message log stays employee-level: a customer you can see, you can see in full.
- A customer editing their own membership (`/users/me`) is unaffected: their allowed targets are
  their own selectable set (public branches and the root), as in step 3.
- Kasse: `/stand_cart/*` resolves a customer; it goes through `assertCustomerInScope`. A customer
  the employee cannot see is "Fant ingen kunde", not a leak.
- Japa for each branch of the rule, with the activity cases from step 4.

Frontend: no change in behaviour for admins. `CustomerSearch` empty states already handle "no
hits". Check that the 404 on `/users/:userId` for an out-of-scope deep link renders the existing
not-found state and not an error toast.

Verify: employee persona searches a sibling school's pupil by name: no hit; by exact phone: no
hit; opens `/admin/kasse?kunde=<that id>`: not found; finds a privatist who ordered at Ullern;
opens that privatist's Meldinger tab.

Not in this step: place-anchored lists.

### Step 10. Place-anchored endpoints respect the home node

**Value**: orders, books, blids, waiting list and bulk collection are confined to the subtree.

Backend

- `GET /orders`, `/orders/export`, `/orders/export/bring`: `branch_id IN subtreeIds(home)`, with
  the existing branch filter intersected, never widened.
- `/orders/:orderId*`: 404 unless the order's branch is in scope.
- `/customer_items/:id`, `/orders/:orderId/items/:itemId`: by `handout_branch_id` / order branch.
- `/blids`, `/blids/:blid*`, `/bulk_collection/:blid`: a blid is in scope if its active customer
  item's `handout_branch_id` is in scope, or it has no active customer item (a blank sticker
  belongs to whoever holds it). State this rule in `BranchScope.blidInScope`.
- `/waiting_list_customers`: by `branch_id`.
- `/unique_ids/pdf`, `/items*`: not scoped (books and stickers are global catalogue data).
- Japa for the order and blid rules.

Verify: employee persona's Ordreoversikt lists only subtree orders; scanning a sibling school's
blid in Kasse is a miss; scanning an unregistered blid still works.

Not in this step: UI restyling.

### Step 11. Tab grouping and root-specific layout

**Value**: the tab strip stops growing sideways and the root page reads as "everyone" rather than
as a school with empty settings.

Frontend only, with the `frontend-design` skill:

- Two tab groups, Innhold and Innstillinger, per 1.6. Mobile layout checked at phone width.
- Root: title "Alle filialer" and child-creation action read as the company level ("Nytt selskap"); the
  settings group shows Generelt only.
- `childLabel`-driven naming everywhere a node's children are created or counted.

Verify: screenshots at desktop and phone width for root, a school and a class, as admin and as
employee.

### Step 12. Rollout

Not a code step. After step 10 is deployed to production:

1. Set `employee_branch_id` for the employees who work for one school, via the Ansatte tab.
2. Leave head office on the root.
3. Watch Sentry for 403/404 spikes on `/users/*` and `/branches/*` for a week.

## 4. Testing notes for every step

- Backend: Japa (`cd backend && vpr test --files tests/<file>.spec.ts`), Node 24.
- Frontend: Playwright per the `CLAUDE.md` playbook. Three personas: admin (`adrian@boklisten.no`),
  an employee homed at Ullern (set `employee_branch_id` by SQL from step 5 on), a privatist customer.
- Finish with `vpr fix`.
