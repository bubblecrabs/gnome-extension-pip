# PiP Manager

GNOME Shell extension for managing Picture-in-Picture (PiP) windows from browsers.

## Features

- **Bottom-right placement** – PiP windows are moved to the bottom-right corner on creation instead of appearing centered
- **Always-on-top toggle** – Control whether PiP windows stay above other windows (disabled by default)
- **Snap to nearest corner** – After moving a PiP window, it snaps to the nearest screen corner and remembers the preference

## Requirements

- GNOME Shell 50+
- TypeScript build toolchain (Node.js, npm)

## Build & Install

```bash
npm install
npm run build
glib-compile-schemas schemas/

make install
```

After installation, restart GNOME Shell:
- **Wayland**: Log out and log back in
- **X11**: Press `Alt+F2`, type `r`, press `Enter`

## Development

```bash
npm install
npm run build    # Compile TypeScript to dist/
npm run pack     # Create extension bundle
```

## License

MIT
