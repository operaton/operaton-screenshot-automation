# Operaton Screenshot Automation Toolkit
# =======================================
# 
# Usage: make <target>
# 
# Run 'make help' to see all available targets

.PHONY: help install setup deploy data incidents simulate capture analyze reset clean all \
        check check-debug test test-check chaos-check chaos-check-debug status-debug \
		chaos-status chaos-status-debug

# Default target
.DEFAULT_GOAL := help

# Colors for pretty output (cross-platform)
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Cross-platform echo with color support
# Usage: @$(call log,$(CYAN),Message here)
define log
	@printf "$(1)$(2)$(RESET)\n"
endef

# Or simpler - just define ECHO:
ECHO := @printf

# Configuration
NODE := node
NPM := npm
SCRIPTS_DIR := scripts

#---------------------------------------------------------------------------
# HELP
#---------------------------------------------------------------------------

# Replace the entire help: target in your Makefile with this:

help: ## Show this help message
	@printf "\n"
	@printf "$(CYAN)Operaton Screenshot Automation Toolkit$(RESET)\n"
	@printf "========================================\n"
	@printf "\n"
	@printf "$(GREEN)Setup & Installation:$(RESET)\n"
	@grep -E '^(install|setup|check|check-debug|status|status-debug):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Testing:$(RESET)\n"
	@grep -E '^(test|chaos-.*):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Deployment & Data:$(RESET)\n"
	@grep -E '^(deploy|data|users|incidents|simulate):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Screenshot Capture:$(RESET)\n"
	@grep -E '^(capture|analyze):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Code Quality:$(RESET)\n"
	@grep -E '^(lint|format|validate):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Dependency Management:$(RESET)\n"
	@grep -E '^deps-.*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Cleanup:$(RESET)\n"
	@grep -E '^(reset|clean|wipe):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(GREEN)Workflows:$(RESET)\n"
	@grep -E '^(all|full|quick|fresh):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
	@printf "$(YELLOW)Examples:$(RESET)\n"
	@printf "  make install          # First-time setup\n"
	@printf "  make quick            # Quick workflow: deploy + data + capture\n"
	@printf "  make validate         # Check code quality before commit\n"
	@printf "  make deps-check       # Check for outdated packages\n"
	@printf "  make chaos-check      # Run chaos tests for check-connection\n"
	@printf "  make reset            # Wipe all data and start fresh\n"
	@printf "\n"

#---------------------------------------------------------------------------
# SETUP & INSTALLATION
#---------------------------------------------------------------------------

install: ## Install npm dependencies
	@printf "$(CYAN)Installing dependencies...$(RESET)\n"
	$(NPM) install
	@printf "$(GREEN)✓ Dependencies installed$(RESET)\n"

setup: install ## Full setup: install dependencies and create .env file
	@printf "$(CYAN)Setting up environment...$(RESET)\n"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env file - please edit with your Operaton credentials$(RESET)\n"; \
	else \
		echo "$(GREEN)✓ .env file already exists$(RESET)\n"; \
	fi
	@printf "$(GREEN)✓ Setup complete$(RESET)\n"

check: ## Check connection to Operaton instance (MERGED)
	@printf "$(CYAN)Checking Operaton connection...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/check-connection.js

check-debug: ## Check connection to Operaton instance with debug output (MERGED)
	@printf "$(CYAN)Checking Operaton connection (debug mode)...$(RESET)\n"
	DEBUG=true $(NODE) $(SCRIPTS_DIR)/check-connection.js

status: ## Show current status of Operaton (MERGED)
	@printf "$(CYAN)Operaton Environment Status$(RESET)\n"
	@echo "============================"
	@$(NODE) $(SCRIPTS_DIR)/show-status.js

status-debug: ## Show current status of Operaton with debug output (MERGED)
	@printf "$(CYAN)Showing Operaton status (debug mode)...$(RESET)\n"
	DEBUG=true $(NODE) $(SCRIPTS_DIR)/show-status.js

#---------------------------------------------------------------------------
# DEPLOYMENT & DATA GENERATION
#---------------------------------------------------------------------------

deploy: ## Deploy BPMN/DMN processes to Operaton
	@printf "$(CYAN)Deploying processes...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/deploy-processes.js

users: ## Create users and groups only
	@printf "$(CYAN)Creating users and groups...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js --users-only

data: ## Generate test data (users, process instances, tasks)
	@printf "$(CYAN)Generating test data...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js

data-light: ## Generate minimal test data (fewer instances)
	@printf "$(CYAN)Generating light test data...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js --light

