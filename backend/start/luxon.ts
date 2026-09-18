/*
|--------------------------------------------------------------------------
| Luxon defaults
|--------------------------------------------------------------------------
|
| Boklisten operates in Norway only. Instants are stored as UTC (Mongo Dates, Postgres
| timestamptz) and every wall-clock operation — formatting a deadline, comparing calendar
| days, deciding what "today" is — happens in Norwegian local time no matter where the
| process runs. Developer machines sit in Europe/Oslo while Railway runs in UTC, and the
| Luxon default zone is what keeps the two behaving alike. Call sites therefore never pass a
| zone themselves; a `setZone("Europe/Oslo")` in app code is redundant.
|
| Lucid serialises DateTime columns with `toISO()`, so API responses carry the Oslo offset
| (`+02:00`) rather than `Z`. Both denote the same instant and every ISO parser accepts both.
|
*/

import { Settings } from "luxon";

Settings.defaultZone = "Europe/Oslo";
Settings.defaultLocale = "nb";
