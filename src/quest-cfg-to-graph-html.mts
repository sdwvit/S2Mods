import "./ensure-env.mts";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaContext } from "./meta-type.mts";
import { baseCfgDir } from "./base-paths.mts";
import { buildQuestGraphData, type QuestGraphData } from "./quest/graph-data.mts";
import { resolveQuestNodesToJsInputPath } from "./quest/js-gen-utils.mts";

export async function questCfgToGraphHtml(inputPath: string, outputFilePath?: string) {
  const resolved = resolveQuestGraphInputPath(inputPath);
  const sourceFilePath = resolveGraphSourceFilePath(resolved.sourceFilePath);
  const fileContents = await readFile(sourceFilePath, "utf8");
  const array = Struct.fromString<QuestNodePrototype>(fileContents).map((s) => s.clone());
  const context: MetaContext<QuestNodePrototype> = {
    fileIndex: 0,
    index: 0,
    array,
    filePath: resolved.contextFilePath,
    fileName: path.parse(sourceFilePath).base,
    extraStructs: [],
    structsById: Object.fromEntries(array.map((s) => [s.__internal__.rawName, s])),
  };
  const graph = buildQuestGraphData(context, sourceFilePath);
  const finalOutputFilePath = outputFilePath || `${sourceFilePath}.graph.html`;
  await writeFile(finalOutputFilePath, renderQuestGraphHtml(graph), "utf8");
  return { outputFilePath: finalOutputFilePath, sourceFilePath, graph };
}

export function resolveQuestGraphInputPath(inputPath: string) {
  const trimmed = inputPath.trim();
  if (existsSync(trimmed)) {
    const normalized = trimmed.replaceAll("\\", "/");
    const gameDataIndex = normalized.indexOf("/GameData/");
    const contextFilePath =
      gameDataIndex >= 0 ? `/${normalized.slice(gameDataIndex + "/GameData/".length)}` : trimmed;
    return {
      contextFilePath,
      sourceFilePath: trimmed,
      outputFilePath: `${trimmed}.graph.html`,
    };
  }
  return resolveQuestNodesToJsInputPath(trimmed, baseCfgDir);
}

export function resolveGraphSourceFilePath(sourceFilePath: string) {
  const normalized = sourceFilePath.replaceAll("\\", "/");
  const marker = "/GameData/QuestNodePrototypes/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0 || !normalized.includes("_patch_")) {
    return sourceFilePath;
  }

  const relativeQuestPath = normalized.slice(markerIndex + "/GameData/".length);
  const parsed = path.posix.parse(relativeQuestPath);
  const baseName = parsed.base.replace(/_patch_[^.]+(?=\.cfg$)/, "");
  if (baseName === parsed.base) {
    return sourceFilePath;
  }

  const candidate = path.join(baseCfgDir, "GameData", parsed.dir, baseName);
  return existsSync(candidate) ? candidate : sourceFilePath;
}

