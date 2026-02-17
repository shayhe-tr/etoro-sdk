import 'dotenv/config';
import { EToroTrading } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function run() {
  const etoro = new EToroTrading();
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  etoro.resolver.loadFromCsv(readFileSync(csvPath, 'utf-8'));

  // Close the most recent BTC position
  const portfolio = await etoro.getPortfolio();
  const btcPositions = portfolio.clientPortfolio.positions
    .filter((p) => p.instrumentID === 100000)
    .sort((a, b) => new Date(b.openDateTime).getTime() - new Date(a.openDateTime).getTime());

  if (btcPositions.length === 0) {
    console.log('No BTC positions to close');
    return;
  }

  const latest = btcPositions[0];
  console.log(`Closing BTC position #${latest.positionID}: $${latest.amount} units=${latest.units}`);
  const result = await etoro.closePosition(latest.positionID);
  console.log(`Closed — token: ${result.token}`);

  // Wait for settlement
  await new Promise((r) => setTimeout(r, 2000));
  const after = await etoro.getPortfolio();
  console.log(`Credit after: $${after.clientPortfolio.credit.toFixed(2)}`);
  console.log(`Positions remaining: ${after.clientPortfolio.positions.length}`);
  for (const p of after.clientPortfolio.positions) {
    const sym = etoro.resolver.getSymbol(p.instrumentID) ?? String(p.instrumentID);
    console.log(`  #${p.positionID}: ${sym} $${p.amount}`);
  }
}

run().catch(console.error);
