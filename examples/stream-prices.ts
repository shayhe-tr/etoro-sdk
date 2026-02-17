/**
 * Real-time Price Streaming Example
 *
 * Demonstrates WebSocket streaming:
 * - Connecting to WebSocket
 * - Subscribing to instrument price feeds
 * - Handling real-time price events
 * - Subscribing to private portfolio events
 * - Graceful shutdown
 *
 * Setup: Set ETORO_API_KEY and ETORO_USER_KEY env vars, then run:
 *   npx tsx examples/stream-prices.ts
 */

import { EToroTrading } from '../src/index';

async function main() {
  const etoro = new EToroTrading({ mode: 'demo' });

  // Connect WebSocket (authenticates automatically)
  await etoro.connect();
  console.log('Connected to eToro WebSocket');

  // Preload instrument IDs for the symbols we want to stream
  await etoro.preloadInstruments(['AAPL', 'BTC', 'TSLA', 'EURUSD']);
  console.log('Instruments preloaded');

  // Subscribe to real-time price updates
  await etoro.streamPrices(['AAPL', 'BTC', 'TSLA', 'EURUSD']);
  console.log('Subscribed to price feeds');

  // Handle price updates
  etoro.on('price', (symbol, instrumentId, rate) => {
    const spread = rate.Ask - rate.Bid;
    console.log(
      `[${new Date().toISOString()}] ${symbol} (${instrumentId}): ` +
      `bid=${rate.Bid.toFixed(4)} ask=${rate.Ask.toFixed(4)} spread=${spread.toFixed(4)}`,
    );
  });

  // Subscribe to private events (order fills, position changes)
  etoro.subscribeToPrivateEvents();
  etoro.on('order:update', (event) => {
    console.log(
      `[ORDER] OrderID=${event.OrderID} Status=${event.StatusID} ` +
      `Instrument=${event.InstrumentID} P&L=${event.NetProfit}`,
    );
  });

  // Handle errors
  etoro.on('error', (err) => {
    console.error('Error:', err.message);
  });

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\nDisconnecting...');
    await etoro.disconnect();
    console.log('Disconnected. Goodbye!');
    process.exit(0);
  });

  // Keep alive — streaming runs indefinitely
  console.log('Streaming prices... Press Ctrl+C to stop.\n');
}

main().catch(console.error);
