import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function run() {
  const etoro = new EToroTrading();

  console.log('=== BTC Price Stream + $100 Buy ===\n');

  // 1. Connect WebSocket
  console.log('[1] Connecting WebSocket...');
  await etoro.connect();
  console.log('[1] Connected & authenticated\n');

  // 2. Load instrument mapping from CSV for reliable symbol resolution
  console.log('[2] Loading instrument mapping...');
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { resolve: pathResolve } = await import('path');
  const csvPath = pathResolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const loaded = etoro.resolver.loadFromCsv(csv);
  console.log(`[2] Loaded ${loaded} instruments from CSV`);
  const btcId = etoro.resolver.getCachedId('BTC');
  console.log(`[2] BTC resolved to: ${btcId}\n`);

  // 3. Subscribe to BTC price stream
  console.log('[3] Subscribing to BTC price feed...');
  await etoro.streamPrices(['BTC'], true);

  // Subscribe to private events to see order updates
  etoro.subscribeToPrivateEvents();

  let priceCount = 0;
  let latestBid = 0;
  let latestAsk = 0;

  // Debug: log raw WS messages
  etoro.on('ws:message', (envelope) => {
    console.log('[WS RAW]', JSON.stringify(envelope).slice(0, 500));
  });

  etoro.on('price', (symbol, instrumentId, rate) => {
    priceCount++;
    latestBid = rate.Bid;
    latestAsk = rate.Ask;
    console.log(
      `[PRICE #${priceCount}] ${symbol} (${instrumentId}): ` +
      `bid=${rate.Bid} ask=${rate.Ask} keys=${Object.keys(rate).join(',')}`
    );
  });

  etoro.on('order:update', (event) => {
    console.log(
      `[ORDER EVENT] OrderID=${event.OrderID} Status=${event.StatusID} ` +
      `Instrument=${event.InstrumentID} P&L=${event.NetProfit}`
    );
  });

  etoro.on('error', (err) => {
    console.error('[ERROR]', err.message);
  });

  // Wait for a few price updates (or timeout after 15s)
  console.log('[3] Waiting for price updates...\n');
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (priceCount >= 3) {
        clearInterval(check);
        resolve();
      }
    }, 500);
    setTimeout(() => { clearInterval(check); resolve(); }, 15_000);
  });

  console.log(`\n[3] Received ${priceCount} price updates. Latest: bid=${latestBid} ask=${latestAsk}\n`);

  // 4. Execute $100 BTC buy order
  console.log('[4] Placing $100 BTC market buy order...');
  try {
    const order = await etoro.buyByAmount('BTC', 100);
    console.log('[4] Order response:', JSON.stringify(order, null, 2));

    // 5. Wait for execution
    console.log('\n[5] Waiting for order execution...');
    const orderId = order.orderForOpen?.orderID;
    if (orderId) {
      try {
        const result = await etoro.waitForOrderExecution(orderId, 15_000);
        console.log('[5] Order executed:', JSON.stringify(result, null, 2));
      } catch (err: any) {
        console.log('[5] Execution wait result:', err.message);
      }
    }
  } catch (err: any) {
    console.log('[4] Order error:', err.message);
    if (err.responseBody) console.log('    Response:', err.responseBody);
  }

  // 6. Check portfolio
  console.log('\n[6] Checking portfolio...');
  try {
    const portfolio = await etoro.getPortfolio();
    const cp = portfolio.clientPortfolio;
    console.log(`[6] Credit: $${cp.credit}`);
    console.log(`[6] Positions: ${cp.positions.length}`);
    for (const pos of cp.positions.slice(0, 5)) {
      const sym = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
      console.log(`    #${pos.positionID}: ${sym} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} units=${pos.units}`);
    }
  } catch (err: any) {
    console.log('[6] Portfolio error:', err.message);
  }

  // 7. Disconnect
  console.log('\n[7] Disconnecting...');
  await etoro.disconnect();
  console.log('[7] Done!');
}

run().catch(console.error);
