(function initialiseCalculatorModel(root, factory) {
  const api = factory();
  if (root) root.StageCalculatorModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCalculatorModel() {
  'use strict';

  const SNAP_MM = 600;
  const MIN_WIDTH_MM = 7200;
  const MIN_HEIGHT_MM = 3600;
  const DECK_SIZES = [1200, 1800, 2400];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uid(prefix = 'deck') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function snapMillimetres(value) {
    return Math.max(0, Math.round((Number(value) || 0) / SNAP_MM) * SNAP_MM);
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
          width: 2400,
          height: 1200,
          legs: 6
        });
      }
    }
    return { rows: 2, columns: 3, selectedDeckId: null, decks };
  }

  function normalizeCalculator(value) {
    if (!value || typeof value !== 'object') return createDefaultCalculator();

    const rows = clamp(Math.round(Number(value.rows) || 2), 1, 12);
    const columns = clamp(Math.round(Number(value.columns) || 3), 1, 12);
    const decks = [];
    const ids = new Set();

    (Array.isArray(value.decks) ? value.decks : []).forEach((deck, index) => {
      const legacyRow = Math.max(0, Math.round(Number(deck?.row) || 0));
      const legacyColumn = Math.max(0, Math.round(Number(deck?.column) || 0));
      const rawLongSide = Number(deck?.size)
        || Math.max(Number(deck?.width) || 0, Number(deck?.height) || 0)
        || 2400;
      const size = DECK_SIZES.reduce((closest, option) => (
        Math.abs(option - rawLongSide) < Math.abs(closest - rawLongSide) ? option : closest
      ), 2400);
      const vertical = size > 1200 && Number(deck?.height) > Number(deck?.width);
      const width = vertical ? 1200 : size;
      const height = vertical ? size : 1200;
      const xValue = Number(deck?.x);
      const yValue = Number(deck?.y);
      const x = snapMillimetres(Number.isFinite(xValue) ? xValue : legacyColumn * 2400);
      const y = snapMillimetres(Number.isFinite(yValue) ? yValue : legacyRow * 1200);
      let id = String(deck?.id || `deck-${legacyRow}-${legacyColumn}-${index}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 100);
      if (!id) id = uid();
      if (ids.has(id)) id = uid();
      ids.add(id);
      decks.push({ id, x, y, size, width, height, legs: Number(deck?.legs) === 4 ? 4 : 6 });
    });

    const selectedDeckId = decks.some(deck => deck.id === value.selectedDeckId)
      ? value.selectedDeckId
      : null;
    return { rows, columns, selectedDeckId, decks };
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

  function getCanvasMetrics(calculator) {
    const maxX = Math.max(0, ...calculator.decks.map(deck => deck.x + deck.width));
    const maxY = Math.max(0, ...calculator.decks.map(deck => deck.y + deck.height));
    return {
      width: Math.max(MIN_WIDTH_MM, Math.ceil((maxX + SNAP_MM) / SNAP_MM) * SNAP_MM),
      height: Math.max(MIN_HEIGHT_MM, Math.ceil((maxY + SNAP_MM) / SNAP_MM) * SNAP_MM)
    };
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
    const sizeCounts = { 1200: 0, 1800: 0, 2400: 0 };

    calculator.decks.forEach(deck => {
      const { x, y, width, height } = deck;
      [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
        .forEach(([supportX, supportY]) => addSupport(supportX, supportY));

      if (deck.legs === 6) {
        if (width >= height) {
          addSupport(x + width / 2, y);
          addSupport(x + width / 2, y + height);
        } else {
          addSupport(x, y + height / 2);
          addSupport(x + width, y + height / 2);
        }
        sixCount += 1;
      } else {
        fourCount += 1;
      }

      legCount += deck.legs;
      sizeCounts[deck.size] = (sizeCounts[deck.size] || 0) + 1;
    });

    const supports = [...supportMap.values()].map(support => ({
      ...support,
      blocks: Math.ceil(support.legs / 4)
    }));
    const woodCount = supports.reduce((total, support) => total + support.blocks, 0);

    return {
      deckCount: calculator.decks.length,
      legCount,
      woodCount,
      fourCount,
      sixCount,
      sizeCounts,
      unsharedWoodCount: legCount,
      woodSaved: legCount - woodCount,
      supports
    };
  }

  return {
    SNAP_MM,
    MIN_WIDTH_MM,
    MIN_HEIGHT_MM,
    DECK_SIZES,
    clamp,
    uid,
    snapMillimetres,
    createDefaultCalculator,
    normalizeCalculator,
    rectanglesOverlap,
    positionAvailable,
    getCanvasMetrics,
    calculateMaterials
  };
});

(function initialiseApp() {
  'use strict';

  const Model = window.StageCalculatorModel;
  const STORAGE_KEY = 'stage-deck-calculator-v1';
  const THEME_STORAGE_KEY = 'stage-deck-calculator-theme';
  const elementIds = [
    'lightThemeBtn', 'darkThemeBtn', 'saveStatus', 'newBtn', 'importBtn', 'exportBtn', 'importFile', 'stageRows',
    'stageColumns', 'stageFillBtn', 'stageClearBtn', 'stageGrid', 'stageSupportLayer',
    'stageDeckSize', 'stageRotateDeckBtn', 'stageSelectionHint', 'stageDeckCount',
    'stageLegCount', 'stageWoodCount', 'stage1200Count', 'stage1800Count',
    'stage2400Count', 'stageFourCount', 'stageSixCount', 'stageUnsharedWoodCount',
    'stageWoodSaved', 'toast'
  ];
  const el = Object.fromEntries(elementIds.map(id => [id, document.getElementById(id)]));

  let calculator = loadCalculator();
  let dragState = null;
  let toastTimer = null;

  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  bindEvents();
  render();

  function bindEvents() {
    el.lightThemeBtn.addEventListener('click', () => applyTheme('light'));
    el.darkThemeBtn.addEventListener('click', () => applyTheme('dark'));
    el.stageRows.addEventListener('change', resizeGrid);
    el.stageColumns.addEventListener('change', resizeGrid);
    el.stageFillBtn.addEventListener('click', fillGrid);
    el.stageClearBtn.addEventListener('click', clearGrid);
    el.stageGrid.addEventListener('click', onGridClick);
    el.stageGrid.addEventListener('pointerdown', onDeckPointerDown);
    el.stageGrid.addEventListener('keydown', onDeckKeyDown);
    el.stageDeckSize.addEventListener('change', changeSelectedDeckSize);
    el.stageRotateDeckBtn.addEventListener('click', rotateSelectedDeck);
    document.querySelectorAll('[data-stage-add-size]').forEach(button => {
      button.addEventListener('click', () => addDeck(Number(button.dataset.stageAddSize)));
    });
    window.addEventListener('pointermove', onDeckPointerMove);
    window.addEventListener('pointerup', endDeckDrag);
    window.addEventListener('pointercancel', endDeckDrag);
    window.addEventListener('resize', render);
    window.addEventListener('keydown', onWindowKeyDown);
    el.newBtn.addEventListener('click', newLayout);
    el.exportBtn.addEventListener('click', exportLayout);
    el.importBtn.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', importLayout);
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    el.lightThemeBtn.setAttribute('aria-pressed', String(nextTheme === 'light'));
    el.darkThemeBtn.setAttribute('aria-pressed', String(nextTheme === 'dark'));
  }

  function getStageScale() {
    const availableWidth = Math.max(0, el.stageGrid.closest('.grid-scroll').clientWidth - 44);
    return Model.clamp(availableWidth / Model.MIN_WIDTH_MM, 0.08, 0.13);
  }

  function loadCalculator() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Model.normalizeCalculator(JSON.parse(saved)) : Model.createDefaultCalculator();
    } catch (error) {
      console.warn('Could not load the saved calculator layout.', error);
      return Model.createDefaultCalculator();
    }
  }

  function saveCalculator() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculator));
    el.saveStatus.textContent = 'Saved locally';
  }

  function commit() {
    calculator = Model.normalizeCalculator(calculator);
    saveCalculator();
    render();
  }

  function resizeGrid() {
    calculator.rows = Model.clamp(Math.round(Number(el.stageRows.value) || calculator.rows), 1, 12);
    calculator.columns = Model.clamp(Math.round(Number(el.stageColumns.value) || calculator.columns), 1, 12);
    commit();
  }

  function fillGrid() {
    calculator.decks = [];
    for (let row = 0; row < calculator.rows; row += 1) {
      for (let column = 0; column < calculator.columns; column += 1) {
        calculator.decks.push({
          id: Model.uid(),
          x: column * 2400,
          y: row * 1200,
          size: 2400,
          width: 2400,
          height: 1200,
          legs: 6
        });
      }
    }
    calculator.selectedDeckId = calculator.decks[0]?.id || null;
    commit();
  }

  function clearGrid() {
    calculator.decks = [];
    calculator.selectedDeckId = null;
    commit();
  }

  function addDeck(sizeValue) {
    const size = Model.DECK_SIZES.includes(sizeValue) ? sizeValue : 2400;
    const width = size;
    const height = 1200;
    const metrics = Model.getCanvasMetrics(calculator);
    let position = null;

    for (let y = 0; y <= metrics.height + 2400 && !position; y += Model.SNAP_MM) {
      for (let x = 0; x <= Math.max(metrics.width - width, 0); x += Model.SNAP_MM) {
        if (Model.positionAvailable(calculator, { x, y, width, height })) {
          position = { x, y };
          break;
        }
      }
    }

    const deck = {
      id: Model.uid(),
      x: position?.x || 0,
      y: position?.y || 0,
      size,
      width,
      height,
      legs: 6
    };
    calculator.decks.push(deck);
    calculator.selectedDeckId = deck.id;
    commit();
  }

  function getSelectedDeck() {
    return calculator.decks.find(deck => deck.id === calculator.selectedDeckId) || null;
  }

  function selectDeck(id) {
    calculator.selectedDeckId = calculator.decks.some(deck => deck.id === id) ? id : null;
    render();
  }

  function changeSelectedDeckSize() {
    const deck = getSelectedDeck();
    if (!deck) return;
    const requested = Number(el.stageDeckSize.value);
    const size = Model.DECK_SIZES.includes(requested) ? requested : 2400;
    const vertical = deck.height > deck.width && size > 1200;
    const candidate = {
      ...deck,
      size,
      width: vertical ? 1200 : size,
      height: vertical ? size : 1200
    };

    if (!Model.positionAvailable(calculator, candidate, deck.id)) {
      render();
      el.stageSelectionHint.textContent = 'Move this deck first — that size would overlap another deck.';
      return;
    }

    Object.assign(deck, candidate);
    commit();
  }

  function rotateSelectedDeck() {
    const deck = getSelectedDeck();
    if (!deck || deck.size === 1200) return;
    const candidate = { ...deck, width: deck.height, height: deck.width };
    if (!Model.positionAvailable(calculator, candidate, deck.id)) {
      render();
      el.stageSelectionHint.textContent = 'Move this deck first — rotating here would overlap another deck.';
      return;
    }
    Object.assign(deck, candidate);
    commit();
  }

  function removeDeck(id) {
    const index = calculator.decks.findIndex(deck => deck.id === id);
    if (index < 0) return;
    calculator.decks.splice(index, 1);
    if (calculator.selectedDeckId === id) calculator.selectedDeckId = null;
    commit();
  }

  function onGridClick(event) {
    const button = event.target.closest('button[data-stage-action]');
    if (!button) return;
    const id = button.dataset.deckId;
    const deck = calculator.decks.find(item => item.id === id);
    if (!deck) return;

    if (button.dataset.stageAction === 'remove') {
      removeDeck(id);
      return;
    }
    if (button.dataset.stageAction === 'legs') {
      deck.legs = Number(button.dataset.legs) === 4 ? 4 : 6;
      calculator.selectedDeckId = id;
      commit();
      return;
    }
    if (button.dataset.stageAction === 'rotate') {
      calculator.selectedDeckId = id;
      rotateSelectedDeck();
    }
  }

  function onDeckPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button')) return;
    const deckElement = event.target.closest('.deck-slot[data-deck-id]');
    if (!deckElement) return;
    event.preventDefault();
    const deck = calculator.decks.find(item => item.id === deckElement.dataset.deckId);
    if (!deck) return;
    calculator.selectedDeckId = deck.id;
    dragState = {
      id: deck.id,
      scale: getStageScale(),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: deck.x,
      startY: deck.y,
      moved: false
    };
    deckElement.setPointerCapture?.(event.pointerId);
    render();
  }

  function onDeckPointerMove(event) {
    if (!dragState) return;
    event.preventDefault();
    const deck = calculator.decks.find(item => item.id === dragState.id);
    if (!deck) return;
    const x = Model.snapMillimetres(dragState.startX + (event.clientX - dragState.startClientX) / dragState.scale);
    const y = Model.snapMillimetres(dragState.startY + (event.clientY - dragState.startClientY) / dragState.scale);
    const candidate = { ...deck, x, y };
    if ((x !== deck.x || y !== deck.y) && Model.positionAvailable(calculator, candidate, deck.id)) {
      deck.x = x;
      deck.y = y;
      dragState.moved = true;
      render();
    }
  }

  function endDeckDrag() {
    if (!dragState) return;
    const moved = dragState.moved;
    dragState = null;
    if (moved) saveCalculator();
    render();
  }

  function onDeckKeyDown(event) {
    const deckElement = event.target.closest('.deck-slot[data-deck-id]');
    if (!deckElement || event.target.closest('button')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDeck(deckElement.dataset.deckId);
    }
  }

  function onWindowKeyDown(event) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && !event.target.matches('input, select')) {
      const selected = getSelectedDeck();
      if (selected) {
        event.preventDefault();
        removeDeck(selected.id);
      }
    }
  }

  function newLayout() {
    calculator = Model.createDefaultCalculator();
    commit();
    showToast('Started a new 2 × 3 layout.');
  }

  function exportLayout() {
    const payload = {
      type: 'stage-deck-calculator',
      version: 1,
      exportedAt: new Date().toISOString(),
      calculator: { ...calculator, selectedDeckId: null }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `stage-deck-layout-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Layout exported.');
  }

  async function importLayout() {
    const [file] = el.importFile.files;
    el.importFile.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const source = parsed?.type === 'stage-deck-calculator' ? parsed.calculator : parsed;
      if (!source || !Array.isArray(source.decks)) throw new Error('No stage deck layout was found.');
      calculator = Model.normalizeCalculator(source);
      commit();
      showToast('Layout imported.');
    } catch (error) {
      showToast(`Could not import this file: ${error.message}`, true);
    }
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.toggle('error', isError);
    el.toast.hidden = false;
    toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, 3200);
  }

  function render() {
    const materials = Model.calculateMaterials(calculator);
    const metrics = Model.getCanvasMetrics(calculator);
    const scale = getStageScale();
    const gridWidth = metrics.width * scale;
    const gridHeight = metrics.height * scale;

    el.stageRows.value = calculator.rows;
    el.stageColumns.value = calculator.columns;
    el.stageGrid.style.width = `${gridWidth}px`;
    el.stageGrid.style.height = `${gridHeight}px`;
    el.stageGrid.style.setProperty('--grid-step', `${Model.SNAP_MM * scale}px`);
    el.stageGrid.innerHTML = calculator.decks.map((deck, index) => {
      const vertical = deck.height > deck.width;
      const orientation = deck.size === 1200 ? '' : vertical ? ' vertical' : ' horizontal';
      const selected = deck.id === calculator.selectedDeckId;
      return `<div class="deck-slot${selected ? ' selected' : ''}" data-deck-id="${deck.id}" tabindex="0" role="group" aria-label="Deck ${index + 1}, ${deck.size} by 1200 millimetres${orientation}" style="left:${deck.x * scale}px;top:${deck.y * scale}px;width:${deck.width * scale}px;height:${deck.height * scale}px">
        <span class="deck-label">${deck.size} × 1200</span>
        <button class="remove-deck" data-stage-action="remove" data-deck-id="${deck.id}" type="button" aria-label="Remove deck ${index + 1}">×</button>
        <div class="leg-toggle" aria-label="Leg count for deck ${index + 1}">
          <button class="${deck.legs === 4 ? 'active' : ''}" data-stage-action="legs" data-deck-id="${deck.id}" data-legs="4" type="button" aria-pressed="${deck.legs === 4}">4</button>
          <button class="${deck.legs === 6 ? 'active' : ''}" data-stage-action="legs" data-deck-id="${deck.id}" data-legs="6" type="button" aria-pressed="${deck.legs === 6}">6</button>
        </div>
        ${deck.size > 1200 ? `<button class="rotate-deck" data-stage-action="rotate" data-deck-id="${deck.id}" type="button" aria-label="Rotate deck ${index + 1}">↻</button>` : ''}
      </div>`;
    }).join('');

    el.stageSupportLayer.style.width = `${gridWidth}px`;
    el.stageSupportLayer.style.height = `${gridHeight}px`;
    el.stageSupportLayer.innerHTML = materials.supports.map(support => {
      const title = `${support.legs} deck leg${support.legs === 1 ? '' : 's'} using ${support.blocks} wood support${support.blocks === 1 ? '' : 's'}`;
      return `<span class="support-point${support.blocks > 1 ? ' multiple' : ''}" style="left:${support.x * scale}px;top:${support.y * scale}px" title="${title}">${support.legs}</span>`;
    }).join('');

    const selectedDeck = getSelectedDeck();
    el.stageDeckSize.disabled = !selectedDeck;
    el.stageRotateDeckBtn.disabled = !selectedDeck || selectedDeck.size === 1200;
    el.stageSelectionHint.textContent = selectedDeck
      ? `${selectedDeck.width} × ${selectedDeck.height} mm at x ${selectedDeck.x}, y ${selectedDeck.y}`
      : 'Select a deck to edit it';
    if (selectedDeck) el.stageDeckSize.value = String(selectedDeck.size);

    el.stageDeckCount.textContent = materials.deckCount;
    el.stageLegCount.textContent = materials.legCount;
    el.stageWoodCount.textContent = materials.woodCount;
    el.stage1200Count.textContent = materials.sizeCounts[1200] || 0;
    el.stage1800Count.textContent = materials.sizeCounts[1800] || 0;
    el.stage2400Count.textContent = materials.sizeCounts[2400] || 0;
    el.stageFourCount.textContent = materials.fourCount;
    el.stageSixCount.textContent = materials.sixCount;
    el.stageUnsharedWoodCount.textContent = materials.unsharedWoodCount;
    el.stageWoodSaved.textContent = materials.woodSaved;
  }
})();
