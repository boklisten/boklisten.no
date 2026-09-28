# Postgres schema review and standardisation plan

Working document for tidying the Postgres schema after the MongoDB migration finished
(2026-09-28). The steps are done **one migration at a time**, in order. Each step is sized for a
single review and ships to production before the next one starts.

- **Snapshot:** staging, 2026-09-28, PostgreSQL 18.6, 37 tables (33 application tables plus 4
  that libraries own)
- **Owner/reviewer:** Adrian
- **Status legend:** ☐ todo · ◐ in progress · ☑ shipped to production · ✗ dropped (reason noted)

---

## 1. How to work a step (read this first, agents)

1. **Re-survey before writing anything.** The numbers in this document date from 2026-09-28. Run
   the queries in the step's _Survey_ section again on staging. If the data changed, say so
   before you continue.
2. **Ask Adrian every question listed under _Decisions_.** Never guess an answer. Legacy rows that
   break a new constraint are **repaired inside the same migration**. Adrian approves how each
   repair is done. `NOT VALID` constraints are not the default.
3. **Write one Lucid migration per step** in `backend/database/migrations/`. Follow the style of
   `1790900000000_store_deadlines_as_dates.ts`: a doc comment that explains _why_, raw SQL where
   knex can't express the change, and a working `down()` wherever the change can be reversed.
4. **Regenerate `backend/database/schema.ts`.** Running `bun migrate:backend` does it; never edit
   the file by hand. Then fix models, transformers, validators, `backend/shared/*` types and the
   frontend **in the same step**. The API may change as long as backend and frontend change
   together; there is no compatibility mapping layer.
5. **Tests:** update or add Japa specs for any logic you touch. Run `bun run test`, using
   `fnm exec --using=24`.
6. **Playwright:** check every UI screen whose data shape changed (see `CLAUDE.md` playbook).
7. **Run `bun fix`** and clear every error it reports.
8. **Tick the step here:** set its status, and record what was actually done and any decision
   that changed on the way.
9. Adrian reviews and commits. The step then ships `main` → staging → `production`.

**Staging trap:** every night, `cron_jobs/copy_prod_postgres_to_staging` copies **prod's whole
schema** onto staging. Until a step is deployed to production, staging falls back to the old
schema each night. Before you work locally, run `bun migrate:backend` against staging again. This
is why steps ship one at a time.

**Locking:** the largest tables are `order_items` (~490k rows, 135 MB), `orders` (185k, 65 MB) and
`customer_items` (165k, 63 MB). On these, `ALTER COLUMN TYPE` rewrites the table and a plain
`CREATE INDEX` blocks writes. Either can take seconds on prod. Both are acceptable when traffic is
low. For index-only steps, prefer `CREATE INDEX CONCURRENTLY` with
`static disableTransactions = true` on the migration.

**Out of scope everywhere:** tables owned by a library keep their names and shapes:
`adonis_schema`, `adonis_schema_versions`, `sessions`, `remember_me_tokens` (its
`tokenable_id` name comes from Adonis) and `rate_limits` (its `expire` bigint comes from the
limiter).

---

## 2. Target conventions

These are the standards the steps move toward. New tables should follow them from now on.

