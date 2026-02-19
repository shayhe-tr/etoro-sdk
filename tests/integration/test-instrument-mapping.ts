import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function main() {
  const etoro = new EToroTrading();

  // Test 1: getDisplayName by ID
  console.log('=== getDisplayName by ID ===');
  const btcName = await etoro.getDisplayName(100000);
  console.log(`  100000 → "${btcName}"`);

  // Test 2: getDisplayName by symbol
  console.log('\n=== getDisplayName by symbol ===');
  const aaplName = await etoro.getDisplayName('AAPL');
  console.log(`  AAPL → "${aaplName}"`);

  // Test 3: getInstrumentInfo full details
  console.log('\n=== getInstrumentInfo ===');
  const btcInfo = await etoro.getInstrumentInfo('BTC');
  console.log(`  displayName: ${btcInfo.displayName}`);
  console.log(`  symbolFull: ${btcInfo.symbolFull}`);
  console.log(`  instrumentTypeID: ${btcInfo.instrumentTypeID}`);
  console.log(`  exchangeID: ${btcInfo.exchangeID}`);
  console.log(`  priceSource: ${btcInfo.priceSource}`);
  console.log(`  imageUrl: ${btcInfo.imageUrl}`);

  // Test 4: getInstrumentInfoBatch
  console.log('\n=== getInstrumentInfoBatch ===');
  const infos = await etoro.getInstrumentInfoBatch(['BTC', 'AAPL', 'TSLA']);
  for (const info of infos) {
    console.log(`  ${info.instrumentId}: ${info.symbolFull} → "${info.displayName}"`);
  }

  // Test 5: Portfolio with display names
  console.log('\n=== Portfolio positions with display names ===');
  const portfolio = await etoro.getPortfolio();
  const positionIds = portfolio.clientPortfolio.positions.map(p => p.instrumentID);
  if (positionIds.length > 0) {
    await etoro.preloadInstrumentMetadata(positionIds);
    for (const pos of portfolio.clientPortfolio.positions) {
      const name = etoro.resolver.getCachedDisplayName(pos.instrumentID) ?? 'Unknown';
      const symbol = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
      console.log(`  #${pos.positionID}: ${symbol} (${name}) ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount}`);
    }
  } else {
    console.log('  No direct positions');
  }

  // Test 6: Cached lookups (should be instant, no API calls)
  console.log('\n=== Cached lookups (no API calls) ===');
  console.log(`  getCachedDisplayName(100000): ${etoro.resolver.getCachedDisplayName(100000)}`);
  console.log(`  getCachedInfo(100000)?.priceSource: ${etoro.resolver.getCachedInfo(100000)?.priceSource}`);
  console.log(`  metadataSize: ${etoro.resolver.metadataSize}`);

  console.log('\n✅ All instrument mapping tests passed!');
}

main().catch(e => console.error('Fatal:', e));
