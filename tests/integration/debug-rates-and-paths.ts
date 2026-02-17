import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function run() {
  const etoro = new EToroTrading();

  // Test rates with known IDs directly
  console.log('=== Rates with single ID (1001 = AAPL) ===');
  try {
    const rates = await etoro.rest.marketData.getRates([1001]);
    console.log(JSON.stringify(rates, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Resolve TSLA and BTC
  console.log('\n=== Resolve TSLA ===');
  try {
    const id = await etoro.resolveInstrument('TSLA');
    console.log('TSLA =', id);
  } catch (err: any) {
    console.log('Error:', err.message);
  }

  console.log('\n=== Resolve BTC ===');
  try {
    const id = await etoro.resolveInstrument('BTC');
    console.log('BTC =', id);
  } catch (err: any) {
    console.log('Error:', err.message);
  }

  // Test rates with multiple known IDs
  console.log('\n=== Rates with multiple IDs ===');
  try {
    const ids = [1001]; // Just AAPL for now
    const tslaId = etoro.resolver.getCachedId('TSLA');
    const btcId = etoro.resolver.getCachedId('BTC');
    if (tslaId) ids.push(tslaId);
    if (btcId) ids.push(btcId);
    console.log('Requesting rates for IDs:', ids);
    const rates = await etoro.rest.marketData.getRates(ids);
    console.log(JSON.stringify(rates, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Test which metadata paths work
  console.log('\n=== Test various paths ===');
  const pathsToTest = [
    '/api/v1/market-data/instruments/types',
    '/api/v1/market-data/instruments/exchanges',
    '/api/v1/market-data/asset-classes',
    '/api/v1/market-data/exchanges',
  ];

  for (const path of pathsToTest) {
    try {
      const result = await (etoro.rest as any).marketData.http.request({
        method: 'GET',
        path,
      });
      console.log(`${path}: OK`, JSON.stringify(result).slice(0, 200));
    } catch (err: any) {
      console.log(`${path}: ${err.statusCode ?? 'ERR'} ${err.message?.slice(0, 60)}`);
    }
  }
}

run().catch(console.error);
