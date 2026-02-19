import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function main() {
  const etoro = new EToroTrading();

  // Test 1: getInstruments metadata - check exact field names/casing
  console.log('=== getInstruments (metadata) ===');
  const meta = await etoro.rest.marketData.getInstruments({ instrumentIds: [100000] }); // BTC
  const btcMeta = meta.instrumentDisplayDatas?.[0];
  if (btcMeta) {
    console.log('All field names:', Object.keys(btcMeta));
    console.log('Full object:', JSON.stringify(btcMeta, null, 2));
  } else {
    console.log('RAW:', JSON.stringify(meta).slice(0, 2000));
  }

  // Test 2: searchInstruments - check what fields are actually returned
  console.log('\n=== searchInstruments (exact match) ===');
  const search = await etoro.rest.marketData.searchInstruments({
    fields: 'instrumentId,displayname,symbol,instrumentTypeID,exchangeID',
    internalSymbolFull: 'AAPL',
    pageSize: 1,
  });
  if (search.items?.length > 0) {
    console.log('All field names:', Object.keys(search.items[0]));
    console.log('Full object:', JSON.stringify(search.items[0], null, 2));
  } else {
    console.log('RAW:', JSON.stringify(search).slice(0, 2000));
  }

  // Test 3: searchInstruments with text search
  console.log('\n=== searchInstruments (text search "Apple") ===');
  const textSearch = await etoro.rest.marketData.searchInstruments({
    fields: 'instrumentId,displayname,symbol',
    searchText: 'Apple',
    pageSize: 3,
  });
  for (const item of textSearch.items ?? []) {
    console.log(`  id=${item.instrumentId} symbol=${item.symbol} displayname=${item.displayname}`);
  }

  // Test 4: getInstruments with multiple IDs
  console.log('\n=== getInstruments (multi-ID) ===');
  const multi = await etoro.rest.marketData.getInstruments({ instrumentIds: [100000, 1001, 1002] });
  for (const d of multi.instrumentDisplayDatas ?? []) {
    console.log(`  instrumentID=${(d as any).instrumentID ?? (d as any).instrumentId} symbolFull=${d.symbolFull} displayName=${d.instrumentDisplayName}`);
  }
}

main().catch(e => console.error('Fatal:', e));
