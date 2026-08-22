# Sentra

Sentra is a desktop Roblox account manager built with Tauri, React, and TypeScript.

## What it does

- Manage multiple Roblox accounts
- Launch games and private servers
- Browse profiles, friends, groups, games, inventory, and catalog items
- Manage Roblox settings, Fast Flags, and installations
- Support multi-instance Roblox sessions
- Track activity and show Discord Rich Presence
- Back up and restore local account-manager data

## Requirements

- Windows, macOS, or Linux
- Node.js 20 or newer
- npm
- Rust 1.77 or newer (the app shell is Tauri)

On Windows, WebView2 is used for rendering; it ships with Windows 11 and current
Windows 10.

## Run Locally

```bash
git clone https://github.com/ex9d/sentra.git
cd sentra
npm install
npm run dev
```

The first `npm run dev` also compiles the Rust shell, which takes a few minutes. Later runs are incremental.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development app |
| `npm run build:sidecar` | Bundle the Node sidecar (required before a Rust build) |
| `npm run test:sidecar` | Boot the sidecar and check every IPC channel registers |
| `npm run migration:status` | Show which channels are served by Rust vs. the sidecar |
| `npm run typecheck` | Check Node and renderer TypeScript |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the project with Prettier |
| `npm run build` | Build the app without creating an installer |
| `npm run build:win` | Build a Windows x64 installer |
| `npm run build:mac` | Build a macOS package |
| `npm run build:linux` | Build a Linux package |

Build output is written to `out/` and installer files are written to `dist/`.

## Data Location

On macOS, Sentra stores its user data in:

```text
~/Documents/Sentra
```

On Windows and Linux, the application uses the platform's normal Electron data location.

## Project Layout

- `src/main` - Electron main-process code
- `src/preload` - secure renderer bridge
- `src/renderer` - React interface
- `src/shared` - shared schemas and navigation types
- `assets` - fonts, icons, and other app assets

## License

Sentra is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

## Contributing

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm run format
```

Report bugs and feature requests in the [GitHub Issues](https://github.com/ex9d/sentra/issues).