export function renderQuestGraphHtml(graph: QuestGraphData) {
  const payload = safeJson(graph);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(graph.title)} quest graph</title>
  <style>
    :root {
      --sidebar-width: 340px;
      --resize-handle: rgba(62, 44, 28, 0.12);
      --resize-handle-active: rgba(184, 92, 25, 0.34);
      --bg: #f4efe4;
      --panel: rgba(255, 250, 240, 0.94);
      --panel-border: rgba(62, 44, 28, 0.18);
      --ink: #24170f;
      --muted: #6d5a49;
      --accent: #b85c19;
      --accent-2: #d9a441;
      --edge: #9b8b7d;
      --node: #d7c2a3;
      --event: #d86c2f;
      --terminal: #5e8a4a;
      --start: #a52619;
      --shadow: 0 18px 42px rgba(36, 23, 15, 0.14);
      --node-fill: #d7c2a3;
      --node-border: #5f4634;
      --node-text: #24170f;
      --event-fill: #d86c2f;
      --start-fill: #a52619;
      --terminal-border: #3f642f;
      --edge-line: #9b8b7d;
      --edge-text: #5d4d40;
      --edge-text-bg: rgba(255, 250, 240, 0.82);
      --highlight: #b85c19;
      --selection: #1f6fd1;
      --card-bg: rgba(255, 255, 255, 0.55);
      --control-bg: rgba(255, 255, 255, 0.78);
      --control-bg-hover: rgba(255, 255, 255, 0.94);
      --control-border: rgba(62, 44, 28, 0.22);
      --toolbar-button-bg: rgba(255, 250, 240, 0.9);
      --detail-bg: rgba(255, 255, 255, 0.56);
      --detail-border: rgba(62, 44, 28, 0.08);
      --section-divider: rgba(62, 44, 28, 0.1);
      --swatch-border: rgba(36, 23, 15, 0.15);
      --error: #8d1717;
    }

    body.dark {
      --bg: #151313;
      --panel: rgba(28, 25, 23, 0.94);
      --panel-border: rgba(214, 195, 168, 0.16);
      --ink: #f2e7d3;
      --muted: #c3b299;
      --accent: #e08a3a;
      --accent-2: #d2b36e;
      --edge: #8f7c67;
      --node: #4e4337;
      --event: #b7472b;
      --terminal: #6f9860;
      --start: #c94732;
      --shadow: 0 24px 48px rgba(0, 0, 0, 0.34);
      --resize-handle: rgba(214, 195, 168, 0.14);
      --resize-handle-active: rgba(224, 138, 58, 0.38);
      --node-fill: #4e4337;
      --node-border: #bfa88d;
      --node-text: #f6ead8;
      --event-fill: #b7472b;
      --start-fill: #c94732;
      --terminal-border: #8fbb7a;
      --edge-line: #7e6c59;
      --edge-text: #d6c4ab;
      --edge-text-bg: rgba(28, 25, 23, 0.84);
      --highlight: #f0a24f;
      --selection: #66b3ff;
      --card-bg: rgba(49, 42, 37, 0.66);
      --control-bg: rgba(42, 36, 32, 0.88);
      --control-bg-hover: rgba(56, 48, 43, 0.96);
      --control-border: rgba(214, 195, 168, 0.18);
      --toolbar-button-bg: rgba(38, 33, 29, 0.94);
      --detail-bg: rgba(47, 40, 35, 0.72);
      --detail-border: rgba(214, 195, 168, 0.1);
      --section-divider: rgba(214, 195, 168, 0.12);
      --swatch-border: rgba(242, 231, 211, 0.18);
      --error: #ff8d78;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(217, 164, 65, 0.35), transparent 28%),
        radial-gradient(circle at bottom right, rgba(184, 92, 25, 0.28), transparent 24%),
        linear-gradient(135deg, #efe3c9 0%, #f8f2e6 46%, #e6d7b8 100%);
    }

    body.dark {
      background:
        radial-gradient(circle at top left, rgba(224, 138, 58, 0.14), transparent 28%),
        radial-gradient(circle at bottom right, rgba(183, 71, 43, 0.16), transparent 24%),
        linear-gradient(135deg, #181513 0%, #211c18 46%, #120f0d 100%);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(260px, var(--sidebar-width)) 12px minmax(0, 1fr);
      height: 100%;
      gap: 16px;
      padding: 16px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .sidebar-resizer {
      position: relative;
      cursor: col-resize;
      border-radius: 999px;
      background: transparent;
      touch-action: none;
      user-select: none;
    }

    .sidebar-resizer::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(180deg, transparent 0%, var(--resize-handle) 12%, var(--resize-handle) 88%, transparent 100%);
      transition: background 120ms ease;
    }

    .sidebar-resizer:hover::before,
    body.is-resizing .sidebar-resizer::before {
      background: linear-gradient(180deg, transparent 0%, var(--resize-handle-active) 12%, var(--resize-handle-active) 88%, transparent 100%);
    }

    .section {
      padding: 18px 18px 0;
    }

    h1, h2, h3, p { margin: 0; }
    h1 {
      font-family: "IBM Plex Serif", Georgia, serif;
      font-size: 1.35rem;
      line-height: 1.2;
      margin-bottom: 6px;
    }

    .meta, .hint {
      color: var(--muted);
      font-size: 0.92rem;
    }

    .meta {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .hint-list {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 0.92rem;
      display: grid;
      gap: 6px;
    }

    .keycap {
      color: var(--ink);
      background: var(--control-bg);
      border: 1px solid var(--control-border);
      border-radius: 6px;
      padding: 2px 7px;
      font-size: 0.86em;
      font-weight: 600;
      box-shadow: inset 0 -1px 0 var(--panel-border);
      white-space: nowrap;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .stat {
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 12px;
      background: var(--card-bg);
    }

    .stat strong {
      display: block;
      font-size: 1.1rem;
      margin-top: 2px;
    }

    .controls {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }

    input, select, button {
      width: 100%;
      border: 1px solid var(--control-border);
      border-radius: 12px;
      background: var(--control-bg);
      color: var(--ink);
      padding: 11px 12px;
      font: inherit;
    }

    button {
      cursor: pointer;
      font-weight: 600;
      transition: transform 120ms ease, background 120ms ease;
    }

    button:hover {
      transform: translateY(-1px);
      background: var(--control-bg-hover);
    }

    button:disabled {
      cursor: default;
      opacity: 0.45;
      background: var(--card-bg);
      color: var(--muted);
      border-color: var(--panel-border);
      transform: none;
      box-shadow: none;
    }

    button:disabled:hover {
      background: var(--card-bg);
      transform: none;
    }

    .legend {
      display: grid;
      gap: 8px;
      margin-top: 14px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--section-divider);
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .legend-filter {
      width: 100%;
      justify-content: flex-start;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      box-shadow: none;
      color: var(--muted);
      font-size: 0.92rem;
      font-weight: 500;
      transform: none;
    }

    .legend-filter:hover {
      background: var(--control-bg-hover);
      transform: none;
    }

    .legend-filter.is-active {
      background: var(--control-bg-hover);
      border-color: var(--panel-border);
      color: var(--text);
    }

    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid var(--swatch-border);
    }

    .details {
      min-height: 0;
      overflow: auto;
      padding: 18px;
    }

    .detail-card {
      display: grid;
      gap: 10px;
    }

    .detail-grid {
      display: grid;
      gap: 8px;
    }

    .detail-row {
      display: grid;
      gap: 3px;
      padding: 9px 10px;
      border-radius: 12px;
      background: var(--detail-bg);
      border: 1px solid var(--detail-border);
    }

    .detail-row strong {
      font-size: 0.83rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .detail-card h2,
    .detail-card p,
    .detail-row span {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .canvas {
      position: relative;
      min-width: 0;
      overflow: hidden;
    }

    #cy {
      width: 100%;
      height: 100%;
    }

    .toolbar {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 2;
    }

    .toolbar button {
      width: auto;
      min-width: 110px;
      background: var(--toolbar-button-bg);
    }

    .error {
      padding: 18px;
      color: var(--error);
      font-weight: 600;
    }

    @media (max-width: 960px) {
      .layout {
        grid-template-columns: 1fr;
        grid-template-rows: auto minmax(420px, 1fr);
      }
      .sidebar-resizer {
        display: none;
      }
      .sidebar {
        max-height: 48vh;
      }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="panel sidebar">
      <div class="section">
        <h1 id="graphTitle">${escapeHtml(graph.title)}</h1>
        <p class="meta" id="graphSource">${escapeHtml(graph.sourceFilePath)}</p>
        <div class="stats">
          <div class="stat">Nodes<strong id="nodeCount">${graph.nodeCount}</strong></div>
          <div class="stat">Edges<strong id="edgeCount">${graph.edgeCount}</strong></div>
        </div>
        <div class="controls">
          <button id="openCfgButton" type="button">Open CFG</button>
          <input id="openCfgInput" type="file" accept=".cfg,text/plain" hidden>
          <input id="search" type="search" placeholder="Search SID or JS name">
          <select id="nodeTypeFilter">
            <option value="">All node types</option>
          </select>
          <button id="fitButton" type="button">Zoom all way out</button>
        </div>
        <div class="legend">
          <button class="legend-row legend-filter" data-legend-filter="regular" type="button"><span class="swatch" style="background: var(--node)"></span>Regular node</button>
          <button class="legend-row legend-filter" data-legend-filter="eventOrStart" type="button"><span class="swatch" style="background: linear-gradient(90deg, var(--event) 0 50%, var(--start) 50% 100%)"></span>Event / trigger or launch on quest start</button>
          <button class="legend-row legend-filter" data-legend-filter="singleConnection" type="button"><span class="swatch" style="background: var(--node); border-style: dashed"></span>Single connection</button>
          <button class="legend-row legend-filter" data-legend-filter="terminal" type="button"><span class="swatch" style="background: var(--terminal)"></span>Terminal / no outgoing edges</button>
        </div>
      </div>
      <div class="details" id="details">
        <div id="detailsContent">
          <p class="hint">Select a node to inspect its fields and connected edges.</p>
        </div>
        <ul class="hint-list">
          <li>Drag: box-select nodes</li>
          <li><span class="keycap">Ctrl</span>/<span class="keycap">Shift</span> + drag: pan canvas</li>
          <li>Middle click + drag: pan canvas</li>
          <li>Drag: move one node</li>
          <li><span class="keycap">Alt</span> + drag: move highlighted nodes</li>
          <li><span class="keycap">Row</span>/<span class="keycap">Column</span>: click again to best-effort sort by arrow direction</li>
          <li><span class="keycap">Undo</span>/<span class="keycap">Redo</span> buttons or <span class="keycap">Ctrl/Cmd+Z</span>, <span class="keycap">Ctrl/Cmd+Shift+Z</span>, <span class="keycap">Ctrl/Cmd+Y</span>: history</li>
        </ul>
      </div>
    </aside>
    <div
      class="sidebar-resizer"
      id="sidebarResizer"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
    ></div>
    <main class="panel canvas">
      <div class="toolbar">
        <button id="themeButton" type="button">Dark mode</button>
        <button id="arrangeRowButton" type="button" disabled>Row</button>
        <button id="arrangeColumnButton" type="button" disabled>Column</button>
        <button id="snapGridButton" type="button" disabled>Snap to grid</button>
        <button id="undoButton" type="button" disabled>Undo</button>
        <button id="redoButton" type="button" disabled>Redo</button>
        <button id="layoutButton" type="button">Reset layout</button>
      </div>
      <div id="cy"></div>
    </main>
  </div>
  <script src="https://unpkg.com/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
  <script>
    const initialGraph = ${payload};
    let graph = cloneGraph(initialGraph);
    let currentGraphIdentity = createGraphIdentityFromGraph(graph);
    const detailsEl = document.getElementById('detailsContent');
    const titleEl = document.getElementById('graphTitle');
    const sourceEl = document.getElementById('graphSource');
    const nodeCountEl = document.getElementById('nodeCount');
    const edgeCountEl = document.getElementById('edgeCount');
    const openCfgButton = document.getElementById('openCfgButton');
    const openCfgInput = document.getElementById('openCfgInput');
    const searchEl = document.getElementById('search');
    const nodeTypeFilterEl = document.getElementById('nodeTypeFilter');
    const legendFilterEls = Array.from(document.querySelectorAll('[data-legend-filter]'));
    const fitButton = document.getElementById('fitButton');
    const layoutButton = document.getElementById('layoutButton');
    const arrangeRowButton = document.getElementById('arrangeRowButton');
    const arrangeColumnButton = document.getElementById('arrangeColumnButton');
    const snapGridButton = document.getElementById('snapGridButton');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const themeButton = document.getElementById('themeButton');
    const sidebarResizer = document.getElementById('sidebarResizer');
    const themeStorageKey = 'quest-graph-theme';
    const layoutStoragePrefix = 'quest-graph-layout:v3:';
    const sidebarWidthStorageKey = 'quest-graph-sidebar-width:v1';
    const maxUndoStates = 30;
    let saveLayoutTimer = null;
    let resizeFrame = null;
    let restoredViewport = null;
    let activeDragGroup = null;
    let isAltPressed = false;
    let isPanModifierPressed = false;
    let activeLegendFilter = '';
    let lastArrangeAction = null;
    let middlePanState = null;
    let previousFilteredNodeIds = [];
    const undoStack = [];
    const redoStack = [];

    if (!window.cytoscape) {
      detailsEl.innerHTML = '<div class="error">Failed to load Cytoscape.js from CDN.</div>';
      throw new Error('Cytoscape.js failed to load');
    }

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: buildCyElements(graph),
      wheelSensitivity: 0.22,
      boxSelectionEnabled: true,
      userPanningEnabled: false,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(nodeFill)',
            'border-width': 2,
            'border-color': 'data(nodeBorder)',
            'label': 'data(label)',
            'font-size': 11,
            'font-family': 'IBM Plex Sans, Segoe UI, sans-serif',
            'color': 'data(nodeText)',
            'text-wrap': 'wrap',
            'text-max-width': 148,
            'text-valign': 'center',
            'text-halign': 'center',
            'line-height': 1.05,
            'padding': '8px 6px',
            'shape': 'round-rectangle',
            'width': 164,
            'height': 'label',
            'min-height': 54,
          },
        },
        {
          selector: 'node.is-event',
          style: {
            'background-color': 'data(eventFill)',
            'color': 'data(inverseText)',
          },
        },
        {
          selector: 'node.is-start',
          style: {
            'background-color': 'data(startFill)',
            'color': 'data(inverseText)',
          },
        },
        {
          selector: 'node.is-terminal',
          style: {
            'border-color': 'data(terminalBorder)',
            'border-style': 'dashed',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 5,
            'border-color': 'data(selection)',
            'underlay-color': 'data(selection)',
            'underlay-opacity': 0.28,
            'underlay-padding': 6,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'data(edgeLine)',
            'line-color': 'data(edgeLine)',
            'width': 2,
            'label': 'data(showLabel)',
            'font-size': 9,
            'text-background-color': 'data(edgeTextBg)',
            'text-background-opacity': 1,
            'text-background-padding': 2,
            'text-rotation': 'autorotate',
            'color': 'data(edgeText)',
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.14,
          },
        },
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'border-width': 4,
            'line-color': 'data(highlight)',
            'target-arrow-color': 'data(highlight)',
          },
        },
      ],
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Alt') {
        isAltPressed = true;
      }
      if (event.key === 'Shift' || event.key === 'Control') {
        isPanModifierPressed = true;
        updateInteractionMode();
      }
    });
    window.addEventListener('keyup', (event) => {
      if (event.key === 'Alt') {
        isAltPressed = false;
      }
      if (event.key === 'Shift' || event.key === 'Control') {
        isPanModifierPressed = event.shiftKey || event.ctrlKey;
        updateInteractionMode();
      }
    });
    window.addEventListener('blur', () => {
      isAltPressed = false;
      isPanModifierPressed = false;
      updateInteractionMode();
      stopMiddleMousePan();
    });
    window.addEventListener('keydown', (event) => {
      const isPrimaryModifier = event.ctrlKey || event.metaKey;
      if (!isPrimaryModifier) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        redoGraphState();
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        undoGraphState();
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        redoGraphState();
      }
    });

    initializeTheme();
    initializeSidebarWidth();
    updateGraphSummary();
    populateNodeTypeFilter();

    cy.on('tap', 'node', (event) => {
      const node = event.target;
      renderDetails(node);
      highlightNeighborhood(node);
    });
    cy.on('grab', 'node', (event) => {
      pushUndoState();
      beginGroupDrag(event.target);
    });
    cy.on('drag', 'node', (event) => updateGroupDrag(event.target));
    cy.on('dragfree', 'node', () => {
      finishGroupDrag();
      scheduleSaveLayout();
    });
    cy.on('select unselect', updateSelectionActionButtons);
    cy.on('zoom pan', () => scheduleSaveLayout());
    cy.on('tap', (event) => {
      if (event.target === cy) {
        clearSelection();
      }
    });

    searchEl.addEventListener('input', applyFilters);
    nodeTypeFilterEl.addEventListener('change', applyFilters);
    legendFilterEls.forEach((legendFilterEl) => {
      legendFilterEl.addEventListener('click', () => {
        const nextFilter = legendFilterEl.dataset.legendFilter || '';
        activeLegendFilter = activeLegendFilter === nextFilter ? '' : nextFilter;
        updateLegendFilterUi();
        applyFilters();
      });
    });
    openCfgButton.addEventListener('click', () => openCfgInput.click());
    openCfgInput.addEventListener('change', async (event) => {
      const input = event.target;
      const file = input.files && input.files[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const nextGraph = parseQuestCfgTextToGraph(text, file.name || 'Uploaded.cfg');
        loadGraph(nextGraph, createGraphIdentityFromCfgText(text, file.name || nextGraph.title));
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        detailsEl.innerHTML = '<div class="error">Failed to open CFG: ' + escapeHtml(message) + '</div>';
      } finally {
        input.value = '';
      }
    });
    fitButton.addEventListener('click', () => {
      cy.fit(cy.nodes(':visible'), 80);
      scheduleSaveLayout();
    });
    layoutButton.addEventListener('click', () => {
      pushUndoState();
      runActiveLayout();
    });
    arrangeRowButton.addEventListener('click', () => arrangeSelectedNodes('row'));
    arrangeColumnButton.addEventListener('click', () => arrangeSelectedNodes('column'));
    snapGridButton.addEventListener('click', snapArrangableNodesToGrid);
    undoButton.addEventListener('click', undoGraphState);
    redoButton.addEventListener('click', redoGraphState);
    themeButton.addEventListener('click', toggleTheme);
    initializeSidebarResizer();
    initializeMiddleMousePan();
    initializeWheelZoom();

    updateInteractionMode();
    updateLegendFilterUi();
    updateSelectionActionButtons();
    applyFilters();
    cy.ready(() => {
      initializeGraphView();
    });

    function getLayout() {
      if (graph.nodeCount > 120) {
        return {
          name: 'cose',
          animate: false,
          padding: 120,
          nodeDimensionsIncludeLabels: true,
          componentSpacing: 220,
          nodeOverlap: 40,
          nodeRepulsion: 320000,
          idealEdgeLength: 240,
          edgeElasticity: 120,
          nestingFactor: 0.9,
          gravity: 28,
          numIter: 2200,
          initialTemp: 180,
          coolingFactor: 0.92,
          minTemp: 1,
        };
      }
      return {
        name: 'breadthfirst',
        directed: true,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true,
        padding: 120,
        spacingFactor: 2.8,
        animate: false,
      };
    }

    function applyFilters() {
      const search = searchEl.value.trim().toLowerCase();
      const nodeType = nodeTypeFilterEl.value;
      const visibleNodeIds = [];
      cy.batch(() => {
        cy.elements().removeClass('faded');
        cy.nodes().forEach((node) => {
          const matchesSearch =
            !search ||
            node.data('id').toLowerCase().includes(search) ||
            node.data('sid').toLowerCase().includes(search) ||
            String(node.data('subtitle') || '').toLowerCase().includes(search);
          const matchesType = !nodeType || node.data('nodeType') === nodeType;
          const matchesLegend = matchesLegendFilter(node);
          const visible = matchesSearch && matchesType && matchesLegend;
          if (visible) {
            visibleNodeIds.push(node.id());
          }
          node.style('display', visible ? 'element' : 'none');
        });
        cy.edges().forEach((edge) => {
          const visible = edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none';
          edge.style('display', visible ? 'element' : 'none');
        });
      });
      if (hasFilteredSelectionChanged(visibleNodeIds)) {
        clearSelection();
      }
      previousFilteredNodeIds = visibleNodeIds.sort();
      updateSelectionActionButtons();
    }

    function matchesLegendFilter(node) {
      if (!activeLegendFilter) {
        return true;
      }
      if (activeLegendFilter === 'eventOrStart') {
        return node.hasClass('is-event') || Boolean(node.data('isStart'));
      }
      if (activeLegendFilter === 'singleConnection') {
        return Number(node.data('connectionCount') || 0) === 1;
      }
      if (activeLegendFilter === 'terminal') {
        return Boolean(node.data('isTerminal'));
      }
      if (activeLegendFilter === 'regular') {
        return !node.hasClass('is-event') && !node.data('isStart') && !node.data('isTerminal');
      }
      return true;
    }

    function updateLegendFilterUi() {
      legendFilterEls.forEach((legendFilterEl) => {
        const isActive = (legendFilterEl.dataset.legendFilter || '') === activeLegendFilter;
        legendFilterEl.classList.toggle('is-active', isActive);
        legendFilterEl.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    function updateSelectionActionButtons() {
      const enabled = getArrangableNodes().length >= 2;
      arrangeRowButton.disabled = !enabled;
      arrangeColumnButton.disabled = !enabled;
      snapGridButton.disabled = !enabled;
    }

    function arrangeSelectedNodes(direction) {
      const selectedNodes = getArrangableNodes();
      if (selectedNodes.length < 2) {
        updateSelectionActionButtons();
        return;
      }
      pushUndoState();
      const spacing = 36;
      const axis = direction === 'column' ? 'y' : 'x';
      const crossAxis = axis === 'x' ? 'y' : 'x';
      const nodeIds = selectedNodes.map((node) => node.id()).sort();
      const useDirectedOrder =
        lastArrangeAction &&
        lastArrangeAction.kind === 'line' &&
        lastArrangeAction.direction === direction &&
        JSON.stringify(lastArrangeAction.nodeIds) === JSON.stringify(nodeIds);
      let metrics = selectedNodes
        .map((node) => {
          const box = node.boundingBox({ includeLabels: true, includeOverlays: false });
          return {
            node,
            width: Math.max(1, box.w),
            height: Math.max(1, box.h),
            position: node.position(),
          };
        })
        .sort((a, b) => a.position[axis] - b.position[axis]);
      if (useDirectedOrder) {
        metrics = orderMetricsByEdgeDirection(metrics, axis, crossAxis);
      }
      const totalPrimarySize = metrics.reduce((sum, metric) => sum + (axis === 'x' ? metric.width : metric.height), 0);
      const totalSpacing = spacing * (metrics.length - 1);
      const anchorMetric = metrics.reduce((best, metric) => {
        if (!best) {
          return metric;
        }
        if (metric.position.y < best.position.y || (metric.position.y === best.position.y && metric.position.x < best.position.x)) {
          return metric;
        }
        return best;
      }, null);
      const anchorPosition = anchorMetric ? anchorMetric.position : metrics[0].position;
      let cursor = anchorPosition[axis];
      cy.batch(() => {
        for (const metric of metrics) {
          const primarySize = axis === 'x' ? metric.width : metric.height;
          metric.node.position({
            x: axis === 'x' ? cursor + primarySize / 2 : anchorPosition.x,
            y: axis === 'y' ? cursor + primarySize / 2 : anchorPosition.y,
          });
          cursor += primarySize + spacing;
        }
      });
      lastArrangeAction = {
        kind: 'line',
        direction,
        nodeIds,
      };
      scheduleSaveLayout();
    }

    function orderMetricsByEdgeDirection(metrics, axis, crossAxis) {
      const metricById = new Map(metrics.map((metric) => [metric.node.id(), metric]));
      const indegreeById = new Map(metrics.map((metric) => [metric.node.id(), 0]));
      const outgoingById = new Map(metrics.map((metric) => [metric.node.id(), []]));
      const compareMetrics = (a, b) =>
        a.position[axis] - b.position[axis] ||
        a.position[crossAxis] - b.position[crossAxis] ||
        a.node.id().localeCompare(b.node.id());
      cy.edges(':visible').forEach((edge) => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        if (!metricById.has(sourceId) || !metricById.has(targetId) || sourceId === targetId) {
          return;
        }
        outgoingById.get(sourceId).push(targetId);
        indegreeById.set(targetId, (indegreeById.get(targetId) || 0) + 1);
      });
      const queue = metrics
        .filter((metric) => (indegreeById.get(metric.node.id()) || 0) === 0)
        .sort(compareMetrics);
      const ordered = [];
      const visited = new Set();
      while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current.node.id())) {
          continue;
        }
        visited.add(current.node.id());
        ordered.push(current);
        const nextIds = (outgoingById.get(current.node.id()) || [])
          .map((id) => metricById.get(id))
          .filter(Boolean)
          .sort(compareMetrics);
        nextIds.forEach((nextMetric) => {
          const nextId = nextMetric.node.id();
          indegreeById.set(nextId, (indegreeById.get(nextId) || 0) - 1);
          if ((indegreeById.get(nextId) || 0) === 0) {
            queue.push(nextMetric);
          }
        });
        queue.sort(compareMetrics);
      }
      if (ordered.length === metrics.length) {
        return ordered;
      }
      const remaining = metrics
        .filter((metric) => !visited.has(metric.node.id()))
        .sort((a, b) =>
          (indegreeById.get(a.node.id()) || 0) - (indegreeById.get(b.node.id()) || 0) ||
          compareMetrics(a, b),
        );
      return [...ordered, ...remaining];
    }

    function getArrangableNodes() {
      const nodesById = new Map();
      cy.nodes(':selected:visible').forEach((node) => nodesById.set(node.id(), node));
      cy.nodes('.highlighted:visible').forEach((node) => nodesById.set(node.id(), node));
      return [...nodesById.values()];
    }

    function snapArrangableNodesToGrid() {
      const nodes = getArrangableNodes();
      if (nodes.length < 2) {
        updateSelectionActionButtons();
        return;
      }
      pushUndoState();
      lastArrangeAction = null;
      const gridSize = 32;
      const anchor = nodes.reduce((best, node) => {
        const position = node.position();
        if (!best) {
          return { x: position.x, y: position.y };
        }
        if (position.y < best.y || (position.y === best.y && position.x < best.x)) {
          return { x: position.x, y: position.y };
        }
        return best;
      }, null);
      cy.batch(() => {
        nodes.forEach((node) => {
          const position = node.position();
          node.position({
            x: anchor.x + Math.round((position.x - anchor.x) / gridSize) * gridSize,
            y: anchor.y + Math.round((position.y - anchor.y) / gridSize) * gridSize,
          });
        });
      });
      scheduleSaveLayout();
    }

    function hasFilteredSelectionChanged(visibleNodeIds) {
      if (visibleNodeIds.length !== previousFilteredNodeIds.length) {
        return true;
      }
      const sortedIds = [...visibleNodeIds].sort();
      return sortedIds.some((id, index) => id !== previousFilteredNodeIds[index]);
    }

    function clearSelection() {
      cy.elements().removeClass('faded highlighted');
      detailsEl.innerHTML = '<p class="hint">Select a node to inspect its fields and connected edges.</p>';
      lastArrangeAction = null;
      updateSelectionActionButtons();
    }

    function highlightNeighborhood(node) {
      cy.elements().addClass('faded').removeClass('highlighted');
      const neighborhood = node.closedNeighborhood().union(node.incomers()).union(node.outgoers());
      neighborhood.removeClass('faded').addClass('highlighted');
      updateSelectionActionButtons();
    }

    function renderDetails(node) {
      const details = node.data('details') || {};
      const incomers = node.incomers('node').map((n) => n.data('id')).sort();
      const outgoers = node.outgoers('node').map((n) => n.data('id')).sort();
      const rows = Object.entries(details)
        .map(([key, value]) => '<div class="detail-row"><strong>' + escapeHtml(key) + '</strong><span>' + escapeHtml(String(value)) + '</span></div>')
        .join('');
      detailsEl.innerHTML =
        '<div class="detail-card">' +
        '<h2>' + escapeHtml(node.data('id')) + '</h2>' +
        '<p class="meta">' + escapeHtml(node.data('sid')) + '</p>' +
        '<p>' + escapeHtml(node.data('subtitle') || node.data('nodeType')) + '</p>' +
        '<div class="detail-grid">' + rows + '</div>' +
        '<div class="detail-row"><strong>Incoming</strong><span>' + escapeHtml(incomers.join(', ') || 'None') + '</span></div>' +
        '<div class="detail-row"><strong>Outgoing</strong><span>' + escapeHtml(outgoers.join(', ') || 'None') + '</span></div>' +
        '</div>';
    }

    function focusInitialView() {
      const startNodes = cy.nodes('.is-start:visible');
      if (startNodes.length > 0) {
        cy.fit(startNodes.union(startNodes.outgoers('node')), 120);
        return;
      }
      const visibleNodes = cy.nodes(':visible');
      if (visibleNodes.length > 0 && visibleNodes.length <= 40) {
        cy.fit(visibleNodes, 80);
        return;
      }
      const firstNode = visibleNodes[0];
      if (firstNode) {
        cy.center(firstNode);
        cy.zoom(1);
      }
    }

    function initializeGraphView() {
      if (restoreSavedLayout()) {
        restoreSavedViewport() || focusInitialView();
        return;
      }
      runActiveLayout();
    }

    function runActiveLayout(onDone) {
      const visibleNodes = cy.nodes(':visible');
      if (visibleNodes.length === 0) {
        if (typeof onDone === 'function') {
          onDone();
        }
        return;
      }
      const layout = cy.elements(':visible').layout(getLayout());
      layout.once('layoutstop', () => {
        packVisibleComponents();
        if (typeof onDone === 'function') {
          onDone();
        }
        restoreSavedViewport() || focusInitialView();
        scheduleSaveLayout();
      });
      layout.run();
    }

    function beginGroupDrag(node) {
      if (!isAltPressed) {
        activeDragGroup = null;
        return;
      }
      const highlightedNodes = cy.nodes('.highlighted').filter((highlighted) => highlighted.isNode());
      if (!node.hasClass('highlighted') || highlightedNodes.length <= 1) {
        activeDragGroup = null;
        return;
      }
      activeDragGroup = {
        anchorId: node.id(),
        lastAnchorPosition: { ...node.position() },
        members: highlightedNodes.filter((highlighted) => highlighted.id() !== node.id()),
      };
    }

    function updateGroupDrag(node) {
      if (!activeDragGroup || activeDragGroup.anchorId !== node.id()) {
        return;
      }
      const currentPosition = node.position();
      const deltaX = currentPosition.x - activeDragGroup.lastAnchorPosition.x;
      const deltaY = currentPosition.y - activeDragGroup.lastAnchorPosition.y;
      if (!deltaX && !deltaY) {
        return;
      }
      cy.batch(() => {
        activeDragGroup.members.positions((member) => {
          const position = member.position();
          return {
            x: position.x + deltaX,
            y: position.y + deltaY,
          };
        });
      });
      activeDragGroup.lastAnchorPosition = { ...currentPosition };
    }

    function finishGroupDrag() {
      activeDragGroup = null;
    }

    function loadGraph(nextGraph, nextIdentity) {
      graph = cloneGraph(nextGraph);
      currentGraphIdentity = nextIdentity;
      restoredViewport = null;
      previousFilteredNodeIds = [];
      activeDragGroup = null;
      activeLegendFilter = '';
      lastArrangeAction = null;
      searchEl.value = '';
      nodeTypeFilterEl.value = '';
      updateLegendFilterUi();
      updateSelectionActionButtons();
      clearSelection();
      clearHistory();
      cy.batch(() => {
        cy.elements().remove();
        cy.add(buildCyElements(graph));
      });
      applyThemeToGraph(document.body.classList.contains('dark') ? 'dark' : 'light');
      updateGraphSummary();
      populateNodeTypeFilter();
      updateInteractionMode();
      applyFilters();
      initializeGraphView();
    }

    function updateInteractionMode() {
      cy.userPanningEnabled(isPanModifierPressed);
      cy.boxSelectionEnabled(!isPanModifierPressed);
    }

    function initializeMiddleMousePan() {
      const container = cy.container();
      container.addEventListener('pointerdown', (event) => {
        if (event.button !== 1 || event.pointerType !== 'mouse') {
          return;
        }
        middlePanState = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        container.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
      container.addEventListener('pointermove', (event) => {
        if (!middlePanState || middlePanState.pointerId !== event.pointerId) {
          return;
        }
        const deltaX = event.clientX - middlePanState.x;
        const deltaY = event.clientY - middlePanState.y;
        if (!deltaX && !deltaY) {
          return;
        }
        cy.panBy({ x: deltaX, y: deltaY });
        middlePanState = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
      container.addEventListener('pointerup', (event) => {
        if (event.button !== 1 || !middlePanState || middlePanState.pointerId !== event.pointerId) {
          return;
        }
        stopMiddleMousePan(event.pointerId);
      }, { capture: true });
      container.addEventListener('pointercancel', (event) => {
        if (!middlePanState || middlePanState.pointerId !== event.pointerId) {
          return;
        }
        stopMiddleMousePan(event.pointerId);
      }, { capture: true });
      container.addEventListener('auxclick', (event) => {
        if (event.button === 1) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, { capture: true });
    }

    function stopMiddleMousePan(pointerId) {
      if (pointerId !== undefined) {
        try {
          cy.container().releasePointerCapture(pointerId);
        } catch {}
      }
      middlePanState = null;
    }

    function initializeWheelZoom() {
      const container = cy.container();
      container.addEventListener('wheel', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return;
        }
        const factor = Math.exp(-event.deltaY * 0.0015);
        cy.zoom({
          level: cy.zoom() * factor,
          renderedPosition: {
            x: event.clientX - container.getBoundingClientRect().left,
            y: event.clientY - container.getBoundingClientRect().top,
          },
        });
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { passive: false, capture: true });
    }

    function restoreSavedLayout() {
      try {
        const raw = localStorage.getItem(getCurrentLayoutStorageKey());
        if (!raw) {
          return false;
        }
        const saved = JSON.parse(raw);
        const positions = saved && typeof saved === 'object' ? saved.positions : null;
        restoredViewport = getValidViewport(saved && typeof saved === 'object' ? saved.viewport : null);
        if (!positions || typeof positions !== 'object') {
          return false;
        }
        let restoredCount = 0;
        cy.batch(() => {
          cy.nodes().forEach((node) => {
            const position = positions[node.id()];
            if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
              return;
            }
            node.position(position);
            restoredCount++;
          });
        });
        return restoredCount > 0;
      } catch {
        return false;
      }
    }

    function restoreSavedViewport() {
      if (!restoredViewport) {
        return false;
      }
      cy.zoom(restoredViewport.zoom);
      cy.pan(restoredViewport.pan);
      restoredViewport = null;
      return true;
    }

    function pushUndoState() {
      const state = captureGraphState();
      const lastState = undoStack[undoStack.length - 1];
      if (lastState && areGraphStatesEqual(lastState, state)) {
        return;
      }
      undoStack.push(state);
      if (undoStack.length > maxUndoStates) {
        undoStack.shift();
      }
      redoStack.length = 0;
      updateHistoryButtons();
    }

    function undoGraphState() {
      const state = undoStack.pop();
      if (!state) {
        updateHistoryButtons();
        return;
      }
      redoStack.push(captureGraphState());
      applyGraphState(state);
      scheduleSaveLayout();
      updateHistoryButtons();
    }

    function redoGraphState() {
      const state = redoStack.pop();
      if (!state) {
        updateHistoryButtons();
        return;
      }
      undoStack.push(captureGraphState());
      applyGraphState(state);
      scheduleSaveLayout();
      updateHistoryButtons();
    }

    function updateHistoryButtons() {
      undoButton.disabled = undoStack.length === 0;
      redoButton.disabled = redoStack.length === 0;
    }

    function clearHistory() {
      undoStack.length = 0;
      redoStack.length = 0;
      updateHistoryButtons();
    }

    function captureGraphState() {
      return {
        positions: Object.fromEntries(
          cy.nodes().map((node) => [
            node.id(),
            {
              x: Number(node.position('x').toFixed(2)),
              y: Number(node.position('y').toFixed(2)),
            },
          ]),
        ),
        viewport: {
          zoom: Number(cy.zoom().toFixed(4)),
          pan: {
            x: Number(cy.pan('x').toFixed(2)),
            y: Number(cy.pan('y').toFixed(2)),
          },
        },
      };
    }

    function applyGraphState(state) {
      cy.batch(() => {
        cy.nodes().forEach((node) => {
          const position = state.positions[node.id()];
          if (position) {
            node.position(position);
          }
        });
      });
      cy.zoom(state.viewport.zoom);
      cy.pan(state.viewport.pan);
    }

    function areGraphStatesEqual(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    function scheduleSaveLayout() {
      if (saveLayoutTimer) {
        clearTimeout(saveLayoutTimer);
      }
      saveLayoutTimer = setTimeout(() => {
        saveLayoutTimer = null;
        saveCurrentLayout();
      }, 250);
    }

    function saveCurrentLayout() {
      const state = captureGraphState();
      localStorage.setItem(
        getCurrentLayoutStorageKey(),
        JSON.stringify({
          version: 3,
          sourceFilePath: graph.sourceFilePath,
          graphKey: currentGraphIdentity.key,
          positions: state.positions,
          viewport: state.viewport,
        }),
      );
    }

    function getCurrentLayoutStorageKey() {
      return layoutStoragePrefix + currentGraphIdentity.key;
    }

    function getValidViewport(viewport) {
      if (!viewport || typeof viewport !== 'object') {
        return null;
      }
      const zoom = viewport.zoom;
      const pan = viewport.pan;
      if (
        typeof zoom !== 'number' ||
        !Number.isFinite(zoom) ||
        !pan ||
        typeof pan.x !== 'number' ||
        typeof pan.y !== 'number' ||
        !Number.isFinite(pan.x) ||
        !Number.isFinite(pan.y)
      ) {
        return null;
      }
      return {
        zoom,
        pan: { x: pan.x, y: pan.y },
      };
    }

    function initializeTheme() {
      const savedTheme = localStorage.getItem(themeStorageKey);
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = savedTheme || (prefersDark ? 'dark' : 'light');
      applyTheme(theme);
    }

    function initializeSidebarWidth() {
      const saved = Number(localStorage.getItem(sidebarWidthStorageKey));
      if (Number.isFinite(saved) && saved > 0) {
        setSidebarWidth(saved);
      } else {
        setSidebarWidth(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 340);
      }
    }

    function initializeSidebarResizer() {
      if (!sidebarResizer) {
        return;
      }
      let pointerId = null;
      const stopResizing = () => {
        if (pointerId !== null) {
          try {
            sidebarResizer.releasePointerCapture(pointerId);
          } catch {}
        }
        pointerId = null;
        document.body.classList.remove('is-resizing');
      };
      sidebarResizer.addEventListener('pointerdown', (event) => {
        if (window.innerWidth <= 960) {
          return;
        }
        pointerId = event.pointerId;
        sidebarResizer.setPointerCapture(pointerId);
        document.body.classList.add('is-resizing');
        event.preventDefault();
      });
      sidebarResizer.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) {
          return;
        }
        setSidebarWidth(event.clientX - 16);
      });
      sidebarResizer.addEventListener('pointerup', stopResizing);
      sidebarResizer.addEventListener('pointercancel', stopResizing);
      sidebarResizer.addEventListener('dblclick', () => setSidebarWidth(340));
      window.addEventListener('resize', () => {
        if (window.innerWidth <= 960) {
          stopResizing();
          return;
        }
        setSidebarWidth(getSidebarWidth());
      });
    }

    function getSidebarWidth() {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 340;
    }

    function getSidebarWidthBounds() {
      const min = 260;
      const max = Math.max(min, Math.min(720, window.innerWidth - 420));
      return { min, max };
    }

    function setSidebarWidth(width) {
      const bounds = getSidebarWidthBounds();
      const nextWidth = Math.round(Math.min(bounds.max, Math.max(bounds.min, width)));
      document.documentElement.style.setProperty('--sidebar-width', nextWidth + 'px');
      localStorage.setItem(sidebarWidthStorageKey, String(nextWidth));
      scheduleCyResize();
    }

    function scheduleCyResize() {
      if (resizeFrame !== null) {
        return;
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        cy.resize();
      });
    }

    function toggleTheme() {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem(themeStorageKey, nextTheme);
    }

    function applyTheme(theme) {
      document.body.classList.toggle('dark', theme === 'dark');
      themeButton.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      applyThemeToGraph(theme);
    }

    function applyThemeToGraph(theme) {
      const css = getComputedStyle(document.body);
      const palette = {
        nodeFill: css.getPropertyValue('--node-fill').trim(),
        nodeBorder: css.getPropertyValue('--node-border').trim(),
        nodeText: css.getPropertyValue('--node-text').trim(),
        eventFill: css.getPropertyValue('--event-fill').trim(),
        startFill: css.getPropertyValue('--start-fill').trim(),
        terminalBorder: css.getPropertyValue('--terminal-border').trim(),
        edgeLine: css.getPropertyValue('--edge-line').trim(),
        edgeText: css.getPropertyValue('--edge-text').trim(),
        edgeTextBg: css.getPropertyValue('--edge-text-bg').trim(),
        highlight: css.getPropertyValue('--highlight').trim(),
        selection: css.getPropertyValue('--selection').trim(),
        inverseText: '#fffaf0',
      };
      cy.batch(() => {
        cy.nodes().forEach((node) => {
          node.data({
            nodeFill: palette.nodeFill,
            nodeBorder: palette.nodeBorder,
            nodeText: palette.nodeText,
            eventFill: palette.eventFill,
            startFill: palette.startFill,
            terminalBorder: palette.terminalBorder,
            selection: palette.selection,
            inverseText: palette.inverseText,
          });
        });
        cy.edges().forEach((edge) => {
          edge.data({
            edgeLine: palette.edgeLine,
            edgeText: palette.edgeText,
            edgeTextBg: palette.edgeTextBg,
            highlight: palette.highlight,
          });
        });
      });
      cy.style().update();
    }

    function updateGraphSummary() {
      titleEl.textContent = graph.title;
      sourceEl.textContent = graph.sourceFilePath;
      nodeCountEl.textContent = String(graph.nodeCount);
      edgeCountEl.textContent = String(graph.edgeCount);
    }

    function populateNodeTypeFilter() {
      nodeTypeFilterEl.innerHTML = '<option value="">All node types</option>';
      const nodeTypeSet = new Set(graph.nodes.map((node) => node.nodeType).filter(Boolean));
      [...nodeTypeSet].sort().forEach((nodeType) => {
        const option = document.createElement('option');
        option.value = nodeType;
        option.textContent = nodeType;
        nodeTypeFilterEl.appendChild(option);
      });
    }

    function buildCyElements(currentGraph) {
      return [
        ...currentGraph.nodes.map((node) => ({
          group: 'nodes',
          data: {
            id: node.id,
            sid: node.sid,
            label: node.label,
            subtitle: node.subtitle,
            nodeType: node.nodeType,
            isStart: node.isStart,
            isTerminal: node.isTerminal,
            connectionCount: node.connectionCount,
            details: node.details,
          },
          classes: [
            node.isStart ? 'is-start' : '',
            node.isTerminal ? 'is-terminal' : '',
            /Event$/.test(node.nodeType) ? 'is-event' : '',
          ].filter(Boolean).join(' '),
        })),
        ...currentGraph.edges.map((edge) => ({
          group: 'edges',
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            showLabel: edge.label,
            kind: edge.kind,
          },
        })),
      ];
    }

    function cloneGraph(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function createGraphIdentityFromGraph(currentGraph) {
      const fingerprint = hashString(JSON.stringify({
        title: currentGraph.title,
        sourceFilePath: currentGraph.sourceFilePath,
        fileName: currentGraph.title,
        nodes: currentGraph.nodes.map((node) => node.sid),
        edges: currentGraph.edges.map((edge) => [edge.source, edge.target, edge.label]),
      }));
      return { key: 'graph:' + slugifyKey(currentGraph.title || currentGraph.sourceFilePath || 'graph') + ':' + fingerprint };
    }

    function createGraphIdentityFromCfgText(text, fileName) {
      const normalizedFileName = fileName || 'uploaded.cfg';
      return {
        key: 'cfg:' + slugifyKey(normalizedFileName) + ':' + hashString(normalizedFileName + '\\n' + normalizeNewlines(text)),
      };
    }

    function hashString(value) {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    }

    function slugifyKey(value) {
      return String(value || 'graph')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'graph';
    }

    function normalizeNewlines(value) {
      return String(value).replaceAll('\\r\\n', '\\n').replaceAll('\\r', '\\n');
    }

    function parseQuestCfgTextToGraph(text, sourceLabel) {
      const structs = parseCfgStructs(text);
      if (!structs.length) {
        throw new Error('No top-level quest node structs found.');
      }
      return buildGraphFromStructs(structs, sourceLabel);
    }

    function parseCfgStructs(text) {
      const root = [];
      const stack = [];
      const lines = normalizeNewlines(text).split('\\n');
      for (const rawLine of lines) {
        const line = stripLineComment(rawLine).trim();
        if (!line) {
          continue;
        }
        const structMatch = line.match(/^(.+?)\\s*:\\s*struct\\.begin\\b/i);
        if (structMatch) {
          const name = structMatch[1].trim();
          const node = { __name: name };
          if (stack.length === 0) {
            root.push(node);
          } else {
            stack[stack.length - 1][name] = node;
          }
          stack.push(node);
          continue;
        }
        if (/^struct\\.end\\b/i.test(line)) {
          stack.pop();
          continue;
        }
        const fieldMatch = line.match(/^([A-Za-z0-9_]+)\\s*=\\s*(.*)$/);
        if (fieldMatch && stack.length > 0) {
          stack[stack.length - 1][fieldMatch[1]] = parseCfgScalar(fieldMatch[2]);
        }
      }
      return root;
    }

    function stripLineComment(line) {
      const commentIndex = line.indexOf('//');
      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    }

    function parseCfgScalar(rawValue) {
      const value = String(rawValue).trim();
      if (!value) {
        return '';
      }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\\'') && value.endsWith('\\''))) {
        return value.slice(1, -1);
      }
      if (/^(true|false)$/i.test(value)) {
        return value.toLowerCase() === 'true';
      }
      if (/^-?\\d+(\\.\\d+)?$/.test(value)) {
        return Number(value);
      }
      return value;
    }

    function buildGraphFromStructs(structs, sourceLabel) {
      const jsNameBySid = new Map();
      const usedNames = new Set();
      const nodes = structs.map((raw) => {
        const sid = String(raw.SID || raw.__name || '');
        const jsSid = getOrCreateJsSid(sid, jsNameBySid, usedNames);
        return { raw, sid, jsSid, launches: [] };
      });
      const nodeBySid = new Map(nodes.map((node) => [node.sid, node]));
      nodes.forEach((node) => {
        forEachStructChild(node.raw.Launchers, (launcher) => {
          forEachStructChild(launcher.Connections, (connection) => {
            const launcherNode = nodeBySid.get(String(connection.SID || ''));
            if (launcherNode) {
              launcherNode.launches.push({
                SID: node.sid,
                Name: String(connection.Name || ''),
              });
            }
          });
        });
      });
      nodes.forEach((node) => {
        if (getNodeSubType(node.raw.NodeType) !== 'BridgeEvent') {
          return;
        }
        const linkedNode = nodeBySid.get(String(node.raw.LinkedNodePrototypeSID || ''));
        if (linkedNode) {
          linkedNode.launches.push({ SID: node.sid, Name: '' });
        }
      });
      const incomingCountBySid = new Map();
      nodes.forEach((node) => {
        incomingCountBySid.set(node.sid, 0);
      });
      nodes.forEach((node) => {
        node.launches.forEach((edge) => {
          incomingCountBySid.set(edge.SID, (incomingCountBySid.get(edge.SID) || 0) + 1);
        });
      });
      const graphNodes = nodes.map((node) => {
        const nodeType = getNodeSubType(node.raw.NodeType);
        const outgoingCount = node.launches.length;
        const incomingCount = incomingCountBySid.get(node.sid) || 0;
        return {
          id: node.jsSid,
          sid: node.sid,
          nodeType,
          label: formatNodeLabel(node.jsSid),
          subtitle: getNodeSubtitle(node.raw),
          isStart: Boolean(node.raw.LaunchOnQuestStart),
          isTerminal: nodeType === 'End' || node.launches.length === 0,
          connectionCount: incomingCount + outgoingCount,
          details: getNodeDetails(node.raw),
        };
      });
      const graphEdges = nodes.flatMap((node) =>
        node.launches.map((edge, index) => ({
          id: node.jsSid + '__' + (jsNameBySid.get(edge.SID) || edge.SID) + '__' + index,
          source: node.jsSid,
          target: jsNameBySid.get(edge.SID) || edge.SID,
          label: edge.Name || '',
          kind: 'launch',
        })),
      );
      return {
        title: sourceLabel,
        sourceFilePath: sourceLabel,
        nodeCount: graphNodes.length,
        edgeCount: graphEdges.length,
        nodes: graphNodes,
        edges: graphEdges,
      };
    }

    function getOrCreateJsSid(rawSid, sidToJs, usedNames) {
      const existing = sidToJs.get(rawSid);
      if (existing) {
        return existing;
      }
      const base = toJsIdentifier(rawSid);
      let candidate = base;
      let suffix = 1;
      while (usedNames.has(candidate)) {
        candidate = base + '_' + suffix++;
      }
      usedNames.add(candidate);
      sidToJs.set(rawSid, candidate);
      return candidate;
    }

    function toJsIdentifier(raw) {
      const cleaned = String(raw || '').replace(/[^A-Za-z0-9_$]/g, '_');
      return /^[A-Za-z_$]/.test(cleaned) ? cleaned : '_' + cleaned;
    }

    function getNodeSubType(nodeType) {
      return String(nodeType || '').split('::').pop() || 'Unknown';
    }

    function getNodeSubtitle(struct) {
      const nodeType = getNodeSubType(struct.NodeType);
      const maybeText = firstDefinedString([
        struct.ScreenText,
        struct.ItemSID,
        struct.ItemPrototypeSID,
        struct.SignalReceiverGuid,
        struct.LinkedNodePrototypeSID,
      ]);
      return maybeText ? nodeType + ': ' + truncate(maybeText, 48) : nodeType;
    }

    function firstDefinedString(values) {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return '';
    }

    function truncate(value, maxLength) {
      return value.length > maxLength ? value.slice(0, maxLength - 3) + '...' : value;
    }

    function formatNodeLabel(value) {
      return String(value).replaceAll('_', '_\\u200b').replace(/([a-z0-9])([A-Z])/g, '$1\\u200b$2');
    }

    function getNodeDetails(struct) {
      const details = {
        SID: struct.SID,
        NodeType: getNodeSubType(struct.NodeType),
      };
      const detailKeys = [
        'Comment',
        'QuestSID',
        'TargetQuestGuid',
        'LinkedNodePrototypeSID',
        'SignalReceiverGuid',
        'SignalSenderGuid',
        'ItemSID',
        'ItemPrototypeSID',
        'ItemsCount',
        'InGameHours',
        'VolumeGuid',
        'SequenceName',
        'ScreenText',
        'FadeTime',
        'LaunchOnQuestStart',
      ];
      for (const key of detailKeys) {
        const value = struct[key];
        if (value === undefined || value === null || value === '') {
          continue;
        }
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          details[key] = value;
          continue;
        }
        details[key] = summarizeValue(value);
      }
      return details;
    }

    function summarizeValue(value) {
      if (Array.isArray(value)) {
        return value.length + ' items';
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).filter((key) => !key.startsWith('__')).length + ' entries';
      }
      return String(value);
    }

    function forEachStructChild(value, callback) {
      if (!value || typeof value !== 'object') {
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (key.startsWith('__') || !child || typeof child !== 'object') {
          return;
        }
        callback(child, key);
      });
    }

    function packVisibleComponents() {
      const visibleElements = cy.elements(':visible');
      const components = visibleElements.components()
        .map((component) => {
          const nodes = component.nodes();
          const box = nodes.boundingBox();
          return {
            nodes,
            box,
            width: Math.max(1, box.w),
            height: Math.max(1, box.h),
          };
        })
        .filter((component) => component.nodes.length > 0)
        .sort((a, b) => {
          const aIsChain = isChainLikeComponent(a);
          const bIsChain = isChainLikeComponent(b);
          if (aIsChain !== bIsChain) {
            return aIsChain ? 1 : -1;
          }
          return b.height * b.width - a.height * a.width;
        });
      if (components.length <= 1) {
        return;
      }
      const horizontalGap = 110;
      const verticalGap = 120;
      const targetRowWidth = Math.max(1800, Math.sqrt(components.reduce((sum, component) => sum + component.width * component.height, 0)) * 1.8);
      let cursorX = 0;
      let cursorY = 0;
      let rowHeight = 0;
      cy.batch(() => {
        for (const component of components) {
          if (cursorX > 0 && cursorX + component.width > targetRowWidth) {
            cursorX = 0;
            cursorY += rowHeight + verticalGap;
            rowHeight = 0;
          }
          const targetX = cursorX - component.box.x1;
          const targetY = cursorY - component.box.y1;
          component.nodes.positions((node) => {
            const position = node.position();
            return {
              x: position.x + targetX,
              y: position.y + targetY,
            };
          });
          cursorX += component.width + horizontalGap;
          rowHeight = Math.max(rowHeight, component.height);
        }
      });
    }

    function isChainLikeComponent(component) {
      return component.nodes.length <= 18 && component.width > component.height * 2.4;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }
  </script>
</body>
</html>`;
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function runQuestCfgToGraphHtml(paths: string[]) {
  if (!paths.length) {
    throw new Error("Expected at least one quest cfg path.");
  }
  let outputFilePathOverride: string | undefined;
  const inputPaths: string[] = [];
  for (let index = 0; index < paths.length; index++) {
    const value = paths[index];
    if (value === "--output" || value === "-o") {
      outputFilePathOverride = paths[index + 1];
      if (!outputFilePathOverride) {
        throw new Error(`Expected a path after ${value}.`);
      }
      index++;
      continue;
    }
    inputPaths.push(value);
  }
  if (!inputPaths.length) {
    throw new Error("Expected at least one quest cfg path.");
  }
  if (outputFilePathOverride && inputPaths.length !== 1) {
    throw new Error("Explicit output path is only supported for a single input file.");
  }
  const results = [];
  for (const inputPath of inputPaths) {
    results.push(await questCfgToGraphHtml(inputPath, outputFilePathOverride));
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await runQuestCfgToGraphHtml(process.argv.slice(2));
  results.forEach((result) => {
    console.log(`${result.sourceFilePath} -> ${result.outputFilePath}`);
  });
}
