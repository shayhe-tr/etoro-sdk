import 'dotenv/config';
import { EToroTrading } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function run() {
  const etoro = new EToroTrading();
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../../src/data/instruments.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  etoro.resolver.loadFromCsv(csv);

  const p = await etoro.getPortfolio();
  const cp = p.clientPortfolio;

  console.log('========== PORTFOLIO ==========\n');
  console.log(`Cash (Credit): $${cp.credit.toFixed(2)}`);
  console.log(`Bonus Credit:  $${cp.bonusCredit.toFixed(2)}`);

  // --- Direct Positions ---
  console.log(`\n--- Direct Positions (${cp.positions.length}) ---`);
  for (const pos of cp.positions) {
    const sym = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
    console.log(`  #${pos.positionID}: ${sym} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} units=${pos.units} @ ${pos.openRate} (leverage: x${pos.leverage})`);
  }

  // --- Copy (Mirror) Investments ---
  console.log(`\n--- Copy Investments (${cp.mirrors.length}) ---`);
  for (const mirror of cp.mirrors) {
    const status = mirror.pendingForClosure ? ' [PENDING CLOSURE]' : mirror.isPaused ? ' [PAUSED]' : '';
    console.log(`\n  Copy #${mirror.mirrorID}: @${mirror.parentUsername}${status}`);
    console.log(`    Initial investment: $${mirror.initialInvestment.toFixed(2)}`);
    console.log(`    Available amount:   $${mirror.availableAmount.toFixed(2)}`);
    console.log(`    Deposits:           $${mirror.depositSummary.toFixed(2)}`);
    console.log(`    Withdrawals:        $${mirror.withdrawalSummary.toFixed(2)}`);
    console.log(`    Closed P&L:         $${mirror.closedPositionsNetProfit.toFixed(2)}`);
    console.log(`    Stop Loss:          $${mirror.stopLossAmount.toFixed(2)} (${mirror.stopLossPercentage}%)`);
    console.log(`    Started:            ${mirror.startedCopyDate}`);
    console.log(`    Positions (${mirror.positions.length}):`);
    for (const pos of mirror.positions) {
      const sym = etoro.resolver.getSymbol(pos.instrumentID) ?? String(pos.instrumentID);
      console.log(`      #${pos.positionID}: ${sym} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount} units=${pos.units} @ ${pos.openRate} (x${pos.leverage})`);
    }
    if (mirror.ordersForOpen.length > 0) {
      console.log(`    Pending orders (${mirror.ordersForOpen.length}):`);
      for (const ord of mirror.ordersForOpen) {
        const sym = etoro.resolver.getSymbol(ord.instrumentID) ?? String(ord.instrumentID);
        console.log(`      #${ord.orderID}: ${sym} ${ord.isBuy ? 'BUY' : 'SELL'} $${ord.amount} @ ${ord.rate}`);
      }
    }
  }

  // --- Pending Orders ---
  if (cp.orders.length > 0 || cp.ordersForOpen.length > 0) {
    console.log(`\n--- Pending Orders ---`);
    for (const ord of [...cp.orders, ...cp.ordersForOpen]) {
      const sym = etoro.resolver.getSymbol(ord.instrumentID) ?? String(ord.instrumentID);
      console.log(`  #${ord.orderID}: ${sym} ${ord.isBuy ? 'BUY' : 'SELL'} $${ord.amount} @ ${ord.rate}`);
    }
  }

  // --- Summary ---
  const directValue = cp.positions.reduce((sum, p) => sum + p.amount, 0);
  const copyValue = cp.mirrors.reduce((sum, m) => sum + m.positions.reduce((s, p) => s + p.amount, 0) + m.availableAmount, 0);
  console.log('\n========== SUMMARY ==========');
  console.log(`Cash:              $${cp.credit.toFixed(2)}`);
  console.log(`Direct positions:  $${directValue.toFixed(2)}`);
  console.log(`Copy investments:  $${copyValue.toFixed(2)}`);
  console.log(`Total (approx):   $${(cp.credit + directValue + copyValue).toFixed(2)}`);
  console.log('==============================');
}

run().catch(console.error);
