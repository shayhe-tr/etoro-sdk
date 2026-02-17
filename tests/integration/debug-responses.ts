import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function run() {
  const etoro = new EToroTrading();

  // Debug: Raw search response
  console.log('=== Search Response (raw) ===');
  try {
    const result = await etoro.rest.marketData.searchInstruments({
      fields: 'instrumentId,displayname,symbol,currentRate,isOpen,isBuyEnabled',
      searchText: 'AAPL',
      pageSize: 3,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Debug: Raw instruments response
  console.log('\n=== Instruments Metadata ===');
  try {
    const result = await etoro.rest.marketData.getInstruments({ instrumentIds: [1001] });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Debug: Try different instrument IDs for rates
  console.log('\n=== Rates (try ID from search) ===');
  try {
    // First get an ID from search
    const search = await etoro.rest.marketData.searchInstruments({
      fields: 'instrumentId,displayname',
      searchText: 'Apple',
      pageSize: 3,
    });
    console.log('Search result keys:', Object.keys(search));
    const items = (search as any).items ?? (search as any).results ?? (search as any).data;
    if (items && items[0]) {
      console.log('First item keys:', Object.keys(items[0]));
      console.log('First item:', JSON.stringify(items[0], null, 2));
    }
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }

  // Debug: Portfolio raw
  console.log('\n=== Portfolio (first 500 chars) ===');
  try {
    const result = await etoro.getPortfolio();
    const str = JSON.stringify(result, null, 2);
    console.log(str.slice(0, 1500));
  } catch (err: any) {
    console.log('Error:', err.message, err.responseBody);
  }
}

run().catch(console.error);
