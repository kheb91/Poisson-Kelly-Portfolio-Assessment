
import { ModelParams } from './poissonKelly';

export interface MacroParams {
  cpi: number;          // YoY Inflation %
  fedFundsRate: number; // %
  gdpGrowth: number;    // YoY %
  unemployment: number; // %
  isStressTest: boolean; // Forces High Correlation Regime
}

export const DEFAULT_MACRO: MacroParams = {
  cpi: 2.4,
  fedFundsRate: 3.65,
  gdpGrowth: 1.4,
  unemployment: 3.6,
  isStressTest: false
};

// "Neutral" baselines for relative adjustment
const BASELINE = {
  cpi: 2.0,
  gdp: 2.5,
  unemployment: 4.0,
  fedFunds: 3.0
};

export function adjustParamsWithMacro(baseParams: ModelParams, macro: MacroParams): { adjusted: ModelParams, explanations: string[] } {
  const explanations: string[] = [];
  const adj = { ...baseParams };

  // 1. Risk Free Rate Adjustment
  // The theoretical risk-free rate is closely tied to the Fed Funds Rate.
  // We blend the user's input with the Fed Rate (50/50) or override? 
  // Let's override for the "Macro Adjusted" model to show the impact.
  adj.riskFree = macro.fedFundsRate / 100;
  if (Math.abs(adj.riskFree - baseParams.riskFree) > 0.001) {
    explanations.push(`Risk-free rate adjusted to ${macro.fedFundsRate}% to match Federal Funds Rate.`);
  }

  // 2. Expected Return (Drift) Adjustment
  // GDP Growth: Higher growth implies higher corporate earnings.
  // Unemployment: Lower unemployment implies stronger consumer spending (up to a point of overheating).
  // Sensitivity: 1% GDP beat adds ~1.5% to equity return? Let's be conservative: 0.5 factor.
  const gdpDelta = macro.gdpGrowth - BASELINE.gdp;
  const unempDelta = macro.unemployment - BASELINE.unemployment;

  // Taylor Rule-ish adjustment for equity premium
  // If GDP is higher than baseline, increase mu.
  // If Unemployment is higher than baseline, decrease mu.
  const driftAdj = (gdpDelta * 0.015) - (unempDelta * 0.01);
  adj.mu = baseParams.mu + driftAdj;

  if (Math.abs(driftAdj) > 0.001) {
    const direction = driftAdj > 0 ? "increased" : "decreased";
    explanations.push(`Expected return ${direction} by ${(Math.abs(driftAdj) * 100).toFixed(2)}% due to GDP (${macro.gdpGrowth}%) and Unemployment (${macro.unemployment}%) divergence.`);
  }

  // 3. Volatility Adjustment
  // CPI: High inflation increases uncertainty.
  // Fed Funds: High rates can increase market stress.
  const cpiExcess = Math.max(0, macro.cpi - BASELINE.cpi); // Only penalize high inflation
  const volMultiplier = 1 + (cpiExcess * 0.05); // 5% vol increase per 1% excess CPI

  adj.sigma = baseParams.sigma * volMultiplier;
  if (volMultiplier > 1.001) {
    explanations.push(`Volatility scaled up by ${((volMultiplier - 1) * 100).toFixed(1)}% due to elevated CPI (${macro.cpi}%).`);
  }

  // 4. Jump Intensity Adjustment (Crash Risk)
  // Recession indicators: Negative GDP or High Unemployment (>6%)
  let jumpMultiplier = 1;
  if (macro.gdpGrowth < 0) jumpMultiplier += 0.5; // Recession
  if (macro.unemployment > 6.0) jumpMultiplier += 0.3; // High stress
  if (macro.cpi > 5.0) jumpMultiplier += 0.2; // Stagflation risk

  adj.lambda = baseParams.lambda * jumpMultiplier;
  if (jumpMultiplier > 1.001) {
    explanations.push(`Jump intensity (crash risk) increased by ${((jumpMultiplier - 1) * 100).toFixed(0)}% due to macroeconomic stress indicators.`);
  }

  return { adjusted: adj, explanations };
}
