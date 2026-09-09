# bl-monorepo

Library and book management services and administration for upper secondary schools. Built with TanStack Start with Mantine using an AdonisJS backend. This project is the successor for the bl-web and bl-admin projects, with the aim to unify the administration site with the customer site.

## Workspaces

This repository consists of two workspaces.

- _frontend_ is the TanStack Start frontend responsible for all user facing UI
- _backend_ is the AdonisJS server responsible for business logic and database access

The frontend only depends on the shared types located in backend/shared. Code style and linting is handled on root level for both workspaces.

## Setup and development

```bash
# Install dependencies
$ bun install

# Copy .env.example to .env.local for both packages and fill in the correct keys

# Run the development server on http://localhost:3000 (frontend) and http://localhost:3333 (backend)
$ bun dev dev

# For production
$ bun build:backend
$ bun start:backend
$ bun build:frontend
$ bun start:frontend
```

## Code style, linting and type checking

```bash
# All checks and fixes for both workspaces can be run with
$ bun fix
```

## Testing

```bash
# Run backend tests
$ bun run test
```

## Branches

There are two active branches, `main` and `production`. The `main` branch is automatically deployed to the staging environment, while `production` auto-deploys to the public live version.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.
