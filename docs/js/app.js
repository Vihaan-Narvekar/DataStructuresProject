import { Experiment, MAX_PRICES, RotationPractice } from './experiment.js';
import { formatPrice, generatePrices, parsePrice, parseSequence } from './prices.js';
import { balance, height, inOrderNodes } from './trees.js';
import { TreeView } from './tree-view.js';

const byId = id => document.getElementById(id);
const experiment = new Experiment();
const views = {
  bst: new TreeView(byId('bst-view'), { label: 'Ordinary binary search tree' }),
  avl: new TreeView(byId('avl-view'), { label: 'AVL tree' }),
};
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const sequencePanel = byId('sequence-panel');
const growth = byId('growth');
const labDialog = byId('lab-dialog');
const labView = new TreeView(byId('lab-view'), {
  label: 'Rotation exercise tree',
  onSelect: updateLabButtons,
  onDrop: (child, parent) => practiceMove(practice.drop(child, parent)),
});

let active = null;
let shownChallenge = null;
let lastSearchTarget = null;
let practice = null;
let solution = null;
let solutionIndex = 0;

byId('capacity').textContent = `Up to ${MAX_PRICES} prices per run`;
byId('rally-count').setAttribute('aria-describedby', 'capacity');
byId('open-guide').addEventListener('click', () => byId('guide').showModal());
const motionSetting = byId('reduce-motion');
function setReducedMotion(enabled) {
  motionSetting.checked = enabled;
  document.documentElement.toggleAttribute('data-reduce-motion', enabled);
}
setReducedMotion(motion.matches);
motion.addEventListener('change', event => setReducedMotion(event.matches));
motionSetting.addEventListener('change', () => setReducedMotion(motionSetting.checked));

function status(id, message = '', tone = '') {
  const element = byId(id);
  element.textContent = message;
  element.dataset.tone = tone;
}

