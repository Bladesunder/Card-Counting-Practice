# Card Counting Practice

A local-first Hi-Lo card-counting and blackjack strategy trainer.

Play the hosted version at <https://bladesunder.github.io/Card-Counting-Practice/>.

## Run locally without Wi-Fi

The game runs entirely in your browser and does not need an internet connection during play. Complete the following setup:

1. Install [Node.js](https://nodejs.org/) 20.19+ from the 20.x release line, or 22.12+.
2. Download or clone this repository.
3. Double-click [`run-game.command`](run-game.command). On the first launch, it detects missing dependencies and installs them automatically. An internet connection may be required for this first launch.

After that setup, Wi-Fi is not required:

- On macOS, double-click [`run-game.command`](run-game.command). It starts the local game server and opens the game in your default browser.
- Keep the Terminal window open while playing. Close it when you are finished to stop the local server.
- The game will be available at `http://127.0.0.1:5173` (or the next available local port).

The launcher only installs dependencies when they are missing or incomplete. Once installed, it does not need Wi-Fi to start the game. If automatic installation fails, connect to the internet and double-click the launcher again.

If Node.js 21 is installed, the launcher automatically builds the game and uses Vite's production preview mode because Vite's development server does not support Node.js 21. The supported Node.js versions above are recommended.

## Run from the command line

From the project directory:

```bash
npm ci
npm run dev
```

Then open the local URL printed by Vite. To create a production build:

```bash
npm run build
```
