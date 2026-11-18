import { formatPrice } from './prices.js';
import { balance, inOrderNodes } from './trees.js';

const SVG = 'http://www.w3.org/2000/svg';
const NODE_HEIGHT = 34;
const LEVEL_GAP = 59;
const MOVE_STEP = 15;
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

export class TreeView {
  constructor(host, { label, onSelect, onDrop } = {}) {
    this.onSelect = onSelect;
    this.onDrop = onDrop;
    this.mode = onDrop ? 'practice' : 'layout';
    this.nodes = new Map();
    this.edges = new Map();
    this.offsets = new Map();
    this.zoom = 1;
    this.selection = null;
    this.displayed = new Map();
    this.data = [];

    host.innerHTML = `
      <div class="canvas-wrap">
        <div class="tree-canvas">
          <div class="canvas-empty">
            <svg viewBox="0 0 64 45" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="m28 15-12 14m20-14 12 14"/><circle cx="32" cy="10" r="7"/><circle cx="12" cy="35" r="7"/><circle cx="52" cy="35" r="7"/>
            </svg>
            <p>Waiting for the first price</p>
          </div>
        </div>
        <div class="canvas-tools" role="group" aria-label="Tree zoom" hidden>
          <button type="button" class="button quiet" data-zoom="out" aria-label="Zoom out">−</button>
          <output aria-label="Zoom level">100%</output>
          <button type="button" class="button quiet" data-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" class="button quiet" data-zoom="fit">Fit</button>
        </div>
      </div>
      <div class="tree-footer">
        <p class="tree-inspector">Select a node to inspect it.</p>
        <div class="move-tools" role="group" aria-label="Move selected node" hidden>
          <button type="button" class="button quiet" data-move="ArrowLeft" aria-label="Move node left">←</button>
          <button type="button" class="button quiet" data-move="ArrowUp" aria-label="Move node up">↑</button>
          <button type="button" class="button quiet" data-move="ArrowDown" aria-label="Move node down">↓</button>
          <button type="button" class="button quiet" data-move="ArrowRight" aria-label="Move node right">→</button>
        </div>
        <button type="button" class="button quiet" data-reset hidden>Reset layout</button>
      </div>`;

    this.canvas = host.querySelector('.tree-canvas');
    this.empty = host.querySelector('.canvas-empty');
    this.tools = host.querySelector('.canvas-tools');
    this.zoomLabel = host.querySelector('output');
    this.inspector = host.querySelector('.tree-inspector');
    this.moveTools = host.querySelector('.move-tools');
    this.resetButton = host.querySelector('[data-reset]');
    this.svg = svgElement('svg', { class: 'tree-svg', role: 'group', 'aria-label': label });
    this.edgeLayer = svgElement('g', { 'aria-hidden': 'true' });
    this.nodeLayer = svgElement('g');
    this.svg.append(this.edgeLayer, this.nodeLayer);
    this.canvas.append(this.svg);

    this.tools.addEventListener('click', event => {
      const action = event.target.closest('[data-zoom]')?.dataset.zoom;
      if (action === 'fit') this.fit();
      if (action === 'out') this.setZoom(this.zoom / 1.25);
      if (action === 'in') this.setZoom(this.zoom * 1.25);
    });
    this.moveTools.addEventListener('click', event => {
      const direction = event.target.closest('[data-move]')?.dataset.move;
      if (direction) this.move(this.selection, directions[direction]);
    });
    this.resetButton.addEventListener('click', () => this.resetLayout());

    this.svg.addEventListener('click', event => {
      const item = event.target.closest('[data-key]');
      if (item) this.select(Number(item.dataset.key));
    });
    this.svg.addEventListener('keydown', event => this.onKey(event));
    this.svg.addEventListener('pointerdown', event => this.startDrag(event));
    this.svg.addEventListener('pointermove', event => this.updateDrag(event));
    this.svg.addEventListener('pointerup', event => this.finishDrag(event));
    this.svg.addEventListener('pointercancel', () => this.cancelDrag());

    const resize = new ResizeObserver(() => {
      if (this.canvas.clientWidth && !this.drag) this.layout();
    });
    resize.observe(this.canvas);
  }

  render(root, { animate = false } = {}) {
    this.cancelDrag();
    this.root = root;
    const depths = new Map();
    const parents = new Map();
    const stack = root ? [{ node: root, depth: 0 }] : [];
    while (stack.length) {
      const { node, depth } = stack.pop();
      depths.set(node.key, depth);
      for (const child of [node.left, node.right]) {
        if (!child) continue;
        parents.set(child.key, node.key);
        stack.push({ node: child, depth: depth + 1 });
      }
    }
    this.data = inOrderNodes(root).map(node => ({
      node,
      depth: depths.get(node.key),
      parent: parents.get(node.key),
      key: node.key,
      width: Math.max(58, formatPrice(node.key).length * 7.3 + 18),
      factor: balance(node),
    }));
    this.byKey = new Map(this.data.map(item => [item.key, item]));

    for (const [key, group] of this.nodes) {
      if (this.byKey.has(key)) continue;
      group.remove();
      this.nodes.delete(key);
      this.offsets.delete(key);
    }
    for (const [key, line] of this.edges) {
      if (this.byKey.get(key)?.parent === Number(line.dataset.parent)) continue;
      line.remove();
      this.edges.delete(key);
    }
    for (const item of this.data) {
      this.updateNode(item);
      if (item.parent === undefined || this.edges.has(item.key)) continue;
      const line = svgElement('line', { class: 'tree-edge', 'data-parent': item.parent, 'data-child': item.key });
      this.edges.set(item.key, line);
      this.edgeLayer.append(line);
    }

    this.empty.hidden = Boolean(root);
    this.tools.hidden = !root;
    this.resetButton.hidden = !root || this.mode === 'read';
    if (!this.byKey.has(this.selection)) this.selection = null;
    this.select(this.selection);
    this.highlight();
    this.layout(animate);
  }

