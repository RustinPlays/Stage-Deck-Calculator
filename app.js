(function initialiseApp() {
  'use strict';

  const Model = window.StageCalculatorModel;
  const STORAGE_KEY = 'stage-deck-calculator-v1';
  const THEME_STORAGE_KEY = 'stage-deck-calculator-theme';
  const ZOOM_STORAGE_KEY = 'stage-deck-calculator-zoom';
  const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const elementIds = [
    'stageGigName', 'stageAreaName',
    'lightThemeBtn', 'darkThemeBtn', 'saveStatus', 'materialsToggleBtn', 'materialsPopover', 'helpToggleBtn', 'helpPopover', 'helpCloseBtn',
    'stageContextMenu', 'stageSelectionControls', 'newBtn', 'importBtn', 'exportBtn', 'exportPngBtn', 'importFile', 'stageCopyBtn', 'stagePasteBtn', 'stageSnap', 'stageZoomOutBtn', 'stageZoomResetBtn', 'stageZoomInBtn', 'stageClearBtn',
    'stageGrid', 'stageSupportLayer', 'stageRotateLeftBtn', 'stageRotateRightBtn', 'stageSelectionHint', 'stageSnapLegend', 'stageDeckCount',
    'stageSelectionCount', 'stageDeleteSelectedBtn', 'stageDeckSizeControls', 'stageOverlapWarning',
    'stageLegCount', 'stageWoodCount', 'stage1200Row', 'stage1200Count', 'stage1800Row', 'stage1800Count',
    'stage2400Row', 'stage2400Count', 'stage1000x2000Row', 'stage1000x2000Count', 'stage2000x500Row', 'stage2000x500Count',
    'stageCarpetDimensions', 'stageCarpetArea',
    'stagePerimeter', 'stageSkirtCount', 'stageSkirtDetailCount',
    'stageSkirtBackOpen', 'stageSkirtCountLabel',
    'stageFourRow', 'stageFourCount', 'stageSixRow', 'stageSixCount',
    'toast'
  ];
  const el = Object.fromEntries(elementIds.map(id => [id, document.getElementById(id)]));

  let calculator = loadCalculator();
  let zoomLevel = loadZoom();
  let dragState = null;
  let panState = null;
  let rotationState = null;
  let marqueeState = null;
  let placementState = null;
  let suppressEdgeClickUntil = 0;
  let suppressAddClickUntil = 0;
  let wheelZoomAccumulator = 0;
  let contextMenuState = null;
  let copiedDecks = [];
  let addEdges = [];
  let toastTimer = null;

  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  bindEvents();
  render();

  function bindEvents() {
    ['stageGigName', 'stageAreaName'].forEach(id => {
      el[id].addEventListener('change', () => {
        calculator.gigName = el.stageGigName.value;
        calculator.areaName = el.stageAreaName.value;
        commit();
      });
    });
    el.lightThemeBtn.addEventListener('click', () => applyTheme('light'));
    el.darkThemeBtn.addEventListener('click', () => applyTheme('dark'));
    el.stageCopyBtn.addEventListener('click', copySelection);
    el.stagePasteBtn.addEventListener('click', pasteSelection);
    el.stageSnap.addEventListener('change', changeSnap);
    el.stageZoomOutBtn.addEventListener('click', () => changeZoom(-1));
    el.stageZoomResetBtn.addEventListener('click', () => setZoom(1));
    el.stageZoomInBtn.addEventListener('click', () => changeZoom(1));
    el.stageClearBtn.addEventListener('click', clearGrid);
    el.materialsToggleBtn.addEventListener('click', () => {
      const isOpen = el.materialsToggleBtn.getAttribute('aria-expanded') === 'true';
      el.materialsToggleBtn.setAttribute('aria-expanded', String(!isOpen));
      el.materialsPopover.hidden = isOpen;
    });
    el.helpToggleBtn.addEventListener('click', toggleHelpPopover);
    el.helpCloseBtn.addEventListener('click', closeHelpPopover);
    el.stageContextMenu.addEventListener('click', onStageContextMenuClick);
    document.addEventListener('pointerdown', event => {
      if (!el.materialsPopover.hidden
        && !el.materialsPopover.contains(event.target)
        && !el.materialsToggleBtn.contains(event.target)) closeMaterialsPopover();
      if (!el.helpPopover.hidden
        && !el.helpPopover.contains(event.target)
        && !el.helpToggleBtn.contains(event.target)) closeHelpPopover();
      if (!el.stageContextMenu.hidden && !el.stageContextMenu.contains(event.target)) closeStageContextMenu();
    });
    el.stageSkirtBackOpen.addEventListener('change', () => {
      calculator.skirtBackOpen = el.stageSkirtBackOpen.checked;
      commit();
    });
    el.stageGrid.addEventListener('click', onGridClick);
    el.stageGrid.addEventListener('pointerdown', onDeckPointerDown);
    el.stageGrid.addEventListener('keydown', onDeckKeyDown);
    const gridScroll = el.stageGrid.closest('.grid-scroll');
    gridScroll.addEventListener('wheel', onCanvasWheel, { passive: false });
    gridScroll.addEventListener('contextmenu', event => event.preventDefault());
    el.stageRotateLeftBtn.addEventListener('click', () => rotateSelectedDeck('left'));
    el.stageRotateRightBtn.addEventListener('click', () => rotateSelectedDeck('right'));
    el.stageDeleteSelectedBtn.addEventListener('click', deleteSelectedDecks);
    document.querySelectorAll('[data-selected-deck-type]').forEach(button => {
      button.addEventListener('click', () => changeSelectedDeckType(button.dataset.selectedDeckType));
    });
    document.querySelectorAll('[data-selected-deck-legs]').forEach(button => {
      button.addEventListener('click', () => setSelectedDeckLegs(Number(button.dataset.selectedDeckLegs)));
    });
    document.querySelectorAll('[data-stage-add-size]').forEach(button => {
      button.addEventListener('pointerdown', startDeckPlacement);
      button.addEventListener('click', event => {
        if (Date.now() < suppressAddClickUntil) {
          event.preventDefault();
          return;
        }
        addDeck(button.dataset.stageAddSize);
      });
    });
    window.addEventListener('pointermove', onDeckPointerMove);
    window.addEventListener('pointerup', endDeckDrag);
    window.addEventListener('pointercancel', endDeckDrag);
    window.addEventListener('dragstart', event => {
      if (event.target.closest('[data-stage-add-size]')) event.preventDefault();
    });
    window.addEventListener('resize', render);
    window.addEventListener('keydown', onWindowKeyDown);
    el.newBtn.addEventListener('click', newLayout);
    el.exportBtn.addEventListener('click', exportLayout);
    el.exportPngBtn.addEventListener('click', exportLayoutPng);
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
    return Model.clamp(availableWidth / Model.MIN_WIDTH_MM, 0.08, 0.13) * zoomLevel;
  }

  function getRenderedStageScale() {
    const gridStep = Number.parseFloat(el.stageGrid.style.getPropertyValue('--grid-step'));
    return gridStep / calculator.snapMm;
  }

  function loadZoom() {
    const saved = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return ZOOM_LEVELS.includes(saved) ? saved : 1;
  }

  function setZoom(nextZoom, anchor = null) {
    const gridScroll = anchor ? el.stageGrid.closest('.grid-scroll') : null;
    const previousMetrics = anchor ? Model.getCanvasMetrics(calculator) : null;
    const previousScale = anchor ? getRenderedStageScale() : null;
    const previousGridRect = anchor ? el.stageGrid.getBoundingClientRect() : null;
    const worldX = anchor
      ? (anchor.clientX - previousGridRect.left) / previousScale - previousMetrics.offsetX
      : null;
    const worldY = anchor
      ? (anchor.clientY - previousGridRect.top) / previousScale - previousMetrics.offsetY
      : null;
    zoomLevel = ZOOM_LEVELS.includes(nextZoom) ? nextZoom : 1;
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
    render();
    if (anchor) {
      const nextMetrics = Model.getCanvasMetrics(calculator);
      const nextGridRect = el.stageGrid.getBoundingClientRect();
      const contentOriginX = nextGridRect.left + gridScroll.scrollLeft;
      const contentOriginY = nextGridRect.top + gridScroll.scrollTop;
      const nextScale = getRenderedStageScale();
      gridScroll.scrollLeft = contentOriginX + (worldX + nextMetrics.offsetX) * nextScale - anchor.clientX;
      gridScroll.scrollTop = contentOriginY + (worldY + nextMetrics.offsetY) * nextScale - anchor.clientY;
    }
  }

  function changeZoom(direction) {
    const currentIndex = Math.max(0, ZOOM_LEVELS.indexOf(zoomLevel));
    const nextIndex = Model.clamp(currentIndex + direction, 0, ZOOM_LEVELS.length - 1);
    setZoom(ZOOM_LEVELS[nextIndex]);
  }

  function onCanvasWheel(event) {
    if (!event.deltaY) return;
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextIndex = Model.clamp(currentIndex + direction, 0, ZOOM_LEVELS.length - 1);
    if (nextIndex === currentIndex) {
      wheelZoomAccumulator = 0;
      return;
    }

    event.preventDefault();
    wheelZoomAccumulator += event.deltaY;
    if (Math.abs(wheelZoomAccumulator) < 60) return;
    const zoomDirection = wheelZoomAccumulator > 0 ? -1 : 1;
    wheelZoomAccumulator = 0;
    const targetIndex = Model.clamp(currentIndex + zoomDirection, 0, ZOOM_LEVELS.length - 1);
    setZoom(ZOOM_LEVELS[targetIndex], { clientX: event.clientX, clientY: event.clientY });
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


  function changeSnap() {
    calculator.snapMm = Model.normalizeSnap(el.stageSnap.value);
    commit();
  }

  function clearGrid() {
    calculator.decks = [];
    setSelectedDeckIds([]);
    commit();
  }

  function addDeck(sizeValue) {
    const type = Model.DECK_TYPES.find(option => option.id === sizeValue) || Model.DECK_TYPES[2];
    const { width, height } = type;
    const metrics = Model.getCanvasMetrics(calculator);
    let position = null;

    for (let y = 0; y <= metrics.height + 2400 && !position; y += calculator.snapMm) {
      for (let x = 0; x <= Math.max(metrics.width - width, 0); x += calculator.snapMm) {
        if (Model.positionAvailable(calculator, { x, y, width, height })) {
          position = { x, y };
          break;
        }
      }
    }

    addDeckAt(type, position?.x || 0, position?.y || 0);
  }

  function addDeckAt(type, x, y) {
    const deck = {
      id: Model.uid(),
      x,
      y,
      size: Math.max(type.width, type.height),
      type: type.id,
      width: type.width,
      height: type.height,
      legs: type.id === '1200x1200' ? 4 : 6
    };
    calculator.decks.push(deck);
    setSelectedDeckIds([deck.id]);
    commit();
  }

  function startDeckPlacement(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const type = Model.DECK_TYPES.find(option => option.id === event.currentTarget.dataset.stageAddSize);
    if (!type) return;
    placementState = {
      type,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function getPlacementCoordinates(state) {
    const gridBounds = el.stageGrid.getBoundingClientRect();
    const metrics = Model.getCanvasMetrics(calculator);
    const scale = getStageScale();
    return {
      gridBounds,
      scale,
      x: Model.snapCoordinate((state.clientX - gridBounds.left) / scale - metrics.offsetX - state.type.width / 2, calculator.snapMm),
      y: Model.snapCoordinate((state.clientY - gridBounds.top) / scale - metrics.offsetY - state.type.height / 2, calculator.snapMm)
    };
  }

  function getSelectedDeckIds() {
    return Array.isArray(calculator.selectedDeckIds)
      ? calculator.selectedDeckIds
      : calculator.selectedDeckId ? [calculator.selectedDeckId] : [];
  }

  function getSelectedDecks() {
    const selectedIds = new Set(getSelectedDeckIds());
    return calculator.decks.filter(deck => selectedIds.has(deck.id));
  }

  function setSelectedDeckIds(ids) {
    const availableIds = new Set(calculator.decks.map(deck => deck.id));
    calculator.selectedDeckIds = [...new Set(ids)].filter(id => availableIds.has(id));
    calculator.selectedDeckId = calculator.selectedDeckIds[0] || null;
  }

  function selectDeck(id, toggle = false) {
    const selected = new Set(getSelectedDeckIds());
    if (toggle) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      setSelectedDeckIds([...selected]);
    } else if (!selected.has(id)) {
      setSelectedDeckIds([id]);
    }
    render();
  }

  function changeSelectedDeckType(requestedType) {
    const selectedDecks = getSelectedDecks();
    if (!selectedDecks.length) return;
    const type = Model.DECK_TYPES.find(option => option.id === requestedType);
    if (!type) return;
    selectedDecks.forEach(deck => {
      const vertical = deck.height > deck.width;
      Object.assign(deck, {
        size: Math.max(type.width, type.height),
        type: type.id,
        width: vertical && type.width !== type.height ? type.height : type.width,
        height: vertical && type.width !== type.height ? type.width : type.height
      });
      if (type.id === '1200x1200') deck.legs = 4;
    });
    commit();
  }

  function setSelectedDeckLegs(legCount) {
    const selectedDecks = getSelectedDecks();
    if (!selectedDecks.length) return;
    selectedDecks.forEach(deck => {
      deck.legs = deck.type === '1200x1200' || Number(legCount) === 4 ? 4 : 6;
    });
    commit();
  }

  function rotateSelectedDeck(direction = 'right') {
    rotateDecks(direction, getSelectedDeckIds());
  }

  function rotateDecks(direction, ids) {
    const selectedIds = new Set(ids);
    const decks = calculator.decks.filter(deck => selectedIds.has(deck.id));
    if (!decks.length || !decks.some(deck => deck.width !== deck.height)) return;
    Model.rotateDecksAroundCenter(decks, direction === 'left' ? -1 : 1).forEach(candidate => {
      Object.assign(decks.find(deck => deck.id === candidate.id), candidate);
    });
    commit();
  }

  function removeDeck(id) {
    const index = calculator.decks.findIndex(deck => deck.id === id);
    if (index < 0) return;
    calculator.decks.splice(index, 1);
    setSelectedDeckIds(getSelectedDeckIds().filter(selectedId => selectedId !== id));
    commit();
  }

  function deleteSelectedDecks() {
    const selectedIds = new Set(getSelectedDeckIds());
    if (!selectedIds.size) return;
    calculator.decks = calculator.decks.filter(deck => !selectedIds.has(deck.id));
    setSelectedDeckIds([]);
    commit();
  }

  function copySelection() {
    copiedDecks = getSelectedDecks().map(deck => ({ ...deck }));
    if (copiedDecks.length) showToast(`${copiedDecks.length} deck(s) copied`);
    render();
  }

  function pasteSelection() {
    const pasted = Model.pasteDecks(calculator, copiedDecks);
    if (!pasted.length) return;
    calculator.decks.push(...pasted);
    setSelectedDeckIds(pasted.map(deck => deck.id));
    commit();
    showToast(`${pasted.length} deck(s) pasted`);
  }

  function openEdgeMenu(button) {
    const edge = addEdges[Number(button.dataset.edgeIndex)];
    if (!edge) return;
    const bounds = button.getBoundingClientRect();
    contextMenuState = { edge };
    el.stageContextMenu.innerHTML = '<div class="context-menu-title">Add deck beside this edge</div>' + Model.DECK_TYPES.map(type => {
      const available = Model.getAdjacentPlacement(calculator, edge, type);
      return `<button type="button" role="menuitem" data-context-action="add-edge" data-deck-type="${type.id}" ${available ? '' : 'disabled'}>${type.width} &times; ${type.height}${available ? '' : ' (no space)'}</button>`;
    }).join('');
    el.stageContextMenu.hidden = false;
    const menu = el.stageContextMenu.getBoundingClientRect();
    el.stageContextMenu.style.left = `${Model.clamp(bounds.left, 8, window.innerWidth - menu.width - 8)}px`;
    el.stageContextMenu.style.top = `${Model.clamp(bounds.bottom, 8, window.innerHeight - menu.height - 8)}px`;
    el.stageContextMenu.querySelector('button:not(:disabled)')?.focus();
  }

  function onGridClick(event) {
    const edgeButton = event.target.closest('[data-edge-index]');
    if (edgeButton) { openEdgeMenu(edgeButton); return; }
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
      deck.legs = deck.type === '1200x1200' || Number(button.dataset.legs) === 4 ? 4 : 6;
      setSelectedDeckIds([id]);
      commit();
      return;
    }
    if (button.dataset.stageAction === 'rotate-edge') {
      if (Date.now() < suppressEdgeClickUntil) return;
      if (!getSelectedDeckIds().includes(id)) setSelectedDeckIds([id]);
      rotateDecks('right', getSelectedDeckIds());
    }
  }

  function onDeckPointerDown(event) {
    if (event.target.closest('[data-edge-index]')) return;
    if (event.button === 2) {
      event.preventDefault();
      const gridScroll = el.stageGrid.closest('.grid-scroll');
      panState = {
        gridScroll,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: gridScroll.scrollLeft,
        scrollTop: gridScroll.scrollTop,
        targetDeckId: event.target.closest('.deck-slot[data-deck-id]')?.dataset.deckId || null,
        moved: false
      };
      el.stageGrid.setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const rotateHandle = event.target.closest('.rotate-edge-handle[data-deck-id]');
    if (rotateHandle) {
      event.preventDefault();
      const id = rotateHandle.dataset.deckId;
      if (!getSelectedDeckIds().includes(id)) setSelectedDeckIds([id]);
      const selectedDecks = getSelectedDecks();
      const gridBounds = el.stageGrid.getBoundingClientRect();
      const metrics = Model.getCanvasMetrics(calculator);
      const scale = getStageScale();
      const centerX = gridBounds.left + (
        (Math.min(...selectedDecks.map(deck => deck.x))
          + Math.max(...selectedDecks.map(deck => deck.x + deck.width))) / 2
        + metrics.offsetX
      ) * scale;
      const centerY = gridBounds.top + (
        (Math.min(...selectedDecks.map(deck => deck.y))
          + Math.max(...selectedDecks.map(deck => deck.y + deck.height))) / 2
        + metrics.offsetY
      ) * scale;
      rotationState = {
        ids: getSelectedDeckIds(),
        originalDecks: selectedDecks.map(deck => ({ ...deck })),
        centerX,
        centerY,
        previousAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        accumulatedAngle: 0,
        quarterTurns: 0,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
      el.stageGrid.setPointerCapture?.(event.pointerId);
      el.stageGrid.classList.add('rotating');
      return;
    }
    if (event.target.closest('button')) return;
    const deckElement = event.target.closest('.deck-slot[data-deck-id]');
    if (!deckElement) {
      if (event.target !== el.stageGrid) return;
      event.preventDefault();
      const gridBounds = el.stageGrid.getBoundingClientRect();
      marqueeState = {
        startX: event.clientX - gridBounds.left,
        startY: event.clientY - gridBounds.top,
        currentX: event.clientX - gridBounds.left,
        currentY: event.clientY - gridBounds.top,
        additive: event.ctrlKey || event.metaKey || event.shiftKey,
        baseIds: event.ctrlKey || event.metaKey || event.shiftKey ? getSelectedDeckIds() : [],
        moved: false
      };
      el.stageGrid.setPointerCapture?.(event.pointerId);
      render();
      return;
    }
    event.preventDefault();
    const deck = calculator.decks.find(item => item.id === deckElement.dataset.deckId);
    if (!deck) return;
    const selectedIds = getSelectedDeckIds();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      selectDeck(deck.id, true);
      return;
    }
    if (!selectedIds.includes(deck.id)) setSelectedDeckIds([deck.id]);
    const movingIds = getSelectedDeckIds();
    dragState = {
      ids: movingIds,
      positions: new Map(calculator.decks.filter(item => movingIds.includes(item.id))
        .map(item => [item.id, { x: item.x, y: item.y }])),
      scale: getStageScale(),
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false
    };
    el.stageGrid.setPointerCapture?.(event.pointerId);
    render();
  }

  function onDeckPointerMove(event) {
    if (panState) {
      event.preventDefault();
      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;
      panState.moved = panState.moved || Math.hypot(deltaX, deltaY) > 6;
      if (panState.moved) {
        panState.gridScroll.classList.add('panning');
        panState.gridScroll.scrollLeft = panState.scrollLeft - deltaX;
        panState.gridScroll.scrollTop = panState.scrollTop - deltaY;
      }
      return;
    }
    if (rotationState) {
      event.preventDefault();
      const angle = Math.atan2(
        event.clientY - rotationState.centerY,
        event.clientX - rotationState.centerX
      );
      let angleDelta = angle - rotationState.previousAngle;
      if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      else if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      rotationState.accumulatedAngle += angleDelta;
      rotationState.previousAngle = angle;
      rotationState.moved = rotationState.moved
        || Math.hypot(event.clientX - rotationState.startX, event.clientY - rotationState.startY) > 4;
      const quarterTurns = Math.round(rotationState.accumulatedAngle / (Math.PI / 2));
      if (quarterTurns !== rotationState.quarterTurns) {
        rotationState.quarterTurns = quarterTurns;
        Model.rotateDecksAroundCenter(rotationState.originalDecks, quarterTurns).forEach(candidate => {
          Object.assign(calculator.decks.find(deck => deck.id === candidate.id), candidate);
        });
        render();
      }
      return;
    }
    if (placementState) {
      event.preventDefault();
      placementState.clientX = event.clientX;
      placementState.clientY = event.clientY;
      placementState.moved = placementState.moved
        || Math.hypot(event.clientX - placementState.startX, event.clientY - placementState.startY) > 6;
      if (placementState.moved) render();
      return;
    }
    if (marqueeState) {
      event.preventDefault();
      const gridBounds = el.stageGrid.getBoundingClientRect();
      marqueeState.currentX = event.clientX - gridBounds.left;
      marqueeState.currentY = event.clientY - gridBounds.top;
      marqueeState.moved = marqueeState.moved
        || Math.abs(marqueeState.currentX - marqueeState.startX) > 4
        || Math.abs(marqueeState.currentY - marqueeState.startY) > 4;
      if (marqueeState.moved) {
        const bounds = getMarqueeBounds(marqueeState);
        const metrics = Model.getCanvasMetrics(calculator);
        const scale = getStageScale();
        const intersectingIds = calculator.decks.filter(deck => {
          const left = (deck.x + metrics.offsetX) * scale;
          const top = (deck.y + metrics.offsetY) * scale;
          const right = left + deck.width * scale;
          const bottom = top + deck.height * scale;
          return left < bounds.right && right > bounds.left && top < bounds.bottom && bottom > bounds.top;
        }).map(deck => deck.id);
        setSelectedDeckIds([...marqueeState.baseIds, ...intersectingIds]);
      }
      render();
      return;
    }
    if (!dragState) return;
    event.preventDefault();
    const deltaX = Model.snapCoordinate((event.clientX - dragState.startClientX) / dragState.scale, calculator.snapMm);
    const deltaY = Model.snapCoordinate((event.clientY - dragState.startClientY) / dragState.scale, calculator.snapMm);
    const candidates = dragState.ids.map(id => {
      const deck = calculator.decks.find(item => item.id === id);
      const position = dragState.positions.get(id);
      return deck ? { ...deck, x: position.x + deltaX, y: position.y + deltaY } : null;
    }).filter(Boolean);
    alignDraggedDecks(candidates, Math.min(100, 10 / dragState.scale));
    const stationary = calculator.decks.filter(deck => !dragState.ids.includes(deck.id));
    if (candidates.some(candidate => stationary.some(deck => Model.rectanglesOverlap(candidate, deck)))) return;
    const moved = candidates.some(candidate => {
      const position = dragState.positions.get(candidate.id);
      return candidate.x !== position.x || candidate.y !== position.y;
    });
    if (moved) {
      candidates.forEach(candidate => {
        const deck = calculator.decks.find(item => item.id === candidate.id);
        deck.x = candidate.x;
        deck.y = candidate.y;
      });
      dragState.moved = true;
      render();
    }
  }

  function endDeckDrag(event) {
    if (panState) {
      const { gridScroll, moved, targetDeckId } = panState;
      gridScroll.classList.remove('panning');
      panState = null;
      if (!moved && event.type === 'pointerup') {
        openStageContextMenu(event.clientX, event.clientY, targetDeckId);
      }
      return;
    }
    if (rotationState) {
      const { moved, originalDecks } = rotationState;
      if (event.type === 'pointercancel') {
        originalDecks.forEach(original => Object.assign(calculator.decks.find(deck => deck.id === original.id), original));
      }
      rotationState = null;
      el.stageGrid.classList.remove('rotating');
      if (moved) suppressEdgeClickUntil = Date.now() + 250;
      if (event.type !== 'pointercancel' && moved) saveCalculator();
      render();
    }
    if (placementState) {
      const placement = placementState;
      placementState = null;
      if (placement.moved) {
        const { gridBounds, x, y } = getPlacementCoordinates(placement);
        const insideGrid = placement.clientX >= gridBounds.left
          && placement.clientX <= gridBounds.right
          && placement.clientY >= gridBounds.top
          && placement.clientY <= gridBounds.bottom;
        if (insideGrid) {
          suppressAddClickUntil = Date.now() + 350;
          addDeckAt(placement.type, x, y);
        } else {
          render();
        }
      } else {
        render();
      }
      return;
    }
    if (marqueeState) {
      const moved = marqueeState.moved;
      marqueeState = null;
      if (!moved) setSelectedDeckIds([]);
      render();
      return;
    }
    if (!dragState) return;
    const moved = dragState.moved;
    dragState = null;
    if (moved) saveCalculator();
    render();
  }

  function getMarqueeBounds(state) {
    return {
      left: Math.min(state.startX, state.currentX),
      top: Math.min(state.startY, state.currentY),
      right: Math.max(state.startX, state.currentX),
      bottom: Math.max(state.startY, state.currentY)
    };
  }

  function buildSkirtZigzagPath(edges, scale, offsetX, offsetY) {
    if (!edges.length) return '';
    const paths = [];
    edges.forEach(edge => {
      const x1 = (edge.x1 + offsetX) * scale;
      const y1 = (edge.y1 + offsetY) * scale;
      const x2 = (edge.x2 + offsetX) * scale;
      const y2 = (edge.y2 + offsetY) * scale;
      const length = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.floor(length / 9));
      const points = [`M ${x1} ${y1}`];
      for (let step = 1; step < steps; step += 1) {
        const progress = step / steps;
        const wave = step % 2 ? 3 : -3;
        const x = x1 + (x2 - x1) * progress + (edge.orientation === 'vertical' ? wave : 0);
        const y = y1 + (y2 - y1) * progress + (edge.orientation === 'horizontal' ? wave : 0);
        points.push(`L ${x} ${y}`);
      }
      points.push(`L ${x2} ${y2}`);
      paths.push(points.join(' '));
    });
    return paths.join(' ');
  }

  function onDeckKeyDown(event) {
    const deckElement = event.target.closest('.deck-slot[data-deck-id]');
    if (!deckElement || event.target.closest('button')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDeck(deckElement.dataset.deckId, event.ctrlKey || event.metaKey || event.shiftKey);
    }
  }

  function onWindowKeyDown(event) {
    if (event.key === 'Escape' && !el.helpPopover.hidden) {
      closeHelpPopover();
      return;
    }
    if (event.key === 'Escape' && !el.stageContextMenu.hidden) {
      closeStageContextMenu();
      return;
    }
    if (event.key === 'Escape' && !el.materialsPopover.hidden) {
      closeMaterialsPopover();
      return;
    }
    if (event.target.matches('input, select, textarea')) return;
    if ((event.ctrlKey || event.metaKey) && ['c', 'v'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'c') copySelection();
      else pasteSelection();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelectedDeckIds(calculator.decks.map(deck => deck.id));
      render();
    } else if (event.key === 'Escape') {
      setSelectedDeckIds([]);
      render();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && getSelectedDeckIds().length) {
      event.preventDefault();
      deleteSelectedDecks();
    }
  }

  function newLayout() {
    calculator = Model.createDefaultCalculator();
    commit();
    showToast('Started a new 2 × 3 layout.');
  }

  function alignDraggedDecks(candidates, tolerance) {
    const stationary = calculator.decks.filter(deck => !dragState.ids.includes(deck.id));
    const corrections = { x: null, y: null };
    candidates.forEach(candidate => stationary.forEach(deck => {
      ['x', 'y'].forEach(axis => {
        const other = axis === 'x' ? 'y' : 'x';
        const size = axis === 'x' ? 'width' : 'height';
        const otherSize = axis === 'x' ? 'height' : 'width';
        if (candidate[other] > deck[other] + deck[otherSize] + tolerance
          || candidate[other] + candidate[otherSize] < deck[other] - tolerance) return;
        [deck[axis] - candidate[axis] - candidate[size],
          deck[axis] + deck[size] - candidate[axis],
          deck[axis] - candidate[axis],
          deck[axis] + deck[size] - candidate[axis] - candidate[size]].forEach(delta => {
          if (Math.abs(delta) <= tolerance && (corrections[axis] === null
            || Math.abs(delta) < Math.abs(corrections[axis]))) corrections[axis] = delta;
        });
      });
    }));
    candidates.forEach(deck => {
      deck.x += corrections.x || 0;
      deck.y += corrections.y || 0;
    });
  }

  function exportTitle() {
    return [calculator.gigName, calculator.areaName].filter(Boolean).join(' / ') || 'Stage Deck Layout';
  }

  function exportFilename(extension) {
    const name = exportTitle().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '');
    return `${name}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  }

  function exportLayout() {
    if (!confirmExportWithOverlaps()) return;
    const payload = {
      type: 'stage-deck-calculator',
      version: 1,
      exportedAt: new Date().toISOString(),
      calculator: { ...calculator, selectedDeckId: null, selectedDeckIds: [] }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, exportFilename('json'));
    showToast('Layout exported.');
  }

  function confirmExportWithOverlaps() {
    const overlapCount = Model.findOverlaps(calculator.decks).length;
    if (!overlapCount) return true;
    const noun = overlapCount === 1 ? 'overlap' : 'overlaps';
    return window.confirm(`There ${overlapCount === 1 ? 'is' : 'are'} ${overlapCount} ${noun} in this layout. Some decks may be clipping. Export anyway?`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportLayoutPng() {
    if (!confirmExportWithOverlaps()) return;
    const materials = Model.calculateMaterials(calculator);
    const metrics = Model.getCanvasMetrics(calculator);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const layout = { x: 72, y: 214, width: 1260, height: 780 };
    const summary = { x: 1380, y: 214, width: 468, height: 780 };
    const scale = Math.min((layout.width - 180) / metrics.width, (layout.height - 140) / metrics.height);
    const drawingWidth = metrics.width * scale;
    const drawingHeight = metrics.height * scale;
    const originX = layout.x + (layout.width - drawingWidth) / 2;
    const originY = layout.y + (layout.height - drawingHeight) / 2;

    canvas.width = 1920;
    canvas.height = 1080;
    context.fillStyle = '#eef5ff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0b2b50';
    context.font = '700 44px "Segoe UI", sans-serif';
    context.fillText(exportTitle(), 72, 82, 1450);
    context.fillStyle = '#55708f';
    context.font = '24px "Segoe UI", sans-serif';
    context.fillText(`${materials.deckCount} decks  ·  ${materials.legCount} legs  ·  ${materials.woodCount} wood`, 72, 126);
    context.textAlign = 'right';
    context.fillText(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 1848, 82);
    context.textAlign = 'left';

    drawRoundedRect(context, layout.x, layout.y, layout.width, layout.height, 24, '#ffffff', '#b8d3f0');
    drawRoundedRect(context, summary.x, summary.y, summary.width, summary.height, 24, '#ffffff', '#b8d3f0');

    const gridStep = calculator.snapMm * scale;
    context.save();
    if (gridStep >= 8) {
      context.strokeStyle = '#dbe9f8';
      context.lineWidth = 1;
      for (let x = 0; x <= metrics.width; x += calculator.snapMm) {
        context.beginPath();
        context.moveTo(originX + x * scale, originY);
        context.lineTo(originX + x * scale, originY + drawingHeight);
        context.stroke();
      }
      for (let y = 0; y <= metrics.height; y += calculator.snapMm) {
        context.beginPath();
        context.moveTo(originX, originY + y * scale);
        context.lineTo(originX + drawingWidth, originY + y * scale);
        context.stroke();
      }
    }

    calculator.decks.forEach(deck => {
      const x = originX + (deck.x + metrics.offsetX) * scale;
      const y = originY + (deck.y + metrics.offsetY) * scale;
      const width = deck.width * scale;
      const height = deck.height * scale;
      context.fillStyle = '#dcecff';
      context.strokeStyle = '#1674d1';
      context.lineWidth = 3;
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.fillStyle = '#0e4f90';
      context.font = `700 ${Math.max(14, Math.min(23, height * 0.18))}px "Segoe UI", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(`${deck.width} × ${deck.height}`, x + width / 2, y + height / 2 - 10);
      context.fillStyle = '#55708f';
      context.font = `600 ${Math.max(12, Math.min(18, height * 0.14))}px "Segoe UI", sans-serif`;
      context.fillText(`${deck.legs} legs`, x + width / 2, y + height / 2 + 18);
    });

    drawExportSkirtOutline(context, scale, originX, originY, metrics.offsetX, metrics.offsetY);

    materials.supports.forEach(support => {
      const x = originX + (support.x + metrics.offsetX) * scale;
      const y = originY + (support.y + metrics.offsetY) * scale;
      context.beginPath();
      context.arc(x, y, 10, 0, Math.PI * 2);
      context.fillStyle = support.blocks > 1 ? '#0756a1' : '#ffffff';
      context.fill();
      context.strokeStyle = '#0756a1';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = support.blocks > 1 ? '#ffffff' : '#0756a1';
      context.font = '700 12px "Segoe UI", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(support.legs), x, y + 1);
    });
    context.restore();

    drawExportDimensions(context, scale, originX, originY, metrics);
    drawExportSummary(context, summary, materials);
    context.textAlign = 'left';
    context.fillStyle = '#55708f';
    context.font = '600 24px "Segoe UI", sans-serif';
    context.fillText('Take extras just as spares.', 72, 1044);
    canvas.toBlob(blob => {
      if (!blob) {
        showToast('Could not create the PNG export.', true);
        return;
      }
      downloadBlob(blob, exportFilename('png'));
      showToast('Stage layout PNG exported.');
    }, 'image/png');
  }

  function drawRoundedRect(context, x, y, width, height, radius, fill, stroke) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }

  function getDimensionDrawing(scale, originX, originY, metrics) {
    if (!calculator.decks.length) return null;
    const dimensions = Model.getStageDimensions(calculator);
    const left = originX + (Math.min(...calculator.decks.map(deck => deck.x)) + metrics.offsetX) * scale;
    const top = originY + (Math.min(...calculator.decks.map(deck => deck.y)) + metrics.offsetY) * scale;
    const right = left + dimensions.widthMm * scale;
    const bottom = top + dimensions.heightMm * scale;
    const x = right + 32;
    const y = bottom + 32;
    return {
      path: `M ${left} ${bottom + 12} V ${y + 8} M ${right} ${bottom + 12} V ${y + 8} M ${left} ${y} H ${right} M ${right + 12} ${top} H ${x + 8} M ${right + 12} ${bottom} H ${x + 8} M ${x} ${top} V ${bottom}`,
      labels: [
        { x: (left + right) / 2, y: y + 20, text: `${formatMetres(dimensions.widthMm)} m`, rotate: false },
        { x: x + 20, y: (top + bottom) / 2, text: `${formatMetres(dimensions.heightMm)} m`, rotate: true }
      ]
    };
  }

  function drawExportDimensions(context, scale, originX, originY, metrics) {
    const drawing = getDimensionDrawing(scale, originX, originY, metrics);
    if (!drawing) return;
    context.save();
    context.strokeStyle = '#55708f';
    context.lineWidth = 2;
    context.stroke(new Path2D(drawing.path));
    context.font = '600 20px "Segoe UI", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    drawing.labels.forEach(label => {
      context.save();
      context.translate(label.x, label.y);
      if (label.rotate) context.rotate(-Math.PI / 2);
      const width = context.measureText(label.text).width + 12;
      context.fillStyle = '#ffffff';
      context.fillRect(-width / 2, -13, width, 26);
      context.fillStyle = '#0b2b50';
      context.fillText(label.text, 0, 0);
      context.restore();
    });
    context.restore();
  }

  function drawExportSummary(context, box, materials) {
    const left = box.x + 42;
    let y = box.y + 62;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#0b2b50';
    context.font = '700 30px "Segoe UI", sans-serif';
    context.fillText('Materials', left, y);

    [
      ['Decks', materials.deckCount],
      ['Legs', materials.legCount],
      ['Wood', materials.woodCount],
      ['Skirts', materials.skirtCount]
    ]
      .forEach(([label, value], index) => {
        const cardWidth = 88;
        const cardX = left + index * 96;
        const highlighted = index === 2;
        drawRoundedRect(context, cardX, y + 34, cardWidth, 104, 12, highlighted ? '#e1efff' : '#f5f9ff', '#c6dbf2');
        context.fillStyle = highlighted ? '#0756a1' : '#0b2b50';
        context.font = '700 31px "Segoe UI", sans-serif';
        context.textAlign = 'center';
        context.fillText(String(value), cardX + cardWidth / 2, y + 82);
        context.fillStyle = '#55708f';
        context.font = '700 12px "Segoe UI", sans-serif';
        context.fillText(label.toUpperCase(), cardX + cardWidth / 2, y + 112);
      });

    const rows = [
      ['1200 × 1200 decks', materials.typeCounts['1200x1200']],
      ['1800 × 1200 decks', materials.typeCounts['1800x1200']],
      ['2400 × 1200 decks', materials.typeCounts['2400x1200']],
      ['1000 × 2000 decks', materials.typeCounts['1000x2000']],
      ['2000 × 500 decks', materials.typeCounts['2000x500']]
    ].filter(([, count]) => count > 0);
    if (materials.fourCount > 0 && materials.sixCount > 0) {
      rows.push(['4-leg decks', materials.fourCount], ['6-leg decks', materials.sixCount]);
    }
    rows.unshift(
      ['Carpet size', `${formatMetres(materials.widthMm)} × ${formatMetres(materials.heightMm)} m`],
      ['Carpet area', `${formatSquareMetres(materials.areaSquareMetres)} m²`],
      ['Full perimeter', `${formatMetres(materials.perimeterMm)} m`],
      [calculator.skirtBackOpen ? 'Stage skirts (back open)' : 'Stage skirts (5 m)', materials.skirtCount]
    );
    y += 212;
    const rowGap = Math.min(42, Math.max(27, (box.y + box.height - y - 30) / Math.max(rows.length, 1)));
    rows.forEach(([label, value], index) => {
      context.textAlign = 'left';
      context.fillStyle = '#55708f';
      context.font = '17px "Segoe UI", sans-serif';
      context.fillText(label, left, y);
      context.textAlign = 'right';
      context.fillStyle = '#0b2b50';
      context.font = '700 20px "Segoe UI", sans-serif';
      context.fillText(String(value), box.x + box.width - 42, y);
      context.strokeStyle = '#e1ebf6';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y + 18);
      context.lineTo(box.x + box.width - 42, y + 18);
      context.stroke();
      y += rowGap;
    });
  }

  function drawExportSkirtOutline(context, scale, originX, originY, offsetX, offsetY) {
    const decks = calculator.decks;
    if (!decks.length) return;
    const edges = Model.getSkirtEdges(decks, calculator.skirtBackOpen === true);
    const drawLine = (strokeStyle, lineWidth) => {
      context.beginPath();
      edges.forEach(edge => {
        const x1 = originX + (edge.x1 + offsetX) * scale;
        const y1 = originY + (edge.y1 + offsetY) * scale;
        const x2 = originX + (edge.x2 + offsetX) * scale;
        const y2 = originY + (edge.y2 + offsetY) * scale;
        const length = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.floor(length / 10));
        context.moveTo(x1, y1);
        for (let step = 1; step < steps; step += 1) {
          const progress = step / steps;
          const wave = step % 2 ? 3 : -3;
          context.lineTo(
            x1 + (x2 - x1) * progress + (edge.orientation === 'vertical' ? wave : 0),
            y1 + (y2 - y1) * progress + (edge.orientation === 'horizontal' ? wave : 0)
          );
        }
        context.lineTo(x2, y2);
      });
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    };
    drawLine('#ffffff', 6);
    drawLine('#d9463e', 3);
    const cornerReturns = edges.filter(edge => edge.cornerReturn);
    if (cornerReturns.length) {
      context.fillStyle = '#b82f28';
      context.font = '700 14px "Segoe UI", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      cornerReturns.forEach(edge => {
        const x = originX + ((edge.x1 + edge.x2) / 2 + offsetX) * scale;
        const y = originY + (edge.y1 + offsetY) * scale - 6;
        context.fillText('300 mm', x, y);
      });
    }
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
    const selectedDecks = getSelectedDecks();
    const selectedIds = new Set(selectedDecks.map(deck => deck.id));
    const overlaps = Model.findOverlaps(calculator.decks);
    const metrics = Model.getCanvasMetrics(calculator);
    const scale = getStageScale();
    const gridWidth = metrics.width * scale + (calculator.decks.length ? 80 : 0);
    const gridHeight = metrics.height * scale + (calculator.decks.length ? 64 : 0);

    el.stageCopyBtn.disabled = !selectedDecks.length;
    el.stagePasteBtn.disabled = !copiedDecks.length;
    el.stageSnap.value = String(calculator.snapMm);
    el.stageGigName.value = calculator.gigName || '';
    el.stageAreaName.value = calculator.areaName || '';
    el.stageSnapLegend.textContent = `Drag decks to move them · snaps every ${calculator.snapMm} mm`;
    const zoomIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    el.stageZoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
    el.stageZoomOutBtn.disabled = zoomIndex <= 0;
    el.stageZoomInBtn.disabled = zoomIndex >= ZOOM_LEVELS.length - 1;
    el.stageGrid.style.width = `${gridWidth}px`;
    el.stageGrid.style.height = `${gridHeight}px`;
    el.stageGrid.style.setProperty('--grid-step', `${calculator.snapMm * scale}px`);
    const deckMarkup = calculator.decks.map((deck, index) => {
      const vertical = deck.height > deck.width;
      const orientation = deck.width === deck.height ? '' : vertical ? ' vertical' : ' horizontal';
      const selected = selectedIds.has(deck.id);
      const multiSelected = selected && selectedDecks.length > 1;
      const renderedShortSide = Math.min(deck.width, deck.height) * scale;
      const compact = renderedShortSide < 80;
      const tiny = renderedShortSide < 50;
      return `<div class="deck-slot${selected ? ' selected' : ''}${multiSelected ? ' multi-selected' : ''}${compact ? ' compact' : ''}${tiny ? ' tiny' : ''}" data-deck-id="${deck.id}" tabindex="0" role="group" aria-label="Deck ${index + 1}, ${deck.width} by ${deck.height} millimetres${orientation}${selected ? ', selected' : ''}" style="left:${(deck.x + metrics.offsetX) * scale}px;top:${(deck.y + metrics.offsetY) * scale}px;width:${deck.width * scale}px;height:${deck.height * scale}px">
        <span class="deck-label">${deck.width} × ${deck.height}</span>
        <button class="remove-deck" data-stage-action="remove" data-deck-id="${deck.id}" type="button" aria-label="Remove deck ${index + 1}">×</button>
        ${deck.width !== deck.height ? `<div class="rotate-edge-handles" aria-label="Rotate deck ${index + 1}">
          <button class="rotate-edge-handle top-left" data-stage-action="rotate-edge" data-deck-id="${deck.id}" type="button" title="Drag outside the corner to rotate around the selection center (90° steps); click to rotate right" aria-label="Rotate deck ${index + 1} around its center"></button>
          <button class="rotate-edge-handle top-right" data-stage-action="rotate-edge" data-deck-id="${deck.id}" type="button" title="Drag outside the corner to rotate around the selection center (90° steps); click to rotate right" aria-label="Rotate deck ${index + 1} around its center"></button>
          <button class="rotate-edge-handle bottom-right" data-stage-action="rotate-edge" data-deck-id="${deck.id}" type="button" title="Drag outside the corner to rotate around the selection center (90° steps); click to rotate right" aria-label="Rotate deck ${index + 1} around its center"></button>
          <button class="rotate-edge-handle bottom-left" data-stage-action="rotate-edge" data-deck-id="${deck.id}" type="button" title="Drag outside the corner to rotate around the selection center (90° steps); click to rotate right" aria-label="Rotate deck ${index + 1} around its center"></button>
        </div>` : ''}
        <div class="leg-toggle${deck.type === '1200x1200' ? ' square-only' : ''}" aria-label="Leg count for deck ${index + 1}">
          <button class="${deck.legs === 4 ? 'active' : ''}" data-stage-action="legs" data-deck-id="${deck.id}" data-legs="4" type="button" aria-pressed="${deck.legs === 4}">4</button>
          ${deck.type === '1200x1200' ? '' : `<button class="${deck.legs === 6 ? 'active' : ''}" data-stage-action="legs" data-deck-id="${deck.id}" data-legs="6" type="button" aria-pressed="${deck.legs === 6}">6</button>`}
        </div>
      </div>`;
    }).join('');
    const skirtEdges = Model.getSkirtEdges(calculator.decks, calculator.skirtBackOpen === true);
    const skirtPath = materials.skirtCount > 0
      ? buildSkirtZigzagPath(
        skirtEdges,
        scale,
        metrics.offsetX,
        metrics.offsetY
      )
      : '';
    const skirtReturnLabels = skirtEdges.filter(edge => edge.cornerReturn).map(edge => (
      `<text class="skirt-return-label" x="${((edge.x1 + edge.x2) / 2 + metrics.offsetX) * scale}" y="${(edge.y1 + metrics.offsetY) * scale - 5}" text-anchor="middle">300 mm</text>`
    )).join('');
    const skirtMarkup = skirtPath
      ? `<svg class="skirt-outline" width="${gridWidth}" height="${gridHeight}" viewBox="0 0 ${gridWidth} ${gridHeight}" aria-hidden="true"><path class="skirt-outline-halo" d="${skirtPath}"/><path class="skirt-outline-line" d="${skirtPath}"/>${skirtReturnLabels}</svg>`
      : '';
    const marqueeMarkup = marqueeState?.moved
      ? (() => {
        const bounds = getMarqueeBounds(marqueeState);
        return `<div class="selection-marquee" style="left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right - bounds.left}px;height:${bounds.bottom - bounds.top}px"></div>`;
      })()
      : '';
    const placementMarkup = placementState?.moved
      ? (() => {
        const position = getPlacementCoordinates(placementState);
        return `<div class="deck-slot placement-preview" style="left:${(position.x + metrics.offsetX) * scale}px;top:${(position.y + metrics.offsetY) * scale}px;width:${placementState.type.width * scale}px;height:${placementState.type.height * scale}px"><span class="deck-label">${placementState.type.width} × ${placementState.type.height}</span></div>`;
      })()
      : '';
    const dimensions = getDimensionDrawing(scale, 0, 0, metrics);
    const dimensionMarkup = dimensions
      ? `<svg class="stage-dimensions" width="${gridWidth}" height="${gridHeight}" aria-label="Overall stage dimensions"><path d="${dimensions.path}"/>${dimensions.labels.map(label => `<text x="${label.x}" y="${label.y}"${label.rotate ? ` transform="rotate(-90 ${label.x} ${label.y})"` : ''}>${label.text}</text>`).join('')}</svg>`
      : '';
    addEdges = Model.getDeckAddEdges(calculator.decks);
    const edgeMarkup = addEdges.map((edge, index) => `<button class="stage-add-edge ${edge.side}" data-edge-index="${index}" type="button" aria-label="Add deck at ${edge.side} exposed edge" aria-haspopup="menu" style="left:${(edge.x + metrics.offsetX) * scale}px;top:${(edge.y + metrics.offsetY) * scale}px">+</button>`).join('');
    el.stageGrid.innerHTML = `${edgeMarkup}${deckMarkup}${skirtMarkup}${dimensionMarkup}${marqueeMarkup}${placementMarkup}`;

    el.stageSupportLayer.style.width = `${gridWidth}px`;
    el.stageSupportLayer.style.height = `${gridHeight}px`;
    el.stageSupportLayer.innerHTML = materials.supports.map(support => {
      const title = `${support.legs} deck leg${support.legs === 1 ? '' : 's'} using ${support.blocks} wood support${support.blocks === 1 ? '' : 's'}`;
      return `<span class="support-point${support.blocks > 1 ? ' multiple' : ''}" style="left:${(support.x + metrics.offsetX) * scale}px;top:${(support.y + metrics.offsetY) * scale}px" title="${title}">${support.legs}</span>`;
    }).join('');

    const canRotateSelection = selectedDecks.some(deck => deck.width !== deck.height);
    el.stageRotateLeftBtn.disabled = !canRotateSelection;
    el.stageRotateRightBtn.disabled = !canRotateSelection;
    el.stageDeleteSelectedBtn.disabled = !selectedDecks.length;
    el.stageSelectionControls.hidden = selectedDecks.length === 0;
    el.stageDeckSizeControls.hidden = selectedDecks.length === 0;
    el.stageSelectionCount.textContent = `${selectedDecks.length} selected`;
    document.querySelectorAll('[data-selected-deck-type]').forEach(button => {
      const active = selectedDecks.length > 0 && selectedDecks.every(deck => button.dataset.selectedDeckType === deck.type);
      button.disabled = !selectedDecks.length;
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-selected-deck-legs]').forEach(button => {
      const active = selectedDecks.length > 0 && selectedDecks.every(deck => Number(button.dataset.selectedDeckLegs) === deck.legs);
      const isSixLegOption = Number(button.dataset.selectedDeckLegs) === 6;
      const onlyFixedFourLegDecks = selectedDecks.length > 0
        && selectedDecks.every(deck => deck.type === '1200x1200');
      button.disabled = !selectedDecks.length || (isSixLegOption && onlyFixedFourLegDecks);
      button.setAttribute('aria-pressed', String(active));
    });
    el.stageSelectionHint.textContent = selectedDecks.length
      ? `${selectedDecks.length} deck${selectedDecks.length === 1 ? '' : 's'} selected. Drag to move together; use the controls to edit.`
      : 'Drag on empty canvas to select; Ctrl/Cmd-click to add or remove decks.';
    el.stageOverlapWarning.hidden = overlaps.length === 0;
    el.stageOverlapWarning.textContent = overlaps.length
      ? `! ${overlaps.length} overlap${overlaps.length === 1 ? '' : 's'}`
      : '';
    el.stageOverlapWarning.title = overlaps.length
      ? `${overlaps.length} overlapping deck pair${overlaps.length === 1 ? '' : 's'}. Decks may be clipping.`
      : '';

    el.stageDeckCount.textContent = materials.deckCount;
    el.stageLegCount.textContent = materials.legCount;
    el.stageWoodCount.textContent = materials.woodCount;
    el.stage1200Count.textContent = materials.typeCounts['1200x1200'];
    el.stage1800Count.textContent = materials.typeCounts['1800x1200'];
    el.stage2400Count.textContent = materials.typeCounts['2400x1200'];
    el.stage1000x2000Count.textContent = materials.typeCounts['1000x2000'];
    el.stage2000x500Count.textContent = materials.typeCounts['2000x500'];
    el.stage1200Row.hidden = !materials.typeCounts['1200x1200'];
    el.stage1800Row.hidden = !materials.typeCounts['1800x1200'];
    el.stage2400Row.hidden = !materials.typeCounts['2400x1200'];
    el.stage1000x2000Row.hidden = !materials.typeCounts['1000x2000'];
    el.stage2000x500Row.hidden = !materials.typeCounts['2000x500'];
    el.stageCarpetDimensions.textContent = `${formatMetres(materials.widthMm)} × ${formatMetres(materials.heightMm)} m`;
    el.stageCarpetArea.textContent = `${formatSquareMetres(materials.areaSquareMetres)} m²`;
    el.stagePerimeter.textContent = `${formatMetres(materials.perimeterMm)} m`;
    el.stageSkirtCount.textContent = materials.skirtCount;
    el.stageSkirtDetailCount.textContent = materials.skirtCount;
    el.stageSkirtBackOpen.checked = calculator.skirtBackOpen === true;
    el.stageSkirtCountLabel.textContent = calculator.skirtBackOpen ? 'Stage skirts (back open)' : 'Stage skirts (5 m)';
    el.stageFourCount.textContent = materials.fourCount;
    el.stageSixCount.textContent = materials.sixCount;
    const hasMixedLegCounts = materials.fourCount > 0 && materials.sixCount > 0;
    el.stageFourRow.hidden = !hasMixedLegCounts;
    el.stageSixRow.hidden = !hasMixedLegCounts;
  }

  function formatMetres(millimetres) {
    return formatDecimal(millimetres / 1000);
  }

  function closeMaterialsPopover() {
    el.materialsPopover.hidden = true;
    el.materialsToggleBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleHelpPopover() {
    const isOpen = el.helpToggleBtn.getAttribute('aria-expanded') === 'true';
    el.helpToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    el.helpPopover.hidden = isOpen;
  }

  function closeHelpPopover() {
    el.helpPopover.hidden = true;
    el.helpToggleBtn.setAttribute('aria-expanded', 'false');
  }

  function closeStageContextMenu() {
    el.stageContextMenu.hidden = true;
    contextMenuState = null;
  }

  function openStageContextMenu(clientX, clientY, deckId) {
    if (deckId && !getSelectedDeckIds().includes(deckId)) setSelectedDeckIds([deckId]);
    if (deckId) render();
    else if (getSelectedDeckIds().length) {
      setSelectedDeckIds([]);
      render();
    }
    const selectedDecks = getSelectedDecks();
    const selectedIds = new Set(selectedDecks.map(deck => deck.id));
    const onlySquares = selectedDecks.length > 0
      && selectedDecks.every(deck => deck.type === '1200x1200');
    const selectedType = selectedDecks.length > 0 && selectedDecks.every(deck => deck.type === selectedDecks[0].type)
      ? selectedDecks[0].type
      : null;
    const selectedLegs = selectedDecks.length > 0 && selectedDecks.every(deck => deck.legs === selectedDecks[0].legs)
      ? selectedDecks[0].legs
      : null;
    const button = (action, label, extra = '', disabled = false, danger = false) => (
      `<button type="button" role="menuitem" data-context-action="${action}" ${extra} ${disabled ? 'disabled' : ''} class="${danger ? 'danger' : ''}">${label}</button>`
    );
    let markup;

    if (!selectedDecks.length) {
      markup = `<div class="context-menu-title">Add deck here</div>${Model.DECK_TYPES.map(type => (
        button('add', `${type.width} × ${type.height}`, `data-deck-type="${type.id}"`)
      )).join('')}`;
    } else {
      const title = `${selectedDecks.length} deck${selectedDecks.length === 1 ? '' : 's'} selected`;
      markup = `<div class="context-menu-title">${title}</div>
        ${button('rotate-left', 'Rotate left', '', !selectedDecks.some(deck => deck.width !== deck.height))}
        ${button('rotate-right', 'Rotate right', '', !selectedDecks.some(deck => deck.width !== deck.height))}
        <div class="context-menu-divider"></div>
        <div class="context-menu-title">Deck size</div>
        ${Model.DECK_TYPES.map(type => button(
          'size',
          `${type.width} × ${type.height}${selectedType === type.id ? ' · current' : ''}`,
          `data-deck-type="${type.id}"`
        )).join('')}
        <div class="context-menu-divider"></div>
        <div class="context-menu-title">Legs</div>
        ${button('legs', '4 legs', 'data-leg-count="4"', selectedLegs === 4)}
        ${button('legs', '6 legs', 'data-leg-count="6"', onlySquares || selectedLegs === 6)}
        <div class="context-menu-divider"></div>
        ${button('delete', 'Delete selected decks', '', false, true)}`;
    }

    contextMenuState = { clientX, clientY };
    el.stageContextMenu.innerHTML = markup;
    el.stageContextMenu.hidden = false;
    const menuBounds = el.stageContextMenu.getBoundingClientRect();
    el.stageContextMenu.style.left = `${Model.clamp(clientX, 8, window.innerWidth - menuBounds.width - 8)}px`;
    el.stageContextMenu.style.top = `${Model.clamp(clientY, 8, window.innerHeight - menuBounds.height - 8)}px`;
    el.stageContextMenu.querySelector('button:not(:disabled)')?.focus();
  }

  function onStageContextMenuClick(event) {
    const button = event.target.closest('button[data-context-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.contextAction;
    const selectedIds = getSelectedDeckIds();
    const menuPosition = contextMenuState;
    closeStageContextMenu();

    if (action === 'add-edge') {
      const type = Model.DECK_TYPES.find(item => item.id === button.dataset.deckType);
      const position = type && menuPosition?.edge && Model.getAdjacentPlacement(calculator, menuPosition.edge, type);
      if (position) addDeckAt(type, position.x, position.y);
      else showToast('There is no space for that deck here.', true);
    } else if (action === 'add') {
      const type = Model.DECK_TYPES.find(item => item.id === button.dataset.deckType);
      if (!type || !menuPosition) return;
      const position = getPlacementCoordinates({ ...menuPosition, type });
      addDeckAt(type, position.x, position.y);
    } else if (action === 'rotate-left' || action === 'rotate-right') {
      rotateDecks(action === 'rotate-left' ? 'left' : 'right', selectedIds);
    } else if (action === 'size') {
      changeSelectedDeckType(button.dataset.deckType);
    } else if (action === 'legs') {
      setSelectedDeckLegs(Number(button.dataset.legCount));
    } else if (action === 'delete') {
      deleteSelectedDecks();
    }
  }

  function formatSquareMetres(squareMetres) {
    return formatDecimal(squareMetres);
  }

  function formatDecimal(value) {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }
})();
