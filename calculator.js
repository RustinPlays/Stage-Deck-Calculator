(function initialiseCalculatorModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StageCalculatorModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCalculatorModel() {
  'use strict';

  const SNAP_MM = 100;
  const SNAP_OPTIONS = [100, 300, 600];
  const MIN_WIDTH_MM = 7200;
  const MIN_HEIGHT_MM = 3600;
  const DECK_SIZES = [1200, 1800, 2400];
  const DECK_TYPES = [
    { id: '1200x1200', width: 1200, height: 1200 },
    { id: '1800x1200', width: 1800, height: 1200 },
    { id: '2400x1200', width: 2400, height: 1200 },
    { id: '1000x2000', width: 1000, height: 2000 },
    { id: '2000x500', width: 2000, height: 500 }
  ];
  const SKIRT_LENGTH_MM = 5000;
  const SKIRT_JOIN_OVERLAP_MM = 100;
  const SKIRT_CORNER_RETURN_MM = 300;
  const CARPET_ROLL_WIDTH_MM = 2000;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uid(prefix = 'deck') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeSnap(value) {
    const requested = Number(value);
    return SNAP_OPTIONS.includes(requested) ? requested : SNAP_MM;
  }

  function getDeckType(deck) {
    const byId = DECK_TYPES.find(type => type.id === deck?.type);
    if (byId) return byId;
    const width = Number(deck?.width);
    const height = Number(deck?.height);
    return DECK_TYPES.find(type => (
      (type.width === width && type.height === height)
      || (type.width === height && type.height === width)
    )) || null;
  }

  function snapMillimetres(value, snapValue = SNAP_MM) {
    const snap = normalizeSnap(snapValue);
    return Math.max(0, Math.round((Number(value) || 0) / snap) * snap);
  }

  function snapCoordinate(value, snapValue = SNAP_MM) {
    const snap = normalizeSnap(snapValue);
    return Math.round((Number(value) || 0) / snap) * snap;
  }

  function createDefaultCalculator() {
    const decks = [];
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        decks.push({
          id: `deck-${row}-${column}`,
          x: column * 2400,
          y: row * 1200,
          size: 2400,
          type: '2400x1200',
          width: 2400,
          height: 1200,
          legs: 6
        });
      }
    }
    return {
      rows: 2,
      columns: 3,
      snapMm: SNAP_MM,
      selectedDeckId: null,
      selectedDeckIds: [],
      skirtBackOpen: false,
      decks
    };
  }

  function normalizeCalculator(value) {
    if (!value || typeof value !== 'object') return createDefaultCalculator();

    const rows = clamp(Math.round(Number(value.rows) || 2), 1, 12);
    const columns = clamp(Math.round(Number(value.columns) || 3), 1, 12);
    const snapMm = normalizeSnap(value.snapMm);
    const decks = [];
    const ids = new Set();

    (Array.isArray(value.decks) ? value.decks : []).forEach((deck, index) => {
      const legacyRow = Math.max(0, Math.round(Number(deck?.row) || 0));
      const legacyColumn = Math.max(0, Math.round(Number(deck?.column) || 0));
      const rawWidth = Number(deck?.width) || 0;
      const rawHeight = Number(deck?.height) || 0;
      const matchedType = getDeckType(deck) || getDeckType({ width: rawWidth, height: rawHeight });
      const rawLongSide = Number(deck?.size)
        || Math.max(rawWidth, rawHeight)
        || 2400;
      const fallbackSize = DECK_SIZES.reduce((closest, option) => (
        Math.abs(option - rawLongSide) < Math.abs(closest - rawLongSide) ? option : closest
      ), 2400);
      const type = matchedType || DECK_TYPES.find(option => option.id === `${fallbackSize}x1200`);
      const size = Math.max(type.width, type.height);
      const reversed = rawWidth > 0 && rawHeight > 0
        ? rawWidth === type.height && rawHeight === type.width
        : false;
      const width = reversed ? type.height : type.width;
      const height = reversed ? type.width : type.height;
      const xValue = Number(deck?.x);
      const yValue = Number(deck?.y);
      const x = snapCoordinate(Number.isFinite(xValue) ? xValue : legacyColumn * 2400, SNAP_MM);
      const y = snapCoordinate(Number.isFinite(yValue) ? yValue : legacyRow * 1200, SNAP_MM);
      let id = String(deck?.id || `deck-${legacyRow}-${legacyColumn}-${index}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 100);
      if (!id) id = uid();
      if (ids.has(id)) id = uid();
      ids.add(id);
      const legs = type.id === '1200x1200' || Number(deck?.legs) === 4 ? 4 : 6;
      decks.push({ id, x, y, size, type: type.id, width, height, legs });
    });

    const requestedSelection = Array.isArray(value.selectedDeckIds)
      ? value.selectedDeckIds
      : value.selectedDeckId ? [value.selectedDeckId] : [];
    const validIds = new Set(decks.map(deck => deck.id));
    const selectedDeckIds = [...new Set(requestedSelection.map(String))]
      .filter(id => validIds.has(id));
    const selectedDeckId = selectedDeckIds[0] || null;
    return {
      rows,
      columns,
      gigName: String(value.gigName || '').trim().slice(0, 80),
      areaName: String(value.areaName || '').trim().slice(0, 80),
      snapMm,
      selectedDeckId,
      selectedDeckIds,
      skirtBackOpen: value.skirtBackOpen === true,
      decks
    };
  }

  function rectanglesOverlap(a, b) {
    return a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y;
  }

  function positionAvailable(calculator, candidate, ignoredId = null) {
    return !calculator.decks.some(deck => deck.id !== ignoredId && rectanglesOverlap(candidate, deck));
  }

  function getDeckAddEdges(decks) {
    return decks.flatMap(deck => ['top', 'right', 'bottom', 'left'].flatMap(side => {
      const horizontal = side === 'top' || side === 'bottom';
      const start = horizontal ? deck.x : deck.y;
      const end = start + (horizontal ? deck.width : deck.height);
      const coordinate = side === 'top' ? deck.y : side === 'bottom' ? deck.y + deck.height
        : side === 'left' ? deck.x : deck.x + deck.width;
      let segments = [[start, end]];
      decks.filter(other => other.id !== deck.id).forEach(other => {
        const blocks = side === 'top' ? other.y < coordinate && other.y + other.height >= coordinate
          : side === 'bottom' ? other.y <= coordinate && other.y + other.height > coordinate
          : side === 'left' ? other.x < coordinate && other.x + other.width >= coordinate
          : other.x <= coordinate && other.x + other.width > coordinate;
        if (!blocks) return;
        const low = horizontal ? other.x : other.y;
        const high = low + (horizontal ? other.width : other.height);
        segments = segments.flatMap(([a, b]) => high <= a || low >= b ? [[a, b]]
          : [[a, Math.min(b, low)], [Math.max(a, high), b]].filter(([c, d]) => d > c));
      });
      return segments.map(([a, b]) => ({ deckId: deck.id, side, start: a, end: b,
        x: horizontal ? (a + b) / 2 : coordinate,
        y: horizontal ? coordinate : (a + b) / 2 }));
    }));
  }

  function getAdjacentPlacement(calculator, edge, type) {
    const horizontal = edge.side === 'top' || edge.side === 'bottom';
    const length = horizontal ? type.width : type.height;
    const preferred = snapCoordinate((edge.start + edge.end - length) / 2);
    const positions = [preferred];
    for (let value = Math.ceil((edge.start - length + SNAP_MM) / SNAP_MM) * SNAP_MM;
      value < edge.end; value += SNAP_MM) positions.push(value);
    positions.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
    for (const value of positions) {
      const candidate = { ...type,
        x: horizontal ? value : edge.side === 'left' ? edge.x - type.width : edge.x,
        y: horizontal ? edge.side === 'top' ? edge.y - type.height : edge.y : value };
      if (positionAvailable(calculator, candidate)) return candidate;
    }
    return null;
  }

  function pasteDecks(calculator, copied) {
    if (!copied.length) return [];
    const width = Math.max(...copied.map(deck => deck.x + deck.width)) - Math.min(...copied.map(deck => deck.x));
    for (let offset = Math.ceil(width / SNAP_MM) * SNAP_MM; ; offset += SNAP_MM) {
      const candidates = copied.map(deck => ({ ...deck, x: deck.x + offset, id: uid() }));
      if (candidates.every(deck => positionAvailable(calculator, deck))) return candidates;
    }
  }

  function findOverlaps(decks) {
    const overlaps = [];
    for (let first = 0; first < decks.length; first += 1) {
      for (let second = first + 1; second < decks.length; second += 1) {
        if (rectanglesOverlap(decks[first], decks[second])) {
          overlaps.push([decks[first].id, decks[second].id]);
        }
      }
    }
    return overlaps;
  }

  function getRotatedDeck(deck, direction = 'right') {
    const candidate = { ...deck, width: deck.height, height: deck.width };
    if (direction === 'left') {
      if (deck.width > deck.height) {
        candidate.y = deck.y + deck.height - deck.width;
      } else if (deck.height > deck.width) {
        candidate.x = deck.x + deck.width - deck.height;
      }
    }
    return candidate;
  }

  function rotateDecksAroundCenter(decks, quarterTurns) {
    if (!decks.length) return [];
    const turns = ((quarterTurns % 4) + 4) % 4;
    const centerX = (Math.min(...decks.map(deck => deck.x)) + Math.max(...decks.map(deck => deck.x + deck.width))) / 2;
    const centerY = (Math.min(...decks.map(deck => deck.y)) + Math.max(...decks.map(deck => deck.y + deck.height))) / 2;
    const cosine = [1, 0, -1, 0][turns];
    const sine = [0, 1, 0, -1][turns];
    const rotated = decks.map(deck => {
      const dx = deck.x + deck.width / 2 - centerX;
      const dy = deck.y + deck.height / 2 - centerY;
      const width = turns % 2 ? deck.height : deck.width;
      const height = turns % 2 ? deck.width : deck.height;
      return { ...deck, width, height,
        x: centerX + dx * cosine - dy * sine - width / 2,
        y: centerY + dx * sine + dy * cosine - height / 2 };
    });
    // Shift the entire group equally onto the grid so its internal spacing stays intact.
    const shiftX = snapCoordinate(rotated[0].x) - rotated[0].x;
    const shiftY = snapCoordinate(rotated[0].y) - rotated[0].y;
    return rotated.map(deck => ({ ...deck, x: deck.x + shiftX, y: deck.y + shiftY }));
  }

  function getCanvasMetrics(calculator) {
    const maxX = Math.max(0, ...calculator.decks.map(deck => deck.x + deck.width));
    const maxY = Math.max(0, ...calculator.decks.map(deck => deck.y + deck.height));
    const minX = Math.min(0, ...calculator.decks.map(deck => deck.x));
    const minY = Math.min(0, ...calculator.decks.map(deck => deck.y));
    const snapMm = normalizeSnap(calculator.snapMm);
    const offsetX = Math.max(0, -minX);
    const offsetY = Math.max(0, -minY);
    return {
      width: Math.max(MIN_WIDTH_MM, Math.ceil((maxX + offsetX + snapMm) / snapMm) * snapMm),
      height: Math.max(MIN_HEIGHT_MM, Math.ceil((maxY + offsetY + snapMm) / snapMm) * snapMm),
      offsetX,
      offsetY
    };
  }

  function getStageDimensions(calculator) {
    if (!calculator.decks.length) {
      return { widthMm: 0, heightMm: 0, areaSquareMetres: 0 };
    }
    const minX = Math.min(...calculator.decks.map(deck => deck.x));
    const minY = Math.min(...calculator.decks.map(deck => deck.y));
    const maxX = Math.max(...calculator.decks.map(deck => deck.x + deck.width));
    const maxY = Math.max(...calculator.decks.map(deck => deck.y + deck.height));
    const widthMm = maxX - minX;
    const heightMm = maxY - minY;
    return { widthMm, heightMm, areaSquareMetres: (widthMm * heightMm) / 1_000_000 };
  }

  function calculateCarpetRoll(dimensions, rollWidthMm = CARPET_ROLL_WIDTH_MM) {
    const { widthMm = 0, heightMm = 0 } = dimensions || {};
    if (widthMm <= 0 || heightMm <= 0) {
      return {
        rollWidthMm,
        rollStripCount: 0,
        rollCutLengthMm: 0,
        rollLinearMetres: 0,
        rollOffcutAreaSquareMetres: 0
      };
    }

    const widthwise = {
      rollStripCount: Math.ceil(widthMm / rollWidthMm),
      rollCutLengthMm: heightMm
    };
    const lengthwise = {
      rollStripCount: Math.ceil(heightMm / rollWidthMm),
      rollCutLengthMm: widthMm
    };
    const selected = widthwise.rollStripCount * widthwise.rollCutLengthMm
      <= lengthwise.rollStripCount * lengthwise.rollCutLengthMm
      ? widthwise
      : lengthwise;
    const totalLengthMm = selected.rollStripCount * selected.rollCutLengthMm;
    const rollLinearMetres = totalLengthMm / 1000;

    return {
      rollWidthMm,
      ...selected,
      rollLinearMetres,
      rollOffcutAreaSquareMetres: Math.max(0, totalLengthMm * rollWidthMm - widthMm * heightMm) / 1_000_000
    };
  }

  function getExposedEdges(decks) {
    if (!decks.length) return [];
    const mergeIntervals = intervals => {
      const merged = [];
      intervals.sort((a, b) => a[0] - b[0]);
      intervals.forEach(([start, end]) => {
        const previous = merged[merged.length - 1];
        if (!previous || start > previous[1]) merged.push([start, end]);
        else previous[1] = Math.max(previous[1], end);
      });
      return merged;
    };
    const subtractIntervals = (source, covered) => {
      const remaining = [];
      source.forEach(([start, end]) => {
        let cursor = start;
        covered.forEach(([coverStart, coverEnd]) => {
          if (coverEnd <= cursor || coverStart >= end) return;
          if (coverStart > cursor) remaining.push([cursor, Math.min(coverStart, end)]);
          cursor = Math.max(cursor, coverEnd);
        });
        if (cursor < end) remaining.push([cursor, end]);
      });
      return remaining;
    };
    const edges = [];
    const appendEdges = (positive, negative, coordinate, orientation) => {
      const positiveOnly = subtractIntervals(positive, negative);
      const negativeOnly = subtractIntervals(negative, positive);
      [...positiveOnly, ...negativeOnly].forEach(([start, end]) => {
        edges.push(orientation === 'horizontal'
          ? { orientation, x1: start, y1: coordinate, x2: end, y2: coordinate }
          : { orientation, x1: coordinate, y1: start, x2: coordinate, y2: end });
      });
    };
    const xCoordinates = [...new Set(decks.flatMap(deck => [deck.x, deck.x + deck.width]))];
    const yCoordinates = [...new Set(decks.flatMap(deck => [deck.y, deck.y + deck.height]))];

    yCoordinates.forEach(y => {
      const above = mergeIntervals(decks
        .filter(deck => deck.y < y && deck.y + deck.height >= y)
        .map(deck => [deck.x, deck.x + deck.width]));
      const below = mergeIntervals(decks
        .filter(deck => deck.y <= y && deck.y + deck.height > y)
        .map(deck => [deck.x, deck.x + deck.width]));
      appendEdges(above, below, y, 'horizontal');
    });
    xCoordinates.forEach(x => {
      const left = mergeIntervals(decks
        .filter(deck => deck.x < x && deck.x + deck.width >= x)
        .map(deck => [deck.y, deck.y + deck.height]));
      const right = mergeIntervals(decks
        .filter(deck => deck.x <= x && deck.x + deck.width > x)
        .map(deck => [deck.y, deck.y + deck.height]));
      appendEdges(left, right, x, 'vertical');
    });
    return edges;
  }

  function getSkirtEdges(decks, backOpen = false) {
    const exposedEdges = getExposedEdges(decks);
    if (!backOpen || !decks.length) return exposedEdges;

    const backY = Math.min(...decks.map(deck => deck.y));
    const rearEdges = exposedEdges.filter(edge => edge.orientation === 'horizontal' && edge.y1 === backY);
    const cornerReturns = rearEdges.flatMap(edge => {
      const left = edge.x1;
      const right = edge.x2;
      const returnLength = Math.min(SKIRT_CORNER_RETURN_MM, (right - left) / 2);
      return [
      {
        orientation: 'horizontal',
        x1: left,
        y1: backY,
        x2: Math.min(right, left + returnLength),
        y2: backY,
        cornerReturn: true
      },
      {
        orientation: 'horizontal',
        x1: Math.max(left, right - returnLength),
        y1: backY,
        x2: right,
        y2: backY,
        cornerReturn: true
      }
      ];
    });
    return [
      ...exposedEdges.filter(edge => !(edge.orientation === 'horizontal' && edge.y1 === backY)),
      ...cornerReturns
    ];
  }

  function calculatePerimeterMm(decks) {
    return getExposedEdges(decks).reduce((total, edge) => (
      total + Math.abs(edge.x2 - edge.x1) + Math.abs(edge.y2 - edge.y1)
    ), 0);
  }

  function calculateBackEdgeLengthMm(decks) {
    if (!decks.length) return 0;
    const backY = Math.min(...decks.map(deck => deck.y));
    const intervals = decks
      .filter(deck => deck.y === backY)
      .map(deck => [deck.x, deck.x + deck.width])
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    intervals.forEach(([start, end]) => {
      const previous = merged[merged.length - 1];
      if (!previous || start > previous[1]) merged.push([start, end]);
      else previous[1] = Math.max(previous[1], end);
    });
    return merged.reduce((total, [start, end]) => total + end - start, 0);
  }

  function calculateSkirtRequirements(decks, perimeterMm, backOpen = false) {
    const hasStage = decks.length > 0;
    const backEdgeLengthMm = backOpen && hasStage ? calculateBackEdgeLengthMm(decks) : 0;
    const coverageMm = getSkirtEdges(decks, backOpen).reduce((total, edge) => (
      total + Math.abs(edge.x2 - edge.x1) + Math.abs(edge.y2 - edge.y1)
    ), 0);
    const skirtCount = coverageMm === 0
      ? 0
      : Math.max(1, Math.ceil((coverageMm - (backOpen ? SKIRT_JOIN_OVERLAP_MM : 0)) / (SKIRT_LENGTH_MM - SKIRT_JOIN_OVERLAP_MM)));
    const skirtSpareMm = Math.max(0, skirtCount * SKIRT_LENGTH_MM - coverageMm);
    return { backEdgeLengthMm, skirtCoverageMm: coverageMm, skirtCount, skirtSpareMm };
  }

  function calculateMaterials(calculator) {
    const supportMap = new Map();
    const addSupport = (x, y) => {
      const key = `${x}:${y}`;
      const support = supportMap.get(key) || { x, y, legs: 0 };
      support.legs += 1;
      supportMap.set(key, support);
    };

    let legCount = 0;
    let fourCount = 0;
    let sixCount = 0;
    const sizeCounts = { 1200: 0, 1800: 0, 2400: 0, 2000: 0 };
    const typeCounts = Object.fromEntries(DECK_TYPES.map(type => [type.id, 0]));

    calculator.decks.forEach(deck => {
      const { x, y, width, height } = deck;
      const type = getDeckType(deck);
      const legs = type?.id === '1200x1200' ? 4 : deck.legs;
      [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
        .forEach(([supportX, supportY]) => addSupport(supportX, supportY));

      if (legs === 6) {
        if (width >= height) {
          addSupport(x + width / 2, y);
          addSupport(x + width / 2, y + height);
        } else {
          addSupport(x, y + height / 2);
          addSupport(x + width, y + height / 2);
        }
      }

      if (legs === 6) {
        sixCount += 1;
      } else {
        fourCount += 1;
      }

      legCount += legs;
      if (type) {
        typeCounts[type.id] += 1;
        sizeCounts[Math.max(type.width, type.height)] = (sizeCounts[Math.max(type.width, type.height)] || 0) + 1;
      }
    });

    const supports = [...supportMap.values()].map(support => ({
      ...support,
      blocks: Math.ceil(support.legs / 4)
    }));
    const woodCount = supports.reduce((total, support) => total + support.blocks, 0);

    const stageDimensions = getStageDimensions(calculator);
    const carpetRoll = calculateCarpetRoll(stageDimensions);
    const perimeterMm = calculatePerimeterMm(calculator.decks);
    const skirtRequirements = calculateSkirtRequirements(
      calculator.decks,
      perimeterMm,
      calculator.skirtBackOpen === true
    );
    return {
      deckCount: calculator.decks.length,
      legCount,
      woodCount,
      fourCount,
      sixCount,
      sizeCounts,
      typeCounts,
      ...stageDimensions,
      ...carpetRoll,
      perimeterMm,
      ...skirtRequirements,
      unsharedWoodCount: legCount,
      woodSaved: legCount - woodCount,
      supports
    };
  }

  return {
    SNAP_MM,
    SNAP_OPTIONS,
    MIN_WIDTH_MM,
    MIN_HEIGHT_MM,
    DECK_SIZES,
    DECK_TYPES,
    clamp,
    uid,
    normalizeSnap,
    snapMillimetres,
    snapCoordinate,
    createDefaultCalculator,
    normalizeCalculator,
    rectanglesOverlap,
    positionAvailable,
    getDeckAddEdges,
    getAdjacentPlacement,
    pasteDecks,
    findOverlaps,
    getRotatedDeck,
    rotateDecksAroundCenter,
    getCanvasMetrics,
    getStageDimensions,
    calculateCarpetRoll,
    CARPET_ROLL_WIDTH_MM,
    calculatePerimeterMm,
    getExposedEdges,
    getSkirtEdges,
    calculateBackEdgeLengthMm,
    calculateSkirtRequirements,
    calculateMaterials
  };
});