simulate: ## Run simulation scenarios (tokens, history, tasks)
	@printf "$(CYAN)Running simulation scenarios...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js

simulate-tokens: ## Simulate processes with visible tokens at various stages
	@printf "$(CYAN)Simulating token positions...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js --tokens

simulate-history: ## Generate completed instances for history views
	@printf "$(CYAN)Generating history data...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js --history

incidents: ## Create intentional incidents (failed jobs, errors)
	@printf "$(CYAN)Creating incidents...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js

incidents-script: ## Create incidents via failing script tasks
	@printf "$(CYAN)Creating script task incidents...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js --script-errors

incidents-service: ## Create incidents via failing service tasks
	@printf "$(CYAN)Creating service task incidents...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js --service-errors

#---------------------------------------------------------------------------
# SCREENSHOT CAPTURE
#---------------------------------------------------------------------------

capture: ## Capture all screenshots (headless)
	@printf "$(CYAN)Capturing screenshots...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js

capture-debug: ## Capture screenshots with visible browser (for debugging)
	@printf "$(CYAN)Capturing screenshots (debug mode)...$(RESET)\n"
	HEADLESS=false DEBUG=true $(NODE) $(SCRIPTS_DIR)/capture-screenshots.js

capture-cockpit: ## Capture only Cockpit screenshots
	@printf "$(CYAN)Capturing Cockpit screenshots...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=cockpit

capture-tasklist: ## Capture only Tasklist screenshots
	@printf "$(CYAN)Capturing Tasklist screenshots...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=tasklist

capture-admin: ## Capture only Admin screenshots
	@printf "$(CYAN)Capturing Admin screenshots...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=admin

analyze: ## Analyze documentation for screenshots to replace
	@printf "$(CYAN)Analyzing documentation...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/analyze-documentation.js

#---------------------------------------------------------------------------
# CLEANUP & RESET
#---------------------------------------------------------------------------

reset: ## Reset Operaton: delete all deployments, instances, and users
	@printf "$(RED)WARNING: This will delete ALL data from Operaton!$(RESET)\n"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@printf "$(CYAN)Resetting Operaton environment...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js

reset-instances: ## Delete all process instances only
	@printf "$(CYAN)Deleting all process instances...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --instances-only

reset-deployments: ## Delete all deployments only
	@printf "$(CYAN)Deleting all deployments...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --deployments-only

reset-users: ## Delete created test users only
	@printf "$(CYAN)Deleting test users...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --users-only

reset-force: ## Force reset without confirmation prompt
	@printf "$(CYAN)Force resetting Operaton environment...$(RESET)\n"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --force

