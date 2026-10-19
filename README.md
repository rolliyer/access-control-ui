# access-control-ui

A web app for managing **who can see which data** in the Roller analytics agent, without writing
SQL. You can add people, create roles, choose what each role can see, and give or remove roles.

It manages the `roller_analytics_agent_access_control` tables described in
`bapps-edp-analytics-mcp/semantic/access_control/README.md`.

> **Right now the app runs on sample data.** Until a backend API is built, every change you make
> is saved only in your own browser. It never touches BigQuery. See [Where the data comes from](#where-the-data-comes-from).

---

## Contents

1. [What you can do](#what-you-can-do)
2. [Run it on your computer](#run-it-on-your-computer)
3. [Run it with Docker](#run-it-with-docker)
4. [Deploy to Google Cloud Run](#deploy-to-google-cloud-run)
5. [Settings](#settings)
6. [Where the data comes from](#where-the-data-comes-from)
7. [Adding a new data domain](#adding-a-new-data-domain)
8. [Troubleshooting](#troubleshooting)
9. [For developers](#for-developers)

---

## What you can do

- **Dashboard**: a summary of users, roles and access, a table of who can see each domain, and the
  grants that expire in the next 30 days.
- **Users**: search people by name, email or department. Add a new person and, if you like, give
  them roles in the same step.
- **A person's page**: see exactly what they can see right now and which role gives it to them.
  Edit their details, give or remove roles, or deactivate them.
- **Roles & permissions**: create roles and tick which domains each one can see.
- **Domains**: the groups of metrics available, which roles give access to each, and how to add
  a new one.

The app follows the same rules as the access-control guide:

- Emails must be lowercase `@rollerdigital.com` addresses.
- Role keys are lowercase words joined with `_`, for example `support_analyst`.
- The person approving access can't be the person receiving it.
- Access expires after 180 days by default.
- Removing access marks it as revoked. Nothing is ever deleted, so history is kept.
- People and roles are deactivated, never deleted.

---

## Run it on your computer

Use this to try the app or work on the code.

### What you need first

| Tool | Why | How to get it |
|---|---|---|
| **Git** | To download the code | Already on most Macs. Check with `git --version`. |
| **nvm** (Node Version Manager) | Installs the right version of Node.js | Follow https://github.com/nvm-sh/nvm#installing-and-updating, then open a new terminal. |
| **Node.js 24** | Runs the app | Installed by nvm in step 2 below. |

### Steps

**1. Download the code** and go into the folder:

```bash
git clone https://github.com/rolliyer/access-control-ui.git
```

```bash
cd access-control-ui
```

**2. Install the right Node.js version.** The project says which version it needs in `.nvmrc`,
and nvm reads it from there:

```bash
nvm install
```

```bash
nvm use
```

You should see `Now using node v24...`. Run `nvm use` every time you open a new terminal for this
project.

**3. Install the app's libraries.** This takes a minute the first time:

```bash
npm install
```

**4. Start the app:**

```bash
npm run dev
```

You should see a line like `Local: http://localhost:5173/`.

**5. Open http://localhost:5173 in your browser.** You'll see the dashboard with sample people
and roles. Changes you make show up straight away.

**6. To stop the app**, go back to the terminal and press `Ctrl + C`.

### Other useful commands

Run these from the project folder after `nvm use`:

| Command | What it does |
|---|---|
| `npm run test:unit -- --run` | Runs all the automated tests once. Leave off `-- --run` to re-run them as you edit. |
| `npm run lint` | Checks the code for mistakes and style problems, and fixes what it can. |
| `npm run build` | Checks types and builds the production files into `dist/`. |
| `npm run preview` | Serves the `dist/` build at http://localhost:4173, so you can check it. |
| `npm run format` | Tidies code formatting. |
| `npm run sync:domains` | Refreshes the list of data domains from the analytics MCP repo. See [Adding a new data domain](#adding-a-new-data-domain). |

---

## Run it with Docker

This runs the app exactly as it will run in the cloud. You don't need Node.js for this, only Docker.

### What you need first

- **Docker Desktop**: download it from https://www.docker.com/products/docker-desktop/, install it,
  and **open it**. Wait until it says Docker is running.
- The code, downloaded as in step 1 of [Run it on your computer](#run-it-on-your-computer).

### Steps

**1. Go into the project folder:**

```bash
cd access-control-ui
```

**2. Build the image.** This packages the app into a container image called
`access-control-ui:local`, and takes a few minutes the first time:

```bash
docker build --platform linux/amd64 -t access-control-ui:local .
```

It's finished when you see `naming to docker.io/library/access-control-ui:local`.

**3. Start the container:**

```bash
docker run --rm --name access-control-ui --platform linux/amd64 -p 8088:8088 access-control-ui:local
```

`-p 8088:8088` connects port **8088 on your computer** (first number) to port 8088 inside the
container (second number). If 8088 is already in use on your computer, change only the first number,
e.g. `-p 8089:8088`, and use that number in the addresses below.

**4. Open http://localhost:8088 in your browser.** You should see the same app as before.

**5. Check it's healthy (optional).** In a second terminal, run:

```bash
curl -s http://localhost:8088/healthz
```

It should print `ok`.

**6. To stop it**, press `Ctrl + C` in the terminal where it's running, or run:

```bash
docker stop access-control-ui
```

**Try a different setting (optional).** Settings are read when the container starts, so you can
change them without rebuilding. For example:

```bash
docker run --rm --name access-control-ui --platform linux/amd64 -p 8088:8088 -e APP_ACTOR_EMAIL=you@rollerdigital.com access-control-ui:local
```

Then `curl -s http://localhost:8088/config.js` shows the settings the app is using. All the
settings are listed under [Settings](#settings).

---

## Deploy to Google Cloud Run

The app runs as a Cloud Run **service** with exactly **one container that is always on**. It never
scales to zero and never adds more containers. (It's a service, not a Cloud Run *job*: jobs run once
and stop, so they can't serve a website.)

These settings live in `deploy/cloudrun/service.yaml`.

### What you need first

- Docker Desktop, running, as in [Run it with Docker](#run-it-with-docker).
- The **Google Cloud CLI** (`gcloud`): install it from https://cloud.google.com/sdk/docs/install.
- A Google Cloud project you're allowed to deploy to.

In the commands below, replace:

| Placeholder | What to put | Example |
|---|---|---|
| `<PROJECT>` | Your Google Cloud project ID | `my-project-id` |
| `<REGION>` | The region to run in | `us-central1` |
| `<REPOSITORY>` | An Artifact Registry repository for container images | `access-control` |

### One-time setup

**1. Log in to Google Cloud:**

```bash
gcloud auth login
```

**2. Create a repository for the container images.** Skip this if it already exists:

```bash
gcloud artifacts repositories create <REPOSITORY> --repository-format=docker --location=<REGION> --project=<PROJECT>
```

**3. Let Docker push to that repository:**

```bash
gcloud auth configure-docker <REGION>-docker.pkg.dev
```

### Each time you deploy

**1. Build the image and upload it** to the repository. The image is tagged with the current
commit, so every deploy is traceable:

```bash
IMAGE=<REGION>-docker.pkg.dev/<PROJECT>/<REPOSITORY>/access-control-ui:$(git rev-parse --short HEAD)
```

```bash
docker build --platform linux/amd64 -t "$IMAGE" .
```

```bash
docker push "$IMAGE"
```

**2. Deploy it.** This creates the service the first time and updates it after that:

```bash
gcloud run deploy access-control-ui --image="$IMAGE" --region=<REGION> --project=<PROJECT> --min-instances=1 --max-instances=1 --port=8080 --no-allow-unauthenticated --set-env-vars=APP_API_MODE=mock
```

When it finishes, it prints the service URL.

*Alternative:* put the `$IMAGE` value into the `image:` line of `deploy/cloudrun/service.yaml`,
then run:

```bash
gcloud run services replace deploy/cloudrun/service.yaml --region=<REGION> --project=<PROJECT>
```

### Who can open it

The service is **private**: only people or accounts given the `roles/run.invoker` role can reach
it. This is an admin tool that controls access to company data, so **don't** open it to everyone
(`allUsers`). For how to make it available to colleagues, ask in the `ai-support` Slack channel.

---

## Settings

The Docker image reads these when the container starts, so one image works everywhere. Set them with
`-e NAME=value` in `docker run`, or `--set-env-vars` in Cloud Run.

| Setting | Default | What it does |
|---|---|---|
| `APP_API_MODE` | `mock` | `mock` keeps sample data in each person's browser. `http` uses the real backend API. |
| `APP_API_BASE_URL` | `/api` | Where the backend API is, when `APP_API_MODE=http`. |
| `APP_ACTOR_EMAIL` | `admin@rollerdigital.com` | The email recorded as "created by" in mock mode. |
| `CSP_CONNECT_SRC` | `'self'` | Which web addresses the page may call. Add the backend's address if it's on a different domain, e.g. `'self' https://api.example.com`. |
| `PORT` | `8088` | The port the container listens on. Cloud Run always sets it to `8080` for you, so leave it alone there. |

When you run with `npm run dev` instead, the same settings come from `.env.development` as
`VITE_API_MODE`, `VITE_API_BASE_URL` and `VITE_ACTOR_EMAIL` (see `.env.example`).

---

## Where the data comes from

The app gets all its data through one interface, `AccessControlApi`
(`src/api/access-control-api.ts`), which has two versions:

| Mode | What happens |
|---|---|
| `mock` (default) | Everything runs in your browser. It starts with sample data matching `dev_seed.sql`, saves your changes in the browser's local storage, and applies the same rules as the real backend would. Nothing reaches BigQuery. |
| `http` | The app calls a REST backend. That backend doesn't exist yet. The endpoints it must provide are listed at the top of `src/api/adapters/http-adapter.ts`. |

The browser never connects to BigQuery directly. The backend will hold the BigQuery credentials and
record who made each change from their login.

**To reset the sample data** in your browser:
1. Open the app.
2. Open the browser's developer tools (`Cmd + Option + I` on a Mac).
3. Go to **Application → Local Storage**.
4. Delete the key `access-control-ui:mock-db:v1`.
5. Reload the page.

---

## Adding a new data domain

A **domain** is a group of metrics, such as `sales` or `support`. It is defined by a folder in the
`bapps-edp-analytics-mcp` repo, not in this app. That's deliberate: access only works if the name
matches a metrics folder exactly, so a domain can't be typed in by hand.

**1. In the `bapps-edp-analytics-mcp` repo:**
- create `semantic/metrics/<domain>/` containing a `_domain.yaml` and the metric files
- add the folder to `metrics_dirs` in `agents/roller_analyst.yaml`
- add the domain name to `valid_resources` in `semantic/access_control/validate.sql`

**2. Make this app see it:**
- *Mock mode:* both repos must sit side by side in the same parent folder. In this project, run:

  ```bash
  npm run sync:domains
  ```

  Then reload the app. If the MCP repo is somewhere else, put its path in front of the command:
  `MCP_REPO_PATH=/path/to/bapps-edp-analytics-mcp npm run sync:domains`.
- *Backend mode:* click **Refresh** on the **Domains** page.

**3. Give access:** on **Roles & permissions**, edit a role, tick the new domain, and save. Then give
that role to people.

The **Domains** page in the app shows these steps too.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `nvm: command not found` | Install nvm (see [What you need first](#what-you-need-first)), then open a new terminal. |
| `npm install` fails, or warns about an unsupported engine | You're on the wrong Node.js version. Run `nvm install` and then `nvm use` in the project folder. |
| `Port 5173 is in use, trying another one` | Port 5173 is taken, usually because the app is already running in another terminal. Open the address it prints instead (e.g. http://localhost:5174), or stop the other one with `Ctrl + C`. |
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running. Open it and wait until it says it's running. |
| `Bind for 0.0.0.0:8088 failed: port is already allocated` | Something else on your computer is using port 8088. Change the first number, e.g. `-p 8089:8088`, then open http://localhost:8089. |
| `The container name "/access-control-ui" is already in use` | The app is already running in another terminal. Use that one, or stop it first with `docker stop access-control-ui`. |
| `requested image's platform (linux/amd64) does not match the detected host platform` | Only a warning (common on Apple Silicon Macs); the app still works. Adding `--platform linux/amd64` to `docker run`, as shown above, removes it. |
| The page is blank or out of date after an update | Do a hard reload (`Cmd + Shift + R`). If sample data looks wrong, [reset it](#where-the-data-comes-from). |
| `npm run sync:domains` says *No metrics folder* | The MCP repo isn't next to this one. Set `MCP_REPO_PATH` as shown above. |

---

## For developers

Built with Vue 3 (`<script setup>` + TypeScript), Vite, Pinia, Vue Router and Vitest. The code
checks are `npm run lint`, `npx vue-tsc --build` and `npm run test:unit -- --run`.

### Project structure

```
access-control-ui/
├── src/
│   ├── api/                      # Data access: the only layer that knows where data lives
│   │   ├── access-control-api.ts     # AccessControlApi interface + ApiError
│   │   ├── adapters/                 # http-adapter (REST), mock-adapter (in-browser)
│   │   ├── mock/seed.ts              # Sample data mirroring dev_seed.sql
│   │   ├── mock/domains.generated.json  # Domain list written by `npm run sync:domains`
│   │   ├── http-client.ts
│   │   └── index.ts                  # useApi() / setApi(): picks the adapter from config
│   ├── domain/                   # Business rules in plain TypeScript, no Vue (easy to test)
│   │   ├── resources.ts              # Tiers + helpers for domains
│   │   ├── grants.ts                 # Grant status and expiry
│   │   ├── effective-access.ts       # Same logic as the effective_access view
│   │   └── validation.ts
│   ├── stores/                   # Pinia stores: users, roles, grants, catalog (domains),
│   │                             #   access (combines them), notifications
│   ├── composables/              # useAsyncAction, useUserSearch, useUserForm, useGrantForm
│   ├── components/
│   │   ├── ui/                       # Building blocks (BaseButton, BaseModal, RollerLogo, …)
│   │   ├── layout/                   # AppShell, AppSidebar, PageHeader
│   │   ├── access/                   # ResourceChips, PermissionPicker, GrantStatusBadge, …
│   │   ├── dashboard/                # AccessMatrix, DomainCoverage, ExpiringGrantsList
│   │   ├── users/                    # UserTable, AddUserModal, GrantRoleModal, …
│   │   └── roles/                    # RoleCard, RoleFormModal
│   ├── views/                    # One page per route (loaded on demand)
│   ├── router/                   # Routes + typed route names
│   ├── types/                    # Types matching the BigQuery tables
│   ├── utils/                    # Date and name formatting
│   ├── assets/                   # Global CSS + colour tokens (Roller palette)
│   └── config.ts                 # Settings: /config.js at runtime, else VITE_* variables
├── public/                       # Copied as-is: favicon.svg, config.js (runtime settings)
├── scripts/sync-domains.mjs      # Reads domains from the analytics MCP repo
├── docker/                       # nginx config + start-up script for the Docker image
├── deploy/cloudrun/service.yaml  # Cloud Run service: one always-on container
└── Dockerfile
```

Dependencies only flow one way: `views → components → stores/composables → api/domain → types`.
Components never call the API directly; they go through the stores.

### How the Docker image works

- **Build stage (Node):** installs dependencies, type-checks and builds the app.
- **Run stage (nginx):** serves the built files as a non-root user (uid 101). The image is about
  80 MB.
  - It listens on `$PORT` (8088 locally, 8080 on Cloud Run) and sends unknown paths to `index.html`, so links like `/users/123` work.
  - `/healthz` is the health check.
  - Built files are cached for a year. The browser re-checks `index.html` on every visit, and
    `config.js` is never cached.
  - Security headers are set, including a Content-Security-Policy.
- **At start-up:** `docker/40-runtime-config.sh` writes `/config.js` from the `APP_*` settings.
  nginx's template step fills `PORT` and `CSP_CONNECT_SRC` into
  `docker/nginx/default.conf.template`.

### Colours

All colours follow Roller's standards from roller.software. The palette (primary navy, secondary
red, neutral, error, success) and the named colours components use are in
`src/assets/styles/tokens.css`. Components only use names such as `--color-text` or
`--button-primary-bg`, never raw hex values. `src/assets/__tests__/brand-colors.spec.ts` fails the
tests if a colour is hard-coded anywhere else.