  updateNode({ key, factor, width, node }) {
    let group = this.nodes.get(key);
    if (!group) {
      group = svgElement('g', { class: 'node', role: 'button', 'data-key': key, tabindex: '-1' });
      group.append(
        svgElement('rect', { class: 'node-shape', rx: 9, height: NODE_HEIGHT, y: -NODE_HEIGHT / 2 }),
        svgElement('text', { class: 'node-key' }),
        svgElement('text', { class: 'node-factor', y: 8 }),
      );
      this.nodes.set(key, group);
      this.nodeLayer.append(group);
    }
    const price = formatPrice(key);
    const [shape, text, factorText] = group.children;
    shape.setAttribute('x', -width / 2);
    shape.setAttribute('width', width);
    text.textContent = price;
    text.setAttribute('y', this.mode === 'layout' ? 0 : -6);
    factorText.textContent = this.mode === 'layout' ? '' : `BF ${factor}`;
    group.classList.toggle('is-unbalanced', this.mode !== 'layout' && Math.abs(factor) > 1);
    group.setAttribute('aria-label', `${price}, height ${node.height}, balance factor ${factor}`);
  }

  layout(animate = false) {
    if (!this.canvas.clientWidth) return;
    this.spacing = Math.max(58, ...this.data.map(item => item.width)) + 12;
    this.naturalWidth = this.data.length * this.spacing + 24;
    this.naturalHeight = (this.root?.height ?? 0) * LEVEL_GAP + 87;
    this.width = Math.max(this.canvas.clientWidth / this.zoom, this.naturalWidth);
    this.height = Math.max(this.canvas.clientHeight / this.zoom, this.naturalHeight);
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('width', this.width * this.zoom);
    this.svg.setAttribute('height', this.height * this.zoom);

    this.anchors = new Map(this.data.map(({ key, depth }, index) => [key, {
      x: this.width / 2 + (index - (this.data.length - 1) / 2) * this.spacing,
      y: 44 + depth * LEVEL_GAP,
    }]));
    const next = this.positions();
    cancelAnimationFrame(this.frame);
    if (!animate || document.documentElement.hasAttribute('data-reduce-motion') || !this.displayed.size) {
      this.paint(next);
      return;
    }
    const start = this.displayed;
    const startTime = performance.now();
    const draw = now => {
      const progress = Math.min(1, (now - startTime) / 240);
      const ease = 1 - (1 - progress) ** 3;
      this.paint(new Map([...next].map(([key, target]) => {
        const from = start.get(key) ?? target;
        return [key, { x: from.x + (target.x - from.x) * ease, y: from.y + (target.y - from.y) * ease }];
      })));
      if (progress < 1) this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
  }

  positions() {
    return new Map([...this.anchors].map(([key, anchor]) => {
      const offset = this.offsets.get(key) ?? { x: 0, y: 0 };
      const half = this.byKey.get(key).width / 2 + 3;
      return [key, {
        x: clamp(anchor.x + offset.x, half, this.width - half),
        y: clamp(anchor.y + offset.y, NODE_HEIGHT / 2 + 3, this.height - NODE_HEIGHT / 2 - 3),
      }];
    }));
  }

  paint(positions) {
    this.displayed = positions;
    for (const [key, { x, y }] of positions) this.nodes.get(key).setAttribute('transform', `translate(${x} ${y})`);
    for (const [key, line] of this.edges) {
      const from = positions.get(Number(line.dataset.parent));
      const to = positions.get(key);
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
    }
  }

  select(key) {
    const item = this.byKey?.get(key);
    this.selection = item ? key : null;
    for (const [nodeKey, group] of this.nodes) {
      const selected = this.selection === nodeKey;
      group.classList.toggle('is-selected', selected);
      group.setAttribute('aria-pressed', selected);
      group.setAttribute('tabindex', (this.selection ?? this.root?.key) === nodeKey ? '0' : '-1');
    }
    this.inspector.textContent = item
      ? `${formatPrice(key)} · Height ${item.node.height} · Balance factor ${item.factor}`
      : this.root && this.mode === 'layout' ? 'Select to inspect a node or drag to move it.' : 'Select a node to inspect it.';
    this.moveTools.hidden = !item || this.mode !== 'layout';
    this.onSelect?.(item?.node ?? null);
  }

  highlight(visited = [], current = null, follow = false) {
    const path = new Set(visited);
    for (const [key, group] of this.nodes) {
      group.classList.toggle('is-visited', path.has(key));
      group.classList.toggle('is-current', key === current);
    }
    for (const [key, line] of this.edges) {
      line.classList.toggle('is-visited', path.has(key) && path.has(Number(line.dataset.parent)));
    }
    if (follow && current !== null) this.ensureVisible(current);
  }

  ensureVisible(key) {
    const point = this.displayed.get(key);
    if (!point) return;
    const x = point.x * this.zoom;
    const y = point.y * this.zoom;
    const canvas = this.canvas;
    const padding = 39;
    if (x - padding < canvas.scrollLeft) canvas.scrollLeft = x - padding;
    if (x + padding > canvas.scrollLeft + canvas.clientWidth) canvas.scrollLeft = x + padding - canvas.clientWidth;
    if (y - padding < canvas.scrollTop) canvas.scrollTop = y - padding;
    if (y + padding > canvas.scrollTop + canvas.clientHeight) canvas.scrollTop = y + padding - canvas.clientHeight;
  }

  setZoom(zoom) {
    this.zoom = clamp(zoom, .15, 1.8);
    this.zoomLabel.value = `${Math.round(this.zoom * 100)}%`;
    this.layout();
    if (this.selection !== null) this.ensureVisible(this.selection);
  }

  fit() {
    if (!this.root) return;
    const { clientWidth, clientHeight } = this.canvas;
    this.setZoom(Math.min(1, (clientWidth - 6) / this.naturalWidth, (clientHeight - 6) / this.naturalHeight));
    this.canvas.scrollTo(0, 0);
  }

  resetLayout() {
    this.offsets.clear();
    this.setZoom(1);
    this.canvas.scrollTo(0, 0);
  }

  onKey(event) {
    const item = event.target.closest('[data-key]');
    if (!item) return;
    const key = Number(item.dataset.key);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(key);
    }
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    if (event.shiftKey && this.mode === 'layout') {
      this.select(key);
      this.move(key, direction);
      return;
    }
    const index = this.data.findIndex(node => node.key === key);
    const next = this.data[clamp(index + direction[0] + direction[1], 0, this.data.length - 1)].key;
    this.select(next);
    this.nodes.get(next).focus({ preventScroll: true });
    this.ensureVisible(next);
  }

