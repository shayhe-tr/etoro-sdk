/**
 * Algo Trading Bot Skeleton
 *
 * A minimal framework for building an automated trading bot:
 * - Real-time price streaming via WebSocket
 * - Simple moving average crossover strategy (as example)
 * - Order execution with stop-loss/take-profit
 * - Position management and monitoring
 * - Graceful shutdown
 *
 * This is a DEMO skeleton — do NOT use for real trading without
 * proper risk management, backtesting, and validation.
 *
 * Setup: Set ETORO_API_KEY and ETORO_USER_KEY env vars, then run:
 *   npx tsx examples/algo-bot-skeleton.ts
 */

import { EToroTrading, CandleInterval, CandleDirection } from '../src/index';
import type { WsInstrumentRate, Position } from '../src/types';

// --- Configuration ---
const SYMBOL = 'AAPL';
const TRADE_AMOUNT = 200; // $200 per trade
const STOP_LOSS_PCT = 0.02; // 2% stop loss
const TAKE_PROFIT_PCT = 0.04; // 4% take profit
const SMA_SHORT = 5; // 5-candle short SMA
const SMA_LONG = 20; // 20-candle long SMA
const CHECK_INTERVAL_MS = 60_000; // check every 60 seconds

// --- Price buffer ---
const priceHistory: number[] = [];
const MAX_HISTORY = SMA_LONG + 10;

function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

async function main() {
  const etoro = new EToroTrading({ mode: 'demo' });
  let currentPosition: Position | null = null;
  let isRunning = true;

  console.log(`Algo Bot Starting — Symbol: ${SYMBOL}, Amount: $${TRADE_AMOUNT}`);
  console.log(`Strategy: SMA(${SMA_SHORT}) / SMA(${SMA_LONG}) crossover`);
  console.log('');

  // --- Connect and preload ---
  await etoro.connect();
  console.log('WebSocket connected');

  await etoro.preloadInstruments([SYMBOL]);
  console.log(`Instrument ${SYMBOL} resolved`);

  // --- Load historical prices to seed SMA ---
  const candles = await etoro.getCandles(SYMBOL, CandleInterval.OneHour, SMA_LONG + 5, CandleDirection.Desc);
  if (candles.candles[0]) {
    for (const candle of candles.candles[0].candles.reverse()) {
      priceHistory.push(candle.close);
    }
  }
  console.log(`Loaded ${priceHistory.length} historical prices`);

  // --- Stream live prices ---
  await etoro.streamPrices([SYMBOL], true);

  etoro.on('price', (_symbol: string, _id: number, rate: WsInstrumentRate) => {
    const mid = (rate.Ask + rate.Bid) / 2;
    priceHistory.push(mid);
    if (priceHistory.length > MAX_HISTORY) {
      priceHistory.shift();
    }
  });

  // --- Monitor order events ---
  etoro.subscribeToPrivateEvents();
  etoro.on('order:update', (event) => {
    console.log(`[ORDER EVENT] ID=${event.OrderID} Status=${event.StatusID} P&L=${event.NetProfit}`);
  });

  etoro.on('error', (err) => {
    console.error('[ERROR]', err.message);
  });

  // --- Strategy loop ---
  async function strategyTick() {
    if (!isRunning) return;

    const smaShort = calculateSMA(priceHistory, SMA_SHORT);
    const smaLong = calculateSMA(priceHistory, SMA_LONG);
    const currentPrice = priceHistory[priceHistory.length - 1];

    if (smaShort === null || smaLong === null) {
      console.log(`[TICK] Waiting for enough data (have ${priceHistory.length}/${SMA_LONG})`);
      return;
    }

    console.log(
      `[TICK] Price=${currentPrice?.toFixed(2)} ` +
      `SMA(${SMA_SHORT})=${smaShort.toFixed(2)} SMA(${SMA_LONG})=${smaLong.toFixed(2)} ` +
      `Position=${currentPosition ? `#${currentPosition.positionID}` : 'none'}`,
    );

    // --- Entry signal: Short SMA crosses above Long SMA ---
    if (smaShort > smaLong && !currentPosition && currentPrice) {
      console.log('[SIGNAL] BUY — SMA crossover detected');

      const stopLoss = currentPrice * (1 - STOP_LOSS_PCT);
      const takeProfit = currentPrice * (1 + TAKE_PROFIT_PCT);

      try {
        const order = await etoro.buyByAmount(SYMBOL, TRADE_AMOUNT, {
          stopLoss,
          takeProfit,
        });
        console.log(`[TRADE] Buy order placed: orderId=${order.orderForOpen.orderID}`);

        const result = await etoro.waitForOrderExecution(order.orderForOpen.orderID, 15_000);
        if (result.positions.length > 0) {
          // Refresh portfolio to get full position data
          const positions = await etoro.getPositions();
          currentPosition = positions.find(
            (p) => p.orderID === order.orderForOpen.orderID,
          ) ?? null;
          console.log(`[TRADE] Position opened: #${currentPosition?.positionID}`);
        }
      } catch (err) {
        console.error('[TRADE] Order failed:', (err as Error).message);
      }
    }

    // --- Exit signal: Short SMA crosses below Long SMA ---
    if (smaShort < smaLong && currentPosition) {
      console.log('[SIGNAL] SELL — SMA crossover reversal');

      try {
        await etoro.closePosition(currentPosition.positionID);
        console.log(`[TRADE] Position #${currentPosition.positionID} closed`);
        currentPosition = null;
      } catch (err) {
        console.error('[TRADE] Close failed:', (err as Error).message);
      }
    }
  }

  // Run strategy on interval
  const intervalId = setInterval(strategyTick, CHECK_INTERVAL_MS);

  // Initial tick
  await strategyTick();

  // --- Graceful shutdown ---
  process.on('SIGINT', async () => {
    console.log('\n[SHUTDOWN] Stopping bot...');
    isRunning = false;
    clearInterval(intervalId);

    // Close any open position
    if (currentPosition) {
      try {
        await etoro.closePosition(currentPosition.positionID);
        console.log(`[SHUTDOWN] Closed position #${currentPosition.positionID}`);
      } catch (err) {
        console.error('[SHUTDOWN] Failed to close position:', (err as Error).message);
      }
    }

    await etoro.disconnect();
    console.log('[SHUTDOWN] Disconnected. Goodbye!');
    process.exit(0);
  });

  console.log(`\nBot running. Checking every ${CHECK_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.\n`);
}

main().catch(console.error);