| Area                    | Convention                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table names             | `snake_case`, plural (`order_items`). No renames of existing tables unless a step says so.                                                                                                                                                                                                                |
| Primary keys            | Existing ObjectId tables keep `varchar(24)` lowercase hex (see E1). New tables use `increments()` (int4 serial), or a uuid when the id is exposed in links or tokens.                                                                                                                                     |
| References to `users`   | `<role>_id`, where the role says what the user _is_ in this row: `customer_id`, `employee_id`, or `user_id` for a plain account owner. Never `*_details_id` or `user_detail_id` (legacy "UserDetail" wording).                                                                                            |
| Other FKs               | `<referenced_singular>_id`. Every FK has an index whose **leading** column is the FK column.                                                                                                                                                                                                              |
| `ON DELETE`             | `CASCADE` for rows the parent owns (lines, periods, participants). `SET NULL` for historical references to people. `RESTRICT` for catalogue data (items, branches).                                                                                                                                       |
| Strings                 | `text`. Use `varchar(n)` only when the length is part of the domain (`varchar(24)` ids). Validate format with a `CHECK`, not a length limit.                                                                                                                                                              |
| Enum-like values        | `text` + a `CHECK (col in (...))` named `<table>_<column>_check`. Values are lowercase kebab-case (`partly-payment`, `vipps-checkout`). Values from an outside system (Vipps checkout states) stay as that system spells them. We do **not** use native Postgres enums, because they're harder to change. |
| Fractions / percentages | `numeric(p,s)` with a range `CHECK`. Never `float8`. `config/database.ts` already parses NUMERIC to `Number`, so no code change is needed to read them.                                                                                                                                                   |
| Money                   | Whole kroner in `integer` (orders, items, payments). Invoices use `numeric(10,2)` (see E3). Amounts can legitimately be negative (refunds), so there are no sign CHECKs.                                                                                                                                  |
| Time                    | `timestamptz` for instants, `date` for calendar days (deadlines, dob), `time` for a time of day.                                                                                                                                                                                                          |
| Audit columns           | `created_at` and `updated_at` are `timestamptz NOT NULL DEFAULT now()`. Child rows written together with their parent (order lines, periods) may leave them out.                                                                                                                                          |
| Unknown values          | `NULL`, never `''` or `'0'` placeholders.                                                                                                                                                                                                                                                                 |
| Arrays                  | Only for plain value lists (labels, locations). **Never** for lists of ids; use a junction table with FKs.                                                                                                                                                                                                |
| Reserved words          | Never as column names (`from`, `to`, `order`, `user`).                                                                                                                                                                                                                                                    |

---

## 3. Findings

Each finding has an ID that the step plan in §4 refers to.

### Naming

**N1 — References to users are named seven different ways.** They all point at `users(id)`:

| Column                                                     | Proposed                                              | Files using the camelCase name (backend / frontend) |
| ---------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `email_verifications.user_detail_id`                       | `user_id`                                             | part of 29 / 5 (`userDetailId`)                     |
| `password_resets.user_detail_id`                           | `user_id`                                             | ″                                                   |
| `match_participants.user_detail_id`                        | `user_id` (NULL = the stand)                          | ″                                                   |
| `book_handovers.from_user_detail_id` / `to_user_detail_id` | `from_user_id` / `to_user_id`                         | 22 / 0 each                                         |
| `signatures.customer_details_id`                           | `customer_id`                                         | 13 / 1                                              |
| `messages.regarding_customer_details_id`                   | `customer_id`                                         | 11 / 1                                              |
| `sendouts.initiated_by_details_id`                         | `initiated_by_id`                                     | 4 / 0                                               |
| `users.branch_membership_id`                               | keep (it reads fine), or `branch_id` — Adrian decides | —                                                   |

`orders.customer_id`/`employee_id` and `customer_items.customer_id`/`*_employee_id` already
follow the convention.

**N2 — `opening_hours."from"` and `"to"` are reserved words.** Every raw query has to quote them.
Proposed names: `opens_at` / `closes_at`. The index `opening_hours_branch_id_to_index` moves along
with the rename.

**N3 — Enum values are spelled inconsistently.** `branch_periods.kind` uses `'partly_payment'`,
while every other column uses `'partly-payment'`. `kind` never reaches the API (it maps to
`partlyPaymentPeriods` in `app/models/branch_period.ts`), so the fix is internal.

**N4 — Small inconsistencies in `waiting_list_customers`.** It uses `phone_number varchar(8)`
where `users.phone` is `text`, and `item_id varchar(255)` where every FK to `items(id)` is
`varchar(24)`. The table has 0 rows.

