# tetranoid
Fan-art mashup of two beloved games

## Play

The game is a static site in `src/` with no build step: serve that folder from any web server and open it. Installing it as an app and playing offline need HTTPS (or `localhost`).

```sh
npm start      # serves the repo at http://localhost:8080 and opens /src/
```

`npm start` fetches `http-server` through `npx`; any static server works.

## Code map

```
src/
  index.html, css/         the page and its styles
  js/main.js               boot and the frame loop
  js/config.js             board geometry and the gameplay knobs (speeds, timings, scores)
  js/game/                 the rules, in plain JS: no three.js, DOM or audio
  js/render/               the three.js scene; view.js redraws the meshes from the game state
  js/fx/                   sound, vibration, and feedback.js: what each game event sounds, feels and looks like
  js/ui/, js/input/        HUD and menus; keyboard, touch gestures and the thumb pad
  js/platform/             screen wake lock, service worker registration
  sw.js, manifest.webmanifest, icons/    the PWA
  vendor/, fonts/          three.js r128 and the fonts, pinned (`npm run vendor` re-fetches them)
legacy/                    the original single-file version, for reference
```

The rules report what happens through events (`js/events.js`: `lock`, `rowCleared`, `smash`, `ballLost`, `over`, …), and the rest of the game listens. To change how the game plays, start in `config.js`; to change how it feels, in `fx/feedback.js`.

## Test

```sh
npm test
```

Node's built-in test runner, no dependencies. It checks the rules in `js/game`, that `js/game` stays free of browser code, and that `sw.js` lists the current files.

## Release

After changing anything in `src/`:

```sh
npm run precache   # refresh the file list and VERSION in src/sw.js
npm test
```

Then publish the `src/` folder. Players see "New version: update" on the menu, and installed apps check for one each time they come back to the foreground. To run the tests before every commit: `git config core.hooksPath .githooks`.

GitHub Pages serves only the repo root or `/docs` from a branch, so publishing `src/` there needs a small Actions workflow that uploads the folder as is. `npm run icons` re-renders the PNG icons from `src/icons/icon.svg`.
