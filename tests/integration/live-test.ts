import 'dotenv/config';
import { EToroTrading, CandleInterval } from '../../src/index';

async function run() {
  console.log('=== eToro SDK Live Integration Test ===\n');
  console.log(`Mode: ${process.env.ETORO_MODE}`);
  console.log(`API Key: ${process.env.ETORO_API_KEY?.slice(0, 8)}...`);
  console.log('');

  const etoro = new EToroTrading();

  // Test 1: Search for an instrument
  console.log('--- Test 1: Search Instruments ---');
  try {
    const searchResult = await etoro.rest.marketData.searchInstruments({
      fields: 'instrumentId,displayname,symbol,currentRate,isOpen',
      searchText: 'AAPL',
      pageSize: 3,
    });
    console.log(`Found ${searchResult.totalItems ?? searchResult.items?.length ?? 0} results`);
    for (const item of (searchResult.items ?? []).slice(0, 3)) {
      console.log(`  ${item.displayname} (${item.symbol}) — ID: ${item.instrumentId} Rate: ${item.currentRate} Open: ${item.isOpen}`);
    }
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 2: Resolve symbol to instrumentId
  console.log('--- Test 2: Resolve Symbol ---');
  try {
    const id = await etoro.resolveInstrument('AAPL');
    console.log(`AAPL resolved to instrumentId: ${id}`);
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 3: Get live rates
  console.log('--- Test 3: Get Live Rates ---');
  try {
    const rates = await etoro.getRates(['AAPL', 'TSLA', 'BTC']);
    for (const rate of rates) {
      const symbol = etoro.resolver.getSymbol(rate.instrumentID) ?? String(rate.instrumentID);
      console.log(`  ${symbol}: bid=${rate.bid} ask=${rate.ask} last=${rate.lastExecution}`);
    }
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 4: Get candles
  console.log('--- Test 4: Get Candles (AAPL, 1D, last 5) ---');
  try {
    const candles = await etoro.getCandles('AAPL', CandleInterval.OneDay, 5);
    const group = candles.candles?.[0];
    if (group) {
      for (const c of group.candles) {
        console.log(`  ${c.fromDate}: O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`);
      }
    }
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 5: Get portfolio
  console.log('--- Test 5: Get Portfolio ---');
  try {
    const portfolio = await etoro.getPortfolio();
    const cp = portfolio.clientPortfolio;
    console.log(`  Credit: $${cp.credit}`);
    console.log(`  Open positions: ${cp.positions.length}`);
    console.log(`  Pending orders: ${cp.orders?.length ?? 0}`);
    console.log(`  Mirrors (copy trading): ${cp.mirrors?.length ?? 0}`);
    for (const pos of cp.positions.slice(0, 5)) {
      console.log(`    Position #${pos.positionID}: instrument=${pos.instrumentID} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} units=${pos.units}`);
    }
    if (cp.positions.length > 5) console.log(`    ... and ${cp.positions.length - 5} more`);
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 6: Get exchanges
  console.log('--- Test 6: Get Exchanges ---');
  try {
    const exchanges = await etoro.rest.marketData.getExchanges();
    console.log(`  Found ${exchanges.exchangeInfo?.length ?? 0} exchanges`);
    for (const ex of (exchanges.exchangeInfo ?? []).slice(0, 5)) {
      console.log(`    ${ex.exchangeID}: ${ex.exchangeDescription}`);
    }
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  // Test 7: Get instrument types
  console.log('--- Test 7: Get Instrument Types ---');
  try {
    const types = await etoro.rest.marketData.getInstrumentTypes();
    console.log(`  Found ${types.instrumentTypes?.length ?? 0} types`);
    for (const t of (types.instrumentTypes ?? []).slice(0, 5)) {
      console.log(`    ${t.instrumentTypeID}: ${t.instrumentTypeDescription}`);
    }
    console.log('PASS\n');
  } catch (err: any) {
    console.log(`FAIL: ${err.message}\n`);
    if (err.responseBody) console.log(`  Response: ${err.responseBody}\n`);
  }

  console.log('=== Integration Test Complete ===');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
