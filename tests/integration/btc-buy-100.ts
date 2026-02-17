import 'dotenv/config';
import { EToroTrading } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function run() {
  const etoro = new EToroTrading();

  console.log('=== Open $100 BTC Position ===\n');

  // 1. Load CSV instrument mapping
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const loaded = etoro.resolver.loadFromCsv(csv);
  console.log(`[1] Loaded ${loaded} instruments. BTC = ${etoro.resolver.getCachedId('BTC')}\n`);

  // 2. Connect WebSocket
  console.log('[2] Connecting WebSocket...');
  await etoro.connect();
  console.log('[2] Connected & authenticated\n');

  // 3. Stream BTC price for context
  await etoro.streamPrices(['BTC'], true);
  etoro.subscribeToPrivateEvents();

  let latestBid = 0;
  let latestAsk = 0;

  etoro.on('price', (_symbol, _id, rate) => {
    latestBid = rate.Bid;
    latestAsk = rate.Ask;
  });

  etoro.on('order:update', (event) => {
    console.log(
      `[ORDER EVENT] OrderID=${event.OrderID} Status=${event.StatusID} ` +
      `Instrument=${event.InstrumentID} P&L=${event.NetProfit}`
    );
  });

  // Wait for first price tick
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (latestBid > 0) { clearInterval(check); resolve(); }
    }, 200);
    setTimeout(() => { clearInterval(check); resolve(); }, 10_000);
  });

  console.log(`[3] BTC price: bid=$${latestBid} ask=$${latestAsk}\n`);

  // 4. Place $100 buy order
  console.log('[4] Placing $100 BTC market buy...');
  const order = await etoro.buyByAmount('BTC', 100);
  const orderId = order.orderForOpen?.orderID;
  console.log(`[4] Order placed — orderID=${orderId} statusID=${order.orderForOpen?.statusID}\n`);

  // 5. Wait for execution
  if (orderId) {
    console.log('[5] Waiting for execution...');
    try {
      const result = await etoro.waitForOrderExecution(orderId, 15_000);
      console.log(`[5] Executed! positionID=${result.positions?.[0]?.positionID} units=${result.units}`);
    } catch (err: any) {
      console.log(`[5] ${err.message}`);
    }
  }

  // 6. Portfolio snapshot
  console.log('\n[6] Portfolio:');
  const portfolio = await etoro.getPortfolio();
  const cp = portfolio.clientPortfolio;
  console.log(`    Credit: $${cp.credit.toFixed(2)}`);
  console.log(`    Positions: ${cp.positions.length}`);
  for (const pos of cp.positions) {
    const sym = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
    console.log(`    #${pos.positionID}: ${sym} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} @ ${pos.openRate}`);
  }

  // 7. Disconnect
  await etoro.disconnect();
  console.log('\nDone!');
}

run().catch(console.error);
