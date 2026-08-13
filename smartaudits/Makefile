WAIT_TIMEOUT ?= 120

up:
	docker compose up -d --build --wait --wait-timeout $(WAIT_TIMEOUT)

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps
