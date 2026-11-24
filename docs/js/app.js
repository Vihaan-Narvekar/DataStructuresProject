import { Experiment, MAX_PRICES, RotationPractice } from './experiment.js';
import { renderGrowthPlots } from './growth-view.js';
import { formatPrice, generatePrices, parsePrice, parseSequence } from './prices.js';
import { balancedReplayOrder, buildRallyExample, RALLY_FIRST_IMBALANCE, RALLY_PRICES, RALLY_TARGET } from './rally.js';
import { RotationScene } from './rotation-scene.js';
import { balance, copyTree, height, inOrderNodes } from './trees.js';
import { TreeView } from './tree-view.js';

const byId = id => document.getElementById(id);
const experiment = new Experiment();
const rallyExample = buildRallyExample();
const exampleGrowthLabel = 'Example market rally';
const views = {
  bst: new TreeView(byId('bst-view'), { label: 'Ordinary binary search tree' }),
  avl: new TreeView(byId('avl-view'), { label: 'AVL tree' }),
};
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const sequencePanel = byId('sequence-panel');
const growth = byId('growth');
const toolbar = document.querySelector('.comparison-toolbar');
const labDialog = byId('lab-dialog');
const labHost = byId('lab-view');
const orbitHost = byId('lab-3d');
const rotationScene = new RotationScene(orbitHost);
const labView = new TreeView(labHost, {
  label: 'Rotation exercise tree',
  onSelect: updateLabButtons,
  onDrop: (child, parent) => practiceMove(practice.drop(child, parent)),
});

