# Operaton Screenshot Automation Toolkit
# =======================================
# 
# Usage: make <target>
# 
# Run 'make help' to see all available targets

.PHONY: help install setup deploy data incidents simulate capture analyze reset clean all \
        check check-debug test test-check chaos-check chaos-check-debug

# Default target
.DEFAULT_GOAL := help

# Colors for pretty output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Configuration
NODE := node
NPM := npm
SCRIPTS_DIR := scripts

#---------------------------------------------------------------------------
# HELP
#---------------------------------------------------------------------------

help: ## Show this help message
	@echo ""
	@echo "$(CYAN)Operaton Screenshot Automation Toolkit$(RESET)"
	@echo "========================================"
	@echo ""
	@echo "$(GREEN)Setup & Installation:$(RESET)"
	@grep -E '^(install|setup|check|check-debug):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Deployment & Data:$(RESET)"
	@grep -E '^(deploy|data|users|incidents|simulate):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Screenshot Capture:$(RESET)"
	@grep -E '^(capture|analyze):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Code Quality:$(RESET)"
	@grep -E '^(lint|format|validate):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Testing:$(RESET)"
	@grep -E '^(test|chaos-):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Dependency Management:$(RESET)"
	@grep -E '^deps-.*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Cleanup:$(RESET)"
	@grep -E '^(reset|clean|wipe):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Workflows:$(RESET)"
	@grep -E '^(all|full|quick|fresh):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make install          # First-time setup"
	@echo "  make quick            # Quick workflow: deploy + data + capture"
	@echo "  make validate         # Check code quality before commit"
	@echo "  make deps-check       # Check for outdated packages"
	@echo "  make reset            # Wipe all data and start fresh"
	@echo ""

#---------------------------------------------------------------------------
# SETUP & INSTALLATION
#---------------------------------------------------------------------------

install: ## Install npm dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	$(NPM) install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

setup: install ## Full setup: install dependencies and create .env file
	@echo "$(CYAN)Setting up environment...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env file - please edit with your Operaton credentials$(RESET)"; \
	else \
		echo "$(GREEN)✓ .env file already exists$(RESET)"; \
	fi
	@echo "$(GREEN)✓ Setup complete$(RESET)"

check: ## Check connection to Operaton instance
	@echo "$(CYAN)Checking Operaton connection...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/check-connection.js

check-debug: ## Check connection with debug output
	@echo "$(CYAN)Checking Operaton connection (debug mode)...$(RESET)"
	DEBUG=true $(NODE) $(SCRIPTS_DIR)/check-connection.js

#---------------------------------------------------------------------------
# DEPLOYMENT & DATA GENERATION
#---------------------------------------------------------------------------

deploy: ## Deploy BPMN/DMN processes to Operaton
	@echo "$(CYAN)Deploying processes...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/deploy-processes.js

users: ## Create users and groups only
	@echo "$(CYAN)Creating users and groups...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js --users-only

data: ## Generate test data (users, process instances, tasks)
	@echo "$(CYAN)Generating test data...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js

data-light: ## Generate minimal test data (fewer instances)
	@echo "$(CYAN)Generating light test data...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/generate-data.js --light

simulate: ## Run simulation scenarios (tokens, history, tasks)
	@echo "$(CYAN)Running simulation scenarios...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js

simulate-tokens: ## Simulate processes with visible tokens at various stages
	@echo "$(CYAN)Simulating token positions...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js --tokens

simulate-history: ## Generate completed instances for history views
	@echo "$(CYAN)Generating history data...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/simulate-scenarios.js --history

incidents: ## Create intentional incidents (failed jobs, errors)
	@echo "$(CYAN)Creating incidents...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js

incidents-script: ## Create incidents via failing script tasks
	@echo "$(CYAN)Creating script task incidents...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js --script-errors

incidents-service: ## Create incidents via failing service tasks
	@echo "$(CYAN)Creating service task incidents...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/create-incidents.js --service-errors

#---------------------------------------------------------------------------
# SCREENSHOT CAPTURE
#---------------------------------------------------------------------------

capture: ## Capture all screenshots (headless)
	@echo "$(CYAN)Capturing screenshots...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js

capture-debug: ## Capture screenshots with visible browser (for debugging)
	@echo "$(CYAN)Capturing screenshots (debug mode)...$(RESET)"
	HEADLESS=false DEBUG=true $(NODE) $(SCRIPTS_DIR)/capture-screenshots.js

capture-cockpit: ## Capture only Cockpit screenshots
	@echo "$(CYAN)Capturing Cockpit screenshots...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=cockpit

capture-tasklist: ## Capture only Tasklist screenshots
	@echo "$(CYAN)Capturing Tasklist screenshots...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=tasklist

capture-admin: ## Capture only Admin screenshots
	@echo "$(CYAN)Capturing Admin screenshots...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/capture-screenshots.js --category=admin

analyze: ## Analyze documentation for screenshots to replace
	@echo "$(CYAN)Analyzing documentation...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/analyze-documentation.js

#---------------------------------------------------------------------------
# CLEANUP & RESET
#---------------------------------------------------------------------------

