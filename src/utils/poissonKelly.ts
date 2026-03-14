
/**
 * Poisson-Kelly Model Utilities
 * 
 * Implements the optimal leverage calculation for a Jump Diffusion model (Merton).
 */

// Gaussian random number generator (Box-Muller transform)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export interface ModelParams {
  mu: number;          // Total Expected Annual Return (decimal)
  sigma: number;       // Annual Volatility (decimal)
  riskFree: number;    // Risk-free Rate (decimal)
  lambda: number;      // Jump Intensity (events per year)
  jumpMean: number;    // Mean of log-jump size (e.g., -0.2 for -20% drop on average)
  jumpVol: number;     // Volatility of log-jump size
  horizon: number;     // Investment Horizon (years)
  initialWealth: number; // Initial Portfolio Value
  simulations: number; // Number of Monte Carlo paths
  maxLeverage: number; // Maximum allowed leverage (e.g., 1.0 for 100% cash)
  maxAssetWeight: number; // Maximum weight for a single asset (e.g., 0.30 for 30%)
  kellyFraction: number; // Fractional Kelly (e.g. 0.5 for Half-Kelly)
  frictionCost: number; // Annual friction cost (decimal, e.g. 0.001)
  maxDrawdown: number; // Max acceptable drawdown (decimal, e.g. 0.25)
}

export interface SimulationResult {
  optimalFraction: number;
  unconstrainedFraction: number; // The theoretical optimal if no cap
  maxGrowthRate: number;
  paths: { time: number; value: number }[][];
  finalWealths: number[];
  maxDrawdowns: number[];
  kellyCurve: { leverage: number; growth: number }[];
}

// Calculate expected value of (Y - 1) where Y is lognormal(jumpMean, jumpVol)
export function getExpectedJumpSize(jumpMean: number, jumpVol: number): number {
  // E[Y] = exp(mu + 0.5 * sigma^2)
  const expectedY = Math.exp(jumpMean + 0.5 * jumpVol * jumpVol);
  return expectedY - 1;
}

// Calculate the growth rate g(f)
// g(f) = r + f(mu - r - lambda*k) - 0.5*sigma^2*f^2 + lambda * E[ln(1 + f(Y-1))]
export function calculateGrowthRate(f: number, params: ModelParams): number {
  const { mu, sigma, riskFree, lambda, jumpMean, jumpVol } = params;
  const k = getExpectedJumpSize(jumpMean, jumpVol);

  // Numerical Integration for E[ln(1 + f(Y-1))]
  // Y = exp(x), x ~ N(jumpMean, jumpVol^2)
  let jumpExpectation = 0;
  const steps = 200;
  const range = 5 * jumpVol; // Integrate +/- 5 sigmas
  const stepSize = (2 * range) / steps;

  for (let i = 0; i <= steps; i++) {
    const x = jumpMean - range + i * stepSize;
    const Y = Math.exp(x);

    // PDF of x
    const pdfX = (1 / (Math.sqrt(2 * Math.PI) * jumpVol)) * Math.exp(-0.5 * Math.pow((x - jumpMean) / jumpVol, 2));

    // Value inside expectation
    // Check for ruin: if 1 + f(Y-1) <= 0, log is undefined (ruin)
    const wealthFactor = 1 + f * (Y - 1);
    let val = 0;
    if (wealthFactor <= 1e-9) {
      val = -1e9; // Penalty for ruin
    } else {
      val = Math.log(wealthFactor);
    }

    jumpExpectation += val * pdfX * stepSize;
  }

  const driftPart = (mu - lambda * k - riskFree) * f;
  const volPart = 0.5 * sigma * sigma * f * f;
  const growth = riskFree + driftPart - volPart + lambda * jumpExpectation;

  return growth;
}

// Optimize f using Golden Section Search
function findOptimalFraction(params: ModelParams): number {
  const phi = (1 + Math.sqrt(5)) / 2;
  let a = 0;
  let b = 5; // Theoretical search upper bound

  // Refine range: check if growth decreases immediately
  if (calculateGrowthRate(0.01, params) < calculateGrowthRate(0, params)) {
    return 0;
  }

  let c = b - (b - a) / phi;
  let d = a + (b - a) / phi;

  const tol = 1e-4;

  while (Math.abs(b - a) > tol) {
    if (calculateGrowthRate(c, params) < calculateGrowthRate(d, params)) {
      a = c;
    } else {
      b = d;
    }
    c = b - (b - a) / phi;
    d = a + (b - a) / phi;
  }

  return (a + b) / 2;
}

