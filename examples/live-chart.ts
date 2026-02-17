import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import asciichart from 'asciichart';
import { EToroTrading } from '../src/index';

// ── Config ───────────────────────────────────────────────────────────
const INSTRUMENTS = ['BTC', 'ETH', 'XRP'];
const CHART_WIDTH = 60;          // data points to display
const CHART_HEIGHT = 15;         // rows tall
const REFRESH_MS = 1_000;        // redraw every 1 second

const COLORS = [
  asciichart.blue,     // BTC
  asciichart.green,    // ETH
  asciichart.magenta,  // XRP
];

const ANSI = {
  clear: '\x1b[2J\x1b[H',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
};

// ── State ────────────────────────────────────────────────────────────
interface InstrumentState {
  symbol: string;
  instrumentId: number;
  prices: number[];           // normalized mid prices for chart
  rawBid: number;
  rawAsk: number;
  prevBid: number;
  tickCount: number;
  lastUpdate: string;
  basePrice: number;          // first price, used for % change
}

const state = new Map<string, InstrumentState>();

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const etoro = new EToroTrading();

  // Load instrument CSV for reliable resolution
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const loaded = etoro.resolver.loadFromCsv(csv);

  // Initialize state for each instrument
  for (const symbol of INSTRUMENTS) {
    const id = etoro.resolver.getCachedId(symbol);
    if (!id) { console.error(`Cannot resolve ${symbol}`); process.exit(1); }
    state.set(symbol, {
      symbol,
      instrumentId: id,
      prices: [],
      rawBid: 0,
      rawAsk: 0,
      prevBid: 0,
      tickCount: 0,
      lastUpdate: '',
      basePrice: 0,
    });
  }

  // Connect WebSocket
  process.stdout.write(`${ANSI.cyan}Connecting...${ANSI.reset}`);
  await etoro.connect();
  process.stdout.write(` ${ANSI.green}OK${ANSI.reset}\n`);

  // Subscribe to all instrument feeds
  const ids = INSTRUMENTS.map((s) => etoro.resolver.getCachedId(s)!);
  await etoro.streamPrices(ids, true);
  etoro.subscribeToPrivateEvents();

  // Handle price events
  etoro.on('price', (_symbol, instrumentId, rate) => {
    const bid = parseFloat(String(rate.Bid));
    const ask = parseFloat(String(rate.Ask));
    if (isNaN(bid) || isNaN(ask) || bid === 0) return;

    // Find which instrument this is
    for (const [sym, s] of state.entries()) {
      if (s.instrumentId === instrumentId) {
        s.prevBid = s.rawBid || bid;
        s.rawBid = bid;
        s.rawAsk = ask;
        s.tickCount++;
        s.lastUpdate = new Date().toLocaleTimeString();
        if (s.basePrice === 0) s.basePrice = bid;

        // Store the mid-price
        const mid = (bid + ask) / 2;
        s.prices.push(mid);
        if (s.prices.length > CHART_WIDTH) {
          s.prices = s.prices.slice(-CHART_WIDTH);
        }
        break;
      }
    }
  });

  // Render loop
  const startTime = Date.now();
  const renderInterval = setInterval(() => {
    render(startTime);
  }, REFRESH_MS);

  // Graceful shutdown
  const shutdown = async () => {
    clearInterval(renderInterval);
    console.log(`\n${ANSI.yellow}Disconnecting...${ANSI.reset}`);
    await etoro.disconnect();
    console.log(`${ANSI.green}Done!${ANSI.reset}`);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`${ANSI.dim}Press Ctrl+C to stop${ANSI.reset}\n`);
}

