import { Experiment } from './experiment.js';

export const RALLY_PRICES = Object.freeze([10000, 10100, 10200, 10300, 10400, 10500, 10600, 10700]);
export const RALLY_TARGET = RALLY_PRICES.at(-1);
export const RALLY_FIRST_IMBALANCE = RALLY_PRICES[2];
export const RALLY_SUBTREE_TRANSFER = RALLY_PRICES[5];

export function balancedReplayOrder(keys) {
  const sorted = [...keys].sort((a, b) => a - b);
  const ranges = [[0, sorted.length - 1]];
  const order = [];
  for (const [first, last] of ranges) {
    const middle = Math.floor((first + last) / 2);
    if (first > last) continue;
    order.push(sorted[middle]);
    if (first < middle) ranges.push([first, middle - 1]);
    if (middle < last) ranges.push([middle + 1, last]);
  }
  return order;
}

export function buildExampleRotation() {
  const rally = new Experiment();
  rally.startReplay(RALLY_PRICES);
  for (const key of RALLY_PRICES) {
    rally.step();
    if (key === RALLY_SUBTREE_TRANSFER) break;
  }
  return rally.challenge;
}
