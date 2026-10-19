# access-control-ui

A web app for managing **who can see which data** in the Roller analytics agent, without writing
SQL. You can add people, create roles, choose what each role can see, and give or remove roles.

It manages the `roller_analytics_agent_access_control` BigQuery tables described in
`bapps-edp-analytics-mcp/semantic/access_control/README.md`.

The repo has two parts, which run together in **one container**:

| Folder | What it is | Built with |
|---|---|---|
| `frontend/` | The web pages you click around in | Vue 3, TypeScript, Vite |
| `backend/` | The API that checks the rules and reads and writes BigQuery | Python, FastAPI |

---

## Contents

1. [What you can do](#what-you-can-do)
2. [Run it on your computer](#run-it-on-your-computer)
3. [Run it with Docker](#run-it-with-docker)
4. [Deploy to Google Cloud Run](#deploy-to-google-cloud-run)
5. [Settings](#settings)
6. [How sign-in and security work](#how-sign-in-and-security-work)
7. [Where the data comes from](#where-the-data-comes-from)
8. [Adding a new data domain](#adding-a-new-data-domain)
9. [Troubleshooting](#troubleshooting)
10. [For developers](#for-developers)

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

The app follows the rules in the access-control guide. The backend enforces them; the web pages
check them too, so you get instant feedback.

- Emails must be lowercase `@rollerdigital.com` addresses.
- Role keys are lowercase words joined with `_`, for example `support_analyst`.
- The person approving access can't be the person receiving it.
- Access expires after 180 days by default.
- Removing access marks it as revoked. Nothing is ever deleted, so history is kept.
- People and roles are deactivated, never deleted.

---

## Run it on your computer

There are two ways to run it locally:

- **A. Web pages only**: quickest. Uses sample data kept in your browser. Needs only Node.js.
- **B. Web pages + backend**: the full app. The web pages talk to the real API, which uses sample
  data in its memory. Needs Node.js and Python (`uv`).

Neither one touches BigQuery. To work with the real dev tables, use
[Docker with your credentials](#use-the-real-dev-tables-instead-of-sample-data).

### What you need first

| Tool | Needed for | How to get it |
|---|---|---|
| **Git** | Downloading the code | Already on most Macs. Check with `git --version`. |
| **nvm** (Node Version Manager) | A and B | Follow https://github.com/nvm-sh/nvm#installing-and-updating, then open a new terminal. |
| **uv** (Python package manager) | B only | Follow https://docs.astral.sh/uv/getting-started/installation/, then open a new terminal. uv installs the right Python for you. |

**Download the code** (once):

```bash
git clone https://github.com/rolliyer/access-control-ui.git
```

### A. Web pages only

**1. Go into the frontend folder:**

```bash
cd access-control-ui/frontend
```

**2. Install the right Node.js version.** The folder's `.nvmrc` says which version is needed:

```bash
nvm install
```

```bash
nvm use
```

You should see `Now using node v24...`. Run `nvm use` every time you open a new terminal here.

**3. Install the libraries.** This takes a minute the first time:

```bash
npm install
```

**4. Start it:**

```bash
npm run dev
```

You should see `Local: http://localhost:5173/`.

**5. Open http://localhost:5173.** You'll see the dashboard with sample people and roles. The
bottom of the left sidebar says **Mock data**.

**6. To stop it**, press `Ctrl + C` in the terminal.

### B. Web pages + backend

You'll use **two terminals**: one for the backend and one for the web pages.

**Terminal 1: start the backend**

```bash
cd access-control-ui/backend
```

Install the backend's libraries (and Python, if needed):

```bash
uv sync
```

Start it in development sign-in mode:

```bash
AUTH_MODE=dev uv run uvicorn app.main:create_app --factory --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`. To check it, open
http://localhost:8000/healthz; it should say `ok`.

`AUTH_MODE=dev` treats you as the signed-in admin `sridhar.iyer@rollerdigital.com`. Never use it on a
server; the app refuses to start that way on Cloud Run.

**Terminal 2: start the web pages, connected to the backend**

```bash
cd access-control-ui/frontend
```

```bash
nvm use
```

```bash
npm install
```

```bash
npm run dev:api
```

Open **http://localhost:5173**. The bottom of the left sidebar now says **Live API**: every change
goes to the backend. The backend keeps data in memory, so it resets when you stop it.

**To stop**, press `Ctrl + C` in each terminal.

### Useful commands

Web pages (in `frontend/`, after `nvm use`):

| Command | What it does |
|---|---|
| `npm run dev` | Starts the web pages with sample data in the browser. |
| `npm run dev:api` | Starts the web pages connected to the backend on port 8000. |
| `npm run test:unit -- --run` | Runs the frontend tests once. |
| `npm run lint` | Checks the code for mistakes and style problems, and fixes what it can. |
| `npm run build` | Checks types and builds the production files into `frontend/dist/`. |
| `npm run sync:domains` | Refreshes the list of data domains from the analytics MCP repo. See [Adding a new data domain](#adding-a-new-data-domain). |

Backend (in `backend/`):

| Command | What it does |
|---|---|
| `uv run pytest` | Runs the backend tests. |
| `uv run ruff check .` | Checks the code for mistakes and style problems. |
| `uv run ruff format .` | Tidies code formatting. |

---

## Run it with Docker

This builds the same single container that runs in the cloud: the backend serves both the API and
the web pages. You don't need Node.js or Python for this, only Docker.

### What you need first

- **Docker Desktop**: download it from https://www.docker.com/products/docker-desktop/, install it,
  and **open it**. Wait until it says Docker is running.
- The code, downloaded as in [Run it on your computer](#run-it-on-your-computer).

### Steps

**1. Go to the top folder of the project** (not `frontend/` or `backend/`):

```bash
cd access-control-ui
```

**2. Build the image.** This takes a few minutes the first time:

```bash
docker build --platform linux/amd64 -t access-control-ui:local .
```

It's finished when you see `naming to docker.io/library/access-control-ui:local`.

**3. Start the container:**

```bash
docker run --rm --name access-control-ui --platform linux/amd64 -p 8088:8088 -e AUTH_MODE=dev access-control-ui:local
```

- `-p 8088:8088` connects port **8088 on your computer** (first number) to the container (second
  number). If 8088 is busy on your computer, change only the first number, e.g. `-p 8089:8088`, and
  use that number below.
- `-e AUTH_MODE=dev` signs you in as a development admin. Without it the container won't start,
  because it expects Google sign-in (IAP), which only exists on Cloud Run.

You should see `Uvicorn running on http://0.0.0.0:8088`.

**4. Open http://localhost:8088.** You'll see the app with **Live API** at the bottom of the sidebar,
using sample data held in the container's memory.

**5. Check it's healthy (optional).** In a second terminal:

```bash
curl -s http://localhost:8088/healthz
```

It should print `ok`.

**6. To stop it**, press `Ctrl + C`, or run:

```bash
docker stop access-control-ui
```

### Use the real dev tables instead of sample data

The steps above use sample data. To see and manage the **real** access-control tables in
`ent-data-warehouse-dev`, start the container with your own Google credentials instead.

> **This changes real data.** Opening pages only reads. Saving anything (adding a user, granting or
> revoking a role, editing a role) writes to the dev tables, and the analytics agent picks it up
> within about 5 minutes. Reading the real tables has been checked; making changes through the app
> hasn't been tested against the real tables yet, so try it on your own test grants first.

**What you need first:**
- the image, built as in step 2 above
- the **Google Cloud CLI** (`gcloud`): install it from https://cloud.google.com/sdk/docs/install
- a Google account that can read and edit the `roller_analytics_agent_access_control` dataset and
  run queries in `ent-data-warehouse-dev`

**1. Log in so programs can use your Google credentials.** You only do this once; run it again if
you later get a credentials error. A browser window opens for you to sign in:

```bash
gcloud auth application-default login
```

This saves your credentials in `~/.config/gcloud/application_default_credentials.json`.

**2. Start the container against the dev tables:**

```bash
docker run --rm --name access-control-ui --platform linux/amd64 -p 8088:8088 -e AUTH_MODE=dev -e STORE=bigquery -e BQ_PROJECT=ent-data-warehouse-dev -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json -v "$HOME/.config/gcloud/application_default_credentials.json:/tmp/adc.json:ro" access-control-ui:local
```

What the extra parts do:
- `-e STORE=bigquery -e BQ_PROJECT=ent-data-warehouse-dev` uses the real tables in that project.
- `-v …:/tmp/adc.json:ro` shares your credentials file with the container, read-only.
- `-e GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json` tells the app where that file is.

The app now reads and writes BigQuery **as your Google account**. `AUTH_MODE=dev` still records
changes as made by `sridhar.iyer@rollerdigital.com`. To record a different person, add
`-e DEV_USER_EMAIL=<your email>`.

**3. Open http://localhost:8088.** You'll see the real people, roles and grants from the dev
tables. Stop it the same way as before.

---

## Deploy to Google Cloud Run

The app runs as a Cloud Run **service** with exactly **one container that is always on**. It never
scales to zero and never adds more containers. (It's a service, not a Cloud Run *job*: jobs run once
and stop, so they can't serve a website.) In the cloud it reads and writes the real BigQuery
tables, and people sign in with Google through Identity-Aware Proxy (IAP).

> These Google Cloud commands haven't been run against a real project yet. Check them the first
> time, and fix this README if anything differs.

### What you need first

- Docker Desktop, running, as in [Run it with Docker](#run-it-with-docker).
- The **Google Cloud CLI** (`gcloud`, which includes `bq`): install it from
  https://cloud.google.com/sdk/docs/install.
- Permission to deploy to the Google Cloud project and to grant access on the BigQuery dataset.

In the commands below, replace:

| Placeholder | What to put | Example |
|---|---|---|
| `<PROJECT>` | The Google Cloud project that runs the app (`PROJECT_ID` in the settings file) | `my-project-id` |
| `<PROJECT_NUMBER>` | That project's number (`gcloud projects describe <PROJECT> --format='value(projectNumber)'`) | `123456789012` |
| `<REGION>` | Where to run it | `us-central1` |
| `<REPOSITORY>` | An Artifact Registry repository for images (`REPO` in the settings file) | `edp` |
| `<BQ_PROJECT>` | The project holding the access-control dataset | `ent-data-warehouse-dev` |

### One-time setup

**1. Log in:**

```bash
gcloud auth login
```

**2. Turn on the services the app uses:**

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iap.googleapis.com --project=<PROJECT>
```

**3. Create a repository for the images:**

```bash
gcloud artifacts repositories create <REPOSITORY> --repository-format=docker --location=<REGION> --project=<PROJECT>
```

**4. Let Docker upload to it:**

```bash
gcloud auth configure-docker <REGION>-docker.pkg.dev
```

**5. Fill in the deploy settings** for the environment, as described in
[Fill in the deploy settings](#fill-in-the-deploy-settings-once-per-environment) below. The commands
in the next steps use the same values.

**6. Create the app's own service account.** This is the identity the app runs as. Keep it
separate from the analytics agent's identity, so the agent itself can never grant access.

```bash
gcloud iam service-accounts create access-control-ui --display-name="Access control UI" --project=<PROJECT>
```

> **Using an existing service account instead?** `deploy/env/dev.env` currently uses
> `sa-cloudrun-schema-loader-dev@ent-data-ingestion-dev.iam.gserviceaccount.com` for now. That
> works, but everything else running as that account could then change who has access too. Switch
> to a dedicated account before going to `stg` or `prod`. Whichever account you use, it needs the
> permissions in step 7, with `SERVICE_ACCOUNT` from the settings file in place of
> `access-control-ui@<PROJECT>.iam.gserviceaccount.com`.

**7. Let it edit only the access-control tables, and run queries:**

```bash
bq query --use_legacy_sql=false --project_id=<BQ_PROJECT> 'GRANT `roles/bigquery.dataEditor` ON SCHEMA `<BQ_PROJECT>.roller_analytics_agent_access_control` TO "serviceAccount:access-control-ui@<PROJECT>.iam.gserviceaccount.com"'
```

```bash
gcloud projects add-iam-policy-binding <BQ_PROJECT> --member=serviceAccount:access-control-ui@<PROJECT>.iam.gserviceaccount.com --role=roles/bigquery.jobUser
```

### Fill in the deploy settings (once per environment)

Each environment (`dev`, `stg`, `prod`) has a settings file: `deploy/env/dev.env`,
`deploy/env/stg.env` and `deploy/env/prod.env`. Open the one you need and replace every
`<FILL_ME>` with the real value (the file explains each one). Then commit it. The deploy script
refuses to run while any `<FILL_ME>` is left.

### Each time you deploy

Deploys use `bin/deploy.sh`, which follows the same pattern as `bapps-edp-services`
(`make build-image ENV=dev`). Run these from the top folder of the project.

**1. Commit your changes.** The image is tagged with the current commit (e.g. `1b915f5`), so you
always know exactly which code is running. The script stops if there are uncommitted changes.

**2. See what would happen (optional, changes nothing):**

```bash
make deploy ENV=dev DRY_RUN=1
```

This prints every command and the filled-in Cloud Run settings.

**3. Build, upload and deploy:**

```bash
make deploy ENV=dev
```

This does three things:
1. builds the image (web pages + API)
2. uploads it to Artifact Registry, tagged with the commit and `latest`
3. updates the Cloud Run service from `deploy/cloudrun/service.yaml`

The service is created the first time and updated after that. At the end it prints the service
URL. For `prod` it first asks you to type `prod` to confirm.

**Other options:**

| Command | What it does |
|---|---|
| `make build-image ENV=dev` | Builds and uploads the image only, without deploying. Same name as in `bapps-edp-services`. |
| `make build ENV=dev` | Builds the image on your computer only. Nothing is uploaded. |
| `make deploy ENV=stg` | Deploys to staging. Use `ENV=prod` for production (`prd` also works). |
| `make check` | Runs all frontend and backend tests and linters. A good idea before deploying. |
| add `ALLOW_DIRTY=1` | Builds even with uncommitted changes. The tag gets `-dirty` on the end. For testing only. |

**To roll back**, deploy an earlier commit: check it out, then run `make deploy ENV=…` again.

### Let people in (after the first deploy)

**1. Allow IAP to call the service:**

```bash
gcloud run services add-iam-policy-binding access-control-ui --region=<REGION> --project=<PROJECT> --member=serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com --role=roles/run.invoker
```

**2. Allow each admin to sign in.** Repeat for every person:

```bash
gcloud iap web add-iam-policy-binding --member=user:mayank.agarwal@rollerdigital.com --role=roles/iap.httpsResourceAccessor --region=<REGION> --resource-type=cloud-run --service=access-control-ui --project=<PROJECT>
```

To limit admin powers further, set `ADMIN_EMAILS` in `service.yaml` (see [Settings](#settings)).

The service stays **private**. This is an admin tool that controls access to company data, so
**never** open it to everyone (`allUsers`). For help making it available more widely, ask in the
`ai-support` Slack channel.

---

## Settings

### Backend / container

Set these with `-e NAME=value` in `docker run`, `env:` in `deploy/cloudrun/service.yaml`, or in
front of the `uv run` command locally.

| Setting | Default | What it does |
|---|---|---|
| `STORE` | `memory` | `memory` uses sample data that resets on restart. `bigquery` uses the real tables. |
| `BQ_PROJECT` | – | Project holding the dataset. Required when `STORE=bigquery`. |
| `BQ_DATASET` | `roller_analytics_agent_access_control` | The access-control dataset. |
| `AUTH_MODE` | `iap` | `iap` checks Google sign-in. `dev` treats everyone as `DEV_USER_EMAIL`; for local use only, and refused on Cloud Run. |
| `IAP_AUDIENCE` | – | Required when `AUTH_MODE=iap`: `/projects/<PROJECT_NUMBER>/locations/<REGION>/services/access-control-ui`. |
| `DEV_USER_EMAIL` | `sridhar.iyer@rollerdigital.com` | Who you are when `AUTH_MODE=dev`. |
| `ADMIN_EMAILS` | *(empty)* | Comma-separated admins. Empty means everyone IAP lets in is an admin. |
| `DOMAINS_FILE` | the synced domain list | The metric domains file (see [Adding a new data domain](#adding-a-new-data-domain)). |
| `STATIC_DIR` | *(none locally; `/app/static` in Docker)* | The built web pages to serve. |
| `CSP_CONNECT_SRC` | `'self'` | Which addresses the web page may call. Leave as is. |
| `PORT` | `8088` in Docker | Port to listen on. Cloud Run sets `8080` itself. |

If a required setting is missing or unsafe, the app **refuses to start** and says what to fix.

### Web pages in development

`npm run dev` reads `frontend/.env.development` (sample data in the browser). `npm run dev:api`
reads `frontend/.env.api` (use the backend). In the container these don't apply: the backend tells
the web pages its settings through `/config.js`.

---

## How sign-in and security work

- **Sign-in is IAP (Google).** Every request carries a token signed by Google. The backend checks
  the signature and audience, and only then trusts the email inside. A plain email header is never
  trusted, because anyone could fake one.
- **Admins:** anyone IAP lets in, or only the people in `ADMIN_EMAILS` if you set it.
- **Least privilege:** the app runs as its own service account. That account can edit only the
  access-control dataset and run queries, nothing else. The analytics agent keeps read-only access
  through `effective_access`, under a different identity.
- **Safe SQL:** every value goes to BigQuery as a query parameter, never pasted into SQL.
- **Audit trail:** `created_by`, `updated_by` and `revoked_by` come from the signed-in person, never
  from what the browser sends. Grants are never deleted.
- **Safe defaults:** without proper settings the app won't start (e.g. no IAP audience, or dev
  sign-in on Cloud Run).
- **Browser protections:** security headers, including a Content-Security-Policy, are set on every
  response.

---

## Where the data comes from

| How you run it | Where data lives |
|---|---|
| `npm run dev` (web pages only) | In your browser. The sample data below, saved in local storage. |
| Backend with `STORE=memory` (local, or Docker) | In the backend's memory. Same sample data, reset when it restarts. |
| Backend with `STORE=bigquery` (Cloud Run, or [Docker with your credentials](#use-the-real-dev-tables-instead-of-sample-data)) | The real BigQuery tables. |

The browser never connects to BigQuery directly. Only the backend does.

**The sample data** (used by `npm run dev` and by the backend with `STORE=memory`) has only four
people. They are the ones in the analytics MCP repo's dev grant scripts:

| Person | Sample roles |
|---|---|
| `sridhar.iyer@rollerdigital.com` | Data Admin (every domain + exploratory SQL) |
| `mayank.agarwal@rollerdigital.com` | Support Analyst, plus an old revoked Support Lead grant |
| `shivani.semwal@rollerdigital.com` | Sales and Support Analyst, expiring in a day, plus an expired Finance Analyst grant |
| `abhisekh.banerjee@rollerdigital.com` | Sales and Support Analyst for a year |

It lives in `frontend/src/api/mock/seed.ts` and `backend/app/store/memory.py`. Keep the two the
same.

**To reset the browser's sample data** (web-pages-only mode):
1. Open the app.
2. Open the browser's developer tools (`Cmd + Option + I` on a Mac).
3. Go to **Application → Local Storage**.
4. Delete the key `access-control-ui:mock-db:v2`.
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

**2. Update this app's domain list.** Both repos must sit side by side in the same parent folder.
In `frontend/`, run:

```bash
npm run sync:domains
```

If the MCP repo is somewhere else, put its path in front:
`MCP_REPO_PATH=/path/to/bapps-edp-analytics-mcp npm run sync:domains`.
This updates `frontend/src/api/mock/domains.generated.json`. **Commit that file.**

**3. Make the app pick it up:**
- Web pages only: reload the page.
- Local backend: restart it.
- Cloud Run: rebuild and redeploy, as in [Each time you deploy](#each-time-you-deploy). The list is
  built into the image.

**4. Give access:** on **Roles & permissions**, edit a role, tick the new domain, and save. Then give
that role to people.

The **Domains** page in the app shows these steps too.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `nvm: command not found` or `uv: command not found` | Install it (see [What you need first](#what-you-need-first)), then open a new terminal. |
| `npm install` fails, or warns about an unsupported engine | Wrong Node.js version. In `frontend/`, run `nvm install` and then `nvm use`. |
| `Port 5173 is in use, trying another one` | The web pages are already running in another terminal. Open the address it prints instead, or stop the other one with `Ctrl + C`. |
| `address already in use` when starting the backend | Port 8000 is taken. Stop whatever is using it, or use `--port 8001`. Then start the web pages with `API_PROXY_TARGET=http://localhost:8001 npm run dev:api`. |
| The page shows errors like *Sign in through IAP to use this API* locally | Start the backend with `AUTH_MODE=dev` (see step B). |
| `ConfigError: AUTH_MODE=iap needs IAP_AUDIENCE` from `docker run` | Add `-e AUTH_MODE=dev` for local runs. On Cloud Run, set `IAP_AUDIENCE`. |
| *… is not an access-control admin* (403) | Your email isn't in `ADMIN_EMAILS`. Add it, or leave `ADMIN_EMAILS` empty. |
| Errors mentioning *DefaultCredentialsError* or *Reauthentication is needed* with `STORE=bigquery` | Your Google credentials are missing or expired. Run `gcloud auth application-default login` again, then restart the container. |
| Errors mentioning *Access Denied* or *403* from BigQuery | Your Google account can't read or edit the access-control dataset in that project. Ask for BigQuery Data Editor on the dataset and Job User on the project. |
| With `STORE=bigquery`, `docker run` fails on the `-v` part, or the app can't read `/tmp/adc.json` | The credentials file doesn't exist yet. Run `gcloud auth application-default login` (step 1 of [Use the real dev tables](#use-the-real-dev-tables-instead-of-sample-data)). |
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running. Open it and wait until it says it's running. |
| `Bind for 0.0.0.0:8088 failed: port is already allocated` | Port 8088 is busy. Change the first number, e.g. `-p 8089:8088`, then open http://localhost:8089. |
| `The container name "/access-control-ui" is already in use` | It's already running in another terminal. Use that one, or run `docker stop access-control-ui` first. |
| `requested image's platform (linux/amd64) does not match the detected host platform` | Only a warning (common on Apple Silicon Macs). Adding `--platform linux/amd64` to `docker run`, as shown above, removes it. |
| The page is blank or out of date after an update | Do a hard reload (`Cmd + Shift + R`). |
| `npm run sync:domains` says *No metrics folder* | The MCP repo isn't next to this one. Set `MCP_REPO_PATH` as shown above. |
| `Fill in PROJECT_ID in deploy/env/dev.env first` | Open that settings file and replace every `<FILL_ME>`. See [Fill in the deploy settings](#fill-in-the-deploy-settings-once-per-environment). |
| `You have uncommitted changes` when deploying | Commit your changes first, so the image tag matches the code. For a test build only, add `ALLOW_DIRTY=1`. |
| `You're not logged in to gcloud` | Run `gcloud auth login`. |
| `docker push` says *denied* or *unauthenticated* | Make sure the repository exists, and that your account can push to it (Artifact Registry Writer). |

---

## For developers

### How the pieces fit

```
Browser ──► Cloud Run (IAP sign-in) ──► one container: FastAPI
                                          ├── /api/*      → rules (service.py) → BigQuery store
                                          ├── /config.js  → tells the web pages to use /api
                                          ├── /healthz    → health check
                                          └── everything else → the built Vue app
```

- The frontend talks to data through one interface, `AccessControlApi`, with a **mock** version
  (in the browser) and an **http** version (the backend). The backend's routes match
  `frontend/src/api/adapters/http-adapter.ts`, and its JSON is camelCase.
- The same rules exist in both places, in `frontend/src/domain/validation.ts` and
  `backend/app/rules.py` + `service.py`. If you change a rule, change both.

### Project structure

```
access-control-ui/
├── frontend/                       # Vue app (has its own package.json and .nvmrc)
│   ├── src/
│   │   ├── api/                        # AccessControlApi + mock and http versions
│   │   │   └── mock/domains.generated.json # Domain list (npm run sync:domains); also used by the backend
│   │   ├── domain/                     # Rules in plain TypeScript (validation, grants, effective access)
│   │   ├── stores/                     # Pinia: users, roles, grants, catalog, access, notifications
│   │   ├── composables/                # Reusable form and search logic
│   │   ├── components/                 # ui/, layout/, access/, dashboard/, users/, roles/
│   │   ├── views/                      # One page per route
│   │   ├── assets/styles/tokens.css    # Roller colour palette (see "Colours")
│   │   └── config.ts                   # Settings: /config.js at runtime, else VITE_* variables
│   ├── public/                         # favicon.svg, config.js
│   ├── scripts/sync-domains.mjs        # Reads domains from the analytics MCP repo
│   ├── .env.development / .env.api     # Dev settings: mock mode / backend mode
│   └── vite.config.ts                  # Proxies /api to the backend in dev:api mode
├── backend/                        # FastAPI app (has its own pyproject.toml and uv.lock)
│   ├── app/
│   │   ├── main.py                     # App factory: routes, errors, security headers, serving the UI
│   │   ├── api.py                      # /api routes
│   │   ├── service.py                  # The rules: who can be granted what
│   │   ├── rules.py                    # Validation helpers (match frontend/src/domain/validation.ts)
│   │   ├── auth.py                     # IAP token check; admin check
│   │   ├── config.py                   # Settings from environment variables, with safety checks
│   │   ├── models.py                   # Request/response shapes (camelCase JSON)
│   │   ├── domains.py                  # Loads the domain list
│   │   └── store/                      # memory.py (sample data) and bigquery.py (real tables)
│   └── tests/                          # pytest
├── bin/deploy.sh                   # Build, push and deploy (make build-image / make deploy)
├── deploy/
│   ├── env/{dev,stg,prod}.env          # Per-environment settings for the deploy script
│   └── cloudrun/service.yaml           # Cloud Run template: one always-on container, IAP, service account
├── Makefile                        # Shortcuts: build, build-image, deploy, check
└── Dockerfile                      # Builds the frontend, then runs FastAPI serving UI + API
```

In the frontend, dependencies only flow one way:
`views → components → stores/composables → api/domain → types`. Components never call the API
directly; they go through the stores.

### How the Docker image works

- **Stage 1 (Node):** installs the frontend's libraries, type-checks, and builds the web pages.
- **Stage 2 (Python):** installs the backend's locked libraries with `uv`, then copies in the
  backend code, the built web pages (`/app/static`) and the domain list (`/app/domains.json`).
- It runs `uvicorn` as a non-root user on `$PORT`. FastAPI handles everything:
  - API, health check and runtime settings.
  - Long caching for fingerprinted files in `/assets/`; the browser re-checks everything else.
  - Links like `/users/123` get the web app.
- Defaults are safe: `STORE=memory` and `AUTH_MODE=iap`, so it won't start without an IAP audience.

### Colours

All colours follow Roller's standards from roller.software. The palette (primary navy, secondary
red, neutral, error, success) and the named colours components use are in
`frontend/src/assets/styles/tokens.css`. Components only use names such as `--color-text` or
`--button-primary-bg`, never raw hex values. `frontend/src/assets/__tests__/brand-colors.spec.ts`
fails the tests if a colour is hard-coded anywhere else.
