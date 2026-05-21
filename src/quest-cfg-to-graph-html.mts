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

export async function questCfgToGraphHtml(inputPath: string) {
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
  const outputFilePath = `${sourceFilePath}.graph.html`;
  await writeFile(outputFilePath, renderQuestGraphHtml(graph), "utf8");
  return { outputFilePath, sourceFilePath, graph };
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
      grid-template-columns: 340px 1fr;
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
        <h1>${escapeHtml(graph.title)}</h1>
        <p class="meta">${escapeHtml(graph.sourceFilePath)}</p>
        <div class="stats">
          <div class="stat">Nodes<strong>${graph.nodeCount}</strong></div>
          <div class="stat">Edges<strong>${graph.edgeCount}</strong></div>
        </div>
        <div class="controls">
          <input id="search" type="search" placeholder="Search SID or JS name">
          <select id="nodeTypeFilter">
            <option value="">All node types</option>
          </select>
          <button id="fitButton" type="button">Fit graph</button>
          <button id="resetButton" type="button">Clear selection</button>
        </div>
        <div class="legend">
          <div class="legend-row"><span class="swatch" style="background: var(--node)"></span>Regular node</div>
          <div class="legend-row"><span class="swatch" style="background: var(--event)"></span>Event / trigger node</div>
          <div class="legend-row"><span class="swatch" style="background: var(--start)"></span>Launch on quest start</div>
          <div class="legend-row"><span class="swatch" style="background: var(--terminal)"></span>Terminal / no outgoing edges</div>
        </div>
      </div>
      <div class="details" id="details">
        <p class="hint">Select a node to inspect its fields and connected edges.</p>
      </div>
    </aside>
    <main class="panel canvas">
      <div class="toolbar">
        <button id="themeButton" type="button">Dark mode</button>
        <button id="undoButton" type="button" disabled>Undo</button>
        <button id="redoButton" type="button" disabled>Redo</button>
        <button id="layoutButton" type="button">Relayout</button>
      </div>
      <div id="cy"></div>
    </main>
  </div>
  <script src="https://unpkg.com/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
  <script>
    const graph = ${payload};
    const detailsEl = document.getElementById('details');
    const searchEl = document.getElementById('search');
    const nodeTypeFilterEl = document.getElementById('nodeTypeFilter');
    const fitButton = document.getElementById('fitButton');
    const resetButton = document.getElementById('resetButton');
    const layoutButton = document.getElementById('layoutButton');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const themeButton = document.getElementById('themeButton');
    const themeStorageKey = 'quest-graph-theme';
    const layoutStorageKey = 'quest-graph-layout:' + graph.sourceFilePath;
    const maxUndoStates = 30;
    let saveLayoutTimer = null;
    let restoredViewport = null;
    const undoStack = [];
    const redoStack = [];

    if (!window.cytoscape) {
      detailsEl.innerHTML = '<div class="error">Failed to load Cytoscape.js from CDN.</div>';
      throw new Error('Cytoscape.js failed to load');
    }

    const nodeTypeSet = new Set(graph.nodes.map((node) => node.nodeType).filter(Boolean));
    [...nodeTypeSet].sort().forEach((nodeType) => {
      const option = document.createElement('option');
      option.value = nodeType;
      option.textContent = nodeType;
      nodeTypeFilterEl.appendChild(option);
    });

    const elements = [
      ...graph.nodes.map((node) => ({
        group: 'nodes',
        data: {
          id: node.id,
          sid: node.sid,
          label: node.label,
          subtitle: node.subtitle,
          nodeType: node.nodeType,
          isStart: node.isStart,
          isTerminal: node.isTerminal,
          details: node.details,
        },
        classes: [
          node.isStart ? 'is-start' : '',
          node.isTerminal ? 'is-terminal' : '',
          /Event$/.test(node.nodeType) ? 'is-event' : '',
        ].filter(Boolean).join(' '),
      })),
      ...graph.edges.map((edge) => ({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          kind: edge.kind,
        },
      })),
    ];

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      wheelSensitivity: 0.22,
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
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'data(edgeLine)',
            'line-color': 'data(edgeLine)',
            'width': 2,
            'label': graph.edgeCount <= 120 ? 'data(label)' : '',
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

    initializeTheme();
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      renderDetails(node);
      highlightNeighborhood(node);
    });
    cy.on('grab', 'node', () => pushUndoState());
    cy.on('dragfree', 'node', () => scheduleSaveLayout());
    cy.on('zoom pan', () => scheduleSaveLayout());

    cy.on('tap', (event) => {
      if (event.target === cy) {
        clearSelection();
      }
    });

    searchEl.addEventListener('input', applyFilters);
    nodeTypeFilterEl.addEventListener('change', applyFilters);
    fitButton.addEventListener('click', () => {
      cy.fit(cy.nodes(':visible'), 80);
      scheduleSaveLayout();
    });
    resetButton.addEventListener('click', clearSelection);
    layoutButton.addEventListener('click', () => {
      pushUndoState();
      runActiveLayout();
    });
    undoButton.addEventListener('click', undoGraphState);
    redoButton.addEventListener('click', redoGraphState);
    themeButton.addEventListener('click', toggleTheme);

    applyFilters();
    cy.ready(() => {
      if (restoreSavedLayout()) {
        restoreSavedViewport() || focusInitialView();
        return;
      }
      runActiveLayout();
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
      cy.batch(() => {
        cy.elements().removeClass('faded');
        cy.nodes().forEach((node) => {
          const matchesSearch =
            !search ||
            node.data('id').toLowerCase().includes(search) ||
            node.data('sid').toLowerCase().includes(search) ||
            String(node.data('subtitle') || '').toLowerCase().includes(search);
          const matchesType = !nodeType || node.data('nodeType') === nodeType;
          const visible = matchesSearch && matchesType;
          node.style('display', visible ? 'element' : 'none');
        });
        cy.edges().forEach((edge) => {
          const visible = edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none';
          edge.style('display', visible ? 'element' : 'none');
        });
      });
      const visibleNodes = cy.nodes(':visible');
      if (visibleNodes.length > 40) {
        packVisibleComponents();
      } else if (visibleNodes.length > 0) {
        cy.fit(visibleNodes, 80);
      }
    }

    function clearSelection() {
      cy.elements().removeClass('faded highlighted');
      detailsEl.innerHTML = '<p class="hint">Select a node to inspect its fields and connected edges.</p>';
    }

    function highlightNeighborhood(node) {
      cy.elements().addClass('faded').removeClass('highlighted');
      const neighborhood = node.closedNeighborhood().union(node.incomers()).union(node.outgoers());
      neighborhood.removeClass('faded').addClass('highlighted');
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

    function runActiveLayout() {
      const visibleNodes = cy.nodes(':visible');
      if (visibleNodes.length === 0) {
        return;
      }
      const layout = cy.elements(':visible').layout(getLayout());
      layout.once('layoutstop', () => {
        packVisibleComponents();
        restoreSavedViewport() || focusInitialView();
        scheduleSaveLayout();
      });
      layout.run();
    }

    function restoreSavedLayout() {
      try {
        const raw = localStorage.getItem(layoutStorageKey);
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
        layoutStorageKey,
        JSON.stringify({
          version: 1,
          sourceFilePath: graph.sourceFilePath,
          positions: state.positions,
          viewport: state.viewport,
        }),
      );
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
      return value
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
  const results = [];
  for (const inputPath of paths) {
    results.push(await questCfgToGraphHtml(inputPath));
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await runQuestCfgToGraphHtml(process.argv.slice(2));
  results.forEach((result) => {
    console.log(`${result.sourceFilePath} -> ${result.outputFilePath}`);
  });
}
