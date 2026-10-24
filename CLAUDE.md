# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Setup and the full walkthrough are in README.md. The commands used most often:

```bash
# Database (MySQL 8 must be running; reset drops and recreates the learnhub DB)
bash db/reset.sh                      # or ./db/reset.ps1 in PowerShell

# Backend API on http://localhost:5080
cd backend/LearnHub.Api && dotnet run --urls http://localhost:5080

# Backend tests (SQLite in-memory, no MySQL needed)
cd backend && dotnet test
cd backend && dotnet test --filter "FullyQualifiedName~ApiTests"                 # one test class
cd backend && dotnet test --filter "FullyQualifiedName~ApiTests.Courses_AreListed_AndSearchable"  # one test

# Frontend on http://localhost:5173 (proxies /api to 5080)
cd frontend && npm install && npm run dev
cd frontend && npm run build

# MCP audit server (compiles src/ to dist/; Claude Code runs dist/index.js)
cd mcp-server && npm run build
```

No linter or formatter is configured for either the backend or the frontend.

Set `LEARNHUB_NOW=2026-10-01T12:00:00Z` when running the API or the tests against the sample data. The seed data ends on that date, so deadlines and refund windows are otherwise judged against the real clock. The variable is read by `SystemClock` (`Services/Infrastructure.cs`) through `IConfiguration`.

## Architecture

### Two processes share one MySQL database

- The **.NET API** (`backend/LearnHub.Api`) is the application. It uses EF Core with the Pomelo MySQL provider. The server version is hardcoded to 8.4.0 in `Program.cs`. The connection string comes from `LEARNHUB_DB` (an environment variable, which wins) or `appsettings.json`.
- The **MCP server** (`mcp-server/`) is a separate Node process. It exposes read-only audit tools (`audit_refunds`, `audit_coupon_usage`, `instructor_payout`, `run_select_query`, and others) to Claude Code. Claude Code starts it from `.mcp.json`, which passes `--env-file=.env` and a path relative to the repo root, so Claude Code must run from the repo root.

The MCP server enforces read-only access by wrapping every query in a `START TRANSACTION READ ONLY` block. `run_select_query` also has a keyword blocklist (`FORBIDDEN` in `mcp-server/src/index.ts`). Keep both in place when you add tools.

### Business rules are duplicated between C# and SQL

Some rules are implemented twice. When you change one, change the other:

- **Refund policy:** `ShopService` has `RefundDays = 7` and `RefundMaxProgressPercent = 30`. The `audit_refunds` tool in `mcp-server/src/index.ts` repeats the same defaults in its parameters and SQL.
- **Instructor payout:** `PayoutReportBuilder` computes the 70% share in C#. The `instructor_payout` MCP tool computes it again in SQL. The API and the MCP audit can disagree if only one is updated.
- **Schema:** `db/schema.sql` and `db/seed.sql` define the production-like database. The tests do not use them. `TestEnv` and `CustomWebApplicationFactory` call `Database.EnsureCreated()` from the EF model and then `TestData.Seed`. A column or table added to `schema.sql` but not to `LearnHubDbContext` (or the reverse) will pass the tests and still break the real database.

### Backend request flow

- `Program.cs` registers every service as scoped (except `IClock`, which is a singleton) and maps one `MapXEndpoints()` extension per area in `Endpoints/`. Add a new area in both places.
- Endpoints are thin. They call a service in `Services/` and convert its result into an HTTP response. Services return a result plus an error string, or a null result, and the endpoint maps that to 400, 404, or 409. Business logic stays in services, which are the classes the tests construct directly through `TestEnv`.
- **Identity is by name, not by login.** There is no authentication. Requests carry a `studentName` in the body or query string. `StudentDirectory` (`Services/Infrastructure.cs`) matches it case-insensitively and creates the student if needed. `GetOrCreate` is the only place a student row is inserted. Instructors are not matched by name. They are identified by numeric `instructorId` (for example in `InstructorService.Dashboard`).
- **Time** always comes from the injected `IClock`, never from `DateTime.UtcNow`. Tests replace it with `FakeClock`, which is pinned to `TestData.Today`. A direct `DateTime.UtcNow` call will make tests depend on the real date.

### Shop pricing is computed in one place

`ShopService.Quote` is the single source of truth for cart prices. `/api/checkout/preview` and `/api/checkout` both use it, so the preview always matches what checkout charges. The order of rules matters:

1. Bundle: 15% off every line when the cart has 3 or more paid courses.
2. Coupon: calculated on the prices after the bundle discount. It is applied across eligible lines, and the last line absorbs any rounding difference.
3. Each line's final price is `Max(0, price - bundle - coupon)`.

A coupon that has already been used by the same student is rejected through `HasUsedCoupon`.

### Frontend

- React with React Router. `src/App.jsx` declares every route, and each route is one file in `src/pages/`.
- `src/api.js` is the only place that calls `fetch`. Every page goes through it, and it throws on non-OK responses using the server's `error` field.
- The student name is stored in `localStorage` under `studentName` (see `getSavedName` and `saveName` in `api.js`). That is the only "login" the frontend has.
- The API's CORS policy allows only `http://localhost:5173`. Requests reach the API through the Vite proxy in dev, so the frontend normally never talks to port 5080 directly.

### Tests

Tests run the real API through `WebApplicationFactory<Program>` (`CustomWebApplicationFactory`) against SQLite, plus service-level tests that build the services directly from `TestEnv`. `TestData` holds the fixed data set that the tests' hardcoded expectations depend on (for example, six courses and "Maya Rao" as the first course's instructor). If you change `TestData`, expect assertions in several test files to change with it.