**N5 — `invoice_lines.cancel` is a verb.** Other flags are states (`returned`, `placed`,
`active`). Proposed name: `cancelled`. The `customer_items` flags are in E2.

### Types

**T1 — `varchar(255)` is a knex default, not a domain rule.** It appears in 21 application
columns: `branch_subjects.name/external_name`, `editable_texts.id`,
`match_rounds.status/name/stand_location`, `matches.meeting_location`,
`message_events.source/event/error_code/provider_event_id`,
`messages.message_type/channel/recipient/subject/template_id/provider_message_id/status/status_detail`,
`sendouts.kind/name`, `signatures.signing_name`, `waiting_list_customers.name`.
`varchar` → `text` is binary coercible, so it runs as a catalog-only change with no rewrite.

**T2 — Fractions are stored as `float8`.** Affected columns:

- `branches.buyout_percentage` and `sell_percentage` (0.33–1)
- `branch_periods.percentage`, `percentage_buyout` and `percentage_up_front` (0.001–1, at most 3
  decimals)
- `items.discount` (0–0.45, 7 distinct values)
- `items.weight` (kg, 0.07–2.236)

Proposed types: `numeric(4,3)` for the fractions, with `CHECK (x >= 0 and x <= 1)`, and
`numeric(6,3)` for weight. Reads are unaffected because NUMERIC is parsed to `Number`.

**T3 — `match_rounds` stores times of day as `varchar(5)` strings.**
`user_meeting_from/to` and `stand_from/to` hold values like `"11:30"`. Proposed type: `time`.
Wire format: decide whether it stays `"HH:MM"` (the model formats it) or becomes `"HH:MM:SS"`.

**T4 — Enum-like columns have no CHECK:**

- `messages.channel` (email, sms)
- `messages.status` (opened, delivered, clicked, failed, bounced, …)
- `messages.message_type` (receipt, signature, email-verification, delivery-info, password-reset,
  custom, employee-monitoring, refund-request)
- `message_events.source` (sendgrid, internal, twilio)
- `message_events.event` (sent, open, delivered, processed, click, deferred, dropped, bounce, …)
- `sendouts.kind` (custom)
- `orders.checkout_state` (Vipps: `SessionCreated`, `PaymentInitiated`, `PaymentSuccessful`,
  `PaymentTerminated`, `PaymentCancelled`)

The value lists must come from the TS unions in code, not only from the rows present today.

**T5 — Nullable "type" columns.** `invoices.type` is NULL on 470 of 7,764 rows, and `branches.type`
on 53 of 115. Does NULL mean something (e.g. "fee-only invoice", "not a school"), or is it missing
data?

**Considered, not recommended — `serial` → identity, int4 → bigint.** Postgres recommends
`generated … as identity` over `serial`, but the practical difference is small here, and Lucid's
`increments()` generates `serial`. `order_items` is the fastest-growing table at 489,617 ids after
about 8 years, nowhere near the int4 limit. Adrian can revive this if he wants strict best practice.

### Integrity

**I1 — `blid` columns have no referential integrity.**

- `customer_items.blid` (text): 18 values are not in `unique_items`, and 9 rows point at a blid
  registered to a _different_ item.
- `order_items.blid` (text): 42 orphans, 9 of them from the last two years.
- `book_handovers.blid` is `varchar(12)` while the others are `text`; it has 0 orphans.

A FK to `unique_items(blid)` interacts with blid deletion (allowed today unless the book is handed
out). With `RESTRICT` on historical `order_items`, a blid that ever appeared on an order could
never be deleted. **Decision needed:** FK on `customer_items` only, with `order_items` and
`book_handovers` keeping the blid as a historical snapshot; or FK everywhere, with blid deletion
reworked.

