COMPOSE_FILES = -f docker-compose.yml -f docker-compose.dev.yml
DOCKER_COMPOSE = docker compose $(COMPOSE_FILES)

.PHONY: dev dev-build dev-down dev-logs dev-config seed seed-reset

# Load demo data (dev stack must be running)
seed:
	$(DOCKER_COMPOSE) exec backend npm run seed

# Wipe all data, then load demo data
seed-reset:
	$(DOCKER_COMPOSE) exec backend npm run seed -- --reset

# Start local development containers with live-reload overrides
dev:
	$(DOCKER_COMPOSE) up

# Build images first, then start local development containers
dev-build:
	$(DOCKER_COMPOSE) up --build

# Stop and remove local development containers
dev-down:
	$(DOCKER_COMPOSE) down

# Stream logs from all services
dev-logs:
	$(DOCKER_COMPOSE) logs -f

# Validate the merged compose configuration
dev-config:
	$(DOCKER_COMPOSE) config
