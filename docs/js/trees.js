export const height = node => node?.height ?? -1;
export const balance = node => height(node.left) - height(node.right);

function updateHeight(node) {
  node.height = 1 + Math.max(height(node.left), height(node.right));
}

function leaf(key) {
  return { key, left: null, right: null, height: 0 };
}

function pathTo(root, key) {
  const path = [];
  for (let node = root; node; node = node[key < node.key ? 'left' : 'right']) {
    path.push(node);
    if (node.key === key) break;
  }
  return path;
}

function rotateLeft(pivot) {
  const promoted = pivot.right;
  pivot.right = promoted.left;
  promoted.left = pivot;
  updateHeight(pivot);
  updateHeight(promoted);
  return promoted;
}

function rotateRight(pivot) {
  const promoted = pivot.left;
  pivot.left = promoted.right;
  promoted.right = pivot;
  updateHeight(pivot);
  updateHeight(promoted);
  return promoted;
}

function reconnect(root, parent, pivot, replacement) {
  if (!parent) return replacement;
  parent[parent.left === pivot ? 'left' : 'right'] = replacement;
  return root;
}

export function insert(root, key, { avl = false, trace = true } = {}) {
  const path = pathTo(root, key);
  const parent = path.at(-1);
  const visited = path.map(node => node.key);
  if (parent?.key === key) return { root, visited, inserted: false, rotation: null };

  const node = leaf(key);
  if (parent) parent[key < parent.key ? 'left' : 'right'] = node;
  else root = node;

  let rotation = null;
  for (let index = path.length - 1; index >= 0; index--) {
    const pivot = path[index];
    updateHeight(pivot);
    const factor = balance(pivot);
    if (!avl || Math.abs(factor) <= 1) continue;

    const leaningLeft = factor > 0;
    const child = leaningLeft ? pivot.left : pivot.right;
    const childFactor = balance(child);
    const double = leaningLeft ? childFactor < 0 : childFactor > 0;
    if (trace) {
      rotation = {
        pivot: pivot.key,
        balance: factor,
        child: child.key,
        childBalance: childFactor,
        caseName: [leaningLeft, double ? !leaningLeft : leaningLeft]
          .map(left => left ? 'Left' : 'Right').join('–'),
        before: copyTree(root),
        steps: [],
      };
    }

    if (double) {
      const promoted = leaningLeft ? rotateLeft(child) : rotateRight(child);
      root = reconnect(root, pivot, child, promoted);
      if (rotation) recordStep(rotation, root, child, promoted, leaningLeft ? 'left' : 'right');
    }
    const promoted = leaningLeft ? rotateRight(pivot) : rotateLeft(pivot);
    root = reconnect(root, path[index - 1], pivot, promoted);
    if (rotation) recordStep(rotation, root, pivot, promoted, leaningLeft ? 'right' : 'left');
  }

  return { root, visited, inserted: true, rotation };
}

function recordStep(rotation, root, pivot, promoted, direction) {
  rotation.steps.push({ direction, pivot: pivot.key, promoted: promoted.key, tree: copyTree(root) });
}

export function search(root, key) {
  const path = pathTo(root, key);
  return {
    found: path.at(-1)?.key === key,
    visited: path.map(node => node.key),
    comparisons: path.length,
  };
}

export function rotateAt(root, key, direction) {
  const path = pathTo(root, key);
  const pivot = path.pop();
  const rotatingLeft = direction === 'left';
  const child = rotatingLeft ? pivot?.right : pivot?.left;
  if (pivot?.key !== key || !child) return null;

  const newRoot = rotatingLeft ? rotateLeft(pivot) : rotateRight(pivot);
  root = reconnect(root, path.at(-1), pivot, newRoot);
  for (let index = path.length - 1; index >= 0; index--) updateHeight(path[index]);
  return { root, promoted: newRoot.key };
}

export function copyTree(root) {
  if (!root) return null;
  const copy = leaf(root.key);
  const copies = [{ source: root, target: copy }];
  for (const { source, target } of copies) {
    for (const side of ['left', 'right']) {
      if (!source[side]) continue;
      target[side] = leaf(source[side].key);
      copies.push({ source: source[side], target: target[side] });
    }
  }
  for (let index = copies.length - 1; index >= 0; index--) updateHeight(copies[index].target);
  return copy;
}

export function inOrderNodes(root) {
  const output = [];
  const stack = [];
  let node = root;
  while (node || stack.length) {
    while (node) {
      stack.push(node);
      node = node.left;
    }
    node = stack.pop();
    output.push(node);
    node = node.right;
  }
  return output;
}

export function deepestKey(root) {
  let node = root;
  while (node && node.height > 0) {
    node = height(node.left) >= height(node.right) ? node.left : node.right;
  }
  return node?.key ?? null;
}
