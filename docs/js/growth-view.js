import { formatPrice } from './prices.js';

function svgElement(tag, attributes, content) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (content !== undefined) element.textContent = content;
  return element;
}

function ticks(first, last, interval) {
  const values = [first];
  for (let value = interval; value < last; value += interval) {
    if (value > first) values.push(value);
  }
  if (last > first) values.push(last);
  return values;
}

function makePlot(rows, maxPrices, maxHeight, selected, onSelect) {
  const svg = svgElement('svg', { viewBox: '0 0 400 190', 'aria-hidden': 'true' });
  const x = count => 36 + 347 * (count - 1) / Math.max(1, maxPrices - 1);
  const y = height => 146 - 116 * height / Math.max(1, maxHeight);

  for (const height of ticks(0, maxHeight, Math.max(1, Math.ceil(maxHeight / 4)))) {
    const level = y(height);
    svg.append(
      svgElement('line', { x1: 36, y1: level, x2: 383, y2: level, class: 'growth-gridline' }),
      svgElement('text', { x: 28, y: level + 4, 'text-anchor': 'end' }, height),
    );
  }
  const priceInterval = maxPrices <= 8 ? 1 : Math.ceil(maxPrices / 4);
  for (const count of ticks(1, maxPrices, priceInterval)) {
    svg.append(svgElement('text', { x: x(count), y: 163, 'text-anchor': 'middle' }, count));
  }
  svg.append(
    svgElement('text', { x: 16, y: 15, class: 'growth-axis-title' }, 'Height in edges'),
    svgElement('text', { x: 210, y: 183, 'text-anchor': 'middle', class: 'growth-axis-title' }, 'Prices inserted'),
    svgElement('line', { x1: x(selected), x2: x(selected), y1: 24, y2: 146, class: 'growth-guide' }),
  );

  for (const type of ['bst', 'avl']) {
    const field = `${type}Height`;
    if (!rows.length) continue;
    svg.append(svgElement('polyline', {
      points: rows.map((row, index) => `${x(index + 1)},${y(row[field])}`).join(' '),
      class: `growth-line ${type}-line`,
    }));
    for (const count of new Set([rows.length, selected])) {
      const row = rows[count - 1];
      if (!row) continue;
      const cx = x(count);
      const cy = y(row[field]);
      svg.append(type === 'bst'
        ? svgElement('circle', { cx, cy, r: 5, class: 'growth-marker bst-marker' })
        : svgElement('rect', { x: cx - 3, y: cy - 3, width: 6, height: 6, class: 'growth-marker avl-marker' }));
    }
  }
  const plotArea = svgElement('rect', { x: 36, y: 21, width: 347, height: 128, class: 'growth-hit-area' });
  plotArea.addEventListener('click', event => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    onSelect(1 + Math.round((point.x - 36) * (maxPrices - 1) / 347));
  });
  svg.append(plotArea);
  return svg;
}

export function renderGrowthPlots(host, runs, domain, selected, onSelect) {
  host.replaceChildren(...runs.map(({ label, rows }) => {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    const readout = document.createElement('p');
    const row = rows[selected - 1];
    caption.textContent = label;
    readout.className = 'growth-readout';
    readout.textContent = row
      ? `${formatPrice(row.key)} inserted · BST height ${row.bstHeight} · AVL height ${row.avlHeight}`
      : `Insertion ${selected} is still ahead in this order.`;
    figure.append(caption, makePlot(rows, domain.prices, domain.height, selected, onSelect), readout);
    return figure;
  }));
}
