import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function run() {
  const etoro = new EToroTrading();

  // Try different field names
  console.log('=== Search with internalSymbolFull ===');
  try {
    const r = await etoro.rest.marketData.searchInstruments({
      fields: 'instrumentId,instrumentDisplayName,symbolFull,currentRate,isOpen',
      searchText: 'AAPL',
      pageSize: 3,
    });
    console.log(JSON.stringify(r, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Try the search endpoint with the query param from docs
  console.log('\n=== Search by internalSymbolFull query param ===');
  try {
    const result = await (etoro.rest as any).marketData.http.request({
      method: 'GET',
      path: '/api/v1/market-data/search',
      query: {
        fields: 'instrumentId,instrumentDisplayName,symbolFull',
        internalSymbolFull: 'AAPL',
        pageSize: 5,
      },
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Get rates for known instrumentId (1001 = Apple)
  console.log('\n=== Rates for instrumentId 1001 ===');
  try {
    const rates = await etoro.rest.marketData.getRates([1001]);
    console.log(JSON.stringify(rates, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Get candles for 1001
  console.log('\n=== Candles for 1001 ===');
  try {
    const candles = await etoro.getCandles(1001, 'OneDay' as any, 3);
    console.log(JSON.stringify(candles, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }
}

run().catch(console.error);
