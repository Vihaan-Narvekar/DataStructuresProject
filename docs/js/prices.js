const dollars = new Intl.NumberFormat('en-US');

export function parsePrice(input) {
  const value = input.trim().replace(/^\$/, '');
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value)) {
    throw new Error('Enter a nonnegative price with up to two decimal places.');
  }

  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole + fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) {
    throw new Error('That price is too large to represent exactly.');
  }
  return cents;
}

export function formatPrice(cents) {
  const fraction = cents % 100;
  const whole = dollars.format((cents - fraction) / 100);
  return fraction ? `$${whole}.${String(fraction).padStart(2, '0')}` : `$${whole}`;
}

export function parseSequence(input) {
  const keys = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();

  for (const token of input.split(/[\s,]+/).filter(Boolean)) {
    let key;
    try {
      key = parsePrice(token);
    } catch {
      invalid.push(token);
      continue;
    }
    if (seen.has(key)) {
      duplicates.push(token);
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return { keys, invalid, duplicates };
}

export function generatePrices(startInput, stepInput, countInput, limit) {
  const start = parsePrice(startInput);
  const step = parsePrice(stepInput);
  const count = Number(countInput);
  if (step === 0) throw new Error('Use an increment greater than zero.');
  if (!/^\d+$/.test(countInput.trim()) || !Number.isSafeInteger(count) || count < 1) {
    throw new Error('Use a positive whole number for the price count.');
  }
  if (count > limit) throw new Error(`Use ${limit} prices or fewer per run.`);
  const last = start + step * (count - 1);
  if (!Number.isSafeInteger(last)) {
    throw new Error('The last price would be too large to represent exactly.');
  }
  return Array.from({ length: count }, (_, index) => start + step * index);
}

export function orderPrices(keys, order, random = Math.random) {
  const result = [...keys];
  if (order === 'ascending') return result.sort((first, second) => first - second);
  if (order === 'descending') return result.sort((first, second) => second - first);
  if (order === 'shuffle') {
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
  }
  return result;
}