**I2 — Arrays of ids in `match_rounds`.** `branches text[]` holds up to 43 branch ids per round,
and `excluded_customer_ids text[]` holds user ids. Neither has FKs, so a deleted branch or user
silently stays in the array. Neither array has orphans today. Proposed: junction tables
`match_round_branches(round_id, branch_id)` and
`match_round_excluded_customers(round_id, customer_id)`, both with a composite PK and FKs.
`user_match_locations text[]` is a plain list of values and stays an array.

**I3 — Audit timestamps are nullable on 23 tables**, and no table has a DB default. Lucid fills
them in, but raw inserts and the sync job do not. There are **0 NULL rows** today, so
`SET NOT NULL` + `SET DEFAULT now()` is a pure tightening. Affected tables: book_handovers,
branch_items, branch_subject_books, branch_subjects, branches, companies, editable_texts,
email_verifications, items, match_obligations, match_participants, match_rounds, matches,
message_events, messages, opening_hours, password_resets, question_and_answers, sendouts,
signatures, unique_items, users, waiting_list_customers. After the change, `schema.ts` types
become `DateTime` instead of `DateTime | null`, so some `?.` and `!` in code will go.

**I4 — Invoice numbers are not unique.** `invoices_invoice_number_index` is a plain index.
Two numbers are duplicated, both from 2020: `20208001` (rows from January and August) and
`20208011` (two rows on the same day). Invoices are accounting documents. **Decision needed** on
the repair, e.g. re-number the later row with a suffix, or confirm one row is a stray copy. After
the repair, swap the index for a `UNIQUE` constraint.

**I5 — Empty-string placeholders.**

- `users.name`, `address`, `post_code` and `post_city` default to `''`. There are 14 empty names,
  55 empty addresses and 50 empty post codes.
- `companies` uses `'0'` as a placeholder for email (5 rows) and phone (6 rows).

The target convention is NULL, which turns those TS types into `string | null`. **Decision
needed:** switch to NULL, or keep `NOT NULL ''` for users (a "details not filled in yet" state the
confirm-details task relies on) and fix only `companies`.

**I6 — `branches.region` is free text with case duplicates.** It has 19 distinct values across 115
branches: `Oslo` (60) vs `oslo` (12), `Sandvika` vs `sandvika`, and lowercase city names mixed
with regions (`Romerike`, `Norge`, `online`). **Decision needed:** normalise the case only, or
agree a fixed list plus a CHECK. Check first how the frontend groups by region.

**I7 — The four invoice flags are really one status.** Across all 7,764 invoices,
`customer_has_paid`, `to_credit_note`, `to_debt_collection` and `to_loss_note` are **never
combined**: 6,623 paid, 371 loss note, 362 credit note, 243 debt collection, 165 none. Proposed:
one `status text` column with the values `open`, `paid`, `credit-note`, `debt-collection`,
`loss-note` and a CHECK. This changes the API and the Faktura page (bulk status already exists
there, see memory `project_invoice_page`). Paid side effects must keep working.

**I8 — Bad ISBN row.** `items.isbn` is 13 digits on 684 rows, and `999` on one test row. After
the repair: `CHECK (isbn between 9780000000000 and 9799999999999)`.

### Indexes

**X1 — 16 FKs have no index whose leading column is the FK.** Deleting or merging a user or order
has to scan the child table for each of these. That matters most on the big tables:

- `customer_items`: `handout_employee_id`, `return_employee_id`, `return_branch_id`,
  `cancel_order_id`, `buyout_order_id`, `buyback_order_id` (165k rows)
- `order_items`: `moved_from_order_id`, `moved_to_order_id` (490k rows)
- `orders.employee_id` (185k rows)
- Small tables: `branch_items.item_id`, `deliveries.branch_id`,
  `email_verifications.user_detail_id`, `password_resets.user_detail_id`,
  `sendouts.initiated_by_details_id`, `waiting_list_customers.branch_id` and `item_id`

