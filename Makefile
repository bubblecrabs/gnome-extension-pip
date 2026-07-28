UUID = pip-manager@bubblecrabs.github.com
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all build pack install clean

all: build

node_modules/.package-lock.json: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules/.package-lock.json src/*.ts src/ambient.d.ts tsconfig.json
	npm run build

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.pip-manager.gschema.xml
	glib-compile-schemas schemas

build: dist/extension.js dist/prefs.js schemas/gschemas.compiled

pack: build
	@rm -f $(UUID).zip
	@cp -r schemas dist/
	@cp metadata.json dist/
	@(cd dist && zip -9r ../$(UUID).zip . 2>/dev/null || tar cf ../$(UUID).zip .)

install: build
	@mkdir -p $(INSTALL_DIR)
	@cp -r dist/* $(INSTALL_DIR)/
	@echo "Extension installed to $(INSTALL_DIR)"
	@echo "Restart GNOME Shell to apply changes (logout/login on Wayland, Alt+F2 → r on X11)"

clean:
	@rm -rf dist node_modules schemas/gschemas.compiled $(UUID).zip
