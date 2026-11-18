import { orderPrices } from './prices.js';
import { balance, copyTree, deepestKey, height, inOrderNodes, insert, rotateAt, search } from './trees.js';

export const MAX_PRICES = 64;

export class Experiment {
  source = [];
  order = 'entered';
  preview = [];
  batch = null;
  history = [];
  bst = null;
  avl = null;
  challenge = null;
  #keys = new Set();

  setSource(keys) {
    this.source = [...new Set(keys)];
    this.setOrder(this.order);
  }

  setOrder(order, random) {
    this.order = order;
    this.preview = orderPrices(this.source, order, random);
  }

  clear() {
    this.batch = null;
    this.#resetTrees();
  }

  startReplay() {
    if (!this.preview.length || this.preview.length > MAX_PRICES) return false;
    this.#resetTrees();
    this.batch = { keys: [...this.preview], cursor: 0 };
    return true;
  }

  step() {
    if (!this.batch || this.batch.cursor >= this.batch.keys.length) return null;
    const index = this.batch.cursor++;
    return this.#record(this.batch.keys[index], index);
  }

  insertPrice(key) {
    if (this.#keys.has(key)) return { status: 'duplicate' };
    if (this.history.length >= MAX_PRICES) return { status: 'full' };
    this.batch = null;
    return { status: 'inserted', ...this.#record(key, null) };
  }

  undo() {
    const removed = this.history.at(-1);
    if (!removed) return null;
    const remaining = this.history.slice(0, -1);
    this.#resetTrees();
    for (const { key, batchIndex } of remaining) this.#record(key, batchIndex);
    if (this.batch && removed.batchIndex !== null) this.batch.cursor = removed.batchIndex;
    return removed.key;
  }

  search(target) {
    return { target, bst: search(this.bst, target), avl: search(this.avl, target) };
  }

  suggestTarget() {
    return deepestKey(this.bst);
  }

  summary(target) {
    if (target == null) return this.history;
    let bst = null;
    let avl = null;
    return this.history.map(entry => {
      bst = insert(bst, entry.key).root;
      avl = insert(avl, entry.key, { avl: true, trace: false }).root;
      return {
        ...entry,
        bstSearch: search(bst, target).comparisons,
        avlSearch: search(avl, target).comparisons,
      };
    });
  }

  #record(key, batchIndex) {
    const bst = insert(this.bst, key);
    const avl = insert(this.avl, key, { avl: true });
    this.bst = bst.root;
    this.avl = avl.root;
    this.#keys.add(key);
    const entry = { key, batchIndex, bstHeight: height(this.bst), avlHeight: height(this.avl) };
    this.history.push(entry);
    if (avl.rotation) this.challenge = { key, ...avl.rotation };
    return { entry, bstPath: bst.visited, avlPath: avl.visited, rotation: avl.rotation };
  }

  #resetTrees() {
    this.#keys.clear();
    this.history = [];
    this.bst = null;
    this.avl = null;
    this.challenge = null;
  }
}

export class RotationPractice {
  constructor(before) {
    this.initial = before;
    this.retry();
  }

  retry() {
    this.root = copyTree(this.initial);
    this.history = [];
  }

  drop(child, parent) {
    const pivot = inOrderNodes(this.root).find(node => node.key === parent);
    if (pivot?.left?.key === child) return this.rotate(parent, 'right');
    if (pivot?.right?.key === child) return this.rotate(parent, 'left');
    return null;
  }

  rotate(pivot, direction) {
    const before = copyTree(this.root);
    const result = rotateAt(this.root, pivot, direction);
    if (!result) return null;
    this.history.push(before);
    this.root = result.root;
    return { direction, pivot, promoted: result.promoted };
  }

  undo() {
    if (!this.history.length) return false;
    this.root = this.history.pop();
    return true;
  }

  violations() {
    return inOrderNodes(this.root).filter(node => Math.abs(balance(node)) > 1);
  }
}