The mostly-NULL order references (`cancel_/buyout_/buyback_order_id`, `moved_*`) can use partial
indexes `WHERE col IS NOT NULL` to stay small.

**X2 — Redundant indexes and indexes led by a low-selectivity column:**

- `branch_subjects_branch_id_index` is covered by the unique `(branch_id, lower(name))` index.
  Drop it.
- `users_permission_index`: 16,668 of 16,734 rows are `customer`. Replace it with a partial index
  `WHERE permission <> 'customer'` if staff lookups use it, otherwise drop it.
- `orders_placed_created_at_index` / `orders_placed_updated_at_index` lead with a boolean. Check
  them against the order-manager queries: a partial index `(created_at) WHERE placed` (or
  `WHERE NOT placed`) is probably smaller and just as fast.
- `messages_status_index`: 5 values. Check whether any query filters on status alone.

**The staging `idx_scan` counters are not evidence.** Staging is rebuilt nightly. Read
`pg_stat_user_indexes` on **production** before you drop anything. Note: the indexes added on
2026-09-28 in `1790800000000_add_query_indexes` were deliberate. Don't remove them without new
information.

### Housekeeping

**H1 — The `uuid-ossp` extension is installed but unused.** The code generates uuids with
`crypto.randomUUID()`, and PG 18 has `gen_random_uuid()`/`uuidv7()` built in. Drop the extension
after a grep over the migrations confirms nothing calls `uuid_generate_*`.

---

## 4. Step plan

Order: DB-only, low-risk tightening first, then renames that touch the API, then steps that need
decisions. Each step is one migration.

### Step 1 — Index every foreign key, drop redundant indexes ◐

- **Findings:** X1, X2 (X2 only once production index stats are read)
- **Changes:**
  - Add the 16 FK indexes, with partial `IS NOT NULL` on the mostly-NULL order references.
  - Drop `branch_subjects_branch_id_index`.
  - Rework the `users_permission` and `orders_placed_*` indexes only if the prod stats and
    `EXPLAIN` agree.
  - Use `CONCURRENTLY` + `disableTransactions`.
- **API impact:** none.
- **Survey:** the FK-without-index catalog query (Appendix A.1). Prod `pg_stat_user_indexes`.
  `EXPLAIN ANALYZE` of the order-manager open-orders query before and after.
- **Decisions:** which X2 indexes to drop or replace, based on prod numbers.
- **Done (2026-09-28, on staging, awaiting review):** migration
  `1791000000000_index_foreign_keys`.
  - Adds all 16 FK indexes, named `<table>_<column>_index`. Every **nullable** FK gets a partial
    `WHERE col IS NOT NULL` index (a rule applied to all of them, not only the order references),
    because constraint lookups are equalities and never match NULL.
  - Drops `branch_subjects_branch_id_index` and `orders_placed_updated_at_index` (no query filters
    or sorts orders by `updated_at`).
  - Replaces `users_permission_index` with a partial `users_staff_name_index (name) WHERE
permission <> 'customer'`, which serves `User.employees()`.
  - Keeps `orders_placed_created_at_index`: the open-orders list runs in 7 ms with it on staging (an
    index scan plus an incremental sort for the id tie-break). Keeps `messages_status_index` (1k
    rows, used by the "only failures" filter).
  - Verified: 0 unindexed FKs, no invalid indexes, the planner uses the partial indexes for
    equality lookups, rollback and re-run both work, 1,031 tests pass.
  - Prod `idx_scan` (read by Adrian, 2026-09-28): `branch_subjects_branch_id_index` 0,
    `orders_placed_updated_at_index` 0, `users_permission_index` 1 (the staff list, now served by
    `users_staff_name_index`). All three drops confirmed. Ready to ship.

### Step 2 — Audit timestamps NOT NULL with defaults ☐

- **Findings:** I3
- **Changes:** `alter column created_at/updated_at set not null, set default now()` on the 23
  tables. Remove the `| null` handling this makes redundant in models and transformers.
