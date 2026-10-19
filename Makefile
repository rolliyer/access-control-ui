# Shortcuts for building and deploying. ENV is dev, stg or prod (default: dev).
#   make build-image ENV=dev   build and push the image (same name as bapps-edp-services)
#   make deploy ENV=dev        build, push and deploy to Cloud Run
#   make check                 run all tests and linters
# Add DRY_RUN=1 to print the commands instead of running them,
# and ALLOW_DIRTY=1 to build with uncommitted changes.

ENV ?= dev
FLAGS := $(if $(DRY_RUN),--dry-run,) $(if $(ALLOW_DIRTY),--allow-dirty,)

.PHONY: build build-image push deploy check

build:
	./bin/deploy.sh $(ENV) build $(FLAGS)

build-image push:
	./bin/deploy.sh $(ENV) push $(FLAGS)

deploy:
	./bin/deploy.sh $(ENV) deploy $(FLAGS)

check:
	cd frontend && npm run lint && npx vue-tsc --build && npm run test:unit -- --run
	cd backend && uv run ruff check . && uv run pytest -q
