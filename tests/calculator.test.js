'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../calculator.js');

test('add handles exclude shared edges and retain partially exposed segments', () => {
  assert.equal(Model.getDeckAddEdges(Model.createDefaultCalculator().decks).length, 10);
  const decks = [
    { id: 'a', x: 0, y: 0, width: 2400, height: 1200 },
    { id: 'b', x: 0, y: 1200, width: 1200, height: 1200 }
  ];
  const edge = Model.getDeckAddEdges(decks).find(edge => edge.deckId === 'a' && edge.side === 'bottom');
  assert.deepEqual([edge.start, edge.end], [1200, 2400]);
  const candidate = Model.getAdjacentPlacement({ decks }, edge, Model.DECK_TYPES[0]);
  assert.deepEqual([candidate.x, candidate.y], [1200, 1200]);
  assert.equal(Model.positionAvailable({ decks }, candidate), true);
});

test('paste preserves group geometry and legs with fresh ids and no collisions', () => {
  const calculator = Model.createDefaultCalculator();
  const pasted = Model.pasteDecks(calculator, calculator.decks);
  assert.equal(pasted.length, 6);
  assert.equal(Model.findOverlaps([...calculator.decks, ...pasted]).length, 0);
  pasted.forEach((deck, index) => {
    const original = calculator.decks[index];
    assert.notEqual(deck.id, original.id);
    assert.equal(deck.x - original.x, pasted[0].x - calculator.decks[0].x);
    assert.deepEqual([deck.y, deck.width, deck.height, deck.legs],
      [original.y, original.width, original.height, original.legs]);
  });
});

test('coarse movement snap preserves mixed deck edge positions across saves', () => {
  const layout = Model.normalizeCalculator({ snapMm: 600, gigName: 'Example gig', areaName: 'Foyer', decks: [
    { id: 'a', x: 0, y: 0, type: '1000x2000', width: 2000, height: 1000, legs: 6 },
    { id: 'b', x: 2000, y: 0, type: '1000x2000', width: 2000, height: 1000, legs: 6 }
  ] });
  assert.equal(layout.decks[1].x, 2000);
  assert.equal(Model.normalizeCalculator(layout).decks[1].x, 2000);
  assert.equal(Model.findOverlaps(layout.decks).length, 0);
  assert.equal(layout.gigName, 'Example gig');
  assert.equal(layout.areaName, 'Foyer');
});

test('default 2 by 3 layout has the expected materials', () => {
  const calculator = Model.createDefaultCalculator();
  const materials = Model.calculateMaterials(calculator);

  assert.equal(materials.deckCount, 6);
  assert.equal(materials.legCount, 36);
  assert.equal(materials.sizeCounts[2400], 6);
  assert.equal(materials.sixCount, 6);
  assert.equal(materials.woodCount, 21);
  assert.equal(materials.woodSaved, 15);
  assert.equal(calculator.snapMm, 100);
});

test('stage dimensions report carpet area, exposed perimeter, and skirt lengths', () => {
  const calculator = Model.normalizeCalculator({
    decks: [
      { id: 'a', x: 0, y: 0, size: 2400, width: 2400, height: 1200, legs: 6 },
      { id: 'b', x: 2400, y: 0, size: 2400, width: 2400, height: 1200, legs: 6 },
      { id: 'c', x: 4800, y: 0, size: 2400, width: 2400, height: 1200, legs: 6 },
      { id: 'd', x: 0, y: 1200, size: 2400, width: 2400, height: 1200, legs: 6 },
      { id: 'e', x: 2400, y: 1200, size: 2400, width: 2400, height: 1200, legs: 6 },
      { id: 'f', x: 4800, y: 1200, size: 2400, width: 2400, height: 1200, legs: 6 }
    ]
  });
  const materials = Model.calculateMaterials(calculator);

  assert.equal(materials.widthMm, 7200);
  assert.equal(materials.heightMm, 2400);
  assert.equal(materials.areaSquareMetres, 17.28);
  assert.equal(materials.rollWidthMm, 2000);
  assert.equal(materials.rollStripCount, 4);
  assert.equal(materials.rollCutLengthMm, 2400);
  assert.equal(materials.rollLinearMetres, 9.6);
  assert.equal(materials.rollOffcutAreaSquareMetres, 1.92);
  assert.equal(materials.perimeterMm, 19200);
  assert.equal(materials.skirtCount, 4);
});