- **API impact:** only where shared types say `createdAt: string | null`; those become non-null.
- **Survey:** count NULLs per table again (Appendix A.2). The step expects 0.

### Step 3 — `varchar(255)` → `text`, drop `uuid-ossp` ☐

- **Findings:** T1, H1, and the type half of N4 (`waiting_list_customers.item_id` →
  `varchar(24)`, `phone_number` → `text`)
- **Changes:** `alter column … type text` (no rewrite). Drop the extension.
- **API impact:** none (`schema.ts` still says `string`).
- **Rename in the same step?** Renaming `waiting_list_customers.phone_number` → `phone` is cheap
  here. Adrian decides.

### Step 4 — CHECK constraints on enum-like columns ☐

- **Findings:** T4, N3
- **Changes:**
  - Add a CHECK to each column in T4, with the value lists taken from the TS unions (message types
    in `app/services/dispatch_service.ts` / message-log shared types; checkout states in
    `checkout_controller`).
  - Rename the `branch_periods.kind` value `partly_payment` → `partly-payment` (data + CHECK +
    `PERIOD_KINDS`).
  - Where no TS union exists yet, introduce one in `backend/shared` so the DB and the code list the
    same values.
- **API impact:** none, or only tighter types.
- **Survey:** `select distinct` on every column, compared against the unions.

### Step 5 — Fractions to `numeric` ☐

- **Findings:** T2
- **Changes:** switch the float columns to `numeric(4,3)` / `numeric(6,3)` and add the range CHECKs.
- **API impact:** none (still numbers). Check the Filialer forms and the Bøker grid still save
  fractions.
- **Survey:** max scale per column (branch_periods percentage has at most 3 decimals). Check no
  value falls outside 0–1.
- **Decision:** confirm 3 decimals is enough for every percentage (the smallest value is 0.001).

### Step 6 — `opening_hours` reserved-word rename ☐

- **Findings:** N2
- **Changes:** `from`/`to` → `opens_at`/`closes_at` in the DB, the model, the shared type, the
  Åpningstider tab and the public branch page.
- **API impact:** yes, the field names change.

### Step 7 — Rename user references (auth + signatures) ☐

- **Findings:** N1 (part 1)
- **Changes:** `email_verifications.user_detail_id`, `password_resets.user_detail_id` →
  `user_id`. `signatures.customer_details_id` → `customer_id`. Rename the matching FK
  constraints and indexes so their names follow the columns.
- **API impact:** the signature endpoints/types (1 frontend file).

### Step 8 — Rename user references (matching + handovers) ☐

- **Findings:** N1 (part 2)
- **Changes:** `match_participants.user_detail_id` → `user_id`.
  `book_handovers.from_/to_user_detail_id` → `from_/to_user_id`. Rename the matching constraints
  and indexes.
- **API impact:** the match types. The match generator and the overleveringer page are the main
  code paths; Playwright on `/admin/overleveringer`.

### Step 9 — Rename user references (message log) ☐

- **Findings:** N1 (part 3)
- **Changes:** `messages.regarding_customer_details_id` → `customer_id`.
  `sendouts.initiated_by_details_id` → `initiated_by_id`. Includes the index
  `messages_regarding_customer_details_id_created_at_index`.
- **API impact:** the message-log types (the logg page and the Meldinger tab).

### Step 10 — `match_rounds`: junction tables and `time` columns ☐

- **Findings:** I2, T3
- **Changes:**
  - Create `match_round_branches` and `match_round_excluded_customers` (FKs, composite PKs, an
    index on the second column) and backfill them from the arrays, then drop the arrays.
  - Change the four `HH:MM` columns to `time`.
  - Update the match-round model, plan generation and the round form.
- **API impact:** the round DTO can keep `branches: string[]` (built from the relation), so the
  frontend may barely change.
