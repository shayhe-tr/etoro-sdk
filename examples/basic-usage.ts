/**
 * Basic Usage Example
 *
 * Demonstrates core SDK functionality:
 * - Configuration via env vars
 * - Searching instruments
 * - Getting market rates
 * - Viewing portfolio
 * - Opening and closing positions (demo mode)
 *
 * Setup: Set ETORO_API_KEY and ETORO_USER_KEY env vars, then run:
 *   npx tsx examples/basic-usage.ts
 */

import { EToroTrading, CandleInterval } from '../src/index';

async function main() {
  // Create client — reads ETORO_API_KEY and ETORO_USER_KEY from env
  // Defaults to demo mode for safety
  const etoro = new EToroTrading({ mode: 'demo' });

  // --- Market Data ---

  // Get current rates for multiple instruments
  const rates = await etoro.getRates(['AAPL', 'TSLA', 'BTC']);
  for (const rate of rates) {
    console.log(`Instrument ${rate.instrumentID}: bid=${rate.bid} ask=${rate.ask}`);
  }

  // Get daily candles for Apple
  const candles = await etoro.getCandles('AAPL', CandleInterval.OneDay, 10);
  console.log(`Last 10 daily candles for AAPL:`, candles.candles[0]?.candles.length);

  // --- Portfolio ---

  const portfolio = await etoro.getPortfolio();
  console.log(`Credit: $${portfolio.clientPortfolio.credit}`);
  console.log(`Open positions: ${portfolio.clientPortfolio.positions.length}`);

  for (const pos of portfolio.clientPortfolio.positions) {
    console.log(
      `  Position ${pos.positionID}: instrument=${pos.instrumentID} ` +
      `${pos.isBuy ? 'LONG' : 'SHORT'} amount=$${pos.amount} units=${pos.units}`,
    );
  }

  // --- Trading (Demo) ---

  // Buy $200 of Apple stock
  const buyOrder = await etoro.buyByAmount('AAPL', 200);
  console.log(`Buy order placed: orderId=${buyOrder.orderForOpen.orderID}`);

  // Wait for execution
  const executed = await etoro.waitForOrderExecution(buyOrder.orderForOpen.orderID);
  console.log(`Order executed: ${executed.positions.length} positions opened`);

  // Close the position
  if (executed.positions.length > 0) {
    const positionId = executed.positions[0].positionID;
    await etoro.closePosition(positionId);
    console.log(`Position ${positionId} closed`);
  }

  // --- Trade History ---

  const history = await etoro.getTradeHistory('2024-01-01');
  console.log(`Trade history entries: ${history.length}`);
}

main().catch(console.error);
