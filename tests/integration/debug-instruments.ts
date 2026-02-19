import 'dotenv/config';
import { EToroTrading } from '../../src/index';

async function main() {
  const etoro = new EToroTrading();

  // Step 1: Get portfolio to find instrument IDs
  console.log('=== Getting portfolio ===');
  const portfolio = await etoro.getPortfolio();
  const ids = [...new Set(portfolio.clientPortfolio.positions.map(p => p.instrumentID))];
  console.log('Instrument IDs from portfolio:', ids);

  // Step 2: Try getInstruments with ALL IDs (comma-separated)
  console.log('\n=== getInstruments with ALL IDs ===');
  try {
    const result = await etoro.rest.marketData.getInstruments({ instrumentIds: ids });
    console.log('SUCCESS with multi-ID!');
    console.log('Response keys:', Object.keys(result));
    if (result.instrumentDisplayDatas) {
      console.log('Count:', result.instrumentDisplayDatas.length);
      for (const d of result.instrumentDisplayDatas) {
        console.log(`  ID: ${d.instrumentID} | symbolFull: ${d.symbolFull} | displayName: ${d.instrumentDisplayName}`);
      }
    } else {
      console.log('RAW response (first 1500 chars):', JSON.stringify(result).slice(0, 1500));
    }
  } catch (err: any) {
    console.error('FAILED with multi-ID:', err.message);
    if (err.statusCode) console.error('  Status:', err.statusCode);
    if (err.responseBody) console.error('  Body:', String(err.responseBody).slice(0, 500));

    // Step 3: Try with SINGLE ID
    console.log('\n=== Fallback: getInstruments with SINGLE ID ===');
    try {
      const single = await etoro.rest.marketData.getInstruments({ instrumentIds: [ids[0]] });
      console.log('Single ID SUCCESS!');
      console.log('Response keys:', Object.keys(single));
      if (single.instrumentDisplayDatas) {
        const d = single.instrumentDisplayDatas[0];
        console.log(`  ID: ${d.instrumentID} | symbolFull: ${d.symbolFull} | displayName: ${d.instrumentDisplayName}`);
      } else {
        console.log('RAW:', JSON.stringify(single).slice(0, 500));
      }
    } catch (e2: any) {
      console.error('Single ID also FAILED:', e2.message);
      if (e2.statusCode) console.error('  Status:', e2.statusCode);
      if (e2.responseBody) console.error('  Body:', String(e2.responseBody).slice(0, 500));
    }
  }
}

main().catch(e => console.error('Fatal:', e));