  move(key, [dx, dy]) {
    const point = this.displayed.get(key);
    if (!point) return;
    this.place(key, point.x + dx * MOVE_STEP, point.y + dy * MOVE_STEP);
    this.ensureVisible(key);
  }

  place(key, x, y) {
    cancelAnimationFrame(this.frame);
    const point = this.anchors.get(key);
    const half = this.byKey.get(key).width / 2 + 3;
    this.offsets.set(key, {
      x: clamp(x, half, this.width - half) - point.x,
      y: clamp(y, NODE_HEIGHT / 2 + 3, this.height - NODE_HEIGHT / 2 - 3) - point.y,
    });
    this.paint(this.positions());
  }

  point(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(this.svg.getScreenCTM().inverse());
  }

  startDrag(event) {
    const item = event.target.closest('[data-key]');
    if (!item || event.button !== 0 || this.drag) return;
    const key = Number(item.dataset.key);
    this.select(key);
    item.focus({ preventScroll: true });
    if (this.mode === 'read') return;
    const start = this.displayed.get(key);
    const pointer = this.point(event);
    this.drag = { key, item, pointerId: event.pointerId, pointer, start, moved: false };
    item.setPointerCapture(event.pointerId);
  }

  updateDrag(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const pointer = this.point(event);
    const dx = pointer.x - drag.pointer.x;
    const dy = pointer.y - drag.pointer.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    drag.item.classList.add('is-dragging');
    this.place(drag.key, drag.start.x + dx, drag.start.y + dy);
    if (this.mode === 'practice') {
      const parent = this.byKey.get(drag.key).parent;
      for (const [key, group] of this.nodes) group.classList.toggle('is-target', key === parent);
    }
  }

  finishDrag(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    let target = null;
    if (drag.moved && this.mode === 'practice') {
      const pointer = this.point(event);
      const candidate = this.data.find(({ key, width }) => {
        const position = this.displayed.get(key);
        return key !== drag.key && Math.abs(position.x - pointer.x) <= width / 2
          && Math.abs(position.y - pointer.y) <= NODE_HEIGHT / 2;
      });
      target = candidate?.key ?? null;
    }
    this.cancelDrag();
    if (drag.moved && this.mode === 'practice') this.onDrop(drag.key, target);
  }

  cancelDrag() {
    if (!this.drag) return;
    const { key, item, pointerId } = this.drag;
    this.drag = null;
    item.classList.remove('is-dragging');
    if (item.hasPointerCapture(pointerId)) item.releasePointerCapture(pointerId);
    for (const group of this.nodes.values()) group.classList.remove('is-target');
    if (this.mode === 'practice') {
      this.offsets.delete(key);
      this.paint(this.positions());
    }
  }
}