function delay(ms, signal) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(true);
    }, motionSetting.checked ? Math.min(ms, 45) : ms);
    function abort() {
      clearTimeout(timer);
      resolve(false);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function cancelPlayback() {
  active?.controller.abort();
  active = null;
}

async function play(kind, action) {
  cancelPlayback();
  const session = { kind, controller: new AbortController(), pause: false };
  active = session;
  updateControls();
  try {
    await action(session);
  } finally {
    if (active === session) {
      active = null;
      updateControls();
    }
  }
}

function availableSteps() {
  const batch = experiment.batch;
  return Boolean(batch && batch.cursor < batch.keys.length);
}

function updateControls() {
  const total = experiment.history.length;
  const batch = experiment.batch;
  const batchPlaying = active?.kind === 'batch';
  byId('undo').disabled = !total;
  byId('clear').disabled = !total && !batch;
  byId('use-current').disabled = !total;
  byId('suggest-price').disabled = !total;
  byId('batch-bar').hidden = !batch;
  byId('step').disabled = !availableSteps() || Boolean(active);
  byId('play').disabled = batchPlaying ? active.pause : !availableSteps();
  byId('play').textContent = batchPlaying ? (active.pause ? 'Pausing…' : 'Pause') : 'Play ▶';
}

function renderBatch() {
  const batch = experiment.batch;
  if (!batch) return;
  const next = batch.keys[batch.cursor];
  byId('batch-position').textContent = next === undefined
    ? `Sequence complete · ${batch.cursor} of ${batch.keys.length} inserted`
    : `${batch.cursor} of ${batch.keys.length} inserted · Next ${formatPrice(next)}`;
  const list = byId('batch-prices');
  const scroll = list.scrollLeft;
  list.replaceChildren(...batch.keys.map((key, index) => {
    const chip = document.createElement('li');
    chip.textContent = formatPrice(key);
    if (index < batch.cursor) chip.setAttribute('data-placed', '');
    if (index === batch.cursor) chip.setAttribute('aria-current', 'step');
    return chip;
  }));
  list.scrollLeft = scroll;
}

function renderTrees(avl = experiment.avl) {
  views.bst.render(experiment.bst);
  views.avl.render(avl);
  renderStats(avl);
}

function renderStats(avl) {
  byId('bst-count').textContent = experiment.history.length;
  byId('avl-count').textContent = experiment.history.length;
  byId('bst-height').textContent = experiment.bst ? height(experiment.bst) : '−1';
  byId('avl-height').textContent = avl ? height(avl) : '−1';
}

function clearSearch() {
  lastSearchTarget = null;
  byId('search-results').hidden = true;
  byId('bst-prediction').value = '';
  byId('avl-prediction').value = '';
  status('search-status');
}

function updateChallenge() {
  const challenge = experiment.challenge;
  if (challenge === shownChallenge) return;
  shownChallenge = challenge;
  byId('challenge-controls').hidden = !challenge;
  byId('rotation-prediction').reset();
  status('rotation-feedback');
  byId('challenge-description').textContent = challenge
    ? `Inserting ${formatPrice(challenge.key)} gave ${formatPrice(challenge.pivot)} a balance factor of ${challenge.balance}. Its taller child, ${formatPrice(challenge.child)}, has a factor of ${challenge.childBalance}.`
    : 'Insert prices until the AVL tree needs a rotation. Then try the repair yourself.';
}

function updateRun() {
  clearSearch();
  updateControls();
  renderBatch();
  updateChallenge();
  if (growth.open) renderGrowth();
}

function showSequence(open, mode) {
  sequencePanel.hidden = !open;
  byId('sequence-toggle').setAttribute('aria-expanded', open);
  if (mode) chooseSequenceMode(mode);
}

function chooseSequenceMode(mode) {
  const isPaste = mode === 'paste';
  byId('paste-mode').setAttribute('aria-pressed', isPaste);
  byId('generate-mode').setAttribute('aria-pressed', !isPaste);
  byId('paste-form').hidden = !isPaste;
  byId('generator').hidden = isPaste;
  status('sequence-status');
}

function updatePreview() {
  const { preview, order } = experiment;
  byId('sequence-order').value = order;
  byId('shuffle-again').hidden = order !== 'shuffle';
  byId('shuffle-again').disabled = preview.length < 2;
  byId('start-replay').disabled = !preview.length || preview.length > MAX_PRICES;
  byId('preview-prices').textContent = preview.length
    ? preview.map(formatPrice).join(' → ')
    : 'Preview a sequence to see its order.';
}

byId('sequence-toggle').addEventListener('click', () => showSequence(sequencePanel.hidden));
byId('paste-mode').addEventListener('click', () => chooseSequenceMode('paste'));
byId('generate-mode').addEventListener('click', () => chooseSequenceMode('generate'));
byId('try-rally').addEventListener('click', () => {
  showSequence(true, 'generate');
  byId('rally-start').focus();
  byId('rally-start').select();
});

byId('paste-form').addEventListener('submit', event => {
  event.preventDefault();
  const { keys, invalid, duplicates } = parseSequence(byId('paste-prices').value);
  experiment.setSource(keys);
  updatePreview();
  const messages = [`${keys.length} unique ${keys.length === 1 ? 'price' : 'prices'} ready.`];
  if (invalid.length) messages.push(`Unrecognized: ${invalid.join(', ')}.`);
  if (duplicates.length) messages.push(`Duplicates skipped: ${duplicates.join(', ')}.`);
  if (keys.length > MAX_PRICES) messages.push(`Use ${MAX_PRICES} prices or fewer per run.`);
  status('sequence-status', messages.join(' '), invalid.length || keys.length > MAX_PRICES ? 'error' : '');
});

byId('generator').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const keys = generatePrices(byId('rally-start').value, byId('rally-step').value, byId('rally-count').value, MAX_PRICES);
    experiment.setSource(keys);
    experiment.setOrder('ascending');
    updatePreview();
    status('sequence-status', `${keys.length} prices ready for a rally.`, 'success');
  } catch (error) {
    status('sequence-status', error.message, 'error');
  }
});

byId('use-current').addEventListener('click', () => {
  experiment.setSource(experiment.history.map(entry => entry.key));
  updatePreview();
  status('sequence-status', 'Current prices are ready to replay.');
});
byId('sequence-order').addEventListener('change', event => {
  experiment.setOrder(event.target.value);
  updatePreview();
});
byId('shuffle-again').addEventListener('click', () => {
  experiment.setOrder('shuffle');
  updatePreview();
});

