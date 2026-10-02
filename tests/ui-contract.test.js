'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectDirectory = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectDirectory, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectDirectory, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(projectDirectory, 'app.js'), 'utf8');

test('light mode is the first-run default and both theme controls are present', () => {
  assert.match(html, /savedTheme === 'dark' \? 'dark' : 'light'/);
  assert.match(html, /id="lightThemeBtn"/);
  assert.match(html, /id="darkThemeBtn"/);
  assert.match(app, /stage-deck-calculator-theme/);
});

test('calculator uses the available viewport instead of a narrow max-width card', () => {
  assert.match(css, /\.calculator\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /\.calculator-shell\s*\{[^}]*padding:\s*12px/s);
});

test('PNG export and unified selected-deck controls are present', () => {
  assert.match(html, /id="exportPngBtn"/);
  assert.match(html, /id="stageSnap"/);
  assert.match(html, /data-selected-deck-type="1200x1200"/);
  assert.match(html, /data-selected-deck-legs="6"/);
  assert.match(app, /function exportLayoutPng\(/);
});

test('deck pieces retain inline leg and rotate controls', () => {
  assert.match(app, /class="leg-toggle/);
  assert.match(app, /data-stage-action="legs"/);
  assert.match(app, /class="rotate-edge-handle top-left"/);
  assert.match(css, /\.leg-toggle button\.active\s*\{[^}]*var\(--accent\)/s);
  assert.match(app, /deck\.type === '1200x1200' \? '' : `<button/);
  assert.match(app, /deck\.type === '1200x1200' \|\| Number\(legCount\) === 4/);
});

test('skirt display follows exposed edges and the canvas uses one grid', () => {
  assert.match(app, /Model\.getSkirtEdges\(calculator\.decks, calculator\.skirtBackOpen === true\)/);
  assert.match(app, /class="skirt-outline"/);
  assert.match(app, /calculator\.skirtBackOpen === true/);
  assert.match(css, /\.skirt-outline-line\s*\{[^}]*var\(--skirt-line\)/s);
  assert.match(css, /\.grid-scroll\s*\{[^}]*background-color:/s);
  assert.doesNotMatch(css.match(/\.grid-scroll\s*\{[^}]*\}/s)?.[0] || '', /background-image/);
});

test('multi-selection supports group edits, rotation, movement, and deletion', () => {
  assert.match(html, /id="stageSelectionCount"/);
  assert.match(html, /id="stageDeleteSelectedBtn"/);
  assert.match(html, /Ctrl\/Cmd-click to add or remove decks/);
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
  assert.match(app, /function deleteSelectedDecks\(/);
  assert.match(app, /function rotateDecks\(/);
});

test('deck dragging prevents overlaps and canvas drags select a group', () => {
  assert.match(app, /stationary.some\(deck => Model.rectanglesOverlap\(candidate, deck\)\)/);
  assert.match(app, /if \(moved\) \{\s*candidates\.forEach/s);
  assert.match(app, /event\.target !== el\.stageGrid/);
  assert.match(app, /class="selection-marquee"/);
  assert.match(css, /\.selection-marquee\s*\{/);
  assert.match(html, /Drag on empty canvas to select/);
});

test('deck size changes hide when unselected and add deck buttons support drag placement', () => {
  assert.doesNotMatch(html, /id="stageFillBtn"|Fill 2400 grid/);
  assert.match(html, /id="stageDeckSizeControls"[^>]*hidden/);
  assert.match(app, /el\.stageDeckSizeControls\.hidden = selectedDecks\.length === 0/);
  assert.match(app, /function startDeckPlacement\(/);
  assert.match(app, /class="deck-slot placement-preview"/);
  assert.match(app, /addDeckAt\(placement\.type, x, y\)/);
  assert.match(html, /id="stageSelectionControls"[^>]*selected-controls/);
  assert.match(app, /el\.stageSelectionControls\.hidden = selectedDecks\.length === 0/);
});

test('Help explains mouse and keyboard controls in a dismissible top-bar panel', () => {
  assert.match(html, /id="helpToggleBtn"/);
  assert.match(html, /id="helpPopover"/);
  assert.match(html, /Right-drag to pan the grid; scroll to zoom around the pointer/);
  assert.match(html, /Ctrl\/Cmd \+ A/);
  assert.match(app, /function toggleHelpPopover\(/);
  assert.match(app, /function closeHelpPopover\(/);
});

test('right-click menus add decks on empty grid and edit selected decks', () => {
  assert.match(html, /id="stageContextMenu"[^>]*role="menu"/);
  assert.match(app, /targetDeckId: event\.target\.closest\('\.deck-slot/);
  assert.match(app, /openStageContextMenu\(event\.clientX, event\.clientY, targetDeckId\)/);
  assert.match(app, /button\('add',/);
  assert.match(app, /button\(\s*'size',/);
  assert.match(app, /button\('legs',/);
  assert.match(app, /button\('rotate-left'/);
  assert.match(app, /button\('delete',/);
  assert.match(app, /getPlacementCoordinates\(\{ \.\.\.menuPosition, type \}\)/);
});

test('stage skirt coverage can leave the back open without a spare-length field', () => {
  assert.match(html, /id="stageSkirtBackOpen"/);
  assert.match(html, /<aside class="side-panel"[\s\S]*class="control-cluster divided skirt-settings"[\s\S]*id="stageSkirtBackOpen"/);
  assert.match(html, /300 mm return at each corner/);
  assert.doesNotMatch(html, /id="stageSkirtSpare"/);
  assert.match(html, /id="stageSkirtCountLabel"/);
  assert.match(app, /calculator\.skirtBackOpen = el\.stageSkirtBackOpen\.checked/);
  assert.doesNotMatch(app, /el\.stageSkirtSpare/);
  assert.match(app, /calculator\.skirtBackOpen \? 'Stage skirts \(back open\)'/);
});

test('rotations may overlap but surface a persistent clipping warning', () => {
  assert.match(html, /id="stageOverlapWarning" role="alert"/);
  assert.match(app, /Model\.findOverlaps\(calculator\.decks\)/);
  assert.match(app, /Decks may be clipping/);
  assert.match(app, /rotate-edge-handles/);
  assert.match(app, /Math\.round\(rotationState\.accumulatedAngle \/ \(Math\.PI \/ 2\)\)/);
  assert.match(app, /centerX/);
  assert.match(app, /centerY/);
  assert.match(app, /Model\.rotateDecksAroundCenter\(rotationState\.originalDecks, quarterTurns\)/);
});

test('overlap warning is in the top bar and both exports confirm clipped layouts', () => {
  assert.match(html, /class="top-actions"[\s\S]*class="overlap-warning" id="stageOverlapWarning"/);
  assert.match(css, /\.overlap-warning\s*\{[^}]*max-width:\s*120px/s);
  assert.match(css, /--warning-border:\s*#dc3029/);
  assert.match(app, /function exportLayout\(\)\s*\{\s*if \(!confirmExportWithOverlaps\(\)\) return;/);
  assert.match(app, /function exportLayoutPng\(\)\s*\{\s*if \(!confirmExportWithOverlaps\(\)\) return;/);
  assert.match(app, /Export anyway\?/);
});

test('PNG export omits redundant labels and filters zero-count breakdowns', () => {
  assert.match(app, /\.filter\(\(\[, count\]\) => count > 0\)/);
  assert.match(app, /materials\.fourCount > 0 && materials\.sixCount > 0/);
  assert.doesNotMatch(app, /Wood without sharing/);
  assert.doesNotMatch(app, /Movement grid:/);
  assert.doesNotMatch(app, /legs · Deck/);
  assert.match(app, /\['Skirts', materials\.skirtCount\]/);
});

test('PNG export draws the calculated skirt outline and omits the open back', () => {
  assert.match(app, /drawExportSkirtOutline\(context, scale, originX, originY, metrics\.offsetX, metrics\.offsetY\)/);
  assert.match(app, /Model\.getSkirtEdges\(decks, calculator\.skirtBackOpen === true\)/);
  assert.match(app, /edge\.cornerReturn/);
  assert.match(app, /drawLine\('#d9463e', 3\)/);
  assert.match(app, /fillText\('300 mm'/);
  assert.match(app, /class="skirt-return-label"/);
  assert.match(app, /Model\.getSkirtEdges\(calculator\.decks, calculator\.skirtBackOpen === true\)/);
});

test('on-screen materials hide zero and sharing breakdown rows', () => {
  assert.doesNotMatch(html, /Wood without sharing/);
  assert.doesNotMatch(html, /Wood saved by sharing/);
  assert.match(html, /id="stage1200Row"/);
  assert.match(html, /id="stageFourRow"/);
  assert.match(app, /stage1200Row\.hidden = !materials\.typeCounts\['1200x1200'\]/);
  assert.match(app, /hasMixedLegCounts/);
});

test('carpet dimensions, exposed perimeter, skirt counts, and all deck types are available', () => {
  assert.match(html, /data-stage-add-size="1000x2000"/);
  assert.match(html, /data-stage-add-size="2000x500"/);
  assert.match(html, /id="stageCarpetDimensions"/);
  assert.match(html, /id="stageCarpetArea"/);
  assert.doesNotMatch(html, /id="stageCarpetRoll(?:Length|Cuts|Waste)"/);
  assert.match(html, /id="stagePerimeter"/);
  assert.match(html, /id="stageSkirtCount"/);
  assert.match(app, /materials\.skirtCount/);
  assert.match(app, /\['Carpet area'/);
  assert.doesNotMatch(app, /el\.stageCarpetRoll(?:Length|Cuts|Waste)/);
});

test('canvas zoom and bidirectional rotation controls are available', () => {
  assert.match(html, /id="stageZoomOutBtn"/);
  assert.match(html, /id="stageZoomResetBtn"/);
  assert.match(html, /id="stageZoomInBtn"/);
  assert.match(html, /id="stageRotateLeftBtn"/);
  assert.match(html, /id="stageRotateRightBtn"/);
  assert.match(app, /rotateSelectedDeck\('left'\)/);
  assert.match(app, /rotateSelectedDeck\('right'\)/);
});

test('right-drag pans the canvas and wheel zoom anchors on the pointer', () => {
  assert.match(app, /event\.button === 2/);
  assert.match(app, /gridScroll\.scrollLeft = panState\.scrollLeft -/);
  assert.match(app, /gridScroll\.addEventListener\('wheel', onCanvasWheel, \{ passive: false \}\)/);
  assert.match(app, /setZoom\(ZOOM_LEVELS\[targetIndex\], \{ clientX: event\.clientX, clientY: event\.clientY \}\)/);
  assert.match(app, /gridScroll\.addEventListener\('contextmenu'/);
  assert.match(css, /\.grid-scroll\.panning[\s\S]*cursor: grabbing/);
});

test('top bar orders brand, theme, materials totals/details, then actions', () => {
  assert.match(html, /class="brand"[\s\S]*class="theme-toggle"[\s\S]*class="topbar-spacer"[\s\S]*class="materials-menu-wrap"[\s\S]*class="materials-title">Materials[\s\S]*class="materials-inline-summary"[\s\S]*id="stageDeckCount"[\s\S]*id="stageLegCount"[\s\S]*id="stageWoodCount"[\s\S]*id="stageSkirtCount"[\s\S]*id="materialsToggleBtn"[\s\S]*class="topbar-spacer"[\s\S]*class="top-actions"/);
  assert.match(html, /id="materialsToggleBtn"[\s\S]*id="materialsPopover"/);
  assert.match(html, /id="stageSkirtDetailCount"/);
  assert.match(html, /id="stageSkirtCount"/);
  assert.doesNotMatch(html, /id="stageSkirtSpare"/);
  assert.match(app, /el\.stageDeckCount\.textContent = materials\.deckCount/);
  assert.match(app, /el\.stageSkirtCount\.textContent = materials\.skirtCount/);
});

test('right panel groups layout, add-deck, and selection controls', () => {
  assert.match(html, /<aside class="side-panel" aria-label="Stage controls">[\s\S]*class="control-cluster layout-settings"[\s\S]*Layout[\s\S]*id="stageZoomOutBtn"[\s\S]*aria-label="Add a stage deck"[\s\S]*aria-label="Selection controls"/);
  assert.match(css, /\.side-panel\s*\{/);
  assert.match(css, /\.materials-popover\s*\{[^}]*max-height:/s);
});