test('two-metre carpet roll estimate chooses the lower-length orientation', () => {
  const estimate = Model.calculateCarpetRoll({
    widthMm: 1800,
    heightMm: 3000,
    areaSquareMetres: 5.4
  });

  assert.equal(estimate.rollStripCount, 1);
  assert.equal(estimate.rollCutLengthMm, 3000);
  assert.equal(estimate.rollLinearMetres, 3);
  assert.equal(estimate.rollOffcutAreaSquareMetres, 0.6);
});

test('empty carpet layout orders no roll material', () => {
  assert.deepEqual(Model.calculateCarpetRoll({ widthMm: 0, heightMm: 0, areaSquareMetres: 0 }), {
    rollWidthMm: 2000,
    rollStripCount: 0,
    rollCutLengthMm: 0,
    rollLinearMetres: 0,
    rollOffcutAreaSquareMetres: 0
  });
});

test('perimeter counts exposed deck edges and rounds skirts up to full lengths', () => {
  const calculator = Model.normalizeCalculator({
    decks: [
      { id: 'a', x: 0, y: 0, size: 2400, width: 2400, height: 1200, legs: 4 },
      { id: 'b', x: 2400, y: 0, size: 2400, width: 2400, height: 1200, legs: 4 }
    ]
  });
  const materials = Model.calculateMaterials(calculator);

  assert.equal(materials.perimeterMm, 12000);
  assert.equal(materials.skirtCount, 3);
});

test('normalization supports 1 x 2 m and 2 x 0.5 m deck shapes', () => {
  const calculator = Model.normalizeCalculator({
    decks: [
      { id: 'one-by-two', x: 0, y: 0, type: '1000x2000', width: 1000, height: 2000, legs: 4 },
      { id: 'two-by-half', x: 2000, y: 0, type: '2000x500', width: 2000, height: 500, legs: 6 }
    ]
  });

  assert.deepEqual(calculator.decks.map(({ type, width, height }) => ({ type, width, height })), [
    { type: '1000x2000', width: 1000, height: 2000 },
    { type: '2000x500', width: 2000, height: 500 }
  ]);
  assert.deepEqual(Model.calculateMaterials(calculator).typeCounts, {
    '1200x1200': 0,
    '1800x1200': 0,
    '2400x1200': 0,
    '1000x2000': 1,
    '2000x500': 1
  });
});

test('four-leg adjacent decks share their corner supports', () => {
  const calculator = {
    rows: 1,
    columns: 2,
    selectedDeckId: null,
    decks: [
      { id: 'a', x: 0, y: 0, size: 1200, width: 1200, height: 1200, legs: 4 },
      { id: 'b', x: 1200, y: 0, size: 1200, width: 1200, height: 1200, legs: 4 }
    ]
  };
  const materials = Model.calculateMaterials(calculator);

  assert.equal(materials.legCount, 8);
  assert.equal(materials.woodCount, 6);
  assert.equal(materials.woodSaved, 2);
});

test('normalization snaps positions and constrains imported values', () => {
  const calculator = Model.normalizeCalculator({
    rows: 99,
    columns: -4,
    selectedDeckId: 'deck-a',
    decks: [{ id: 'deck-a', x: 901, y: 310, size: 1750, width: 1750, height: 1200, legs: 3 }]
  });

  assert.equal(calculator.rows, 12);
  assert.equal(calculator.columns, 1);
  assert.deepEqual(calculator.decks[0], {
    id: 'deck-a', x: 900, y: 300, size: 1800, type: '1800x1200', width: 1800, height: 1200, legs: 6
  });
  assert.equal(calculator.selectedDeckId, 'deck-a');
  assert.equal(calculator.snapMm, 100);
});

test('1200 square decks always normalize to four legs', () => {
  const calculator = Model.normalizeCalculator({
    decks: [{ id: 'square', x: 0, y: 0, size: 1200, width: 1200, height: 1200, legs: 6 }]
  });

  assert.equal(calculator.decks[0].type, '1200x1200');
  assert.equal(calculator.decks[0].legs, 4);
});