byId('start-replay').addEventListener('click', () => {
  if (!experiment.startReplay()) return;
  cancelPlayback();
  showSequence(false);
  updateRun();
  renderTrees();
  views.bst.resetLayout();
  views.avl.resetLayout();
  status('build-status', 'Replay ready. Step through the prices or press Play.');
  byId('step').focus();
});

byId('insert-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = byId('price');
  try {
    const key = parsePrice(input.value);
    const change = experiment.insertPrice(key);
    if (change.status === 'duplicate') {
      status('build-status', `${formatPrice(key)} is already in both trees.`, 'error');
      return;
    }
    if (change.status === 'full') {
      status('build-status', `This run already has ${MAX_PRICES} prices. Undo an insertion or clear the trees.`, 'error');
      return;
    }
    input.value = '';
    input.focus();
    play('insert', session => showInsertion(change, session.controller.signal));
  } catch (error) {
    status('build-status', error.message, 'error');
  }
});

byId('step').addEventListener('click', () => {
  if (active) return;
  const change = experiment.step();
  if (change) play('step', session => showInsertion(change, session.controller.signal));
});

byId('play').addEventListener('click', () => {
  if (active?.kind === 'batch') {
    active.pause = true;
    updateControls();
    return;
  }
  if (!availableSteps()) return;
  play('batch', async session => {
    const { signal } = session.controller;
    while (!signal.aborted && !session.pause && availableSteps()) {
      await showInsertion(experiment.step(), signal, true);
    }
    if (signal.aborted) return;
    if (session.pause && availableSteps()) status('build-status', 'Replay paused.');
    if (!availableSteps()) status('build-status', 'Replay complete. Try searching for a price.', 'success');
  });
});

byId('undo').addEventListener('click', () => {
  cancelPlayback();
  const key = experiment.undo();
  updateRun();
  renderTrees();
  if (key !== null) status('build-status', `Removed ${formatPrice(key)} from both trees.`);
  if (byId('undo').disabled) byId('price').focus();
});
byId('clear').addEventListener('click', () => {
  cancelPlayback();
  experiment.clear();
  updateRun();
  renderTrees();
  views.bst.resetLayout();
  views.avl.resetLayout();
  status('build-status', 'Both trees are empty.');
  byId('price').focus();
});

async function showInsertion(change, signal, quick = false) {
  const { entry, bstPath, avlPath, rotation } = change;
  updateRun();
  renderTrees(rotation?.before);
  status('build-status', `Inserting ${formatPrice(entry.key)}`);
  if (!quick) {
    await showPaths({ bst: bstPath, avl: avlPath }, signal, false);
    if (signal.aborted) return;
  }
  views.bst.highlight(bstPath, entry.key, true);
  views.avl.highlight(avlPath, entry.key, true);
  if (!await delay(quick ? 200 : 255, signal)) return;

  if (rotation) {
    for (const step of rotation.steps) {
      status('build-status', `AVL · Rotate ${step.direction} at ${formatPrice(step.pivot)}`);
      views.avl.render(step.tree, { animate: true });
      renderStats(step.tree);
      views.avl.highlight([step.pivot], step.promoted, true);
      if (!await delay(quick ? 285 : 440, signal)) return;
    }
    views.avl.render(experiment.avl);
    views.avl.highlight([], entry.key, true);
  }
  renderStats(experiment.avl);
  status('build-status', `Inserted ${formatPrice(entry.key)} into both trees.`, 'success');
}

async function showPaths(paths, signal, searchAnimation) {
  const length = Math.max(paths.bst.length, paths.avl.length);
  const interval = searchAnimation ? Math.min(270, 3600 / length) : Math.min(120, 850 / length);
  for (let index = 0; index < length; index++) {
    for (const type of ['bst', 'avl']) {
      const path = paths[type];
      if (index < path.length) views[type].highlight(path.slice(0, index + 1), path[index], true);
    }
    if (!await delay(interval, signal)) return;
  }
}

byId('suggest-price').addEventListener('click', () => {
  const suggestion = experiment.suggestTarget();
  if (suggestion === null) return;
  const field = byId('search-price');
  field.value = formatPrice(suggestion).replace(/[$,]/g, '');
  field.focus();
});

