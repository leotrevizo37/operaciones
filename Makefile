PROJECTS := app-shell experiencia-digital lecturas dispositivos smartaudits

up:
	"$(MAKE)" -C app-shell up
	"$(MAKE)" -C experiencia-digital up
	"$(MAKE)" -C lecturas up
	"$(MAKE)" -C dispositivos up
	"$(MAKE)" -C smartaudits up

down:
	"$(MAKE)" -C app-shell down
	"$(MAKE)" -C experiencia-digital down
	"$(MAKE)" -C lecturas down
	"$(MAKE)" -C dispositivos down
	"$(MAKE)" -C smartaudits down

logs:
	@for project in $(PROJECTS); do $(MAKE) -C $$project logs; done

ps:
	"$(MAKE)" -C app-shell ps
	"$(MAKE)" -C experiencia-digital ps
	"$(MAKE)" -C lecturas ps
	"$(MAKE)" -C dispositivos ps
	"$(MAKE)" -C smartaudits ps