let active = null;
let runKind = 'custom';
let rallyResult = null;
let alternateResult = null;
let growthSelection = null;
let pendingRepair = null;
let shownChallenge = null;
let lastSearchTarget = null;
let practice = null;
let solution = null;
let solutionIndex = 0;
let currentLabTree = null;
let showingCurrentLabTree = false;
let labExample = false;
let labRoles = {};
let labRoot = null;
let labOpener = null;

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
  const startingFocus = document.activeElement;
  const session = { kind, controller: new AbortController(), pause: false };
  active = session;
  updateControls();
  try {
    await action(session);
  } finally {
    if (active === session) {
      const focused = document.activeElement === document.body ? startingFocus : document.activeElement;
      active = null;
      updateControls();
      const leavingPlayback = [byId('play'), byId('step'), byId('search-counts')].includes(focused);
      const next = pendingRepair ? byId('view-rally-repair')
        : [byId('view-comparison'), byId('replay-alternate'), byId('predict-rally')].find(button => !button.hidden);
      if (leavingPlayback && next) next.focus({ preventScroll: true });
      else if (document.activeElement === document.body && focused === byId('step') && !focused.disabled) focused.focus({ preventScroll: true });
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
  byId('replay-current').hidden = !total;
  byId('open-3d').disabled = byId('review-transfer').disabled = Boolean(batch && !total);
  byId('review-transfer').textContent = experiment.challenge ? 'Review last AVL repair' : total ? 'View current AVL tree' : 'Review example rotation';
  byId('rotation-review-description').textContent = experiment.challenge
    ? `Step through the repair triggered by ${formatPrice(experiment.challenge.key)}.`
    : total || batch ? 'Inspect the tree formed by your current prices.' : 'On the sixth rally insertion, the branch rooted at $102 changes parents.';
  byId('suggest-price').disabled = !total;
  byId('batch-bar').hidden = !batch;
  byId('step').disabled = !availableSteps() || Boolean(active);
  byId('step').textContent = pendingRepair ? 'Step through repair' : 'Step →';
  byId('play').disabled = batchPlaying ? active.pause : !availableSteps();
  byId('play').textContent = batchPlaying ? (active.pause ? 'Pausing…' : 'Pause') : 'Play ▶';
  byId('repair-pause').hidden = !pendingRepair || Boolean(active);
  byId('search-submit').disabled = Boolean(pendingRepair) || (runKind !== 'custom' && (availableSteps() || (active && active.kind !== 'search')));
  const guidedFinished = runKind !== 'custom' && !availableSteps() && !batchPlaying;
  byId('predict-rally').hidden = runKind !== 'rally' || !guidedFinished || Boolean(active) || Boolean(rallyResult);
  byId('step').hidden = byId('play').hidden = guidedFinished;
  byId('replay-alternate').disabled = Boolean(active);
  byId('view-comparison').hidden = !alternateResult;
}

function renderBatch() {
  const batch = experiment.batch;
  if (!batch) return;
  const next = batch.keys[batch.cursor];
  const progress = next === undefined
    ? `Sequence complete · ${batch.cursor} of ${batch.keys.length} inserted`
    : `${batch.cursor} of ${batch.keys.length} inserted · Next ${formatPrice(next)}`;
  const label = { rally: 'Rally', alternate: 'Different order' }[runKind];
  byId('batch-position').textContent = label ? `${label} · ${progress}` : progress;
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
  const current = list.querySelector('[aria-current]');
  if (current) {
    const viewport = list.getBoundingClientRect();
    const chip = current.getBoundingClientRect();
    if (chip.right > viewport.right) list.scrollLeft += chip.right - viewport.right;
    if (chip.left < viewport.left) list.scrollLeft -= viewport.left - chip.left;
  }
}

function renderTrees(avl = experiment.avl, imbalance = null) {
  views.bst.render(experiment.bst);
  views.avl.render(avl, { imbalance });
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
  byId('search-counts').hidden = true;
  byId('search-results').hidden = true;
  byId('search-results').removeAttribute('aria-busy');
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
  if (runKind === 'custom') byId('search-prompt').textContent = 'Which tree will visit fewer nodes for the same price?';
  updateControls();
  renderBatch();
  updateChallenge();
  renderGrowth();
  renderComparison();
}

function resetGuidedRun() {
  rallyResult = null;
  alternateResult = null;
  growthSelection = null;
  pendingRepair = null;
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
byId('try-rally').addEventListener('click', () => startRun('rally', RALLY_PRICES));
byId('replay-alternate').addEventListener('click', () => {
  if (rallyResult && runKind === 'rally') startRun('alternate', balancedReplayOrder(rallyResult.order));
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

function startRun(kind, keys) {
  if (!experiment.startReplay(keys)) return;
  cancelPlayback();
  if (kind !== 'alternate') resetGuidedRun();
  runKind = kind;
  showSequence(false);
  updateRun();
  renderTrees();
  views.bst.resetLayout();
  views.avl.resetLayout();
  if (kind === 'custom') {
    status('build-status', 'Replay ready. Step through the prices or press Play.');
    byId('step').focus();
  } else {
    byId('search-prompt').textContent = 'Finish the replay to search the completed trees.';
    byId('comparison-start').scrollIntoView({ block: 'start' });
    byId('play').focus({ preventScroll: true });
    playBatch();
  }
}

byId('start-replay').addEventListener('click', () => startRun('custom'));
byId('replay-current').addEventListener('click', () => {
  const keys = experiment.history.map(({ key }) => key);
  startRun('custom', keys);
  status('build-status', `Replay ready with the ${keys.length} prices already inserted in your run.`);
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
    runKind = 'custom';
    resetGuidedRun();
    play('insert', session => showInsertion(change, session.controller.signal));
  } catch (error) {
    status('build-status', error.message, 'error');
  }
});

byId('step').addEventListener('click', () => {
  if (active) return;
  if (!availableSteps()) return;
  play('step', async session => {
    const { signal } = session.controller;
    if (pendingRepair) await continueRepair(signal);
    else await showInsertion(experiment.step(), signal);
    if (!signal.aborted && !availableSteps()) await finishBatch(signal);
  });
});

function playBatch() {
  if (active?.kind === 'batch') {
    active.pause = true;
    updateControls();
    return;
  }
  if (!availableSteps()) return;
  play('batch', async session => {
    const { signal } = session.controller;
    if (pendingRepair) await continueRepair(signal, true);
    while (!signal.aborted && !session.pause && !pendingRepair && availableSteps()) {
      await showInsertion(experiment.step(), signal, true);
    }
    if (signal.aborted) return;
    if (session.pause && !pendingRepair && availableSteps()) status('build-status', 'Replay paused.');
    if (!availableSteps()) await finishBatch(signal);
  });
}
byId('play').addEventListener('click', playBatch);

async function finishBatch(signal) {
  if (runKind === 'alternate') {
    byId('search-price').value = String(RALLY_TARGET / 100);
    byId('search-prompt').textContent = 'The same $107 target is searched in both trees again.';
    status('build-status', 'Different order complete. Searching for $107.', 'success');
    await showSearch(RALLY_TARGET, { bst: null, avl: null }, signal);
  } else if (runKind === 'rally') {
    byId('search-price').value = String(RALLY_TARGET / 100);
    byId('predictions').open = true;
    byId('search-prompt').textContent = 'How many comparisons will each tree make to find $107?';
    status('build-status', 'Rally complete. Predict the comparisons for $107.', 'success');
  } else {
    status('build-status', 'Replay complete. Try searching for a price.', 'success');
  }
}

byId('predict-rally').addEventListener('click', () => {
  byId('search-price').value = String(RALLY_TARGET / 100);
  byId('predictions').open = true;
  scrollBelowToolbar(byId('search-form').closest('section'));
  byId('bst-prediction').focus({ preventScroll: true });
});
byId('view-comparison').addEventListener('click', () => {
  const results = byId('comparison-results');
  scrollBelowToolbar(results);
  results.focus({ preventScroll: true });
});

function scrollBelowToolbar(section) {
  const top = window.scrollY + section.getBoundingClientRect().top - toolbar.offsetHeight - 10;
  window.scrollTo({ top });
}

byId('undo').addEventListener('click', () => {
  cancelPlayback();
  runKind = 'custom';
  resetGuidedRun();
  const key = experiment.undo();
  updateRun();
  renderTrees();
  if (key !== null) status('build-status', `Removed ${formatPrice(key)} from both trees.`);
  if (byId('undo').disabled) byId('price').focus();
});
byId('clear').addEventListener('click', () => {
  cancelPlayback();
  runKind = 'custom';
  resetGuidedRun();
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
  const pausesForRepair = runKind === 'rally' && rotation && entry.key === RALLY_FIRST_IMBALANCE;
  updateRun();
  renderTrees(rotation?.before, pausesForRepair ? rotation.pivot : null);
  status('build-status', `Inserting ${formatPrice(entry.key)}`);
  if (!quick) {
    await showPaths({ bst: bstPath, avl: avlPath }, signal, false);
    if (signal.aborted) return;
  }
  views.bst.highlight(bstPath, entry.key, true);
  views.avl.highlight(avlPath, entry.key, true);
  if (!await delay(quick ? 200 : 255, signal)) return;

  if (pausesForRepair) {
    pendingRepair = experiment.challenge;
    const detail = `${formatPrice(rotation.pivot)} has balance factor ${rotation.balance}. Its right child is ${formatPrice(rotation.child)}.`;
    byId('repair-details').textContent = detail;
    status('build-status', `Paused for AVL repair. ${detail}`);
    views.avl.highlight([rotation.child], rotation.pivot, true);
    views.avl.select(rotation.pivot);
    return;
  }
  if (rotation && !await showRotation(rotation, entry.key, signal, quick)) return;
  renderStats(experiment.avl);
  status('build-status', `Inserted ${formatPrice(entry.key)} into both trees.`, 'success');
}

async function continueRepair(signal, quick = false) {
  const repair = pendingRepair;
  pendingRepair = null;
  updateControls();
  if (await showRotation(repair, repair.key, signal, quick)) {
    renderStats(experiment.avl);
    status('build-status', 'AVL repaired. Both trees are ready for the next price.', 'success');
  }
}

async function showRotation(rotation, key, signal, quick) {
  for (const step of rotation.steps) {
    status('build-status', `AVL · Rotate ${step.direction} at ${formatPrice(step.pivot)}`);
    views.avl.render(step.tree, { animate: true });
    renderStats(step.tree);
    views.avl.highlight([step.pivot], step.promoted, true);
    if (!await delay(quick ? 285 : 440, signal)) return false;
  }
  views.avl.render(experiment.avl);
  views.avl.highlight([], key, true);
  return true;
}

async function showPaths(paths, signal, searchAnimation) {
  if (searchAnimation && motionSetting.checked) {
    for (const [type, path] of Object.entries(paths)) {
      views[type].highlight(path, path.at(-1) ?? null, true);
      byId(`${type}-visits`).textContent = path.length;
    }
    return;
  }
  const length = Math.max(paths.bst.length, paths.avl.length);
  const interval = searchAnimation ? Math.min(270, 3600 / length) : Math.min(120, 850 / length);
  for (let index = 0; index < length; index++) {
    for (const type of ['bst', 'avl']) {
      const path = paths[type];
      if (index < path.length) {
        views[type].highlight(path.slice(0, index + 1), path[index], true);
        if (searchAnimation) byId(`${type}-visits`).textContent = index + 1;
      }
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
  if (byId('search-submit').disabled) return;
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
  play('search', session => showSearch(target, predictions, session.controller.signal));
});

async function showSearch(target, predictions, signal) {
  const outcome = experiment.search(target);
  const paths = { bst: outcome.bst.visited, avl: outcome.avl.visited };
  lastSearchTarget = null;
  byId('search-results').hidden = true;
  byId('count-target').textContent = `Comparisons for ${formatPrice(target)}`;
  byId('bst-visits').textContent = byId('avl-visits').textContent = '0';
  byId('search-counts').hidden = false;
  renderTrees();
  if (paths.bst.length) byId('comparison-start').scrollIntoView({ block: 'start' });
  byId('search-counts').focus({ preventScroll: true });
  status('search-status');
  byId('search-results').setAttribute('aria-busy', 'true');
  if (!motionSetting.checked && paths.bst.length && !await delay(160, signal)) return;
  await showPaths(paths, signal, true);
  if (signal.aborted) return;
  lastSearchTarget = target;
  if (runKind !== 'custom' && target === RALLY_TARGET) {
    const snapshot = {
      order: [...experiment.batch.keys],
      rows: experiment.summary().map(row => ({ ...row })),
      outcome,
    };
    if (runKind === 'rally') rallyResult = snapshot;
    else alternateResult = snapshot;
    renderComparison();
  }
  renderResults(outcome, predictions);
  byId('search-results').removeAttribute('aria-busy');
  renderGrowth();
  const { bst, avl } = outcome;
  const tally = bst.comparisons === avl.comparisons
    ? 'Both trees visited the same number of nodes.'
    : `${bst.comparisons < avl.comparisons ? 'The BST' : 'The AVL tree'} visited fewer nodes for this target.`;
  status('search-status', `${formatPrice(target)} · BST: ${bst.comparisons}, AVL: ${avl.comparisons}. ${tally}`);
}

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

function renderComparison() {
  byId('comparison-results').hidden = !rallyResult;
  byId('replay-alternate').hidden = runKind !== 'rally' || !rallyResult;
  if (!rallyResult) return;
  const tbody = byId('comparison-rows');
  tbody.replaceChildren();
  for (const [label, snapshot] of [['Market rally', rallyResult], ['Different order', alternateResult]]) {
    if (!snapshot) continue;
    const row = tbody.insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    heading.title = snapshot.order.map(formatPrice).join(' → ');
    row.append(heading);
    const { bstHeight, avlHeight } = snapshot.rows.at(-1);
    for (const value of [bstHeight, avlHeight, snapshot.outcome.bst.comparisons, snapshot.outcome.avl.comparisons]) {
      row.insertCell().textContent = value;
    }
  }
  const before = rallyResult.outcome;
  const after = alternateResult?.outcome;
  byId('comparison-takeaway').textContent = after
    ? `Changing the insertion order cut the BST search from ${before.bst.comparisons} comparisons to ${after.bst.comparisons}. The AVL search took ${after.avl.comparisons} comparisons in both runs.`
    : `Search target ${formatPrice(before.target)}. Keep the same prices and see what a different insertion order changes.`;
}

function renderGrowth({ updateTables = true } = {}) {
  const rows = experiment.summary();
  const comparison = runKind === 'alternate' && rallyResult;
  const showingExample = !rows.length && !experiment.batch;
  const runs = comparison
    ? [{ label: 'Market rally', rows: rallyResult.rows }, { label: 'Different order', rows }]
    : showingExample
      ? [{ label: exampleGrowthLabel, rows: rallyExample.rows }]
      : [{ label: runKind === 'rally' ? 'Market rally' : 'Current run', rows }];
  const count = Math.max(...runs.map(run => run.rows.length));
  byId('growth-example').hidden = !showingExample;
  byId('growth-pending').hidden = count > 0;

  const domain = runKind === 'custom' && !showingExample
    ? { prices: count, height: Math.max(1, ...rows.flatMap(row => [row.bstHeight, row.avlHeight])) }
    : { prices: RALLY_PRICES.length, height: RALLY_PRICES.length - 1 };
  const selected = Math.max(1, Math.min(growthSelection ?? count, count));
  const cursor = byId('growth-cursor');
  cursor.max = Math.max(1, count);
  cursor.value = selected;
  cursor.disabled = count < 2;
  cursor.setAttribute('aria-valuetext', `Insertion ${selected} of ${count}`);
  byId('growth-position').value = count ? `${selected} of ${count}` : '';
  renderGrowthPlots(byId('growth-charts'), runs, domain, selected, inspectGrowth);
  if (growth.open && updateTables) renderGrowthTables();
}

function renderGrowthTables() {
  const savedRally = runKind === 'alternate' ? rallyResult : null;
  byId('growth-rally-wrap').hidden = !savedRally;
  if (savedRally) {
    writeGrowthTable(byId('growth-rally-table'), savedRally.rows, 'Market rally · Heights by insertion');
  }
  const rows = experiment.summary(lastSearchTarget);
  const table = byId('growth-table');
  const showingExample = !rows.length && !experiment.batch;
  byId('growth-table-wrap').hidden = !rows.length && !showingExample;
  if (showingExample) {
    writeGrowthTable(table, rallyExample.rows, exampleGrowthLabel);
    return;
  }
  const label = { rally: 'Market rally', alternate: 'Different order' }[runKind] ?? 'Current run';
  writeGrowthTable(table, rows, label, lastSearchTarget);
}

function writeGrowthTable(table, rows, label, target = null) {
  table.replaceChildren();
  if (!rows.length) return;
  const cols = ['Nodes', 'Added price', 'BST height', 'AVL height'];
  if (target !== null) cols.push('BST comparisons', 'AVL comparisons');
  table.createCaption().textContent = target === null ? label : `${label} · Search target ${formatPrice(target)}`;
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
    if (target !== null) cells.push(entry.bstSearch, entry.avlSearch);
    for (const text of cells) row.insertCell().textContent = text;
  }
}

growth.addEventListener('toggle', () => {
  if (growth.open) renderGrowthTables();
});
function inspectGrowth(insertion) {
  growthSelection = Math.min(insertion, Number(byId('growth-cursor').max));
  renderGrowth({ updateTables: false });
}
byId('growth-cursor').addEventListener('input', event => inspectGrowth(Number(event.target.value)));

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

byId('open-practice').addEventListener('click', event => openLab(true, { opener: event.currentTarget }));
byId('open-solution').addEventListener('click', event => openLab(false, { opener: event.currentTarget }));
byId('view-rally-repair').addEventListener('click', event => {
  if (pendingRepair) openLab(false, { trace: pendingRepair, opener: event.currentTarget });
});
byId('review-transfer').addEventListener('click', event => {
  const example = !experiment.avl;
  openLab(false, { trace: example ? rallyExample.transfer : experiment.challenge, opener: event.currentTarget, example });
});
byId('open-3d').addEventListener('click', event => {
  const example = !experiment.avl;
  openLab(false, {
    trace: example ? rallyExample.transfer : experiment.challenge,
    opener: event.currentTarget,
    example,
    showCurrent: !example,
    startIn3D: true,
  });
});
byId('lab-tree-toggle').addEventListener('click', () => renderLabReview(!showingCurrentLabTree));
byId('rotation-front').addEventListener('click', () => setRotationAngle(false));
byId('rotation-angle').addEventListener('click', () => setRotationAngle(true));
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
  currentLabTree = null;
  labRoot = null;
  rotationScene.reset();
  if (labOpener && !labOpener.closest('[hidden]')) labOpener.focus({ preventScroll: true });
  labOpener = null;
});

function openLab(interactive, { trace = experiment.challenge, opener, example = false, showCurrent = false, startIn3D = false } = {}) {
  if (labDialog.open || (!trace && (interactive || !experiment.avl))) return;
  solution = trace;
  labOpener = opener;
  labExample = example;
  currentLabTree = !interactive && !example ? copyTree(experiment.avl) : null;
  if (active?.kind === 'batch') {
    active.pause = true;
    updateControls();
  } else if (interactive && active) {
    if (active.kind === 'search') clearSearch();
    cancelPlayback();
    renderTrees(pendingRepair?.before, pendingRepair?.pivot);
    updateControls();
    renderGrowth();
  }
  practice = interactive ? new RotationPractice(solution.before) : null;
  labView.mode = interactive ? 'practice' : 'read';
  byId('rotation-views').hidden = interactive;
  byId('lab-tree-toggle').hidden = !currentLabTree || !solution;
  setRotationAngle(false);
  byId('practice-actions').hidden = !interactive;
  labDialog.showModal();
  labView.resetLayout();
  if (practice) {
    byId('lab-title').textContent = 'Rotation practice';
    byId('lab-instruction').textContent = 'Promote a child by dragging it onto its parent, or select a pivot and use the rotation buttons. Bring every balance factor within −1 and 1.';
    byId('solution-actions').hidden = true;
    labRoles = {};
    renderRotationKey();
    renderPractice();
    labView.select(solution.pivot);
    labView.ensureVisible(solution.pivot);
  } else {
    solutionIndex = 0;
    renderLabReview(showCurrent || !solution);
    if (startIn3D) setRotationAngle(true);
  }
}

function renderLabReview(showCurrent) {
  showingCurrentLabTree = showCurrent;
  byId('lab-tree-toggle').textContent = showCurrent ? 'Replay last AVL repair' : 'View current AVL tree';
  byId('solution-actions').hidden = showCurrent;
  if (showCurrent) {
    byId('lab-title').textContent = 'Current AVL tree';
    byId('lab-instruction').textContent = solution
      ? 'Inspect your current tree or revisit the last repair from this run.'
      : 'Inspect your current tree. This run has not needed a rotation yet.';
    labRoles = {};
    renderRotationKey();
    renderLabTree(currentLabTree, false);
    status('lab-status');
  } else {
    byId('lab-title').textContent = labExample ? 'Example AVL repair' : 'Replay the repair';
    byId('lab-instruction').textContent = `Follow the ${solution.caseName.toLowerCase()} repair recorded when ${formatPrice(solution.key)} was inserted.`;
    renderSolution();
  }
  if (!labHost.hidden) labView.fit();
}

function getRotationRoles(trace, frame) {
  const index = Math.max(0, frame - 1);
  const step = trace.steps[index];
  const before = trace.steps[index - 1]?.tree ?? trace.before;
  const promoted = inOrderNodes(before).find(node => node.key === step.promoted);
  const branch = step.direction === 'left' ? promoted.left : promoted.right;
  return { pivot: step.pivot, promoted: step.promoted, ...(branch && { branch: branch.key }) };
}

function setRotationAngle(angled) {
  labHost.hidden = angled;
  orbitHost.hidden = !angled;
  byId('rotation-front').setAttribute('aria-pressed', !angled);
  byId('rotation-angle').setAttribute('aria-pressed', angled);
  if (angled) rotationScene.render(labRoot, labRoles, false);
}

function renderRotationKey() {
  const key = byId('rotation-key');
  key.hidden = !Object.keys(labRoles).length;
  key.replaceChildren();
  const roles = { pivot: 'Pivot', promoted: 'Promoted node', branch: 'Moving branch' };
  for (const [role, price] of Object.entries(labRoles)) {
    const label = document.createElement('li');
    label.dataset.rotationRole = role;
    label.textContent = `${roles[role]} ${formatPrice(price)}`;
    key.append(label);
  }
}

function updateLabButtons(node) {
  byId('rotate-left').disabled = !node?.right;
  byId('rotate-right').disabled = !node?.left;
  byId('undo-rotation').disabled = !practice?.history.length;
}

function renderLabTree(root, animate) {
  labRoot = root;
  labView.render(root, { animate, compact: labRoles.branch !== undefined });
  labView.markRotation(labRoles);
  if (!orbitHost.hidden) rotationScene.render(root, labRoles, animate);
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
  labRoles = getRotationRoles(solution, solutionIndex);
  renderRotationKey();
  renderLabTree(step?.tree ?? solution.before, Boolean(step));
  labView.highlight(step ? [step.pivot] : [], pivot, true);
  const back = byId('solution-back');
  const next = byId('solution-next');
  const focused = document.activeElement;
  back.disabled = solutionIndex === 0;
  next.disabled = solutionIndex === solution.steps.length;
  if (focused === next && next.disabled) back.focus();
  if (focused === back && back.disabled) next.focus();
  const action = step
    ? `Rotate ${step.direction} at ${formatPrice(step.pivot)} to promote ${formatPrice(step.promoted)}.`
    : `Before rotation, ${formatPrice(solution.pivot)} has balance factor ${solution.balance}.`;
  const onRight = ((step ?? solution.steps[0]).direction === 'left') === Boolean(step);
  const transfer = labRoles.branch !== undefined
    ? ` The branch rooted at ${formatPrice(labRoles.branch)} is the ${onRight ? 'right' : 'left'} child of ${formatPrice(step ? labRoles.pivot : labRoles.promoted)}.`
    : '';
  status('lab-status', `Frame ${solutionIndex + 1} of ${solution.steps.length + 1}. ${action}${transfer}`);
}

renderTrees();
updateControls();
updatePreview();
renderGrowth();