byId('search-form').addEventListener('submit', event => {
  event.preventDefault();
  let target;
  const predictions = {};
  try {
    target = parsePrice(byId('search-price').value);
    for (const tree of ['bst', 'avl']) {
      const field = byId(`${tree}-prediction`);
      const count = field.value;
      if (field.validity.badInput || (count !== '' && (!Number.isSafeInteger(Number(count)) || Number(count) < 0))) {
        byId('predictions').open = true;
        field.focus();
        throw new Error('Use a whole number of comparisons, zero or more.');
      }
      predictions[tree] = count === '' ? null : Number(count);
    }
  } catch (error) {
    status('search-status', error.message, 'error');
    return;
  }

  const outcome = experiment.search(target);
  const paths = { bst: outcome.bst.visited, avl: outcome.avl.visited };
  byId('search-results').hidden = true;
  if (paths.bst.length) document.querySelector('.tree-grid').scrollIntoView({ block: 'nearest' });
  play('search', async session => {
    const { signal } = session.controller;
    renderTrees();
    status('search-status', `Tracing the search for ${formatPrice(target)}.`);
    await showPaths(paths, signal, true);
    if (signal.aborted) return;
    lastSearchTarget = target;
    renderResults(outcome, predictions);
    if (growth.open) renderGrowth();
    const { bst, avl } = outcome;
    const tally = bst.comparisons === avl.comparisons
      ? 'Both trees visited the same number of nodes.'
      : `${bst.comparisons < avl.comparisons ? 'The BST' : 'The AVL tree'} visited fewer nodes for this target.`;
    status('search-status', `${formatPrice(target)} · BST: ${bst.comparisons}, AVL: ${avl.comparisons}. ${tally}`);
  });
});

function renderResults(outcome, predictions) {
  const results = byId('search-results');
  results.replaceChildren(...['bst', 'avl'].map(type => {
    const result = outcome[type];
    const card = document.createElement('div');
    card.className = 'result';
    const title = document.createElement('h3');
    title.textContent = type === 'bst' ? 'Ordinary BST' : 'AVL tree';
    const count = document.createElement('p');
    count.textContent = `${result.found ? 'Found' : 'Missing'} · ${result.comparisons} ${result.comparisons === 1 ? 'comparison' : 'comparisons'}`;
    const path = document.createElement('p');
    path.className = 'path';
    path.textContent = result.visited.length ? result.visited.map(formatPrice).join(' → ') : 'Empty path';
    card.append(title, count, path);
    if (predictions[type] !== null) {
      const feedback = document.createElement('p');
      feedback.textContent = predictions[type] === result.comparisons
        ? 'Your prediction was correct.'
        : `Your prediction was ${predictions[type]}. The highlighted path shows the visits counted.`;
      card.append(feedback);
    }
    return card;
  }));
  results.hidden = false;
}

function renderGrowth() {
  const table = byId('growth-table');
  table.replaceChildren();
  const rows = experiment.summary(lastSearchTarget);
  byId('growth-empty').hidden = Boolean(rows.length);
  byId('growth-table-wrap').hidden = !rows.length;
  if (!rows.length) return;

  const cols = ['Nodes', 'Added price', 'BST height', 'AVL height'];
  const includeSearch = lastSearchTarget !== null;
  if (includeSearch) {
    cols.push('BST comparisons', 'AVL comparisons');
    table.createCaption().textContent = `Search target at each insertion: ${formatPrice(lastSearchTarget)}`;
  }
  const headings = table.createTHead().insertRow();
  for (const label of cols) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    headings.append(heading);
  }
  const body = table.createTBody();
  for (const [index, entry] of rows.entries()) {
    const row = body.insertRow();
    const cells = [index + 1, formatPrice(entry.key), entry.bstHeight, entry.avlHeight];
    if (includeSearch) cells.push(entry.bstSearch, entry.avlSearch);
    for (const text of cells) row.insertCell().textContent = text;
  }
}

growth.addEventListener('toggle', () => {
  if (growth.open) renderGrowth();
});

byId('rotation-prediction').addEventListener('submit', event => {
  event.preventDefault();
  const challenge = experiment.challenge;
  if (!challenge) return;
  const correct = challenge.steps.map(step => step.direction).join('-');
  const answer = byId('rotation-answer').value;
  const explanation = challenge.steps.map(step => `${step.direction} at ${formatPrice(step.pivot)}`).join(', then ');
  const result = answer === correct ? 'Correct.' : 'Try replaying the repair.';
  status('rotation-feedback', `${result} ${challenge.caseName} imbalance: rotate ${explanation}.`, answer === correct ? 'success' : '');
});

