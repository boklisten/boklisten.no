# MongoDB → Postgres migration plan

Reference document for the work of moving every remaining MongoDB collection into Postgres. It
records the decisions taken on 2026-09-16, the conventions every step follows, and one section per
step with the target schema, the relationship changes, the code that has to move, the survey to run
first, and how to verify. Future agents: read "Ground rules" and "Per-step checklist" in full before
starting a step, then the step's own section. Update this document when a step lands (tick the
status, record survey results and anything surprising).

## Goal and constraints

- Everything leaves MongoDB. When the last step lands, the backend has one database.
- Least risk and least code change. Each step is one collection (or one pair that must move
  together), lands as one pull request made of small reviewable commits, and is merged as a unit
  because the migration and the code that reads the new table must deploy together.
- Small schema fixes are made on the way (relationship direction, naming, types, dropping dead
  fields). No larger restructuring of services or the API.
- All data is transferred. Nothing is left behind except what a survey has explicitly classified as
  garbage and the step's migration logs as skipped.

## Decisions (2026-09-16)

| Topic                      | Decision                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary keys               | Migrated tables keep the Mongo 24-char hex id as a `string(24)` primary key. New rows get an app-generated ObjectId hex. URLs, tokens, avatars and existing Postgres id columns keep working.                                                                                                              |
| Cutover                    | One shot per collection, inside the Lucid migration's `defer` block on Railway predeploy (the signatures pattern). No dual-write period, no reconciliation pass.                                                                                                                                           |
| Drop of Mongo collection   | In the same migration, right after the transfer. No separate safety net; a broken transfer is fixed forward in Postgres.                                                                                                                                                                                   |
| Timing                     | No seasonal constraint. Between the drop and Railway switching traffic, the old backend errors on that collection and its writes are lost. Accepted: traffic is low and the window is a few minutes.                                                                                                       |
| Embedded arrays            | Every embedded array whose elements have identity becomes a child table (order items, period extends, invoice item payments, invoice comments, branch periods).                                                                                                                                            |
| jsonb                      | Only for payloads whose shape belongs to an external vendor (payment gateway info). Everything the app itself defines becomes columns. One exception, decided in step 1: `items.price_history` (a year → price map with keys that vary per item).                                                          |
| Snapshot copies            | Invoice snapshots (customer info, item titles on invoice lines) are kept because invoices are accounting documents. `customerItem.customerInfo`, `uniqueItem.title` and `orderItem.title` are dropped.                                                                                                     |
| Meta fields                | `creationTime`/`lastUpdated` → `created_at`/`updated_at`. `user` and `editableFor` are dropped. `active` is dropped unless the step's survey finds `active: false` documents that code reads.                                                                                                              |
| API contract               | The frontend may change in the same step when a shape changes (inverted arrays, dropped fields). No presenter code that fakes the old document shape.                                                                                                                                                      |
| Access layer               | One Lucid model per table with static query helpers (see `app/models/signature.ts`). Call sites of `StorageService.X` are rewritten to model calls. No Postgres imitation of `MongodbHandler`/`SEDbQuery`.                                                                                                 |
| Orphans                    | Every step starts with a staging survey. The migration then drops, nullifies or keeps orphans explicitly, with a logged count. Foreign keys are always real.                                                                                                                                               |
| Order/customer-item cycle  | Orders first. `order_items.customer_item_id` lands as a plain column; the customer-items step adds the foreign key and drops `customerItem.orders`.                                                                                                                                                        |
| users + userdetails        | Merged into one table named `users`, keyed by the user-details id (the id everything else references).                                                                                                                                                                                                     |
| Deleted users (2026-09-21) | Orders, customer items, payments and invoices are history and outlive the customer (book history, accounting), so their `customer_id` columns are nullable with `SET NULL`, not `RESTRICT` as the schema conventions say for other references. Match participations are deleted with the user (`CASCADE`). |
| Document location          | This file, `docs/postgres-migration-plan.md`.                                                                                                                                                                                                                                                              |

## Current state (surveyed 2026-09-16 on staging, which is a nightly copy of production)

| Collection    |    Docs | Data size | Backend references (`StorageService.X`) | Notes                                                              |
| ------------- | ------: | --------: | --------------------------------------- | ------------------------------------------------------------------ |
| branches      |     115 |    0.1 MB | 56 refs / 26 files                      | self-reference `parentBranch`/`childBranches`, `branchItems` array |
| branchitems   |   1 366 |    0.5 MB | 7 / 4                                   | unique (branch, item)                                              |
| companies     |      24 |    0.0 MB | 4 / 2                                   | referenced only from invoice snapshots                             |
| customeritems | 164 861 |  137.6 MB | 55 / 27                                 | `orders` array, `periodExtends` array, `customerInfo` snapshot     |
| deliveries    |  59 640 |   27.6 MB | 11 / 10                                 | one per placed order with delivery                                 |
| invoices      |   7 735 |    9.5 MB | 13 / 9                                  | `customerItemPayments`, `comments` arrays, snapshots               |
| items         |     685 |    0.3 MB | 37 / 22                                 | `info.price` is a Map                                              |
| orders        | 185 289 |  189.8 MB | 73 / 30                                 | `orderItems` array, `payments` array, `delivery` ref               |
| payments      |  59 941 |   31.1 MB | 11 / 10                                 | `info` is Mixed (vendor payload)                                   |
| uniqueitems   |  51 667 |   13.4 MB | 8 / 6                                   | `title` snapshot                                                   |
| userdetails   |  16 706 |   12.7 MB | 87 / 41                                 | `orders`, `customerItems` arrays                                   |
| users         |  16 705 |    4.0 MB | 16 / 11                                 | 1:1 with userdetails; login hashes                                 |

Also present on staging Mongo but already migrated and dropped by earlier migrations: `messages`
(103 301 docs), `signatures`, `stand_matches`, `user_matches`. They reappear on staging because the
nightly "Copy Mongo to Staging" cron restores whatever production holds, so production still has
them. `1789100000000_drop_migrated_mongo_collections` drops all four wherever it runs (step 13 also
drops them defensively).

Existing Postgres columns that hold Mongo ids as plain strings today and become real foreign keys as
their target table lands:

| Column                                                    | Target   | Step                                        |
| --------------------------------------------------------- | -------- | ------------------------------------------- |
| `branch_subject_books.item_id`                            | items    | 1                                           |
| `match_obligations.item_id`                               | items    | 1                                           |
| `book_handovers.item_id`                                  | items    | 1                                           |
| `waiting_list_customers.item_id`                          | items    | 1                                           |
| `branch_subjects.branch_id`                               | branches | 3                                           |
| `opening_hours.branch_id`                                 | branches | 3                                           |
| `waiting_list_customers.branch_id`                        | branches | 3                                           |
| `signatures.customer_details_id`                          | users    | 5                                           |
| `match_participants.user_detail_id`                       | users    | 5                                           |
| `book_handovers.from_user_detail_id`, `to_user_detail_id` | users    | 5                                           |
| `sendouts.initiated_by_details_id`                        | users    | 5                                           |
| `messages.regarding_customer_details_id`                  | users    | 5                                           |
| `match_rounds.excluded_customer_ids` (text[])             | users    | 5 (no FK possible on an array; survey only) |
| `book_handovers.order_id`                                 | orders   | 8                                           |

## Ground rules

### Schema conventions

- Table names plural snake_case; column names snake_case; foreign keys `<singular>_id`;
  timestamps `<verb>_at` as `timestamptz`. Lucid maps to camelCase automatically.
- Primary key of a migrated collection: `table.string("id", 24).primary()`. Child tables created
  from embedded arrays use `table.increments("id")` unless the frontend already addresses the
  element by its Mongo subdocument `_id` (none does today; verify per step).
- Foreign keys are declared in the migration with an explicit `onDelete` chosen per relationship:
  `CASCADE` for children that cannot exist without the parent (order items, period extends),
  `SET NULL` for optional back-references (employee on an order), `RESTRICT` for references that
  must never dangle (item on an order item, customer on an order). Write the reason as a comment.
- Enum-like strings use `table.enu(column, values)` (a check constraint; no native Postgres enum
  types in this project). Booleans are `notNullable().defaultTo(false)`.
- Money stays integer NOK unless the survey finds decimals in the collection; then `decimal(10,2)`.
- Every index the Mongo schema declares gets a Postgres equivalent, including partial unique
  indexes (`customeritems.unique_active_blid`) via `this.schema.raw("CREATE UNIQUE INDEX … WHERE …")`,
  see `1786600000002_create_matches_table.ts`.
- `created_at`/`updated_at` are copied from `creationTime`/`lastUpdated`, falling back to the
  ObjectId timestamp (`ObjectId.getTimestamp()`) when the document has neither.
- `database/schema.ts` is generated from the migrations by `node ace migration:run`; never edit it.
  The generated class gives the columns; the model in `app/models/` adds relationships, scopes and
  query helpers.

### Model conventions

- One model per table in `app/models/<singular>.ts` extending the generated schema class.
- Migrated tables declare `static override selfAssignPrimaryKey = true` and a `@beforeCreate` hook
  calling `assignObjectId(row)` from `app/models/helpers/object_id.ts` (step 0), mirroring
  `app/models/message.ts`; the snippet is in that file's doc comment. Specs build ids with
  `fixtureId(n)` from `tests/fixtures.ts`.
- Query helpers live as static methods on the model (see `Signature.newestPerCustomer`), or in a
  small repository module under `app/services/<feature>/` when they span several models (see
  `app/services/matches/match_repository.ts`). Do not create a generic handler with
  get/getMany/add/update/remove.
- Aggregations become Lucid query-builder or raw SQL (`Database.rawQuery`) inside those helpers.
  Report queries in `reports_controller.ts` are the largest group.
- Serialization: controllers return models or plain objects; Tuyau derives the frontend types from
  the controller return types, so shape changes reach the frontend at compile time. Regenerate the
  committed client (`backend/.adonisjs/client/`) whenever a controller's return type or a validator
  changes; the codegen command has been observed not to exit on its own, so stop it once the files
  are written.

### Transfer conventions

- The transfer runs in `this.defer(async (database) => …)` inside the same migration that creates
  the table, guarded by `if (env.get("API_ENV") === "test") return;` so the test database (which has
  no Mongo) can run the migration. Pattern: `1787932298876_create_signatures_table.ts`; the shared
  pieces live in `database/helpers/mongo_transfer.ts` (step 0).
