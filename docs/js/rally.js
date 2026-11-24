import { Experiment } from './experiment.js';

export const RALLY_PRICES = Object.freeze([10000, 10100, 10200, 10300, 10400, 10500, 10600, 10700]);
export const RALLY_TARGET = RALLY_PRICES.at(-1);
export const ALTERNATE_PRICES = Object.freeze([10300, 10100, 10500, 10000, 10200, 10400, 10600, 10700]);
export const RALLY_FIRST_IMBALANCE = RALLY_PRICES[2];
export const RALLY_SUBTREE_TRANSFER = RALLY_PRICES[5];

export function buildRallyExample() {
  const rally = new Experiment();
  rally.startReplay(RALLY_PRICES);
  let transfer;
  for (const key of RALLY_PRICES) {
    rally.step();
    if (key === RALLY_SUBTREE_TRANSFER) transfer = rally.challenge;
  }
  return { rows: rally.summary(), transfer };
}
