# access-control-ui

Admin UI for the Roller analytics agent's access control. It lets admins manage users, roles,
role permissions and grants without writing SQL. Those are the `roller_analytics_agent_access_control`
tables described in `bapps-edp-analytics-mcp/semantic/access_control/README.md`.

Built with Vue 3 (`<script setup>` + TypeScript), Vite, Pinia, Vue Router and Vitest.

## Features

- **Dashboard**: summary stats, a searchable people × domains access matrix, domain coverage, and
  grants expiring within 30 days.
- **Users**: search by name, email or department, filter by status and department. The filters are
  kept in the URL. Add users, optionally with roles granted in the same step.
- **User detail**: what the person can see right now and which role grants it, plus their grants
  with full history. Edit details, deactivate or reactivate, grant a role, or revoke one.
- **Domains**: the metric domains found in the analytics MCP repo, with metric counts, whether
  the agent loads each one, which roles grant it and how many people can see it. Permissions that
  point at unknown domains are flagged.
- **Roles & permissions**: create and edit roles, pick domains and tiers, and retire or reactivate
  roles. Shows a warning when the exploratory tier is given to a role that can't see every domain.

The UI enforces the same rules as the guide:
- Emails are lowercase `@rollerdigital.com` addresses.
- Role keys are snake_case.
- The approver can't be the person receiving access.
- Grants default to 180 days.
- Grants are append-only: revoking sets `revokedAt`, it never deletes the row.
- Users and roles are deactivated, never deleted.

## Getting started

Requires Node `^22.18` or `>=24.12` (see `.nvmrc`).

```sh
nvm use
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production build |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run lint` | oxlint + ESLint |
| `npm run format` | Prettier |
| `npm run sync:domains` | Refresh the mock domain list from the analytics MCP repo |

## Data source

All data access goes through the `AccessControlApi` interface (`src/api/access-control-api.ts`).
`VITE_API_MODE` picks the implementation (see `.env.example`):

| Mode | Adapter | Use |
|---|---|---|
| `mock` (default) | `MockAccessControlApi` | Runs entirely in the browser. It's seeded from `dev_seed.sql` and kept in localStorage. It applies the same validation as the real backend. |
| `http` | `HttpAccessControlApi` | Calls a REST backend at `VITE_API_BASE_URL`. The contract is documented in `src/api/adapters/http-adapter.ts`. |

The browser never talks to BigQuery directly. A backend service should own the BigQuery
credentials and set `created_by` / `revoked_by` from the signed-in user.

To reset the mock data, clear the `access-control-ui:mock-db:v1` localStorage key.

## Project structure

```
src/
├── api/                    # Data access — the only layer that knows where data lives
│   ├── access-control-api.ts   # AccessControlApi interface + ApiError
│   ├── adapters/               # http-adapter (REST), mock-adapter (in-browser)
│   ├── mock/seed.ts            # Seed data mirroring dev_seed.sql
│   ├── http-client.ts
│   └── index.ts                # useApi() / setApi() — picks the adapter from config
├── domain/                 # Pure business rules, no Vue — easy to unit test
│   ├── resources.ts            # Domains and tiers
│   ├── grants.ts               # Grant status, expiry
│   ├── effective-access.ts     # Client-side equivalent of the effective_access view
│   └── validation.ts
├── stores/                 # Pinia setup stores: users, roles, grants, access (derived), notifications
├── composables/            # useAsyncAction, useUserSearch, useUserForm, useGrantForm
├── components/
│   ├── ui/                     # Generic building blocks (BaseButton, BaseModal, BaseInput, …)
│   ├── layout/                 # AppShell, AppSidebar, PageHeader
│   ├── access/                 # Access-specific pieces (ResourceChips, PermissionPicker, …)
│   ├── dashboard/              # AccessMatrix, DomainCoverage, ExpiringGrantsList
│   ├── users/                  # UserTable, AddUserModal, GrantRoleModal, …
│   └── roles/                  # RoleCard, RoleFormModal
├── views/                  # Route-level pages (lazy-loaded)
├── router/                 # Routes + typed route names
├── types/                  # Types mirroring the BigQuery tables
├── utils/                  # Date and user formatting helpers
├── assets/                 # Global CSS + design tokens (Roller palette)
└── config.ts               # Typed access to VITE_* env vars
```

### Colours

All colours follow Roller's standards, taken from roller.software. The raw palette (primary
navy, secondary red, neutral, error, success) and the semantic tokens components use are in
`src/assets/styles/tokens.css`. Components only reference semantic tokens such as
`--color-text` or `--button-primary-bg`, never hex values. `src/assets/__tests__/brand-colors.spec.ts`
fails the build if a colour is hard-coded anywhere else.

Dependencies flow one way: `views → components → stores/composables → api/domain → types`.
Components never call the API directly; they go through stores.

## Adding a new domain

Domains aren't typed into the UI. A domain *is* a folder under `semantic/metrics/` in
`bapps-edp-analytics-mcp`, and the UI discovers them through `listDomains()` (`GET /domains`).
Permission keys must match a folder name exactly, so a typed key with no folder behind it would
grant nothing.

1. In the MCP repo, create `semantic/metrics/<domain>/` with `_domain.yaml` and the metric files.
   Add the folder to `metrics_dirs` in `agents/roller_analyst.yaml`, and add the key to
   `valid_resources` in `validate.sql`.
2. Make the UI pick it up:
   - **mock mode**: run `npm run sync:domains`, then reload. By default it reads
     `../bapps-edp-analytics-mcp`; set `MCP_REPO_PATH` to point somewhere else. It writes
     `src/api/mock/domains.generated.json`.
   - **http mode**: the backend serves `GET /domains`. Click **Refresh** on the Domains page.
3. On **Roles & permissions**, tick the new domain on a role, then grant that role to people.

The Domains page shows these steps too.