byId('open-practice').addEventListener('click', () => openLab(true));
byId('open-solution').addEventListener('click', () => openLab(false));
byId('rotate-left').addEventListener('click', () => practiceMove(practice.rotate(labView.selection, 'left')));
byId('rotate-right').addEventListener('click', () => practiceMove(practice.rotate(labView.selection, 'right')));
byId('undo-rotation').addEventListener('click', () => {
  if (practice.undo()) renderPractice('Undid the last move.');
});
byId('retry-rotation').addEventListener('click', () => {
  practice.retry();
  labView.select(solution.pivot);
  renderPractice('Returned to the original imbalance.');
});
byId('solution-back').addEventListener('click', () => {
  solutionIndex--;
  renderSolution();
});
byId('solution-next').addEventListener('click', () => {
  solutionIndex++;
  renderSolution();
});
labDialog.addEventListener('close', () => {
  practice = null;
  solution = null;
});

function openLab(interactive) {
  solution = experiment.challenge;
  if (!solution) return;
  cancelPlayback();
  renderTrees();
  updateControls();
  practice = interactive ? new RotationPractice(solution.before) : null;
  labView.mode = interactive ? 'practice' : 'read';
  byId('lab-title').textContent = interactive ? 'Rotation practice' : 'Replay the repair';
  byId('lab-instruction').textContent = interactive
    ? 'Promote a child by dragging it onto its parent, or select a pivot and use the rotation buttons. Bring every balance factor within −1 to 1.'
    : `Follow the ${solution.caseName.toLowerCase()} repair after inserting ${formatPrice(solution.key)}.`;
  byId('practice-actions').hidden = !interactive;
  byId('solution-actions').hidden = interactive;
  labDialog.showModal();
  labView.resetLayout();
  if (practice) {
    renderPractice();
    labView.select(solution.pivot);
    labView.ensureVisible(solution.pivot);
  } else {
    solutionIndex = 0;
    renderSolution();
  }
}

function updateLabButtons(node) {
  byId('rotate-left').disabled = !node?.right;
  byId('rotate-right').disabled = !node?.left;
  byId('undo-rotation').disabled = !practice?.history.length;
}

function renderLabTree(root, animate) {
  labView.render(root, { animate });
  byId('lab-traversal').textContent = inOrderNodes(root).map(node => formatPrice(node.key)).join(' → ');
}

function renderPractice(action = '', animate = false) {
  renderLabTree(practice.root, animate);
  const violations = practice.violations();
  const feedback = violations.length
    ? `Still out of balance: ${violations.map(node => `${formatPrice(node.key)} (BF ${balance(node)})`).join(', ')}.`
    : 'Balanced. The keys are still in sorted order.';
  status('lab-status', [action, feedback].filter(Boolean).join(' '), violations.length ? '' : 'success');
}

function practiceMove(move) {
  if (!move) {
    status('lab-status', 'Drop a node onto its direct parent to rotate that subtree.', 'error');
    return;
  }
  renderPractice(`Rotated ${move.direction} at ${formatPrice(move.pivot)}, promoting ${formatPrice(move.promoted)}.`, true);
  labView.select(move.promoted);
}

function renderSolution() {
  const step = solution.steps[solutionIndex - 1];
  const pivot = step?.promoted ?? solution.pivot;
  renderLabTree(step?.tree ?? solution.before, Boolean(step));
  labView.highlight(step ? [step.pivot] : [], pivot, true);
  byId('solution-back').disabled = solutionIndex === 0;
  byId('solution-next').disabled = solutionIndex === solution.steps.length;
  const action = step
    ? `Rotate ${step.direction} at ${formatPrice(step.pivot)} to promote ${formatPrice(step.promoted)}.`
    : `Before rotation, ${formatPrice(solution.pivot)} has balance factor ${solution.balance}.`;
  status('lab-status', `Frame ${solutionIndex + 1} of ${solution.steps.length + 1}. ${action}`);
}

renderTrees();
updateControls();
updatePreview();