test('material totals force raw 1200 square decks to four legs', () => {
  const materials = Model.calculateMaterials({
    decks: [{ id: 'square', x: 0, y: 0, size: 1200, width: 1200, height: 1200, legs: 6 }]
  });

  assert.equal(materials.legCount, 4);
  assert.equal(materials.fourCount, 1);
  assert.equal(materials.sixCount, 0);
});

test('movement snapping supports fine and coarse placement options', () => {
  assert.equal(Model.snapMillimetres(176, 100), 200);
  assert.equal(Model.snapMillimetres(449, 300), 300);
  assert.equal(Model.snapMillimetres(901, 600), 1200);
  assert.equal(Model.normalizeSnap(275), 100);
  assert.equal(Model.snapCoordinate(-449, 300), -300);
});

test('negative vertical positions create workspace above the original top row', () => {
  const calculator = Model.normalizeCalculator({
    snapMm: 300,
    decks: [{ id: 'raised', x: 0, y: -1800, size: 2400, width: 2400, height: 1200, legs: 6 }]
  });
  const metrics = Model.getCanvasMetrics(calculator);

  assert.equal(calculator.decks[0].y, -1800);
  assert.equal(metrics.offsetY, 1800);
  assert.ok(metrics.height >= Model.MIN_HEIGHT_MM);
});

test('left and right rotation use alternate expansion directions', () => {
  const horizontal = { id: 'deck', x: 600, y: 0, size: 2400, width: 2400, height: 1200, legs: 6 };

  assert.deepEqual(Model.getRotatedDeck(horizontal, 'right'), {
    ...horizontal, width: 1200, height: 2400
  });
  assert.deepEqual(Model.getRotatedDeck(horizontal, 'left'), {
    ...horizontal, y: -1200, width: 1200, height: 2400
  });

  const vertical = Model.getRotatedDeck(horizontal, 'right');
  assert.deepEqual(Model.getRotatedDeck(vertical, 'left'), {
    ...horizontal, x: -600, width: 2400, height: 1200
  });
});

test('default layouts have no unused headroom above the first row', () => {
  const metrics = Model.getCanvasMetrics(Model.createDefaultCalculator());
  assert.equal(metrics.offsetX, 0);
  assert.equal(metrics.offsetY, 0);
});

test('touching edges do not count as overlap', () => {
  const left = { x: 0, y: 0, width: 1200, height: 1200 };
  const right = { x: 1200, y: 0, width: 2400, height: 1200 };
  assert.equal(Model.rectanglesOverlap(left, right), false);
});

test('imported deck identifiers are safe to render as attributes', () => {
  const calculator = Model.normalizeCalculator({
    decks: [{ id: '\"><script>alert(1)</script>', x: 0, y: 0, size: 1200, legs: 4 }]
  });

  assert.match(calculator.decks[0].id, /^[a-zA-Z0-9_-]+$/);
});

test('multi-selection normalization keeps unique valid deck identifiers', () => {
  const calculator = Model.normalizeCalculator({
    selectedDeckIds: ['a', 'missing', 'a', 'b'],
    decks: [
      { id: 'a', x: 0, y: 0, width: 1200, height: 1200, legs: 4 },
      { id: 'b', x: 1200, y: 0, width: 1200, height: 1200, legs: 4 }
    ]
  });

  assert.deepEqual(calculator.selectedDeckIds, ['a', 'b']);
  assert.equal(calculator.selectedDeckId, 'a');
});

test('overlap detection ignores touching edges and reports clipping pairs', () => {
  const decks = [
    { id: 'a', x: 0, y: 0, width: 1200, height: 1200 },
    { id: 'b', x: 1200, y: 0, width: 1200, height: 1200 },
    { id: 'c', x: 2200, y: 0, width: 1200, height: 1200 }
  ];

  assert.deepEqual(Model.findOverlaps(decks), [['b', 'c']]);
});

test('perimeter measures the union boundary when decks overlap', () => {
  const decks = [
    { id: 'a', x: 0, y: 0, width: 2000, height: 1000 },
    { id: 'b', x: 1000, y: 0, width: 2000, height: 1000 }
  ];

  assert.equal(Model.calculatePerimeterMm(decks), 8000);
  assert.equal(Model.getExposedEdges(decks).reduce((total, edge) => (
    total + Math.abs(edge.x2 - edge.x1) + Math.abs(edge.y2 - edge.y1)
  ), 0), 8000);
});

