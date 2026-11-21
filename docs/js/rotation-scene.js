import { formatPrice } from './prices.js';
import { balance, inOrderNodes } from './trees.js';

const defaultCamera = { yaw: -0.46, pitch: 0.27, zoom: 1 };
const corners = [
  [-17, -17, -17], [17, -17, -17], [17, 17, -17], [-17, 17, -17],
  [-17, -17, 17], [17, -17, 17], [17, 17, 17], [-17, 17, 17],
];
const faces = [
  [0, 1, 2, 3], [4, 5, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5], [3, 2, 6, 7], [0, 1, 5, 4],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

export function layoutRotationTree(root) {
  const ordered = inOrderNodes(root);
  const ranks = new Map(ordered.map((node, index) => [node.key, index]));
  const levels = (root?.height ?? 0) / 2;
  const nodes = new Map();
  function visit(node, parent, level, z) {
    if (!node) return;
    const x = (ranks.get(node.key) - (ordered.length - 1) / 2) * 64;
    nodes.set(node.key, { node, parent, center: [x, (levels - level) * 70, z] });
    const separation = Math.max(24, 56 - 10 * level);
    visit(node.left, node.key, level + 1, z - separation);
    visit(node.right, node.key, level + 1, z + separation);
  }
  visit(root, null, 0, 0);
  return nodes;
}

export function rotationProjection({ yaw, pitch, zoom }) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return ([x, y, z]) => {
    const horizontal = x * cosYaw - z * sinYaw;
    const rotatedZ = x * sinYaw + z * cosYaw;
    const vertical = y * cosPitch - rotatedZ * sinPitch;
    const depth = y * sinPitch + rotatedZ * cosPitch;
    const scale = 640 * zoom / (760 - depth);
    return { x: 250 + horizontal * scale, y: 152 - vertical * scale, depth };
  };
}

export class RotationScene {
  constructor(host) {
    this.stage = host.querySelector('.orbit-stage');
    this.svg = this.stage.querySelector('svg');
    this.inspector = host.querySelector('.orbit-inspector');
    this.geometry = svgElement('g', { 'aria-hidden': 'true' });
    this.labels = svgElement('g', { role: 'group', 'aria-label': 'Selectable tree nodes' });
    this.svg.append(this.geometry, this.labels);
    this.nodes = new Map();
    this.points = new Map();
    this.controls = new Map();
    this.reset();

    const moves = {
      left: [-0.22, 0, 0], right: [0.22, 0, 0], up: [0, 0.18, 0], down: [0, -0.18, 0],
      nearer: [0, 0, 0.14], farther: [0, 0, -0.14],
    };
    host.addEventListener('click', event => {
      const action = event.target.closest('[data-orbit]')?.dataset.orbit;
      if (action === 'reset') {
        this.camera = { ...defaultCamera };
        this.draw();
      } else if (moves[action]) {
        this.move(...moves[action]);
      }
    });
    this.stage.addEventListener('pointerdown', event => this.startDrag(event));
    this.stage.addEventListener('pointermove', event => this.dragCamera(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.stage.addEventListener(type, event => {
        if (type === 'lostpointercapture' && event.target !== this.stage) return;
        if (this.drag?.id !== event.pointerId) return;
        this.drag = null;
        this.stage.classList.remove('is-orbiting');
      });
    }
    this.stage.addEventListener('click', event => {
      const key = event.target.closest('[data-scene-key]')?.dataset.sceneKey;
      if (key !== undefined && !this.dragged) this.select(Number(key));
    });
    this.stage.addEventListener('keydown', event => {
      const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'nearer', '-': 'farther' }[event.key];
      const key = event.target.dataset.sceneKey;
      if (direction) {
        event.preventDefault();
        this.move(...moves[direction]);
      } else if (key !== undefined && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.select(Number(key));
      }
    });
  }

  reset() {
    cancelAnimationFrame(this.frame);
    this.drag = null;
    this.dragged = false;
    this.selected = null;
    this.camera = { ...defaultCamera };
    this.stage.classList.remove('is-orbiting');
  }

  startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const { pointerId: id, clientX: x, clientY: y } = event;
    this.drag = { id, x, y, ...this.camera };
    this.dragged = false;
  }

  dragCamera(event) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!this.dragged) {
      if (Math.hypot(dx, dy) < 5) return;
      this.stage.setPointerCapture(drag.id);
      this.stage.classList.add('is-orbiting');
      this.dragged = true;
    }
    this.camera.yaw = (drag.yaw + dx * .012) % (2 * Math.PI);
    this.camera.pitch = clamp(drag.pitch + dy * .01, -1.05, 1.05);
    this.draw();
  }

  move(yaw, pitch, zoom) {
    this.camera.yaw = (this.camera.yaw + yaw) % (2 * Math.PI);
    this.camera.pitch = clamp(this.camera.pitch + pitch, -1.05, 1.05);
    this.camera.zoom = clamp(this.camera.zoom + zoom, .72, 1.42);
    this.draw();
  }

  render(root, roles, animate) {
    cancelAnimationFrame(this.frame);
    this.nodes = layoutRotationTree(root);
    this.roles = new Map(Object.entries(roles).map(([role, key]) => [key, role]));
    for (const [key, control] of this.controls) {
      if (this.nodes.has(key)) continue;
      control.remove();
      this.controls.delete(key);
    }
    for (const key of [...this.nodes.keys()].sort((a, b) => a - b)) {
      if (this.controls.has(key)) continue;
      const label = svgElement('g', { class: 'orbit-node', tabindex: '0', role: 'button', 'data-scene-key': key });
      const text = svgElement('text', { y: -23 });
      text.textContent = formatPrice(key);
      label.append(svgElement('circle', { r: 22, class: 'orbit-node-hit' }), text);
      this.labels.append(label);
      this.controls.set(key, label);
    }
    if (!this.nodes.has(this.selected)) this.selected = roles.branch;
    this.updateSelection();

    const start = this.points;
    const finish = new Map([...this.nodes].map(([key, { center }]) => [key, center]));
    if (!animate || document.documentElement.hasAttribute('data-reduce-motion') || !start.size) {
      this.points = finish;
      this.draw();
      return;
    }
    const began = performance.now();
    const frame = now => {
      const progress = Math.min(1, (now - began) / 280);
      const eased = 1 - (1 - progress) ** 3;
      this.points = new Map([...finish].map(([key, to]) => {
        const from = start.get(key) ?? to;
        return [key, to.map((value, i) => from[i] + (value - from[i]) * eased)];
      }));
      this.draw();
      if (progress < 1) this.frame = requestAnimationFrame(frame);
    };
    this.frame = requestAnimationFrame(frame);
  }

  select(key) {
    this.selected = key;
    this.updateSelection();
    this.draw();
  }

  updateSelection() {
    for (const [key, label] of this.controls) {
      const { node } = this.nodes.get(key);
      label.setAttribute('aria-label', `${formatPrice(key)}, height ${node.height}, balance factor ${balance(node)}`);
      label.setAttribute('aria-pressed', key === this.selected);
    }
    const { node, parent } = this.nodes.get(this.selected);
    const link = key => key == null ? 'none' : formatPrice(key);
    this.inspector.textContent = `${formatPrice(node.key)} · Height ${node.height} · Balance factor ${balance(node)} · Parent ${parent == null ? 'none (root)' : formatPrice(parent)} · Left ${link(node.left?.key)} · Right ${link(node.right?.key)}`;
  }

  draw() {
    const project = rotationProjection(this.camera);
    const floor = [];
    for (let coordinate = -200; coordinate <= 200; coordinate += 40) {
      floor.push(this.line(project([-200, -138, coordinate]), project([200, -138, coordinate]), 'orbit-grid'));
      floor.push(this.line(project([coordinate, -138, -200]), project([coordinate, -138, 200]), 'orbit-grid'));
    }
    const links = [];
    const surfaces = [];
    for (const [key, point] of this.points) {
      const center = project(point);
      const { parent } = this.nodes.get(key);
      const role = this.roles.get(key) ?? 'regular';
      const label = this.controls.get(key);
      label.setAttribute('transform', `translate(${center.x} ${center.y})`);
      if (parent !== null) {
        const link = this.line(project(this.points.get(parent)), center, 'orbit-link', {
          'data-scene-parent': parent, 'data-scene-child': key,
        });
        link.classList.toggle('is-branch', role === 'branch');
        link.classList.toggle('is-connected', this.selected === parent || this.selected === key);
        links.push(link);
      }
      const vertices = corners.map(corner => project(point.map((value, i) => value + corner[i])));
      for (const [index, indices] of faces.entries()) {
        const face = indices.map(i => vertices[i]);
        const points = face.map(vertex => `${vertex.x},${vertex.y}`).join(' ');
        surfaces.push({
          depth: face.reduce((sum, vertex) => sum + vertex.depth, 0) / face.length,
          polygon: svgElement('polygon', { points, class: `orbit-face face-${index}`, 'data-role': role }),
        });
      }
    }
    surfaces.sort((a, b) => a.depth - b.depth);
    this.geometry.replaceChildren(...floor, ...links, ...surfaces.map(({ polygon }) => polygon));
  }

  line(start, end, className, attributes = {}) {
    return svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: className, ...attributes });
  }
}