- Mongo is read through `withMongo(fn)`, which opens a dedicated
  `mongoose.createConnection(env.get("MONGODB_URI"), { dbName })`, where `dbName` is `production`
  when `API_ENV === "production"` and `staging` otherwise, and closes it in `finally`.
- `transferCollection({ mongo, database, collection, table, map })` streams the collection through
  the step's `map` function and inserts rows in batches of 500 with `multiInsert`. `map` returns
  `{ row, children? }` (child rows keyed by table, inserted right after their parents' batch) or
  `skip(reason)`. Lucid already runs the whole migration, including the deferred block, inside one
  transaction, so a failure leaves Postgres exactly as before; do not open a second one.
- After inserting, the migration calls `assertRowCount(database, table, migrated)` (throws on
  mismatch, which rolls the transaction back) and then `dropCollection(mongo, name)`.
- Ids go through `hexId(value)` (nullable references) or `requiredHexId(value, field)`; both throw
  on anything that is not a Mongo id, so garbage references fail the deploy instead of landing in a
  foreign-key column. Timestamps come from `timestampsOf(document)`.
- Postgres checks foreign keys per statement, and documents arrive in cursor order, so a reference
  that can point at a row of the same table or at a row a later batch inserts (self references like
  `branches.parent_branch_id`, `order_items.moved_from_order_id` / `moved_to_order_id`) must not be
  declared on `createTable`. Register the transfer with `this.defer` first and then add the key with
  `this.schema.alterTable(…)`; Lucid executes tracked `schema` and `defer` calls in registration
  order, so the key is created after every row is in place (verified in
  `@adonisjs/lucid` `BaseSchema.executeQueries`). References to tables that are complete before the
  step starts are declared on `createTable` as usual.
- Mongo `ObjectId` values are stored as their 24-char hex string; `Date` values as `timestamptz`;
  missing optional fields as `NULL`. Fields that the survey proved constant are not copied.
- `transferCollection` prints one summary line per table:
  `<table>: migrated N, skipped M (<n> <reason>, …); <child_table>: migrated K`. Read it in the
  Railway predeploy log after every deploy.

### Test conventions

- Specs that stubbed `StorageService.X` with sinon now insert real rows into the test Postgres
  database and run the code. `group.each.setup(() => testUtils.db().truncate())` resets state
  (see `tests/branch_subjects_service.spec.ts`).
- Specs that only tested the Mongoose layer (`tests/mongoDb.spec.ts`, `order_schema_info_casting`)
  are deleted when the layer they test is deleted.
- Backend commands need Node 24: prefix with `fnm exec --using=24` when `node -v` disagrees.

### Deploy and environment facts

- `main` deploys to staging, `production` deploys to live. The backend runs `bun migrate:backend`
  as a predeploy command in both, so the transfer executes inside Railway's private network.
- Staging Postgres is rebuilt from production every night at 04:00 (`copy_prod_postgres_to_staging`
  drops the schema and restores the production dump, including the `adonis_schema` table). Staging
  Mongo is rebuilt at the same time. Consequences:
  - After the nightly copy, staging Postgres lacks tables that only exist on `main` until the next
    staging deploy re-runs the pending migrations. Until then the staging backend fails on those
    tables. Decided in step 0: no automation; redeploy the staging backend by hand (Railway
    dashboard or `railway redeploy`) after the 04:00 copy whenever `main` is ahead of `production`
    by a migration. Rerunning the migrations also re-executes the Mongo transfer against the fresh
    production copy, which is the free rehearsal mentioned below.
  - Every night the staging cutover is effectively re-tested against fresh production data on the
    next staging deploy, which is a free rehearsal for the production cutover.
- Local rehearsal: `backend/.env.local` points at the staging databases, so
  `cd backend && bun run migrate:backend` from a local machine performs the real staging cutover. Use
  it to time the transfer and inspect the result before merging. Staging resets nightly, so a
  rehearsal is disposable.
- The transfer time measured on staging is the production predeploy time (same data volume).

## Per-step checklist

Copy this list into the pull request description of every step and tick it.

1. **Survey on staging.** Run read-only queries against staging Mongo (and Postgres for existing id
   columns): document count, orphan references per foreign key, distinct values of every enum-like
   field, null/absence rate of every optional field, extra keys not in the schema, decimals in
   money fields, consistency of derivable arrays, count of `active: false` documents (and whether
   any code reads `active` for that collection; if both are non-zero the column stays). Record the
   numbers in the PR and under the step's "Survey results" heading in this document.
2. **Decide orphan handling** per foreign key from the survey, and write it into the migration as
   code plus a comment.
3. **Migration**: create table(s), indexes, foreign keys (both new ones and the ones on existing
   Postgres columns listed above), then the deferred transfer with count assertion and collection
   drop. For Mongo collections that stay behind for a few more steps but lose their parent-side
   array, add the Mongo index the child-side lookup now needs (steps 5 and 8).
4. **Model(s)** with id assignment, relationships, and the static query helpers the call sites need.
5. **Rewrite call sites**: every `StorageService.X` use for that collection, every `aggregate` over
   it, every `SEDbQuery` for it. Delete the Mongoose schema file, the `BlSchemaName` entry, the
   `StorageService` entry, and the shared type or reshape it to the new columns.
6. **Frontend**: adapt features to the changed return types (Tuyau types drive the compiler),
   regenerate the committed Tuyau client.
7. **Tests**: rewrite stubs to Postgres rows, add specs for new query helpers, delete Mongo-only
   specs.
8. **Rehearse on staging locally**: run the migration against staging, check the summary line and
   the timing, spot-check rows against Mongo (before the drop, on a copy, or against production
   read-only), click through the affected pages with Playwright at desktop and 375px.
9. **`bun fix`** clean.
10. **Merge to `main`**, watch the staging predeploy log for the summary line, use staging for a
    day.
11. **Merge to `production`**, watch the predeploy log, verify the affected pages on live.
12. Update this document: status, survey results, surprises.

## Step 0 — Groundwork (no data moves) — status: done 2026-09-16 (pending merge)

Goal: make steps 1–12 mechanical by extracting the shared pieces once.

Deliverables:

- `backend/database/helpers/mongo_transfer.ts` (outside `database/migrations/`, which Lucid scans):
  `withMongo(fn)` opening and closing the connection with the `API_ENV` rules above;
  `transferCollection({ collection, table, map, filter?, batchSize = 500 })` returning
  `{ migrated, skipped }`; `assertRowCount(table, expected)`; `dropCollection(name)` tolerant of
  `NamespaceNotFound`; `hexId(value)` and `timestampOf(document)` for the id/date conventions.
  Written so that a migration reads as a mapping function plus a few calls.
- `backend/app/models/helpers/object_id.ts`: `newObjectId(): string` built on the `ObjectId`
  class of the `bson` package. Add `bson` as a direct dependency now (it is currently a transitive
  dependency of `mongodb`) so id generation survives step 13. Keep the format identical to Mongo's
  (4-byte timestamp, 5-byte random, 3-byte counter) so ids stay time-sortable and cannot collide
  with transferred ids.
- Model mixin or documented snippet for `selfAssignPrimaryKey` + `@beforeCreate` id assignment.
- Test helper for inserting fixture rows with generated ids where the specs need it.
- Timing dry run: transfer the `orders` collection to a throwaway table against staging locally with
  the helper (then drop the table), to know the predeploy duration for the largest step before
  committing to the one-shot approach. Record the number here.
- Decide how staging recovers after the nightly Postgres copy: either extend
  `copy_prod_postgres_to_staging` to trigger a staging backend redeploy (Railway CLI in the cron
  image) or document that a manual redeploy is required. Record the decision here.
- Confirm on production Mongo whether `messages`, `signatures`, `stand_matches`, `user_matches`
  still exist; if so, drop them (they are fully migrated) so the nightly copy stops resurrecting
  them.

Survey results / notes (2026-09-16):

- `backend/database/helpers/mongo_transfer.ts`: `withMongo`, `transferCollection` (with
  `skip(reason)`, child tables, summary line), `assertRowCount`, `dropCollection`, `hexId`,
  `requiredHexId`, `timestampOf`, `timestampsOf`. Spec: `tests/mongo_transfer.spec.ts` (runs the
  batching against scratch tables in the test Postgres).
- `backend/app/models/helpers/object_id.ts`: `newObjectId`, `isObjectIdHex`, `assignObjectId`;
  `bson` ^7.3.2 is a direct dependency. The model snippet is the file's doc comment (no mixin: Lucid
  hooks are decorators, so a four-line snippet per model is clearer than a class factory). Spec:
  `tests/object_id.spec.ts`.
