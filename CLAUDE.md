# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LearnHub: a small e-learning site (browse courses, read lessons, enroll). Training repo for a Claude Code course. `README.md` has setup, `EXERCISE.md` is the Day 1 exercise, and `FEATURE.md` is a spec for a planned "Paid Courses" feature (cart, coupons, bundles, refunds, instructor revenue). Nothing from `FEATURE.md` is implemented yet.

## Commands

Run backend and frontend at the same time, in two terminals.

- Backend (http://localhost:5080): `cd backend/LearnHub.Api && dotnet run`
- Frontend (http://localhost:5173): `cd frontend && npm install && npm run dev`
- Build: `dotnet build backend/LearnHub.sln` and `cd frontend && npm run build`
- Quick backend check: GET http://localhost:5080/api/courses

Requires .NET 8 SDK and Node 20+. There are currently no tests, linter, or formatter configured. `FEATURE.md` expects a future `dotnet test` project and a `scripts/e2e-shop.sh` script, but neither exists.

## Architecture

**Backend** (`backend/LearnHub.Api`, ASP.NET Core minimal APIs, nullable + implicit usings on):
- `Program.cs` registers `InMemoryStore` as a singleton, enables CORS for `http://localhost:5173`, and calls one `Map*Endpoints()` extension per area. A new area means a new static class in `Endpoints/` plus a call in `Program.cs`.
- `Data/InMemoryStore.cs` is the whole "database": `Courses` (seed data with nested `Lessons`) and `Enrollments` are plain `List<T>`. State is lost on restart. Enrollment ids come from `Count + 1`, and lesson ids are global across courses.
- `Endpoints/` returns anonymous objects, not the model classes, so adding a field to a model does not expose it. Add it to the projection in `CourseEndpoints.cs` too.
- Errors use the shape `{ "error": "message" }` (see `EnrollmentEndpoints.cs`). The frontend relies on that shape.
- There is no auth. A student is identified only by the `studentName` string, matched case-insensitively.

**Frontend** (`frontend/`, React 19 + react-router-dom 6 + Vite, plain JS/JSX, no TypeScript):
- `src/App.jsx` holds the routes: `/`, `/courses/:id`, `/my-courses`. Pages are in `src/pages`, shared pieces in `src/components`.
- `src/api.js` is the only place that calls the backend. Its `request()` helper throws `Error(body.error)` on non-2xx. The saved student name lives in `localStorage` (`studentName`).
- `vite.config.js` proxies `/api` to `http://localhost:5080`, so the frontend uses relative URLs. The backend port (also in `Properties/launchSettings.json`) and the CORS origin must stay in sync with the Vite config.