// ── Render ───────────────────────────────────────────────────────────
function render(startTime: number) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  let output = ANSI.clear;

  // Header
  output += `${ANSI.bold}${ANSI.cyan}═══════════════════════════════════════════════════════════════════════${ANSI.reset}\n`;
  output += `${ANSI.bold}  eToro SDK — Live Price Chart${ANSI.reset}`;
  output += `${ANSI.dim}                           elapsed: ${mm}:${ss}${ANSI.reset}\n`;
  output += `${ANSI.bold}${ANSI.cyan}═══════════════════════════════════════════════════════════════════════${ANSI.reset}\n\n`;

  // Legend
  const legendParts: string[] = [];
  const colorNames = [ANSI.blue, ANSI.green, ANSI.magenta];
  let i = 0;
  for (const [sym, s] of state.entries()) {
    const pctChange = s.basePrice > 0
      ? ((s.rawBid - s.basePrice) / s.basePrice * 100)
      : 0;
    const pctStr = pctChange >= 0 ? `+${pctChange.toFixed(3)}%` : `${pctChange.toFixed(3)}%`;
    const pctColor = pctChange >= 0 ? ANSI.green : ANSI.red;
    legendParts.push(
      `${colorNames[i]}██${ANSI.reset} ${ANSI.bold}${sym}${ANSI.reset} ${pctColor}${pctStr}${ANSI.reset}`
    );
    i++;
  }
  output += `  ${legendParts.join('    ')}\n\n`;

  // Build chart data — normalize each series to % change for overlay
  const series: number[][] = [];
  let anyData = false;

  for (const [, s] of state.entries()) {
    if (s.prices.length >= 2) {
      anyData = true;
      // Normalize to % change from first visible price
      const base = s.prices[0];
      const normalized = s.prices.map((p) => ((p - base) / base) * 100);
      series.push(normalized);
    }
  }

  if (anyData) {
    try {
      const chart = asciichart.plot(series, {
        height: CHART_HEIGHT,
        colors: COLORS.slice(0, series.length),
        format: (x: number) => {
          const s = x >= 0 ? '+' + x.toFixed(3) + '%' : x.toFixed(3) + '%';
          return s.padStart(10);
        },
      });
      output += chart + '\n';
    } catch {
      output += `  ${ANSI.dim}Collecting data...${ANSI.reset}\n`;
    }
  } else {
    output += `  ${ANSI.dim}Waiting for price data...${ANSI.reset}\n`;
  }

  output += '\n';

  // Price table
  output += `${ANSI.bold}  ${'Symbol'.padEnd(8)} ${'Bid'.padStart(14)} ${'Ask'.padStart(14)} ${'Spread'.padStart(10)} ${'Ticks'.padStart(8)} ${'Updated'.padStart(12)}${ANSI.reset}\n`;
  output += `  ${ANSI.dim}${'─'.repeat(68)}${ANSI.reset}\n`;

  for (const [sym, s] of state.entries()) {
    if (s.rawBid === 0) {
      output += `  ${ANSI.dim}${sym.padEnd(8)} waiting...${ANSI.reset}\n`;
      continue;
    }

    const spread = s.rawAsk - s.rawBid;
    const dir = s.rawBid > s.prevBid ? ANSI.green + '▲' : s.rawBid < s.prevBid ? ANSI.red + '▼' : ANSI.dim + '─';
    const bidStr = formatPrice(s.rawBid, sym);
    const askStr = formatPrice(s.rawAsk, sym);
    const spreadStr = formatPrice(spread, sym);

    output += `  ${dir}${ANSI.reset} ${ANSI.bold}${sym.padEnd(6)}${ANSI.reset} ${bidStr.padStart(14)} ${askStr.padStart(14)} ${spreadStr.padStart(10)} ${String(s.tickCount).padStart(8)} ${ANSI.dim}${s.lastUpdate.padStart(12)}${ANSI.reset}\n`;
  }

  output += `\n  ${ANSI.dim}Chart: % change since subscribe | 1s refresh | ${CHART_WIDTH} data points${ANSI.reset}\n`;

  process.stdout.write(output);
}

function formatPrice(value: number, symbol: string): string {
  if (symbol === 'BTC') return value.toFixed(2);
  if (symbol === 'ETH') return value.toFixed(2);
  if (symbol === 'XRP') return value.toFixed(5);
  return value.toFixed(4);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
