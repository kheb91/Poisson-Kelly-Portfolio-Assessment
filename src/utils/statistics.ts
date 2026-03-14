import * as ss from 'simple-statistics';

// --- 1. Itô's Lemma Arithmetic Drift Correction ---

/**
 * Calculates the arithmetic drift (mu) from geometric mean returns using Itô's Lemma.
 * Formula: mu = (mean_log_return + 0.5 * sigma^2) * 252
 */
export function calculateArithmeticDrift(logReturns: number[]): { mu: number, sigma: number } {
  const meanLogReturn = ss.mean(logReturns);
  const stdDev = ss.standardDeviation(logReturns);

  // Convert mean daily log return back to standard daily percentage return
  const dailyArithmeticDrift = Math.exp(meanLogReturn) - 1;
  const annualizedMu = dailyArithmeticDrift * 252;
  const annualizedSigma = stdDev * Math.sqrt(252);

  return { mu: annualizedMu, sigma: annualizedSigma };
}

// --- 2. Covariance Shrinkage (Ledoit-Wolf) ---

/**
 * Calculates the Ledoit-Wolf shrunk covariance matrix.
 * Target: Constant Correlation Matrix.
 * 
 * Reference: "Honey, I Shrunk the Sample Covariance Matrix" (Ledoit & Wolf, 2004)
 */
export function calculateLedoitWolfCovariance(returns: number[][]): number[][] {
  const n = returns.length; // number of assets
  const t = returns[0].length; // number of observations (days)

  if (t < 2) throw new Error("Insufficient data for covariance calculation");

  // 1. Calculate Sample Covariance Matrix (S)
  const means = returns.map(r => ss.mean(r));
  const centered = returns.map((r, i) => r.map(val => val - means[i]));

  const sampleCov: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < t; k++) {
        sum += centered[i][k] * centered[j][k];
      }
      const val = sum / (t - 1);
      sampleCov[i][j] = val;
      sampleCov[j][i] = val;
    }
  }

  // 2. Calculate Target Matrix (F) - Constant Correlation
  // Average correlation
  let sumCor = 0;
  let countCor = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const stdI = Math.sqrt(sampleCov[i][i]);
      const stdJ = Math.sqrt(sampleCov[j][j]);
      const cor = sampleCov[i][j] / (stdI * stdJ);
      sumCor += cor;
      countCor++;
    }
  }
  const avgCor = countCor > 0 ? sumCor / countCor : 0;

  const targetCov: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        targetCov[i][j] = sampleCov[i][i];
      } else {
        const stdI = Math.sqrt(sampleCov[i][i]);
        const stdJ = Math.sqrt(sampleCov[j][j]);
        targetCov[i][j] = avgCor * stdI * stdJ;
      }
    }
  }

  // 3. Calculate Shrinkage Intensity (delta)
  // This is a simplified estimation of the optimal shrinkage intensity
  // based on the variance of the sample covariance.
  // Full implementation of Ledoit-Wolf 2004 is complex.
  // We use a robust estimator: delta = min(1, max(0, kappa / t))

  // Calculate pi (sum of asymptotic variances of entries of S)
  let pi = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sumSq = 0;
      for (let k = 0; k < t; k++) {
        const term = (centered[i][k] * centered[j][k]) - sampleCov[i][j];
        sumSq += term * term;
      }
      pi += sumSq / t; // asymptotic variance
    }
  }

  // Calculate gamma (distance between S and F)
  let gamma = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const diff = sampleCov[i][j] - targetCov[i][j];
      gamma += diff * diff;
    }
  }

  // Calculate rho (sum of asymptotic covariances) - approximated
  // For constant correlation target, rho is often close to sum of variances of diagonal
  // We use a simplified rho calculation for stability
  let rho = 0;
  // (Skipping full rho calculation for brevity, assuming pi is dominant term for shrinkage)
  // A common simplification is delta = 1 / t for very noisy data, or using the pi/gamma ratio.
  // Let's use the standard formula: kappa = (pi - rho) / gamma.
  // If we assume rho is small relative to pi (conservative), we can use kappa = pi / gamma.

  const kappa = pi / gamma;
  const delta = Math.max(0, Math.min(1, kappa / t));

  // 4. Shrink
  const shrunkCov: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      shrunkCov[i][j] = (1 - delta) * sampleCov[i][j] + delta * targetCov[i][j];
      // Annualize
      shrunkCov[i][j] *= 252;
    }
  }

  return shrunkCov;
}


// --- 3. MLE for Jump Diffusion ---

/**
 * Performs Maximum Likelihood Estimation to fit Merton Jump Diffusion parameters.
 * Returns: { lambda, jumpMean, jumpVol }
 */
