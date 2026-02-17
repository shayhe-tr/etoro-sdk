import 'dotenv/config';
import { EToroTrading } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function run() {
  const etoro = new EToroTrading();

  console.log('=== BTC $50 Buy — WS Order Monitoring ===\n');

  // 1. Load CSV
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  etoro.resolver.loadFromCsv(csv);
  console.log(`[1] BTC = ${etoro.resolver.getCachedId('BTC')}`);

  // 2. Connect WS
  console.log('[2] Connecting WebSocket...');
  await etoro.connect();
  console.log('[2] Connected & authenticated\n');

  // Log all WS order events for visibility
  etoro.on('order:update', (event) => {
    console.log(
      `  [WS EVENT] OrderID=${event.OrderID} Status=${event.StatusID} ` +
      `Instrument=${event.InstrumentID} Units=${event.ExecutedUnits} ` +
      `P&L=${event.NetProfit} PositionID=${event.PositionID ?? 'n/a'}`
    );
  });

  // 3. Place $50 BTC buy
  console.log('[3] Placing $50 BTC market buy...');
  const startTime = Date.now();
  const order = await etoro.buyByAmount('BTC', 50);
  const orderId = order.orderForOpen?.orderID;
  console.log(`[3] Order submitted — orderID=${orderId} (${Date.now() - startTime}ms)\n`);

  // 4. Wait for execution via WS
  if (orderId) {
    console.log('[4] Waiting for execution via WebSocket...');
    const wsStart = Date.now();
    try {
      const result = await etoro.waitForOrder(orderId, 15_000);
      const wsElapsed = Date.now() - wsStart;
      console.log(`[4] Order EXECUTED in ${wsElapsed}ms via WebSocket!`);
      console.log(`    OrderID:    ${result.OrderID}`);
      console.log(`    StatusID:   ${result.StatusID}`);
      console.log(`    PositionID: ${result.PositionID ?? 'n/a'}`);
      console.log(`    Units:      ${result.ExecutedUnits}`);
      console.log(`    Amount:     ${result.Amount ?? 'n/a'}`);
      console.log(`    Rate:       ${result.Rate ?? 'n/a'}`);
    } catch (err: any) {
      console.log(`[4] Error: ${err.message}`);
    }
  }

  // 5. Portfolio check
  console.log('\n[5] Portfolio:');
  const portfolio = await etoro.getPortfolio();
  const cp = portfolio.clientPortfolio;
  console.log(`    Credit: $${cp.credit.toFixed(2)}`);
  for (const pos of cp.positions) {
    const sym = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
    console.log(`    #${pos.positionID}: ${sym} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} units=${pos.units} @ ${pos.openRate}`);
  }

  const totalElapsed = Date.now() - startTime;
  console.log(`\nTotal time: ${totalElapsed}ms`);

  await etoro.disconnect();
  console.log('Done!');
}

run().catch(console.error);