- **Decision:** the wire format for times (see T3).

### Step 11 — Unique invoice numbers ☐

- **Findings:** I4
- **Changes:** repair the 2 duplicates (method approved by Adrian), then replace the plain index
  with a `UNIQUE` constraint.
- **API impact:** none. Invoice creation must surface the unique violation as a proper error
  instead of a raw knex message (see memory `project_provisioning_duplicate_rows`).

### Step 12 — Invoice status column ☐

- **Findings:** I7, N5
- **Changes:**
  - Add `invoices.status`, backfill it from the four flags, add a CHECK, then drop the flags.
  - Rename `invoice_lines.cancel` → `cancelled`.
  - Update the Faktura page (filters, bulk status), the export and the paid side effects.
- **API impact:** yes, the invoice shared types change.
- **Survey:** check the flag combinations again (they're expected to stay mutually exclusive).

### Step 13 — blid referential integrity ☐

- **Findings:** I1
- **Changes:**
  - Repair the 18 + 42 orphans and the 9 item mismatches (each fix approved).
  - Unify the blid type to `text` (`book_handovers.blid`).
  - Add a FK to `unique_items(blid)` where Decision I1 says so.
- **Decision:** I1 (which tables get a FK, and what blid deletion does).

### Step 14 — Placeholders → NULL ☐

- **Findings:** I5
- **Decision:** I5 (users vs companies scope). Then migrate the data, drop the `''` defaults and
  update the types and the confirm-details logic.

### Step 15 — `branches.region` and nullable type columns ☐

- **Findings:** I6, T5, I8
- **Decisions:** I6 (normalise only, or fixed list + CHECK), T5 (what NULL means), I8 (fix or
  delete the test item).

---

## 5. Evaluate only (no step scheduled)

### E1 — ObjectId primary keys

All 9 ObjectId tables (users, orders, customer_items, items, branches, unique_items, payments,
deliveries, invoices) hold only 24-char lowercase hex ids, verified 2026-09-28.

| Option                                 | Pros                                                                                                         | Cons                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keep `varchar(24)`** (current)       | Nothing changes. Ids already appear in URLs (`?kunde=`, `?filial=`), emails, Vipps references and old links. | Each key is 25 bytes and is compared with collation, so indexes are larger than necessary. `orders_pkey` is 9 MB and `order_items` repeats the 24-char `order_id` 490k times.  |
| Keep + `CHECK (id ~ '^[0-9a-f]{24}$')` | Cheap. Documents the domain and catches bugs.                                                                | Cosmetic.                                                                                                                                                                      |
| Keep + `COLLATE "C"` on id columns     | Faster comparisons and the same byte order.                                                                  | Every FK column must change with it, which is a big mechanical migration.                                                                                                      |
| Convert to `uuid` (e.g. `uuidv7`)      | Native 16-byte type, and PG 18 generates it.                                                                 | Every FK, API field, URL and stored external reference changes. The old hex has no lossless mapping into a uuid (12 vs 16 bytes; you could pad it, but it would be confusing). |
| Convert to `bigint` identity           | Smallest and fastest keys.                                                                                   | Same blast radius as uuid, and ids become guessable in URLs.                                                                                                                   |

**Assessment:** at the current data sizes (the largest table is 135 MB), performance does not
justify a conversion. If anything is done, the hex CHECK is the only low-risk step.

### E2 — `customer_items` state model

There are four boolean/timestamp pairs: `returned`/`returned_at`, `cancel`/`cancelled_at`,
`buyout`/`bought_out_at`, `buyback`/`bought_back_at`. Staging facts (2026-09-28):

- 42,775 `returned` rows have **no `returned_at`** and no `return_branch_id`. They were created
  between 2019-01-10 and **2026-09-10**, so some current code path still sets `returned` without
  the timestamp. **Investigate this first; it may be a bug independent of the schema.**
- Also without their timestamp: 8,832 `buyout` rows and 9,933 `buyback` rows. `cancel` is fully
  consistent.
- 29,396 rows have more than one flag set. Cancel and buyback always set `returned` too (verified
  in `project_query_review_sep_2026`); `whereActive` relies on this.

Options:

1. **Timestamps as truth:** backfill the timestamps from the order lines (the `buyout`/`buyback`/
   `return` order items carry the time), then drop the booleans. State becomes
   `returned_at is not null`, etc. The partial index `customer_items_open_deadline_index` changes
   to use the timestamps.
2. **A `status` enum** (`active`, `returned`, `cancelled`, `bought-out`, `bought-back`) plus the
   timestamps. This only works if the combined flags can be ordered into one state
   (cancel/buyback ⇒ returned suggests they can).
3. **Keep both** and add `CHECK (returned = (returned_at is not null))` once the data is backfilled.

This affects the API, the Kasse page, reminders and reports. Worth doing only after the root cause
of the missing timestamps is understood.

### E3 — Money representation

Orders, items and payments store whole kroner as `integer`. Invoices store `numeric(10,2)` kroner,
because they need øre for VAT. This is consistent within each domain. A switch to integer øre
everywhere is a large change with little gain. No action.

### E4 — `items.price_history jsonb`

The column holds `{ "2018": 845, … }`, one price per year. A `item_prices(item_id, year, price)`
table would allow constraints and SQL reporting. Worth it only if reports start to query prices
by year. No action.

### E5 — `branch_items.categories text[]` vs `branch_subjects`

The free-text categories (~170 distinct, with duplicates like `Fransk 2 VG2`/`Fransk 2 vg2`)
overlap with the newer structured `branch_subjects`/`branch_subject_books`. Consider retiring
`categories` once subjects cover every branch. This is a product decision more than a schema one.

---

## Appendix A — Survey queries

Run these against staging with the `pg` driver from `backend/`:
`fnm exec --using=24 node script.mjs`, reading `POSTGRES_URL` from `.env.local`. `psql` and
`pg_dump` are not installed.

**A.1 FKs with no index whose leading column is the FK**

```sql
select conrelid::regclass as tbl, a.attname as col, confrelid::regclass as ref
from pg_constraint k
join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
where contype = 'f' and connamespace = 'public'::regnamespace
  and not exists (select 1 from pg_index i where i.indrelid = k.conrelid and i.indkey[0] = k.conkey[1])
order by 1;
```

**A.2 Nullable audit columns**

```sql
select table_name, string_agg(column_name, ',')
from information_schema.columns
where table_schema = 'public' and column_name in ('created_at', 'updated_at') and is_nullable = 'YES'
group by 1 order by 1;
```

**A.3 Orphan and mismatched blids**

```sql
select count(*) from customer_items ci
where blid is not null and not exists (select 1 from unique_items u where u.blid = ci.blid);
select count(*) from customer_items ci join unique_items u on u.blid = ci.blid where u.item_id <> ci.item_id;
select count(*) from order_items oi
where blid is not null and not exists (select 1 from unique_items u where u.blid = oi.blid);
```

**A.4 customer_items flag/timestamp consistency**

```sql
select sum((returned <> (returned_at is not null))::int) as returned_mismatch,
       sum((cancel   <> (cancelled_at is not null))::int) as cancel_mismatch,
       sum((buyout   <> (bought_out_at is not null))::int) as buyout_mismatch,
       sum((buyback  <> (bought_back_at is not null))::int) as buyback_mismatch
from customer_items;
```

**A.5 Invoice flag combinations**

```sql
select customer_has_paid, to_credit_note, to_debt_collection, to_loss_note, count(*)
from invoices group by 1, 2, 3, 4 order by 5 desc;
```

**A.6 Index usage (run on production)**

```sql
select relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
from pg_stat_user_indexes order by idx_scan;
```