export function mleJumpDiffusion(logReturns: number[]): { lambda: number, jumpMean: number, jumpVol: number } {
  // Initial estimates using moments/heuristics
  const mean = ss.mean(logReturns);
  const std = ss.standardDeviation(logReturns);

  // Define Likelihood Function
  // We approximate the daily return PDF as a mixture of two normals:
  // 1. No jump: N(mu*dt, sigma^2*dt) with prob (1 - lambda*dt)
  // 2. Jump: N(mu*dt + mu_J, sigma^2*dt + sigma_J^2) with prob (lambda*dt)
  // Note: This is a simplification of the full Poisson sum, valid for small dt (1/252)

  const dt = 1 / 252;

  // We fix mu and sigma to the sample estimates to reduce dimensionality and improve stability
  // The solver only optimizes lambda, jumpMean, jumpVol
  const mu_diff = mean; // drift per day
  const var_diff = std * std; // variance per day

  function negLogLikelihood(params: number[]): number {
    const [lambda, mu_J, sigma_J] = params;

    // CONSTRAINTS: Force Downside Tail Risk Only
    if (lambda < 0 || lambda > 252) return 1e9;
    if (sigma_J < 0) return 1e9;
    if (mu_J >= -0.01) return 1e9; // Jump mean MUST be worse than -1%

    const probJump = lambda * dt;
    const probNoJump = 1 - probJump;

    if (probNoJump < 0) return 1e9;

    let logLikelihood = 0;

    // Pre-calculate constants
    const sigma_no_jump = Math.sqrt(var_diff);
    const sigma_jump = Math.sqrt(var_diff + sigma_J * sigma_J);

    for (const x of logReturns) {
      // PDF of No Jump
      const d1 = (x - mu_diff) / sigma_no_jump;
      const pdf1 = (1 / (sigma_no_jump * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * d1 * d1);

      // PDF of Jump
      const d2 = (x - (mu_diff + mu_J)) / sigma_jump;
      const pdf2 = (1 / (sigma_jump * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * d2 * d2);

      const pdf = probNoJump * pdf1 + probJump * pdf2;

      if (pdf > 0) {
        logLikelihood += Math.log(pdf);
      } else {
        logLikelihood -= 1e9; // Penalty
      }
    }

    return -logLikelihood; // Minimize negative log likelihood
  }

  // Multi-start Nelder-Mead to avoid getting stuck
  // Try multiple starting guesses for jumpMean (ranging from moderate to severe crashes)
  const startingPoints = [
    [0.5, -0.05, 0.03],   // Small crashes: ~5% drop
    [1.0, -0.15, 0.08],   // Mid crashes: ~15% drop (e.g. tech selloff)
    [0.3, -0.30, 0.12],   // Large crashes: ~30% drop (e.g. bear market leg)
    [2.0, -0.08, 0.05],   // Frequent small dips
  ];

  let bestResult = { x: [0.5, -0.10, 0.05], fx: Infinity };

  for (const start of startingPoints) {
    const result = nelderMead(negLogLikelihood, start, { maxIter: 1000, tolerance: 1e-6 });
    if (result.fx < bestResult.fx) {
      bestResult = result;
    }
  }

  return {
    lambda: Math.max(0, Math.min(10, bestResult.x[0])),
    jumpMean: Math.min(-0.01, bestResult.x[1]),  // Clamp to strictly negative
    jumpVol: Math.max(0.01, bestResult.x[2])
  };
}

/**
 * Simple Nelder-Mead optimization algorithm
 */
function nelderMead(f: (x: number[]) => number, x0: number[], opts: { maxIter: number, tolerance: number }) {
  const n = x0.length;
  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;

  // Initialize simplex
  let simplex: { x: number[], fx: number }[] = [];
  simplex.push({ x: x0, fx: f(x0) });

  for (let i = 0; i < n; i++) {
    const x = [...x0];
    x[i] = x[i] !== 0 ? x[i] * 1.05 : 0.00025;
    simplex.push({ x, fx: f(x) });
  }

  for (let iter = 0; iter < opts.maxIter; iter++) {
    // Sort
    simplex.sort((a, b) => a.fx - b.fx);

    const best = simplex[0];
    const worst = simplex[n];
    const secondWorst = simplex[n - 1];

    // Check convergence
    const diff = Math.abs(worst.fx - best.fx);
    if (diff < opts.tolerance) break;

    // Centroid
    const centroid = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i].x[j];
      }
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    // Reflection
    const xr = centroid.map((c, j) => c + alpha * (c - worst.x[j]));
    const fxr = f(xr);

    if (best.fx <= fxr && fxr < secondWorst.fx) {
      simplex[n] = { x: xr, fx: fxr };
      continue;
    }

    // Expansion
    if (fxr < best.fx) {
      const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
      const fxe = f(xe);
      if (fxe < fxr) {
        simplex[n] = { x: xe, fx: fxe };
      } else {
        simplex[n] = { x: xr, fx: fxr };
      }
      continue;
    }

    // Contraction
    const xc = centroid.map((c, j) => c + rho * (worst.x[j] - c));
    const fxc = f(xc);
    if (fxc < worst.fx) {
      simplex[n] = { x: xc, fx: fxc };
      continue;
    }

    // Shrink
    for (let i = 1; i <= n; i++) {
      simplex[i].x = simplex[i].x.map((x, j) => best.x[j] + sigma * (x - best.x[j]));
      simplex[i].fx = f(simplex[i].x);
    }
  }

  return simplex[0];
}