reset: ## Reset Operaton: delete all deployments, instances, and users
	@echo "$(RED)WARNING: This will delete ALL data from Operaton!$(RESET)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(CYAN)Resetting Operaton environment...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js

reset-instances: ## Delete all process instances only
	@echo "$(CYAN)Deleting all process instances...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --instances-only

reset-deployments: ## Delete all deployments only
	@echo "$(CYAN)Deleting all deployments...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --deployments-only

reset-users: ## Delete created test users only
	@echo "$(CYAN)Deleting test users...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --users-only

reset-force: ## Force reset without confirmation prompt
	@echo "$(CYAN)Force resetting Operaton environment...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/reset-environment.js --force

clean: ## Clean local output files (screenshots, reports)
	@echo "$(CYAN)Cleaning output directory...$(RESET)"
	rm -rf output/*
	@echo "$(GREEN)✓ Output directory cleaned$(RESET)"

wipe: reset clean ## Full wipe: reset Operaton AND clean local files

#---------------------------------------------------------------------------
# WORKFLOWS (Combined Tasks)
#---------------------------------------------------------------------------

quick: deploy data capture ## Quick workflow: deploy, generate data, capture
	@echo "$(GREEN)✓ Quick workflow complete$(RESET)"

full: deploy data simulate incidents capture ## Full workflow with all scenarios
	@echo "$(GREEN)✓ Full workflow complete$(RESET)"

all: setup deploy data simulate incidents capture analyze ## Complete workflow from scratch
	@echo "$(GREEN)✓ Complete workflow finished$(RESET)"

fresh: reset-force deploy data simulate incidents capture ## Fresh start: reset then full workflow
	@echo "$(GREEN)✓ Fresh workflow complete$(RESET)"

#---------------------------------------------------------------------------
# TESTING
#---------------------------------------------------------------------------

test: ## Run all tests
	@echo "$(CYAN)Running all tests...$(RESET)"
	$(NODE) tests/chaos-check-connection.js
	@echo "$(GREEN)✓ All tests passed$(RESET)"

test-check: chaos-check ## Alias for chaos-check

chaos-check: ## Run chaos tests for check-connection.js
	@echo "$(CYAN)Running chaos tests for check-connection...$(RESET)"
	$(NODE) tests/chaos-check-connection.js

chaos-check-debug: ## Run chaos tests with debug output
	@echo "$(CYAN)Running chaos tests for check-connection (debug mode)...$(RESET)"
	DEBUG=true $(NODE) tests/chaos-check-connection.js

#---------------------------------------------------------------------------
# CODE QUALITY
#---------------------------------------------------------------------------

lint: ## Run ESLint on all scripts
	@echo "$(CYAN)Running ESLint...$(RESET)"
	$(NPM) run lint

lint-fix: ## Run ESLint and auto-fix issues
	@echo "$(CYAN)Running ESLint with auto-fix...$(RESET)"
	$(NPM) run lint:fix

format: ## Format all code with Prettier
	@echo "$(CYAN)Formatting code...$(RESET)"
	$(NPM) run format

format-check: ## Check code formatting without changes
	@echo "$(CYAN)Checking code format...$(RESET)"
	$(NPM) run format:check

validate: ## Run all code quality checks (lint + format)
	@echo "$(CYAN)Validating code...$(RESET)"
	$(NPM) run validate

#---------------------------------------------------------------------------
# DEPENDENCY MANAGEMENT
#---------------------------------------------------------------------------

deps-check: ## Check for outdated dependencies
	@echo "$(CYAN)Checking for outdated packages...$(RESET)"
	$(NPM) run deps:check

deps-update: ## Update all dependencies to latest
	@echo "$(CYAN)Updating all dependencies...$(RESET)"
	$(NPM) run deps:update

deps-update-minor: ## Update dependencies (minor/patch only, safer)
	@echo "$(CYAN)Updating dependencies (minor/patch only)...$(RESET)"
	$(NPM) run deps:update:minor

deps-audit: ## Run security audit
	@echo "$(CYAN)Running security audit...$(RESET)"
	$(NPM) run deps:audit

deps-audit-fix: ## Fix security vulnerabilities
	@echo "$(CYAN)Fixing security vulnerabilities...$(RESET)"
	$(NPM) run deps:audit:fix

#---------------------------------------------------------------------------
# GIT HOOKS
#---------------------------------------------------------------------------

hooks-install: ## Install git hooks (husky)
	@echo "$(CYAN)Installing git hooks...$(RESET)"
	npx husky install
	@echo "$(GREEN)✓ Git hooks installed$(RESET)"

hooks-uninstall: ## Uninstall git hooks
	@echo "$(CYAN)Uninstalling git hooks...$(RESET)"
	rm -rf .husky/_
	@echo "$(GREEN)✓ Git hooks uninstalled$(RESET)"

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

status: ## Show current status of Operaton (counts)
	@echo "$(CYAN)Operaton Environment Status$(RESET)"
	@echo "============================"
	@$(NODE) $(SCRIPTS_DIR)/show-status.js