test('full stage skirt count accounts for joins and shows nominal spare length', () => {
  const requirements = Model.calculateSkirtRequirements(
    [{ id: 'stage', x: 0, y: 0, width: 7000, height: 2000 }],
    18000,
    false
  );

  assert.equal(requirements.skirtCount, 4);
  assert.equal(requirements.skirtCoverageMm, 18000);
  assert.equal(requirements.skirtSpareMm, 2000);
});

test('open-back skirt mode removes the rear edge and adds 300 mm corner returns', () => {
  const decks = [{ id: 'stage', x: 0, y: 0, width: 7000, height: 2000 }];
  const requirements = Model.calculateSkirtRequirements(decks, 18000, true);

  assert.equal(requirements.backEdgeLengthMm, 7000);
  assert.equal(requirements.skirtCoverageMm, 11600);
  assert.equal(requirements.skirtCount, 3);
  assert.equal(requirements.skirtSpareMm, 3400);
});

test('open-back skirt geometry includes two visible 300 mm corner return segments', () => {
  const decks = Model.createDefaultCalculator().decks;
  const fullEdges = Model.getSkirtEdges(decks, false);
  const openEdges = Model.getSkirtEdges(decks, true);
  const returns = openEdges.filter(edge => edge.cornerReturn);

  assert.equal(fullEdges.filter(edge => edge.cornerReturn).length, 0);
  assert.equal(returns.length, 2);
  assert.deepEqual(returns.map(edge => edge.x2 - edge.x1), [300, 300]);
  assert.ok(returns.every(edge => edge.y1 === 0 && edge.y2 === 0));
  assert.equal(openEdges.some(edge => edge.orientation === 'horizontal' && edge.y1 === 0 && !edge.cornerReturn), false);
});

test('closed skirt coverage includes the final join overlap', () => {
  const decks = [{ x: 0, y: 0, width: 3000, height: 1950 }];
  assert.equal(Model.calculateSkirtRequirements(decks, 9900, false).skirtCount, 3);
});

test('separated rear edges each receive corner returns and coverage matches the drawing', () => {
  const decks = [
    { x: 0, y: 0, width: 2000, height: 1000 },
    { x: 4000, y: 0, width: 2000, height: 1000 }
  ];
  const edges = Model.getSkirtEdges(decks, true);
  assert.equal(edges.filter(edge => edge.cornerReturn).length, 4);
  assert.equal(Model.calculateSkirtRequirements(decks, 12000, true).skirtCoverageMm, 9200);
  assert.ok(edges.every(edge => edge.x2 <= 2000 || edge.x1 >= 4000));
});

test('outside-handle rotation stays centered and reverses from the original layout', () => {
  const decks = [{ id: 'a', x: 1000, y: 1000, width: 2400, height: 1200, legs: 6 }];
  const right = Model.rotateDecksAroundCenter(decks, 1)[0];
  assert.equal(right.x + right.width / 2, 2200);
  assert.equal(right.y + right.height / 2, 1600);
  assert.equal(right.width, 1200);
  assert.deepEqual(Model.rotateDecksAroundCenter(decks, 0), decks);
  assert.deepEqual(Model.rotateDecksAroundCenter(decks, 4), decks);
  assert.deepEqual(Model.rotateDecksAroundCenter(decks, -1), Model.rotateDecksAroundCenter(decks, 3));
  assert.deepEqual(decks[0], { id: 'a', x: 1000, y: 1000, width: 2400, height: 1200, legs: 6 });
});

test('outside-handle rotation preserves spacing between mixed decks', () => {
  const decks = [
    { id: 'a', x: 0, y: 0, width: 2000, height: 1000 },
    { id: 'b', x: 2000, y: 0, width: 2000, height: 500 }
  ];
  const rotated = Model.rotateDecksAroundCenter(decks, 1);
  assert.equal(rotated[0].y + rotated[0].height, rotated[1].y);
  assert.equal(Model.findOverlaps(rotated).length, 0);
  assert.deepEqual(Model.rotateDecksAroundCenter(decks, 4), decks);
});

test('an empty stage requires no skirts even in open-back mode', () => {
  assert.deepEqual(Model.calculateSkirtRequirements([], 0, true), {
    backEdgeLengthMm: 0,
    skirtCoverageMm: 0,
    skirtCount: 0,
    skirtSpareMm: 0
  });
});
