# bl-monorepo

Library and book management services and administration for upper secondary schools. Built with TanStack Start with Mantine using an AdonisJS backend. This project is the successor for the bl-web and bl-admin projects, with the aim to unify the administration site with the customer site.

## Workspaces

This repository consists of two workspaces.

- _frontend_ is the TanStack Start frontend responsible for all user facing UI
- _backend_ is the AdonisJS server responsible for business logic and database access

The frontend only depends on the shared types located in backend/shared. Code style and linting is handled on root level for both workspaces.

## Setup and development

```bash
# Install dependencies with Vite+ (Node 24 from .node-version, Bun from packageManager)
$ vp install

# Copy .env.example to .env.local for both packages and fill in the correct keys

# Run the development server on http://localhost:3000 (frontend) and http://localhost:3333 (backend)
$ vpr dev

# For production
$ vpr build:backend
$ vpr start:backend
$ vpr build:frontend
$ vpr start:frontend
```

## Code style, linting and type checking

Formatting, linting and type-aware checks are configured once in the root `vite.config.ts` and run through [Vite+](https://viteplus.dev).

```bash
# Check both workspaces (what CI runs)
$ vpr check

# Apply all fixes
$ vpr fix
```

## Testing

```bash
# Run backend tests (Japa; `vp test` is Vitest and has no suites yet)
$ vpr test
```

## Branches

There are two active branches, `main` and `production`. The `main` branch is automatically deployed to the staging environment, while `production` auto-deploys to the public live version.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.