- `backend/tests/fixtures.ts`: `fixtureId(n)` for readable deterministic ids in specs.
- Staging recovery after the nightly Postgres copy: manual redeploy (see "Deploy and environment
  facts"). Automating it would put Railway credentials in the cron image for a situation that only
  arises while `main` is ahead of `production` by a migration.
- Staging Mongo (2026-09-16) still held `messages` 103 301, `signatures` 4 864, `stand_matches` 374
  and `user_matches` 838 documents, all restored nightly from production even though the migrations
  that dropped them are on `production`. `1789100000000_drop_migrated_mongo_collections` drops all
  four again wherever it runs.
- Timing dry run (orders → throwaway `dry_run_orders` + `dry_run_order_items`, per the step 8
  schema minus foreign keys, from a laptop over Railway's public TCP proxy, so slower than the
  predeploy inside the private network): 570 s (9.5 min) for 184 908 orders and 488 898 order
  items, in one transaction, batches of 500 parents. Round trips dominate (about 0.75 s per insert
  statement), so the predeploy inside the private network should be well under this; treat
  10 minutes as the upper bound for step 8 and expect a similar order of magnitude for step 9
  (customer items). Acceptable for the one-shot approach; deploy steps 8 and 9 in a quiet hour.
- Early step 8 survey facts from the dry run: 381 orders have no `customer` (skipped in the dry
  run; step 8 must decide, probably drop them after checking they are unplaced carts); every order
  item has an `item`; the largest order has 32 lines (the child inserts are chunked in
  `transferCollection` because 500 parents × 32 lines × 19 columns would exceed Postgres's 65 535
  bind parameters).

## Step 1 — items → `items` — status: done 2026-09-16 (rehearsed on staging, pending merge)

Smallest collection with the widest fan-in: it establishes the string-primary-key pattern and turns
four existing Postgres columns into real foreign keys.

Target schema `items` (decided 2026-09-16 after the survey below):

| Column                 | Type                           | From               | Notes                                                                    |
| ---------------------- | ------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| id                     | string(24) PK                  | `_id`              |                                                                          |
| title                  | text not null                  | `title`            |                                                                          |
| price                  | integer not null               | `price`            | survey: always integer                                                   |
| isbn                   | bigint unique not null         | `info.isbn`        | 13 digits exceed int4; pg returns int8 as string, the model `consume`s   |
| subject                | text not null                  | `info.subject`     |                                                                          |
| year                   | integer not null               | `info.year`        |                                                                          |
| weight                 | double precision null          | `info.weight`      | kilograms; legacy `"?"` (13 docs) becomes NULL                           |
| distributor            | text not null                  | `info.distributor` |                                                                          |
| discount               | double precision not null      | `info.discount`    | fraction 0–1 with up to 3 decimals; double so the driver returns numbers |
| publisher              | text not null                  | `info.publisher`   |                                                                          |
| active                 | boolean not null default true  | `active`           | kept: 347 of 685 are inactive and code reads it (see below)              |
| buyback                | boolean not null default false | `buyback`          |                                                                          |
| price_history          | jsonb not null default '{}'    | `info.price` (Map) | `{ "<calendar year>": price }`, see below                                |
| created_at, updated_at | timestamptz                    |                    |                                                                          |

`info.price` is keyed by calendar year (2018–2026 on staging, each item holding its own subset), so
the fixed-column option is out. Decided 2026-09-16 (Adrian): `price_history jsonb` rather than a
child table, because only the book form reads it (as a history list) and only the management
service writes it (this year's entry on every price change). This is the one exception to the
"jsonb only for vendor payloads" decision.

`active` is a real feature for items, not a dead meta field: `MongodbHandler.getAll`/`getMany`
hide inactive items from non-admins, the book grid on `/admin/database/boker` has the Aktiv switch
and opens filtered on it, and the form and spreadsheet edit it. The Postgres model keeps an
`active` scope; the admin listing returns everything, the customer listing only active titles.
Single-id reads never filtered on `active` in Mongo (`findById`) and still do not.

Dropped: `user`, `editableFor`, `viewableFor` (always empty), `taxRate` (8 documents, never read),
`info._id` (Mongoose subdocument artefact).

Foreign keys added on existing tables after the transfer (all `RESTRICT`: an item with history
must not be deleted; item deletion is not a feature): `branch_subject_books.item_id`,
`match_obligations.item_id`, `book_handovers.item_id`, `waiting_list_customers.item_id` (the last
one was missing from the table above; it is empty on staging).

Code to move (37 `StorageService.Items` refs / 22 files, plus the joins below): `item_lookup.ts`,
`item_management_service.ts` (PATCH and bulk upsert by id/ISBN for `/admin/database/boker`),
`blid_registration_service.ts`, `branch_subjects_service.ts` (title aggregate → `Item.byIds`),
order validators that check item existence, stand cart line resolver and pricing, invoices,
matches (`read_matches.ts`, `statistics.ts`, `record_transfer.ts`), `delivery_service.ts`,
`cart_service.ts`, `order_service.ts`, `unique_item_edit_service.ts`, `public_blid_lookup_service.ts`,
`blid_search_service.ts`, `customer_item_actions_service.ts`, `bulk_collection_controller.ts`,
`customer_items_controller.ts`, `branch_catalog_controller.ts`, `branch_items_controller.ts`.

Mongo aggregations that `$lookup` into `items` (missed by the first draft of this plan; every one
becomes an aggregation without the join plus an `Item.byIds` lookup merged in code, keeping the
CSV column order where the rows feed a report): `reports_controller.ts` (customer items and orders
reports), `reminders_controller.ts`, `customer_items_controller.forCustomer`,
`order_service.getOpenOrderItems`, `order_manager_service.ordersReportPipeline`,
`branch_books_service.ts` (`ITEM_TITLE_STAGES`, two summaries), `public_blid_lookup_service.ts`
(`findHandedOut`), `blid_search_service.search`.

API shape: the frontend receives the flat row (`isbn`, `subject`, `weight`, … instead of `info.*`)
through `ItemTransformer`; the shared `Item` type is reshaped to match, so every consumer is caught
by the compiler. The book spreadsheet keeps the legacy `info.isbn`-style headers (importcsv matches
on them), mapped explicitly on download and upload.

Tests: `item_lookup.spec.ts`, `item_management_service.spec.ts`, `branch_subjects_service.spec.ts`
(drop the `stubItemTitles` sinon stub, insert items) and every spec that stubbed
`StorageService.Items` (14 files) insert real rows into the test Postgres instead.

Survey results (staging Mongo, 2026-09-16, 685 documents):

- `active: false` on 347 documents; `active` present on all. Column kept (see above).
- `info.price` keys: 2018 (415 docs), 2019 (421), 2020 (465), 2021 (517), 2022 (606), 2023 (476),
  2024 (484), 2025 (498), 2026 (338). Every value an integer; no document without a price map.
- `price`: all integers. `info.discount`: {0, 0.15, 0.175, 0.2, 0.23, 0.25, 0.45}.
- `info.weight`: kilograms with ≤ 3 decimals, stored as a mix of strings and numbers; 13 documents
  hold `"?"`; none are 0 or empty.
- `info.isbn`: always a number, always 13 digits (max 9788293092032), unique (the `isbn_unique`
  index holds). `info.year`: 1998–2026. No empty `title`/`subject`/`distributor`/`publisher`.
- Extra keys: `taxRate` (8), `viewableFor` (685, always `[]`), `info._id` (519), `__v`. `user` is
  always an admin `u#…` reference, `editableFor` always `[]`.
- `creationTime`/`lastUpdated` are `Date` on every document.
- Postgres id columns: `branch_subject_books.item_id` (67 distinct), `match_obligations.item_id`
  (62), `book_handovers.item_id` (164), `waiting_list_customers.item_id` (0 rows): zero orphans,
  all `varchar(24) not null`.
- Mongo references into items: `branchitems.item` 227 distinct, 0 orphans. `uniqueitems.item`,
  `customeritems.item` and `orders.orderItems.item` each reference one item id that no longer
  exists, `5b6441add2e733002fae8723`. Not this step's problem (those collections stay in Mongo for
  now), but steps 7, 8 and 9 must decide how to handle rows pointing at it before declaring their
  `item_id` foreign keys (survey the affected documents; `SET NULL` is not an option for a
  required reference, so it is either a placeholder item or dropping/skipping those documents).
  `branches.branchItems` holds branchitem ids, not item ids (4 027 distinct), so it is irrelevant
  here.

Notes (2026-09-16):

- Staging rehearsal from a laptop: `items: migrated 685, skipped 0`, whole migration 4.4 s, the
  Mongo collection dropped. Row spot-check afterwards matched the survey exactly (685 rows, 347
  inactive, 13 NULL weights, 685 distinct ISBNs, same discount set and year histogram, the four
  foreign keys present).
- Migration `1789200000000_create_items_table.ts`; model `app/models/item.ts` (`activeOnly`
  scope, `findByIsbn`, `byIds`, `titlesByIds`); `app/transformers/item_transformer.ts` gives the
  API the flat `Item` shape; `app/services/report_item_columns.ts` (`withItemColumns`) joins
  catalogue columns into Mongo report rows in place of the projected `itemId`, keeping the CSV
  column order.
- The `bigint` ISBN comes back from the pg driver as a string; the model declares
  `@column({ consume: Number })` on `isbn` and `tests/item_model.spec.ts` guards the round trip.
  Lucid's schema generator types bigint as `bigint | number`, numeric/decimal as `string` and
  double precision as `number`, which is why weight and discount are doubles.
- Specs: every spec that inserts a row referencing `items` now seeds real items
  (`tests/item_fixtures.ts` `createItem`, `tests/matches/match-testing-utils.ts`
  `seedTestCatalogue`). `testUtils.db().truncate()` registered as a setup returns the cleanup
  hook, i.e. it empties tables _after_ each test; seed rows in a separate setup, never by awaiting
  `truncate()` inside one.
- Behaviour kept on purpose: the public buyback list never filtered on `active` and still does
  not; joins that were inner joins (open order items, reminders) still drop rows whose item is
  gone; outer joins (branch book summaries, customer items for a customer) still fall back to
  "Ukjent bok". The `BlError` 702 flow in `order_item_validator.ts` is preserved by hand;
  everywhere else a missing item is `Item.find` → null or `findOrFail` → 404.
- Frontend: `Item` consumers read `isbn`/`subject`/… directly; the book form's weight field is a
  bare `NumberInput` so an empty field can mean "unknown" (the shared `NumberField` coerces empty
  to 0); the spreadsheet keeps the legacy `info.*` headers via an explicit mapping on download,
  and the weight column is optional on upload.
- The user's running `bun dev` backend does not survive the step's file changes (Mongoose
  "Cannot overwrite `branches` model once compiled" under HMR); restart `bun dev` after pulling.

## Step 2 — companies → `companies` — status: done 2026-09-16 (rehearsed on staging, pending merge)

Target schema `companies` (decided 2026-09-16 after the survey below): `id` string(24) PK, `name`,
`phone`, `email`, `address`, `post_code`, `post_city`, `customer_number`, `organization_number`,
all `text not null`, plus timestamps. `contactInfo` is flattened. No unique index on
`organization_number` (two companies share Oslo kommune's invoice centre). Referenced later by
`invoices.company_id` (step 12), which will be nullable: no invoice has ever stored a
`companyDetail`.

Dropped: `user`, `editableFor`, `viewableFor` (always `[]`), `active` (always `true`, never read).

Code moved (4 refs / 2 files): `companies_controller.ts` (list, create, delete) and
`services/invoices/company_invoice_service.ts` (the customer snapshot on a hand-written company
invoice). Model `app/models/company.ts` (`allByName`, Norwegian collation in code);
`app/transformers/company_transformer.ts` gives the API the flat `Company` shape.

API shape: `GET /companies` returns the flat row (`phone`, `email`, `address`, `postCode`,
`postCity` at top level) and `POST /companies` accepts the same flat shape (decided 2026-09-16:
one shape in and out; the create form maps its postal field on submit). The shared `Company`
type is reshaped to match; `CompanyManager.tsx` is the only frontend consumer besides the
company-invoice select, which reads `id`, `name` and `organizationNumber` and did not change.

Tests: `tests/company_invoice_service.spec.ts` inserts a real company (`tests/company_fixtures.ts`
`createCompany`) instead of stubbing `StorageService.Companies`; `tests/company_model.spec.ts`
guards id assignment and the sort order.

Survey results (staging Mongo, 2026-09-16, 24 documents):

- Every field present and a non-empty string on all 24 documents (`name`, `customerNumber`,
  `organizationNumber`, `contactInfo.{phone,email,address,postCode,postCity}`). Hence every column
  `not null`.
- Two documents carry a leading space in `organizationNumber`/`customerNumber` (they predate the
  schema's `trim`); the transfer trims every string.
- Five documents (four fylkeskommune invoice centres and Oslo kommune) hold the literal string
  `"0"` as `email`, the legacy way of saying "no email". Transferred as is; the validator requires a
  real address for new companies. Company invoices copy it into `customerInfo.email` exactly as
  before.
- `organizationNumber` `976820037` is shared by "Oslo kommune - Fakturasentralen" and "Ullern
  videregående skole, Oslo kommune Fakturasentralen"; `customerNumber` equals the organization
  number except for the two oldest companies (`111`, `112`).
- `active: true` on all 24; `editableFor`/`viewableFor` always `[]`; `user` an admin `u#…`
  reference on 22. `creationTime`/`lastUpdated` are `Date` on every document.
- Invoices: `customerInfo.companyDetail` is `null` on all 7 735 invoices; 102 invoices carry an
  `organizationNumber` in their snapshot (how the frontend tells company invoices apart today).

Notes (2026-09-16):

- Staging rehearsal from a laptop: `companies: migrated 24, skipped 0`, whole migration 2.9 s, the
  Mongo collection dropped. Spot-check afterwards: 24 rows, no untrimmed numbers, no
  upper-case emails, no null timestamps, sort order as expected.
- Migration `1789300000000_create_companies_table.ts`.
- Verified with Playwright on `/admin/database/selskap` (24 cards sorted, create → row appears with
  the flat body, delete → row gone, no horizontal scroll at 375px) and on
  `/admin/faktura?fakturaFane=selskapsfaktura` (the select offers all 24 companies).
- As after step 1, the running `bun dev` backend dies with Mongoose's "Cannot overwrite `branches`
  model once compiled" when the schema file is deleted under HMR; touching `start/routes.ts`
  triggers a full restart of the child without killing `bun dev`.

## Step 3 — branches → `branches` + `branch_periods` — status: done 2026-09-16 (rehearsed on staging, pending merge)

Target schema `branches`:

| Column                                | From                                 | Notes          |
| ------------------------------------- | ------------------------------------ | -------------- |
| id string(24) PK                      | `_id`                                |                |
| name not null                         | `name`                               |                |
| logo                                  | `logo`                               |                |
| type enu(VGS, privatist) null         | `type`                               |                |
| parent_branch_id FK branches SET NULL | `parentBranch`                       | self reference |
| local_name                            | `localName`                          |                |
| child_label                           | `childLabel`                         |                |
| payment_responsible bool              | `paymentInfo.responsible`            |                |
| responsible_for_delivery bool         | `paymentInfo.responsibleForDelivery` | default false  |
| buyout_percentage decimal             | `paymentInfo.buyout.percentage`      | default 1      |
| sell_percentage decimal               | `paymentInfo.sell.percentage`        | default 1      |
| delivery_at_branch bool               | `deliveryMethods.branch`             | default true   |
| delivery_by_mail bool                 | `deliveryMethods.byMail`             | default true   |
| branch_items_live_online bool         | `isBranchItemsLive.online`           |                |
| branch_items_live_at_branch bool      | `isBranchItemsLive.atBranch`         |                |
| region not null                       | `location.region`                    |                |
| address                               | `location.address`                   |                |
| timestamps                            |                                      |                |

Dropped: `childBranches` (derivable from `parent_branch_id`; survey that every child listed has the
matching `parentBranch`, otherwise `parentBranch` wins and the discrepancy is logged),
`branchItems` (derivable from `branch_items.branch_id` after step 4; until then the two readers of
the array query `StorageService.BranchItems` by branch).

Target schema `branch_periods` (one row per entry of `partlyPaymentPeriods`, `rentPeriods`,
`extendPeriods`): `id increments`, `branch_id FK CASCADE`, `kind enu(partly_payment, rent, extend)`,
`period_type enu(semester, year)`, `date timestamptz`, `max_number_of_periods int null`,
`percentage decimal null`, `price int null`, `percentage_buyout`, `percentage_buyout_used`,
`percentage_up_front`, `percentage_up_front_used` (decimals, null unless kind = partly_payment).
Index `(branch_id, kind)`. The shared `BranchPaymentInfo` type is reshaped to three arrays built
from this table by the branch model (`periodsOf(kind)`), so the frontend keeps addressing
`rentPeriods`, `extendPeriods`, `partlyPaymentPeriods` by name.

Foreign keys added on existing tables: `branch_subjects.branch_id`, `opening_hours.branch_id`,
`waiting_list_customers.branch_id`, all `CASCADE` (a deleted branch takes its configuration with
it). The two existing columns are untyped `string`; alter them to `string(24)` first.

Code to move (56 refs / 26 files): `branch_relationship_service.ts` (parent/child tree),
`branch_signature_status_service.ts`, `branch_insights_service.ts`, `branch_books_service.ts`,
`deadline_window.ts` and `date_service.ts` (period lookups), order validators (rent/extend/partly
payment period checks), stand cart pricing, matches `round_scope.ts`, `user_provisioning_service.ts`,
`/admin/database/filialer` tabs.

Survey queries: `type` values outside the enum; `childBranches` vs `parentBranch` consistency;
periods with missing `date`/`type`; percentages outside 0..1; `location.region` missing.

Decisions taken with Adrian after the survey (2026-09-16): the API shape is the flat row plus the
three period lists (`paymentResponsible`, `responsibleForDelivery`, `buyoutPercentage`,
`sellPercentage`, `deliveryAtBranch`, `deliveryByMail`, `branchItemsLiveOnline`,
`branchItemsLiveAtBranch`, `region`, `address`, `parentBranchId`, `rentPeriods`, `extendPeriods`,
`partlyPaymentPeriods`), the same shape in and out; the "Består av" multiselect on the Relasjoner
tab stays as a command (`PATCH /branches/relationships` takes `childBranchIds`, re-parents the
listed branches and makes the dropped ones roots; `GET` returns no child list, the form derives it
from the other branches' `parentBranchId`); the one branch without a region ("Sonans Lillestrøm",
inactive) gets `"Lillestrøm"` hard-coded in the migration rather than a nullable column.

`active` is kept: 11 branches are inactive and the public listing must hide them (the old
`indexPublic` meant to filter on `active` and `isBranchItemsLive.online` but overwrote the first
filter with the second; the Postgres version filters on both, which changes nothing today because
every inactive branch is also offline). `logo` is kept although no branch has one (the form offers
it). Percentages are `double precision` like `items.discount`.

Survey results (staging Mongo, 2026-09-16, 115 documents):

- `type`: privatist 34, VGS 28, null 3, missing 50. `active: false` on 11. `name` always set,
  no duplicates. `logo` never set; `openingHours` never set; `localName` missing on 8;
  `childLabel` set on 25; `location.address` on 24; `location.region` missing on exactly one
  document (see above), casing inconsistent ("oslo"/"Oslo") and kept as is.
- `parentBranch` ObjectId on 99 (7 null, 9 missing); `childBranches` fully consistent with it:
  zero children missing their parent reference, zero parents missing a child, no branch claimed
  by two parents, no cycles; 16 roots, 94 leaves, depth ≤ 3.
- `branchItems`: 4 027 entries on 57 branches, 3 506 of them pointing at deleted branch items,
  and 845 of the 1 366 branch items not listed on any branch. Dropped; nothing reads it (the
  `PUT /branches/:id/items` handler wrote it with a wrong payload).
- Periods: 65 partly-payment entries (33 branches, semester 33 / year 32, buyout 0.33 or 0.333
  or 1, up-front 0, 0.6, 0.65 or 1), 28 rent entries (28 branches, all `maxNumberOfPeriods` 1,
  percentage 1 except one 0.001), 32 extend entries (all semester, price 50, `percentage` never
  set, `maxNumberOfPeriods` 1). Nine period dates (three Sonans branches) are ISO strings, not
  `Date`. No duplicate (type, date) within a branch.
- `paymentInfo` present on all; `responsibleForDelivery` missing on 54; `buyout.percentage`
  {1, 0.5, 0.33}; `sell.percentage` {1, 0.333, 0.33, 0.333333}. `deliveryMethods` on all
  (branch/byMail: 54 both, 29/29 one of them, 1 neither); `isBranchItemsLive` missing on 46.
- `user` on 59, `editableFor`/`viewableFor` always `[]`, `_id` subdocument artefacts on
  `location` (33), `buyout`/`sell` (3) and most period entries. Timestamps are `Date` on all.
- References into branches from other Mongo collections: `orders.branch` (68 distinct),
  `customeritems.handoutInfo.handoutById` (59), `userdetails.branchMembership` (87 + null),
  `payments.branch` (57), `invoices.branch` (56 + null), `branchitems.branch` (52): zero
  orphans everywhere. Postgres: `branch_subjects.branch_id` (14 distinct, varchar(24)),
  `opening_hours.branch_id` (11, varchar(255)), `waiting_list_customers.branch_id` (empty,
  varchar(255)), `match_rounds.branches` text[] (50 ids): zero orphans; the two varchar(255)
  columns are narrowed to 24 by the migration.

Notes (2026-09-16):

- Staging rehearsal from a laptop: `branches: migrated 115, skipped 0; branch_periods: migrated
125`, `1 regions filled in by hand`, whole migration 4.5 s, the Mongo collection dropped. A
  field-by-field comparison of every row and period against a JSON dump taken before the run
  found zero differences; the five foreign keys (`branch_periods`, self reference,
  `branch_subjects`, `opening_hours`, `waiting_list_customers`) are in place.
- Migration `1789400000000_create_branches_table.ts`; models `app/models/branch.ts` (`allByName`,
  `publicByName`, `findOptional`, `getOrFail`, `byIds`, `namesByIds`, recursive-CTE
  `descendants`/`descendantIds`/`leafDescendants`, `toDto`) and `app/models/branch_period.ts`
  (`rowsFor`, the three `to*Period` mappers); `app/services/branch_service.ts` (`createBranch`,
  `updateBranch` with wholesale period-list replacement in a transaction,
  `updateBranchRelationships` with cycle detection); `BranchRelationshipService` is now a thin
  facade over the model helpers.
- Periods are preloaded by `beforeFind`/`beforeFetch` hooks, so every read carries them; the
  getters throw on a branch that was `create`d without a reload (`createBranch` re-reads the
  row). The API returns `branch.toDto()` rather than a transformer because Adonis'
  `InferData<Transformer>` types `Date` as `string`, while plain controller returns keep `Date`
  like every other endpoint (`ActiveCustomerItem.deadline`); the frontend already treats these as
  strings at runtime.
- Aggregations that `$lookup`ed into branches (reports ×4, customer items for a customer, public
  blid lookup, branch book details) now project the branch id and join the name in code
  (`app/services/report_columns.ts` `withBranchName`, keeping CSV column order).
- Frontend: `BranchGeneralSettings`, `BranchPaymentSettings`, `BranchRelationshipSettings` use
  the flat fields; `shared/utils/branchTree.ts` builds the tree from `parentBranchId` (roots are
  branches whose parent is not in the list). Verified with Playwright on
  `/admin/database/filialer` (tree with 16 roots, all three tabs, address save/revert, payment save,
  removing and re-adding a class via "Består av"), `/bestilling` (grouped by region) and
  `/info/branch/:id` (address), at desktop and 375 px.
- Pre-existing behaviour noticed, left alone: saving the payment form re-parses the period dates
  from `YYYY-MM-DD` through `vine.date()` as Oslo midnight, so a UTC-midnight deadline
  (`2027-09-01T00:00Z`) becomes `2027-08-31T22:00Z` (same Oslo day; the code compares Oslo
  days). The percentage slider's "100 %" mark label overflows a 375 px viewport by 8 px on the
  Betaling tab.
- As after steps 1 and 2, the running `bun dev` backend dies with Mongoose's "Cannot overwrite
  `branchitems` model once compiled" when the schema file is deleted under HMR; touching
  `start/routes.ts` restarts the child.

## Step 4 — branchitems → `branch_items` — status: done 2026-09-16 (rehearsed on staging, pending merge)

Target schema `branch_items`: `id string(24) PK`, `branch_id FK CASCADE`, `item_id FK CASCADE`,
`unique(branch_id, item_id)`, six booleans (`rent`, `partly_payment`, `buy`, `rent_at_branch`,
`partly_payment_at_branch`, `buy_at_branch`), `categories text[] not null default '{}'`,
timestamps. The plan's first draft listed ten booleans; `sell`, `sell_at_branch`, `live` and
`live_at_branch` were dropped after the survey (see below).

Code to move (7 refs / 4 files): `branch_books_service.ts` (branch "Bøker" tab), cart/order
validators checking that a branch offers an item, the two `branch.branchItems` readers from step 3.

Survey queries: documents whose `branch` or `item` no longer exists (drop and log; a branch item
without either side is meaningless); duplicate (branch, item) pairs; `categories` non-empty count.

Decisions taken with Adrian after the survey (2026-09-16): drop `sell`, `sellAtBranch`, `live`
and `liveAtBranch` (false on all but six documents, read by nothing in backend or frontend, and
the only writer overwrote all four to false on every save); keep `categories` as a `text[]`
column (it drives the public catalog grouping and the "Fag" tags on the branch's book list; the
API keeps calling it `subjects`); `PUT /branches/:branchId/items` becomes a diff inside one
transaction (rows for titles already on the list are updated in place so their id and
`created_at` survive, new titles are inserted, titles left out are deleted) instead of the old
delete-all-and-reinsert. The API shape of `GET`/`PUT /branches/:branchId/items` and of
`GET /branches/:branchId/catalog` is unchanged, so the frontend needed no changes and the
committed Tuyau client did not change.

Survey results (staging Mongo, 2026-09-16, 1 366 documents):

- Every field present on every document with the declared type: `branch`/`item` ObjectId, the
  ten booleans `Boolean`, `categories` array, `creationTime`/`lastUpdated` `Date`. Extra keys:
  `active` (never false), `editableFor` (1 366), `viewableFor` (1 321), `user` (529), `__v`.
  `required` (removed by `1788518000000_drop_branch_item_required`) on 0.
- References: `branch` → 52 distinct branches, `item` → 227 distinct items, zero orphans against
  Postgres `branches` and `items`; zero duplicate (branch, item) pairs (the Mongo unique index
  `branch_item_unique` held). Nothing else, in Mongo or Postgres, references branch items.
- Booleans (true count): `rent` 390, `partlyPayment` 911, `buy` 42, `rentAtBranch` 419,
  `partlyPaymentAtBranch` 910, `buyAtBranch` 830, `sell` 6, `sellAtBranch` 6, `live` 0,
  `liveAtBranch` 0.
- `categories`: non-empty on 1 358, 1 470 entries, 163 distinct names (top: "Kjemi 2" 75,
  "Kjemi 1" 70, "Fysikk 1" 45), no blank or whitespace-padded names, no duplicates within a
  document.

Notes (2026-09-16):

- Staging rehearsal from a laptop: `branch_items: migrated 1366, skipped 0`, whole migration
  4.87 s, the Mongo collection dropped. A field-by-field comparison of every row against a JSON
  dump taken before the run found zero differences; both foreign keys and the unique index are in
  place. The migration still guards against orphans (an entry whose branch or item is gone is
  skipped and counted) in case production differs.
- Migration `1789500000000_create_branch_items_table.ts`; model `app/models/branch_item.ts`
  (`forBranch` returns the query so callers chain `.preload("item")`, `findPair`, `belongsTo`
  branch and item); `app/services/branch_items_service.ts` (`list` preloads the items, `replace`
  with the diff semantics above where Lucid skips the UPDATE for rows whose values did not change,
  400 on a title listed twice or unknown). `CartService.getOptions` became a pure function taking
  the branch and item it used to fetch per call, so the public catalog runs four queries (branch,
  periods, entries, items) instead of three per entry (review, 2026-09-16). The stand cart line
  resolver and `BranchSubjectsService.importFromBranchItems` (which used to `aggregate` over
  Mongo) read the model. The shared `BranchItem` type is reshaped to the columns (`branchId`, `itemId`, six
  flags, `categories`) and no longer extends `BlDocument`; the model satisfies it structurally,
  so the pure pricing functions and their `mock<BranchItem>` specs are unchanged.
- Specs: `tests/branch_items_service.spec.ts` (new); `stand_cart_line_resolver.spec.ts` and
  `branch_subjects_service.spec.ts` lost their `StorageService.BranchItems` stubs (the former had
  no test using branch items at all, the latter now inserts rows). Verified with Playwright on
  `/admin/database/filialer?filialFane=books` for "Fri privatist" (57 cards, toggle-save-reload,
  remove-save-reload, re-add through the "Legg til" modal with a subject tag and two switches) and
  `/bestilling/:branchId` (45 subjects), at desktop and 375 px.
- Pre-existing behaviour noticed, left alone: titles starting with punctuation ("¿Sabes? 2022")
  sort first on the Bøker tab, both with the old plain `localeCompare` and the new
  `localeCompare(…, "nb")`.

## Step 5 — userdetails + users → `users` — status: done 2026-09-21 (rehearsed on staging, pending merge)

The two collections are 1:1 (16 706 vs 16 705 documents) and merge into a single table keyed by the
user-details id, since that is the id every token (`details` claim), route, avatar seed and Postgres
column already carries. The old `users._id` disappears; the survey must confirm nothing stores it
(tokens use `sub = blid`, not the users id; `StorageService.Users.update(user.id, …)` in
`token_service.ts`, `password_service.ts` and `local_controller.ts` becomes an update by the merged
id).

Target schema `users`:

| Column                                                      | From                                   | Notes                                                                                      |
| ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| id string(24) PK                                            | `userdetails._id`                      |                                                                                            |
| name                                                        | `name`                                 |                                                                                            |
| email unique not null                                       | `email`                                | always present (confirmed 2026-09-16); lowercased on write; unique index on `lower(email)` |
| phone unique null                                           | `phone`                                | partial unique index `WHERE phone IS NOT NULL`                                             |
| address, post_code, post_city                               |                                        |                                                                                            |
| email_confirmed bool                                        | `emailConfirmed`                       |                                                                                            |
| dob date null                                               | `dob`                                  |                                                                                            |
| guardian_name, guardian_email, guardian_phone               | `guardian.*`                           |                                                                                            |
| blid not null                                               | `blid`                                 | token `sub`                                                                                |
| branch_membership_id FK branches SET NULL                   | `branchMembership`                     |                                                                                            |
| task_confirm_details bool                                   | `tasks.confirmDetails`                 | default false                                                                              |
| task_sign_agreement bool                                    | `tasks.signAgreement`                  | default false                                                                              |
| permission enu(customer, employee, manager, admin) not null | `users.permission`                     | default customer                                                                           |
| local_hashed_password                                       | `users.login.local.hashedPassword`     | null for Vipps-only users                                                                  |
| vipps_user_id unique null                                   | `users.login.vipps.userId`             |                                                                                            |
| local_last_login timestamptz                                | `users.login.local.lastLogin`          | folded into `last_active_at` by the session-tables migration                               |
| vipps_last_login timestamptz                                | `users.login.vipps.lastLogin`          | folded into `last_active_at` by the session-tables migration                               |
| last_token_issued_at timestamptz                            | `users.login.lastTokenIssuedAt`        | folded into `last_active_at` by the session-tables migration                               |
| timestamps                                                  | `userdetails.creationTime/lastUpdated` |                                                                                            |

Dropped: `orders` and `customerItems` arrays. Until steps 8 and 9 land, the readers (4 backend
files for orders, 6 for customer items, plus the frontend customer views) fetch by
`StorageService.Orders.getByQuery(customer = id)` / `CustomerItems` likewise. This migration also
creates Mongo indexes `orders.customer` and `customeritems.customer` (neither exists today), using
the pattern of `1788900000000_create_orders_open_list_index.ts`.

Foreign keys added on existing tables, after orphan survey (the inactive-user cron has deleted
users, so orphans are expected): `signatures.customer_details_id` CASCADE (a deleted customer's
signatures go too), `match_participants.user_detail_id` RESTRICT (NULL means the stand, so SET NULL
would corrupt meaning; a user with match history cannot be deleted), `book_handovers.from/to`
SET NULL, `sendouts.initiated_by_details_id` SET NULL, `messages.regarding_customer_details_id`
SET NULL. Orphans in SET NULL columns are nullified by the migration with a logged count; orphans in
the RESTRICT/CASCADE columns are surveyed and decided individually.

Code to move (103 refs / ~45 files): `user_detail_service.ts` (search over name/email/phone → `ILIKE`
with a `pg_trgm` GIN index if the survey of search latency needs it), `user_service.ts`,
`user_management_service.ts` and `user_duplicates_service.ts` (aggregates → SQL; the merge flow
moves orders/customer items/signatures to the surviving user), `user_provisioning_service.ts`,
`user_metrics_service.ts`, `token_service.ts`, `password_service.ts`, `permission_service.ts`, auth
controllers (local, Vipps, email verification, password reset), `signature_gallery_service.ts`,
customer search spotlight, Kasse customer view, `/admin/database/brukere`, reports aggregate over
userdetails. Frontend: `UserDetail` shared type is imported in 20 files; rename to the merged shape
(or keep `UserDetail` as the exported name of the model's serialized type to limit churn; decide in
the step).

Also in this step: delete `cron_jobs/database_cleanup/remove_old_order_references.sh` and
`remove_old_customer_item_references.sh` (they repaired the dropped arrays) and
`remove_inactive_users.sh` (it joined users, userdetails, customeritems and orders inside Mongo,
which is no longer possible). Adrian reimplements user cleanup later, once orders and customer items
are in Postgres.

Tests: `auth_middleware.spec.ts`, `checkout_signature_guard.spec.ts`, `branch_signature_status.spec.ts`,
customer-related order validator specs (`order-user-detail-validator.spec.ts`), plus new specs for
the query helpers.

Survey queries: users without userdetail and vice versa; userdetails without `email` (expected 0,
the column is not null); duplicate emails differing only in case; duplicate phones; `permission`
outside the enum; users with neither local nor Vipps login; `userdetails.active: false` count and
whether any code reads it (the `active` column is only kept if both are non-zero); orphan ids in
each Postgres column listed above; ids in `match_rounds.excluded_customer_ids` not in userdetails.

Survey results (2026-09-21, staging):

- 16 716 userdetails, 16 715 users; every user points at an existing userdetail, none shared. One
  userdetail (a 2022 customer with 3 orders) has no user document; it migrated with permission
  `customer` and no login.
- Permission: customer 16 647, employee 61, manager 4, admin 3. Login shape: 9 055 have no login
  at all (never logged in since the auth rewrite), 3 624 local only, 4 974 Vipps only, 954 both.
  One Vipps user id was attached to two accounts (a guardian who had logged in on their child's
  account before creating their own); the older account keeps it, the newer one lost its Vipps
  login and re-links by phone or email on its next Vipps login, which is how the callback resolves
  the account anyway.
- Email always present, 0 case duplicates, 2 not lowercased (lowercased on transfer). Phone: 21
  missing (NULL), 0 duplicates, 3 not eight digits (`+47…`, trailing space). Guardian object on
  14 413 but only 5 193 with any field filled, 27 partially filled; 80 guardian phones with `+47`
  or padding and 3 stored as integers. Phones are normalised to eight digits on transfer; 1 phone
  and 7 guardian phones that still did not come out as eight digits were kept as they were.
- dob: 233 missing; 9 836 stored as Oslo midnight (22:00/23:00Z), 6 600 as UTC midnight, ~30 equal
  to `creationTime` (2018–2021 imports). Three impossible dates (years 200207, 200303 and 1194)
  were cleared to NULL. Everything else became the calendar day it names in Oslo time.
- `active: false`: 0 on both collections (column dropped). Dead keys dropped: `user`,
  `editableFor`, `viewableFor`, `signatures` (the pre-Postgres array, 16 559), `lastActive`
  (7 356), `temporaryGroupMembership` (264), `__v`.
- `orders`/`customerItems` arrays: 81 207 / 93 680 entries; 55 748 orders and 53 341 customer items
  on staging belong to deleted users, so the arrays were already the weaker side. Both dropped;
  `orders.customer_1` and `customeritems.customer_1` Mongo indexes created.
- `branchMembership`: 87 distinct, 0 orphans against Postgres branches.
- Postgres orphans: signatures 3 rows (deleted), match_participants 1 (a stand match in a draft
  round with 6 obligations; the match was deleted), messages 28 rows / 6 ids (set to null),
  password_resets 2 rows / 1 id (deleted), book_handovers 0, sendouts 0, email_verifications 0,
  `match_rounds.excluded_customer_ids` 0.

Notes (2026-09-21):

- Decisions taken in the interview: the shared type is renamed to `User` (`shared/user.ts`, flat
  fields: `guardianName`/`guardianEmail`/`guardianPhone`, `taskConfirmDetails`/`taskSignAgreement`,
  `branchMembershipId`, `permission`, `dob` as a `yyyy-MM-dd` string, `createdAt`); `vipps_user_id`
  is unique; phones are normalised on transfer and the `phoneField` validator now strips
  `+47`/`0047` and inner spaces and rejects anything that is not eight digits starting with 4 or 9;
  `match_participants.user_detail_id` is `CASCADE` (not `RESTRICT` as first planned) because Adrian
  wants deleting a user to keep working; `email_verifications.user_detail_id` and
  `password_resets.user_detail_id` (not in the plan's list) also became foreign keys (CASCADE,
  narrowed to 24 chars).
- Staging rehearsal from a laptop: `users: migrated 16716, skipped 0`, orphan clean-up as listed
  above, both Mongo collections dropped, the whole migration in seconds. A field-by-field
  comparison of every row against a JSON dump taken before the run found zero differences; the
  eight foreign keys and the unique indexes (`lower(email)`, partial `phone`, partial
  `vipps_user_id`, `blid`) are in place. The first attempt failed on the year-200207 date of birth
  (`time zone displacement out of range`), which is why impossible dates are cleared.
- Files: migration `1789900000000_create_users_table.ts`; model `app/models/user.ts`
  (`findOptional`, `getOrFail`, `byIds`, `namesByIds`, `byEmail` (case-insensitive), `byPhone`,
  `byUsername`, `byVippsUserId`, `membersOf`, `countMembersOf`, `employees`, `search` (ILIKE over
  nine columns, own-info matches first, newest first), `toDto`); `app/services/user_service.ts`
  replaces `user_detail_service.ts` + the old `user_service.ts` (`search`, `updateAsEmployee`,
  `createVippsUser`, `createLocalUser`, `createProvisionedUser`, `dobFrom`);
  `user_detail_helper.ts` is now the function `invalidUserFields`. `config/database.ts` registers a
  pg type parser so `date` columns come back as text (Lucid's `@column.date()` reads it in the app
  zone), which also affects `match_rounds.deadline`/`meeting_date` harmlessly.
- `Signature.isValidFor`/`isUnderage` and friends take `{ dob: DateTime | null }` now; the
  reminders, reports, order manager, branch books, public blid lookup and duplicates code project
  the user id in Mongo and join names from Postgres in code (`report_columns.ts` `withUserColumns`).
  The users report (`/reports/user_details`) is a plain Postgres query.
- API: `PATCH /user_details/*` and `POST /local/register` take `branchMembershipId`,
  `guardianName`, `guardianEmail`, `guardianPhone` (nullable) instead of `branchMembership` and a
  `guardian` object. Routes keep their `/user_details/...` paths.
- Specs insert users with `tests/user_fixtures.ts` (`createUser`, `userDouble` for stub-only specs)
  and seed people before participants/handovers/signatures/messages with
  `tests/matches/match-testing-utils.ts` `ensureUsers`, since all of those columns are foreign keys
  now. New specs: `tests/user_model.spec.ts`, `tests/phone_field.spec.ts`.
- Cron: `remove_old_order_references.sh`, `remove_old_customer_item_references.sh` and
  `remove_inactive_users.sh` deleted (the last one on review, 2026-09-21); the Database Cleanup job
  now only runs `remove_unplaced_orders.sh`. User cleanup is reimplemented later, by Adrian.
- Legacy access tokens keep working: `details` (the user id) and `sub` (blid) are unchanged.

## Step 6 — (merged into step 5)

Kept as a placeholder so step numbers in older discussions still line up. Nothing to do.

## Step 7 — uniqueitems → `unique_items` — status: not started

Target schema `unique_items`: `id string(24) PK`, `blid text unique not null`, `item_id FK items
RESTRICT`, timestamps. `title` is dropped (join `items`).

Indexes: unique on `blid`; blid prefix search (`/admin/kasse` blid search, Boksøk) uses
`WHERE blid LIKE 'prefix%'`, which the unique b-tree index serves when the database collation is
`C`; otherwise add a `text_pattern_ops` index. Check `SHOW lc_collate` on staging.

Code to move (8 refs / 6 files): `blid_search_service.ts` (ranked hits), `blid_registration_service.ts`,
`unique_item_edit_service.ts` (relink/delete blid), `unique_item_monitoring.ts`, Merking page
endpoints, public `/sjekk` lookup.

Survey queries: `item` ids not in `items`; blids not matching the 8-digit or 12-alphanumeric
formats; blid duplicates (the unique index would refuse them).

Survey results / notes: (fill in)

## Step 8 — orders → `orders` + `order_items` — status: not started

The largest step by code (73 refs / 30 files) and by rows. Everything referenced by an order except
customer items and deliveries is already in Postgres at this point.

Target schema `orders`:

| Column                         | From                 | Notes                                                                                          |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------- |
| id string(24) PK               | `_id`                |                                                                                                |
| amount integer not null        | `amount`             |                                                                                                |
| branch_id FK branches RESTRICT | `branch`             |                                                                                                |
| customer_id FK users SET NULL  | `customer`           | nullable: orders outlive a deleted customer (decided 2026-09-21); 381 orders already have none |
| by_customer bool               | `byCustomer`         |                                                                                                |
| employee_id FK users SET NULL  | `employee`           |                                                                                                |
| placed bool                    | `placed`             |                                                                                                |
| delivery_id string(24) null    | `delivery`           | plain column until step 10 removes it                                                          |
| notify_by_email bool null      | `notification.email` |                                                                                                |
| checkout_state text null       | `checkoutState`      | legacy Vipps Checkout; survey whether any live code reads it                                   |
| timestamps                     |                      |                                                                                                |

Dropped: `payments` array (derivable from `payments.order`; this migration creates the Mongo index
`payments.order` so the interim lookup is cheap).

Indexes: `(placed, created_at desc)` (order manager walks placed orders newest first),
`(customer_id, created_at desc)`, `(branch_id, created_at desc)`, `(placed, updated_at)` for the
unplaced-order cleanup.

Target schema `order_items`:

| Column                                                                                                                         | From                       | Notes                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| id increments                                                                                                                  | (subdocument `_id` unused) |                                          |
| order_id FK orders CASCADE                                                                                                     |                            |                                          |
| type enu(rent, buy, extend, sell, buyout, return, cancel, partly-payment, buyback, invoice-paid, match-receive, match-deliver) | `type`                     |                                          |
| item_id FK items RESTRICT                                                                                                      | `item`                     |                                          |
| blid text null                                                                                                                 | `blid`                     |                                          |
| amount integer, unit_price integer                                                                                             |                            |                                          |
| delivered bool, handout bool                                                                                                   |                            |                                          |
| customer_item_id string(24) null                                                                                               | `customerItem`             | FK added in step 9                       |
| period_from, period_to timestamptz null                                                                                        | `info.from`, `info.to`     |                                          |
| number_of_periods int null                                                                                                     | `info.numberOfPeriods`     |                                          |
| period_type enu(semester, year) null                                                                                           | `info.periodType`          |                                          |
| amount_left_to_pay int null                                                                                                    | `info.amountLeftToPay`     |                                          |
| buyback_amount int null                                                                                                        | `info.buybackAmount`       |                                          |
| moved_from_order_id FK orders SET NULL                                                                                         | `movedFromOrder`           |                                          |
| moved_to_order_id FK orders SET NULL                                                                                           | `movedToOrder`             |                                          |
| position smallint                                                                                                              | array index                | preserves the order of lines on receipts |

Dropped: `title` (join `items`; receipts and emails render the current title), `info.customerItem`
(duplicate of `customerItem`; survey confirms, and where only `info.customerItem` is set the transfer
copies it into `customer_item_id`). `info` is `strict: false` in Mongoose; the survey lists any
extra keys so nothing is silently lost.

Indexes: `(order_id, position)`, `customer_item_id`, `blid`, `item_id`.

Code to move: `order_service.ts`, `orders/order_place_service.ts` (its customer-item aggregate stays
Mongo until step 9), `orders/` validators and handlers (rent/extend/partly-payment/buy validators,
placed handler, moved-from-order handler, order-to-customer-item generator), `order_item_service.ts`,
`order_manager_service.ts` (cursor paging over `(created_at, id)`), `order_history_service.ts`,
`order_cancellation_service.ts`, `refund_request_service.ts`, stand cart placement and Vipps
engine, invoices generation, `branch_insights_service.ts` and `reports_controller.ts` aggregates
(→ SQL with `GROUP BY`), matches `generate_round.ts`/`round_scope.ts` (which orders count as a
customer's expected books), `customer_item_actions_service.ts` line 143 (finds the order item for a
customer item → query `order_items` by `customer_item_id`), postal handout signal (`delivery_id`
still a plain column in this step). Frontend: order history tab, order manager, Kasse cart,
checkout, receipts.

Also in this step: rewrite `cron_jobs/database_cleanup/remove_unplaced_orders.sh` as SQL
(`DELETE FROM orders WHERE NOT placed AND updated_at < now() - interval '1 year'`, cascading to
`order_items`) in a `postgres` image with `DATABASE_URL`, and switch the "Database Cleanup" cron in
`.railway/railway.ts` to the Postgres URL.

Tests: the many `order-*.spec.ts` and `order_*.spec.ts` files. Most stub `StorageService.Orders`;
they become Postgres-backed. Expect this to be the largest test diff of the whole migration; do it
in its own commit(s) inside the PR.

Survey queries: `customer`, `branch`, `employee` ids not in Postgres `users`/`branches`; order
items whose `item` is not in `items`; `movedFromOrder`/`movedToOrder` pointing at missing orders;
`type` values outside the enum; extra keys in `info`; `info.customerItem` ≠ `customerItem` when both
set; decimals in `amount`/`unitPrice`; `checkoutState` non-null count and whether any code reads it;
unplaced orders older than a year (cleanup volume); maximum `orderItems.length`.

Survey results / notes: (fill in; include the measured transfer duration)

## Step 9 — customeritems → `customer_items` + `customer_item_period_extends` — status: not started

Target schema `customer_items`:

| Column                                                         | From                           | Notes                                                           |
| -------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| id string(24) PK                                               | `_id`                          |                                                                 |
| item_id FK items RESTRICT                                      | `item`                         |                                                                 |
| type enu(rent, partly-payment) not null                        | `type`                         |                                                                 |
| blid text null                                                 | `blid`                         |                                                                 |
| customer_id FK users SET NULL                                  | `customer`                     | nullable: books outlive a deleted customer (decided 2026-09-21) |
| deadline timestamptz not null                                  | `deadline`                     |                                                                 |
| handout bool                                                   | `handout`                      |                                                                 |
| handout_branch_id FK branches SET NULL                         | `handoutInfo.handoutById`      | `handoutBy` is always "branch"; dropped                         |
| handout_employee_id FK users SET NULL                          | `handoutInfo.handoutEmployee`  |                                                                 |
| handed_out_at timestamptz null                                 | `handoutInfo.time`             |                                                                 |
| returned bool                                                  | `returned`                     |                                                                 |
| return_branch_id FK branches SET NULL                          | `returnInfo.returnedToId`      |                                                                 |
| return_employee_id FK users SET NULL                           | `returnInfo.returnEmployee`    |                                                                 |
| returned_at timestamptz null                                   | `returnInfo.time`              |                                                                 |
| cancel bool, cancel_order_id FK orders SET NULL, cancelled_at  | `cancel`, `cancelInfo.*`       |                                                                 |
| buyout bool, buyout_order_id FK orders SET NULL, bought_out_at | `buyout`, `buyoutInfo.*`       |                                                                 |
| buyback bool, buyback_order_id FK orders SET NULL              | `buyback`, `buybackInfo.order` |                                                                 |
| total_amount int null, amount_left_to_pay int null             | partly payment                 |                                                                 |
| timestamps                                                     |                                |                                                                 |

Partial unique index reproducing `unique_active_blid`:
`CREATE UNIQUE INDEX customer_items_unique_active_blid ON customer_items (blid) WHERE blid IS NOT NULL AND NOT returned AND NOT buyout`.
Other indexes: `(customer_id)`, `(blid)`, `(deadline) WHERE NOT returned AND NOT buyout AND NOT cancel`
for reminders, `(handout_branch_id)`.

Dropped: `orders` array (derivable from `order_items.customer_item_id`) and `customerInfo`
snapshot. The survey checks that every id in `customerItem.orders` has an `order_items` row with
that `customer_item_id`; where it does not, the transfer sets `customer_item_id` on the matching
order item (same order, same item, null `customer_item_id`) and logs the count; leftovers are
logged and dropped.

Foreign key added on the existing column: `order_items.customer_item_id → customer_items SET NULL`.

Target schema `customer_item_period_extends`: `id increments`, `customer_item_id FK CASCADE`,
`period_from`, `period_to`, `period_type enu(semester, year)`, `created_at` (from `time`).

Code to move (55 refs / 27 files): `customer_item_service.ts`, `customer_items/` services,
`customer_item_actions_service.ts`, `active_item_corrections.ts`, `active_item_monitoring.ts`,
`bulk_collection_monitoring.ts`, `orders/order_place_service.ts` (handout check aggregate → query),
`order-to-customer-item generator`, `reminders_controller.ts` and `reports_controller.ts`
aggregates, `blid_search_service.ts` history reconciliation, matches `round_scope.ts` /
`generate_round.ts`, `branch_insights_service.ts`, invoices generation, deadline extension, the
Kasse customer view and Overleveringer.

Also in this step, or later: user cleanup is reimplemented by Adrian (the old Mongo script deleted
customers whose `updated_at`, all orders and all customer items were older than three years and
whose items were all returned, cancelled, bought out or bought back). Deleting in dependency order
is no longer needed for the Postgres side: the user's foreign keys cascade or set null.

Tests: `customer-item-*.spec.ts`, `active_customer_items_for_customer.spec.ts`,
`customer_item_actions_service.spec.ts`, `active_item_monitoring.spec.ts`,
`bulk_collection_monitoring.spec.ts`, `order_place_service.spec.ts`, matches specs that build
customer items via `match-testing-utils.ts`.

Survey queries: `customer`/`item` ids missing from Postgres; `handoutById`, `returnedToId` missing
branches; order ids in `cancelInfo`/`buyoutInfo`/`buybackInfo`/`orders` missing from `orders`;
`orders` array vs `order_items.customer_item_id` consistency; active blid duplicates that would
violate the partial unique index; `type` outside the enum; `periodExtends` entries with missing
fields.

Survey results / notes: (fill in; include the measured transfer duration)

## Step 10 — deliveries → `deliveries` — status: not started

Relationship inverted: the delivery owns `order_id` (unique), and `orders.delivery_id` is dropped.
Code that read `order.delivery` uses `hasOne` on the order model.

Target schema `deliveries`:

| Column                                                                      | From                     | Notes                                     |
| --------------------------------------------------------------------------- | ------------------------ | ----------------------------------------- |
| id string(24) PK                                                            | `_id`                    |                                           |
| order_id FK orders CASCADE unique                                           | `order`                  | survey for orders with several deliveries |
| method enu(branch, bring) not null                                          | `method`                 |                                           |
| amount integer not null                                                     | `amount`                 |                                           |
| branch_id FK branches SET NULL                                              | `info.branch`            | survey: is it always a branch id?         |
| bring_amount int null                                                       | `info.amount`            |                                           |
| estimated_delivery timestamptz null                                         | `info.estimatedDelivery` |                                           |
| facility_address, facility_postal_code, facility_postal_city                | `info.facilityAddress.*` |                                           |
| shipment_name, shipment_address, shipment_postal_code, shipment_postal_city | `info.shipmentAddress.*` |                                           |
| from_postal_code, to_postal_code                                            | `info.from`, `info.to`   |                                           |
| product text null                                                           | `info.product`           | Bring product code                        |
| tracking_number text null                                                   | `info.trackingNumber`    |                                           |
| timestamps                                                                  |                          |                                           |

Everything in `info` is app-defined shape, so it becomes columns; no jsonb here.

Code to move (11 refs / 10 files): `delivery_service.ts`, `bring/` services, order placement,
order manager Bring CSV export, postal handout signal (postal = delivery with method bring), order
history.

Survey queries: deliveries whose `order` is missing or unplaced; orders whose `delivery` points at
a missing delivery; orders with more than one delivery; `info.branch` values that are not branch
ids; `method` outside the enum.

Survey results / notes: (fill in)

## Step 11 — payments → `payments` — status: not started

Target schema `payments`: `id string(24) PK`, `order_id FK orders CASCADE`, `customer_id FK users
SET NULL` (payments outlive a deleted customer, decided 2026-09-21), `branch_id FK branches RESTRICT`, `method enu(card, cash, vipps, vipps-checkout,
vipps-epayment, bank-transfer, dibs)`, `amount integer`, `confirmed bool default false`,
`info jsonb null` (vendor payload: Vipps/DIBS/bank-transfer details; the only jsonb column of the
migration), timestamps. Indexes: `(order_id)`, `(customer_id)`, `(branch_id, created_at)` for the
cash-payment report.

If the survey shows that a specific `info` key is queried (for example a Vipps reference looked up
by the refund flow or webhooks), promote it to an indexed column in this step rather than querying
inside jsonb.

Code to move (11 refs / 10 files): `vipps/` services (ePayment create/capture/refund, webhook
handling), stand cart Vipps engine and refund plan, `refund_request_service.ts`, order placement,
reports (`payments` aggregate → SQL), employee monitoring cash report.

Survey queries: `order`/`customer`/`branch` ids missing from Postgres; `method` outside the enum;
`info` key sets per method; payments whose order lists them nowhere (the `orders.payments` array
was dropped in step 8, so compare against the pre-step-8 array only if a dump exists; otherwise
skip).

Survey results / notes: (fill in)

## Step 12 — invoices → `invoices` + `invoice_lines` + `invoice_comments` — status: not started

Invoices are accounting documents, so their snapshots survive as columns. Naming fixes: the
`customerHavePayed` flag becomes `customer_has_paid`; `customerItemPayments` becomes `invoice_lines`.

Target schema `invoices`:

| Column                                                                                                                           | From                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| id string(24) PK                                                                                                                 | `_id`                                    |
| due_date timestamptz not null                                                                                                    | `duedate`                                |
| customer_has_paid bool                                                                                                           | `customerHavePayed`                      |
| to_credit_note, to_debt_collection, to_loss_note bool                                                                            | flags                                    |
| type text null                                                                                                                   | `type`                                   |
| branch_id FK branches SET NULL                                                                                                   | `branch`                                 |
| customer_id FK users SET NULL                                                                                                    | `customerInfo.userDetail`                |
| company_id FK companies SET NULL                                                                                                 | `customerInfo.companyDetail`             |
| customer_number, customer_name, customer_email, customer_phone, customer_dob, customer_branch_name, customer_organization_number | `customerInfo.*` snapshot                |
| postal_address, postal_city, postal_code, postal_country                                                                         | `customerInfo.postal.*`                  |
| total_gross, total_net, total_vat, total_discount int                                                                            | `payment.total.*`                        |
| fee_unit, fee_gross, fee_net, fee_vat, fee_discount int                                                                          | `payment.fee.*`                          |
| total_including_fee int                                                                                                          | `payment.totalIncludingFee`              |
| our_reference, invoice_number, reference text                                                                                    | `ourReference`, `invoiceId`, `reference` |
| timestamps                                                                                                                       |                                          |

Target schema `invoice_lines`: `id increments`, `invoice_id FK CASCADE`, `position smallint`,
`customer_item_id FK customer_items SET NULL`, `item_id FK items SET NULL`, `title` (snapshot,
kept), `number_of_items integer` (Mongo stores a string; survey and cast), `customer_number`,
`cancel bool`, `customer_item_type`, `organization_number`, `product_number`, `unit`, `gross`,
`net`, `vat`, `discount` integers.

Target schema `invoice_comments`: `id increments`, `invoice_id FK CASCADE`, `user_id FK users SET
NULL`, `message text`, `created_at` (from `creationTime`; note the Mongo schema default is
`Date.now()` evaluated once at boot, so many comments share a bogus timestamp; survey and keep as is).

Code to move (13 refs / 9 files): `services/invoices/` (generation, status, export, numbering),
`/admin/faktura` endpoints and bulk status updates, company invoice flow. The export must remain
byte-identical: produce the export for the same invoice set on staging before and after the
cutover and diff.

Survey queries: `branch`/`customerInfo.userDetail`/`companyDetail`/`customerItem`/`item`/`comments.user`
ids missing from Postgres; `numberOfItems` values not integers; `type` values; decimals in money
fields; `dob` strings that do not parse as dates.

Survey results / notes: (fill in)

## Step 13 — Decommission MongoDB — status: not started

Only after step 12 has run in production.

- Remove `mongoose` and `mongodb` from `backend/package.json` (keep `bson` for id generation).
  Delete `app/models/mongoose/` (schemas, `MongodbHandler`, `SEDbQuery`, `MongooseModelCreator`,
  `BlSchemaName`), `app/services/storage_service.ts`, `start/mongoose.ts`, the `ToSchema` type, and
  `tests/mongoDb.spec.ts`. Shrink `shared/bl-document.ts` to what is still used, or delete it.
- Historical migrations that import `mongoose` (`1787932298876`, `1788117209148`, `1788515000000`,
  `1788516000000`, `1788517000000`, `1788518000000`, `1788600000000`, `1788700000000`,
  `1788800000000`, `1788900000000`, `1789000000000`, and every transfer migration from steps 1–12)
  must keep their file names so `adonis_schema` stays consistent, but their bodies change: keep the
  Postgres DDL, replace the Mongo work with a comment stating what ran and when. A fresh database
  has no Mongo to copy from, so this loses nothing.
- Environment: drop `MONGODB_URI` from `start/env.ts`, `.env.example`, `.env.test`, `.env.local`
  and the Railway variables; update `app/models/mongoose`-related `imports` in `package.json`.
- Cron jobs: delete `cron_jobs/copy_prod_mongodb_to_staging/` and any remaining mongosh script;
  the "Database Cleanup" job runs only SQL by now.
- Railway IaC (`.railway/railway.ts`): remove the `Mongo` service, `mongodb-volume`, the
  "Copy Mongo to Staging" cron and `MONGODB_URI` on the backend. Deleting a database and volume is
  destructive, so `railway config apply` refuses it in CI; apply by hand in staging first, then
  production, each with the user's explicit go-ahead.
- Docs: update `CLAUDE.md` (dual-DB wording, `MONGODB_URI` requirement, Mongo gotchas in the
  Playwright playbook), `README.md`, and mark this document complete.

## Risks and mitigations

- **Predeploy duration.** Orders and customer items are ~350 000 documents plus child rows. The
  step 0 dry run measures it; the same duration applies to the production predeploy, during which
  the old backend keeps serving from Mongo. No constraint was set; deploy in a quiet hour if the
  measured duration is long.
- **Errors and lost writes between drop and traffic switch.** The migration drops the collection
  right after the transfer, but Railway switches traffic to the new backend only after predeploy
  finishes. In that window the old backend fails every read of the dropped collection, and its
  writes create a fresh empty collection that nothing copies. Documents written after the
  transfer's cursor passed are also not copied. Decided 2026-09-16: accepted without mitigation
  (no reconciliation pass, no write-freeze) because traffic is low and the window is a few minutes.
  The `dropCollection` helper must tolerate a collection that already exists again with a handful
  of documents when a later migration or step 13 drops it defensively.
- **Count assertion failures** roll back the Postgres transaction and fail the deploy; Mongo is
  untouched. Fix forward and redeploy.
- **Tuyau client drift.** Every step regenerates the committed client; a stale client breaks the
  frontend build in CI.
- **Nightly staging reset** can leave staging without the new tables until redeploy (see deploy
  facts). Decide in step 0.
- **Legacy tokens.** Access tokens live up to a year and carry `details` (the user-details id) and
  `sub` (blid); both survive step 5 unchanged.

## Change log

- 2026-09-16: plan written; decisions recorded; staging survey counts taken.
- 2026-09-16 (review): drop-window failure mode stated and accepted, re-read mitigation removed;
  `active` dropped per survey instead of unconditionally; step 5 email confirmed always present.
- 2026-09-16: step 0 implemented (helpers, ObjectId generator, fixture ids, drop migration,
  staging-recovery decision, orders timing dry run).
- 2026-09-16: step 2 implemented (companies flattened into Postgres, POST body flattened too, all
  columns not null per survey, staging rehearsal 2.9 s).
- 2026-09-16: step 4 implemented (branch items into Postgres with six flags and `categories text[]`,
  four dead flags dropped, PUT became an in-place diff, staging rehearsal 4.87 s, zero orphans).
- 2026-09-21: step 5 implemented (userdetails + users merged into `users`, shared type renamed to
  `User`, eight foreign keys added, `match_participants` CASCADE instead of RESTRICT, phone
  normalisation, staging rehearsal with zero field diffs). Decided that orders, customer items,
  payments and invoices keep their rows when a customer is deleted, so steps 8, 9 and 11 use
  `customer_id … SET NULL`.
