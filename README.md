# Attendance System

## Database setup

The Express backend stores students, attendance, and sessions in PostgreSQL.
Set `DATABASE_URL` to a hosted PostgreSQL connection string before starting the
backend. Render deployments can set this value as a secret environment variable.
The backend also requires `ADMIN_USERNAME` and `ADMIN_PASSWORD`; use
[backend/.env.example](./backend/.env.example) as a template for local setup.

## Local development

Vite reads frontend variables from the repository root, not from `backend/.env`.
Copy [`.env.example`](./.env.example) to `.env` for local development; the API
defaults to Express at `http://localhost:3001`. Start the frontend and backend
in separate terminals with `npm run dev` and `npm --prefix backend start`.

The previous local database files are not imported automatically. Existing
records were removed as requested.

## Render deployment

Create a PostgreSQL database with a free-tier provider, then set `DATABASE_URL`,
`ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the Render web service environment.
The backend creates the required tables on startup.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