clean: ## Clean local output files (screenshots, reports)
	@printf "$(CYAN)Cleaning output directory...$(RESET)\n"
	rm -rf output/*
	@printf "$(GREEN)✓ Output directory cleaned$(RESET)\n"

wipe: reset clean ## Full wipe: reset Operaton AND clean local files

#---------------------------------------------------------------------------
# WORKFLOWS (Combined Tasks)
#---------------------------------------------------------------------------

quick: deploy data capture ## Quick workflow: deploy, generate data, capture
	@printf "$(GREEN)✓ Quick workflow complete$(RESET)\n"

full: deploy data simulate incidents capture ## Full workflow with all scenarios
	@printf "$(GREEN)✓ Full workflow complete$(RESET)\n"

all: setup deploy data simulate incidents capture analyze ## Complete workflow from scratch
	@printf "$(GREEN)✓ Complete workflow finished$(RESET)\n"

fresh: reset-force deploy data simulate incidents capture ## Fresh start: reset then full workflow
	@printf "$(GREEN)✓ Fresh workflow complete$(RESET)\n"

#---------------------------------------------------------------------------
# TESTING
#---------------------------------------------------------------------------

test: ## Run all tests
	@printf "$(CYAN)Running all tests...$(RESET)\n"
	$(NODE) tests/chaos-check-connection.js
	$(NODE) tests/chaos-show-status.js
	@printf "$(GREEN)All tests passed$(RESET)\n"

test-check: chaos-check ## Alias for chaos-check
test-status: chaos-status ## Alias for chaos-status

chaos-check: ## Run chaos tests for checking Operaton instance (MERGED)
	@printf "$(CYAN)Running chaos tests for checking Operaton connection...$(RESET)\n"
	$(NODE) tests/chaos-check-connection.js

chaos-check-debug: ## Run chaos tests for checking Operaton instance with debug output (MERGED)
	@printf "$(CYAN)Running chaos tests for checking Operaton connection (debug mode)...$(RESET)\n"
	DEBUG=true $(NODE) tests/chaos-check-connection.js

chaos-status: ## Run chaos tests for showing current status of Operaton (MERGED)
	@printf "$(CYAN)Running chaos tests for showing Operaton status...$(RESET)\n"
	$(NODE) tests/chaos-show-status.js

chaos-status-debug: ## Run chaos tests for showing current status of Operaton with debug output (MERGED)
	@printf "$(CYAN)Running chaos tests for showing Operaton status (debug mode)...$(RESET)\n"
	DEBUG=true $(NODE) tests/chaos-show-status.js

#---------------------------------------------------------------------------
# CODE QUALITY
#---------------------------------------------------------------------------

lint: ## Run ESLint on all scripts
	@printf "$(CYAN)Running ESLint...$(RESET)\n"
	$(NPM) run lint

lint-fix: ## Run ESLint and auto-fix issues
	@printf "$(CYAN)Running ESLint with auto-fix...$(RESET)\n"
	$(NPM) run lint:fix

format: ## Format all code with Prettier
	@printf "$(CYAN)Formatting code...$(RESET)\n"
	$(NPM) run format

format-check: ## Check code formatting without changes
	@printf "$(CYAN)Checking code format...$(RESET)\n"
	$(NPM) run format:check

validate: ## Run all code quality checks (lint + format)
	@printf "$(CYAN)Validating code...$(RESET)\n"
	$(NPM) run validate

#---------------------------------------------------------------------------
# DEPENDENCY MANAGEMENT
#---------------------------------------------------------------------------

deps-check: ## Check for outdated dependencies
	@printf "$(CYAN)Checking for outdated packages...$(RESET)\n"
	$(NPM) run deps:check

deps-update: ## Update all dependencies to latest
	@printf "$(CYAN)Updating all dependencies...$(RESET)\n"
	$(NPM) run deps:update

deps-update-minor: ## Update dependencies (minor/patch only, safer)
	@printf "$(CYAN)Updating dependencies (minor/patch only)...$(RESET)\n"
	$(NPM) run deps:update:minor

deps-audit: ## Run security audit
	@printf "$(CYAN)Running security audit...$(RESET)\n"
	$(NPM) run deps:audit

deps-audit-fix: ## Fix security vulnerabilities
	@printf "$(CYAN)Fixing security vulnerabilities...$(RESET)\n"
	$(NPM) run deps:audit:fix

#---------------------------------------------------------------------------
# GIT HOOKS
#---------------------------------------------------------------------------

hooks-install: ## Install git hooks (husky)
	@printf "$(CYAN)Installing git hooks...$(RESET)\n"
	npx husky install
	@printf "$(GREEN)✓ Git hooks installed$(RESET)\n"

hooks-uninstall: ## Uninstall git hooks
	@printf "$(CYAN)Uninstalling git hooks...$(RESET)\n"
	rm -rf .husky/_
	@printf "$(GREEN)✓ Git hooks uninstalled$(RESET)\n"

#---------------------------------------------------------------------------
# DEVELOPMENT & DEBUGGING
#---------------------------------------------------------------------------

list-deployments: ## List current deployments in Operaton
	@$(NODE) -e "const axios = require('axios'); require('dotenv').config(); \
		axios.get(process.env.OPERATON_REST_URL + '/deployment', { \
			auth: { username: process.env.OPERATON_USERNAME, password: process.env.OPERATON_PASSWORD } \
		}).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(e => console.error(e.message))"

list-instances: ## List running process instances
	@$(NODE) -e "const axios = require('axios'); require('dotenv').config(); \
		axios.get(process.env.OPERATON_REST_URL + '/process-instance', { \
			auth: { username: process.env.OPERATON_USERNAME, password: process.env.OPERATON_PASSWORD } \
		}).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(e => console.error(e.message))"

list-incidents: ## List current incidents
	@$(NODE) -e "const axios = require('axios'); require('dotenv').config(); \
		axios.get(process.env.OPERATON_REST_URL + '/incident', { \
			auth: { username: process.env.OPERATON_USERNAME, password: process.env.OPERATON_PASSWORD } \
		}).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(e => console.error(e.message))"

list-tasks: ## List current tasks
	@$(NODE) -e "const axios = require('axios'); require('dotenv').config(); \
		axios.get(process.env.OPERATON_REST_URL + '/task', { \
			auth: { username: process.env.OPERATON_USERNAME, password: process.env.OPERATON_PASSWORD } \
		}).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(e => console.error(e.message))"

