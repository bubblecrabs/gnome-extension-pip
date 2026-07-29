UUID = pip-manager@bubblecrabs
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
	rm -f $(UUID).zip
	cp metadata.json dist/
	mkdir -p dist/schemas
	cp schemas/org.gnome.shell.extensions.pip-manager.gschema.xml dist/schemas/
	cd dist && zip -9r ../$(UUID).zip .

install: build
	mkdir -p $(INSTALL_DIR)
	cp metadata.json dist/extension.js dist/prefs.js schemas $(INSTALL_DIR)/ -r

clean:
	rm -rf dist node_modules schemas/gschemas.compiled $(UUID).zip
