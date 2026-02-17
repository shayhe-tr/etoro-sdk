import 'dotenv/config';
import { EToroTrading } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function run() {
  const etoro = new EToroTrading();

  console.log('=== Partial Close BTC — $50 ===\n');

  // 1. Load CSV
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  etoro.resolver.loadFromCsv(csv);

  // 2. Get portfolio and find BTC position
  console.log('[1] Fetching portfolio...');
  const portfolio = await etoro.getPortfolio();
  const cp = portfolio.clientPortfolio;
  console.log(`    Credit: $${cp.credit.toFixed(2)}`);

  const btcPosition = cp.positions.find((p) => p.instrumentID === 100000);
  if (!btcPosition) {
    console.log('    No BTC position found!');
    return;
  }

  console.log(`    BTC position #${btcPosition.positionID}: ${btcPosition.isBuy ? 'LONG' : 'SHORT'} $${btcPosition.amount} units=${btcPosition.units} @ ${btcPosition.openRate}`);

  // 3. Calculate units to close for ~$50
  // units represents the fraction of the position. To close $50 of a $100 position, close half the units.
  const fractionToClose = 50 / btcPosition.amount;
  const unitsToDeduct = parseFloat((btcPosition.units * fractionToClose).toFixed(8));
  console.log(`\n[2] Closing ~$50 (${(fractionToClose * 100).toFixed(1)}%) = ${unitsToDeduct} units\n`);

  // 4. Execute partial close
  console.log('[3] Executing partial close...');
  try {
    const result = await etoro.closePosition(btcPosition.positionID, unitsToDeduct);
    console.log(`[3] Close response: token=${result.token}\n`);
  } catch (err: any) {
    console.log(`[3] Close error: ${err.message}`);
    if (err.responseBody) console.log('    Response:', err.responseBody);
    return;
  }

  // 5. Verify portfolio after close
  await new Promise((r) => setTimeout(r, 2000)); // wait for settlement
  console.log('[4] Portfolio after partial close:');
  const after = await etoro.getPortfolio();
  const cpAfter = after.clientPortfolio;
  console.log(`    Credit: $${cpAfter.credit.toFixed(2)}`);

  const btcAfter = cpAfter.positions.find((p) => p.instrumentID === 100000);
  if (btcAfter) {
    console.log(`    BTC position #${btcAfter.positionID}: $${btcAfter.amount} units=${btcAfter.units} @ ${btcAfter.openRate}`);
  } else {
    console.log('    BTC position fully closed');
  }

  console.log('\nDone!');
}

run().catch(console.error);