export function runSimulation(params: ModelParams): SimulationResult {
  const theoreticalOptimalF = findOptimalFraction(params);

  // Apply constraint
  const optimalF = Math.min(theoreticalOptimalF, params.maxLeverage);

  const maxGrowth = calculateGrowthRate(optimalF, params);

  // Generate Kelly Curve
  const kellyCurve = [];
  // Show curve up to 2x the optimal or at least 2.0
  const curveMax = Math.max(2.0, theoreticalOptimalF * 1.5);

  for (let l = 0; l <= curveMax; l += (curveMax / 50)) {
    let growth = calculateGrowthRate(l, params);
    if (growth < -1.0) growth = -1.0; // Clamp penalty to -100% for smooth charting

    kellyCurve.push({
      leverage: l,
      growth: growth
    });
  }

  // Monte Carlo Simulation
  const dt = 1 / 252; // Daily steps
  const nSteps = Math.floor(params.horizon * 252);
  const paths: { time: number; value: number }[][] = [];
  const finalWealths: number[] = [];
  const maxDrawdowns: number[] = [];

  const k = getExpectedJumpSize(params.jumpMean, params.jumpVol);

  // Continuous drift component for log wealth
  // dlnW = (r + f(mu - r - lambda*k) - 0.5*(f*sigma)^2)dt + f*sigma*dW
  // Note: The formula in original code line 143 was slightly different, let's stick to what was there or correct it.
  // Original: params.riskFree + optimalF * (params.mu - params.riskFree - params.lambda * k) - 0.5 * Math.pow(optimalF * params.sigma, 2);
  // This matches the Merton model log-drift.

  const logDrift = params.riskFree + optimalF * (params.mu - params.riskFree - params.lambda * k) - 0.5 * Math.pow(optimalF * params.sigma, 2);
  const diffusionVol = optimalF * params.sigma;

  for (let i = 0; i < params.simulations; i++) {
    const path = [{ time: 0, value: params.initialWealth }];
    let currentWealth = params.initialWealth;
    let peakWealth = params.initialWealth;
    let maxDrawdown = 0;
    let ruined = false;

    for (let t = 1; t <= nSteps; t++) {
      if (ruined) {
        if (t % 5 === 0 || t === nSteps) path.push({ time: t / 252, value: 0 });
        continue;
      }

      // Diffusion step
      const dZ = randn() * Math.sqrt(dt);

      // Jump step
      let jumpLogReturn = 0;
      // Poisson check
      if (Math.random() < params.lambda * dt) {
        // Jump size Y is lognormal(jumpMean, jumpVol)
        // Y - 1 is the percentage change in asset price
        // Wealth factor = 1 + f * (Y - 1)

        // Use Box-Muller for jump size
        const logY = params.jumpMean + params.jumpVol * randn();
        const Y = Math.exp(logY);
        const wealthFactor = 1 + optimalF * (Y - 1);

        if (wealthFactor <= 1e-9) {
          ruined = true;
          currentWealth = 0;
        } else {
          jumpLogReturn = Math.log(wealthFactor);
        }
      }

      if (!ruined) {
        // Update wealth
        // W_t = W_{t-1} * exp(drift*dt + vol*dZ + jump)
        currentWealth *= Math.exp(logDrift * dt + diffusionVol * dZ + jumpLogReturn);

        // Update Peak and Drawdown
        if (currentWealth > peakWealth) {
          peakWealth = currentWealth;
        } else {
          const dd = (peakWealth - currentWealth) / peakWealth;
          if (dd > maxDrawdown) maxDrawdown = dd;
        }
      }

      // Store points (downsample)
      if (t % 5 === 0 || t === nSteps) {
        path.push({ time: t / 252, value: currentWealth });
      }
    }

    if (ruined) maxDrawdown = 1.0;

    paths.push(path);
    finalWealths.push(currentWealth);
    maxDrawdowns.push(maxDrawdown);
  }

  return {
    optimalFraction: optimalF,
    unconstrainedFraction: theoreticalOptimalF,
    maxGrowthRate: maxGrowth,
    paths,
    finalWealths,
    maxDrawdowns,
    kellyCurve
  };
}
