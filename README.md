# Stage Deck Calculator

A standalone desktop-ready version of the stage deck calculator. It contains no stage plot, signal flow, equipment catalogue or other AV Planner features.

## Run the project

Install the development dependencies once:

```powershell
npm.cmd install
```

Then launch the desktop app:

```powershell
npm.cmd start
```

You can also open `index.html` directly in a modern browser for quick use without Electron.

## Build the Windows executable

```powershell
npm.cmd run dist
```

The portable executable is created at:

```text
release/Stage-Deck-Calculator-1.0.0.exe
```

It is a single portable app: no installer is required. The build stages Electron in your Windows temporary folder before copying the finished executable into `release`, which avoids file-locking problems that can occur while antivirus software scans Electron. The first build can take a few minutes.

## Test the calculations

```powershell
npm.cmd test
```

## Included features

- 1200 × 1200, 1800 × 1200, 2400 × 1200, 1000 × 2000 and 2000 × 500 deck sizes
- Dragging with selectable 100, 300 or 600 mm snapping and collision prevention, defaulting to 100 mm
- Workspace expands above or left only when decks are moved there
- Horizontal/vertical deck rotation in either direction for alternate collision clearance
- Canvas zoom from 25% to 200% for large stage layouts
- Click-to-edit deck size, orientation and four- or six-leg selection
- Ctrl/Cmd-click multi-selection with group move, resize, leg changes, rotation and delete
- Drag on empty canvas to box-select decks; decks can be placed over one another by dragging
- Drag a deck's top edge to rotate; overlapping layouts remain visible with a clipping warning
- Shared wood support calculation
- Carpet bounding dimensions and area in square metres
- Estimated linear metres, cut count and offcut for 2 m carpet rolls, using the lower-length cut orientation
- Exposed stage perimeter and required 5 m skirt lengths
- Drag deck-size buttons onto the stage canvas to place decks precisely
- Optional open-back skirt calculation with 300 mm corner returns and 100 mm joins between 5 m skirt lengths
- Blue light and dark themes, with light mode used by default
- A responsive, full-window calculator workspace
- Automatic local saving
- PNG layout export with deck, leg and wood totals
- JSON import and export

## Project files

- `index.html` — standalone interface
- `styles.css` — calculator-only styling
- `calculator.js` — calculation and layout model
- `app.js` — interactions, saving and import/export
- `main.js` — secure Electron desktop window
- `tests/calculator.test.js` — calculation tests
- `package.json` — run and executable build commands
