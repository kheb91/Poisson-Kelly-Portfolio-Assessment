

/**
 * Constrained Multi-Asset Kelly Solver
 * 
 * Uses Projected Gradient Descent to maximize the Geometric Growth Rate
 * subject to:
 * 1. No shorting (w >= 0)
 * 2. Max weight constraint (w <= maxWeight)
 * 3. No leverage (sum(w) <= 1)
 * 
 * Objective: Maximize w'μ - 0.5 * w'Σw + Sum(λ * E[ln(1 + wJ)]) + (1 - sum(w)) * r_f
 */

export interface Asset {
  id: string;
  ticker: string;
  mu: number;    // Expected Return
  sigma: number; // Volatility
  lambda?: number; // Jump Intensity
  jumpMean?: number; // Jump Mean
  jumpVol?: number; // Jump Volatility
  weight?: number; // Calculated optimal weight
}

interface JumpParams {
  lambda: number;
  mu: number;
  sigma: number;
}

// Helper: Dot product
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

// Helper: Matrix-Vector multiplication
const matVec = (M: number[][], v: number[]) => M.map(row => dot(row, v));

// Projection onto Bounded Simplex (sum w = 1, 0 <= w <= u)
// Solves: min ||w - y||^2 s.t. sum(w) = 1, 0 <= w <= u
function projectToBoundedSimplex(y: number[], upperBounds: number[]): number[] {
  const n = y.length;

  // We need to find lambda such that Sum(clamp(y_i - lambda, 0, u_i)) = 1
  // f(lambda) = Sum(...) - 1 is monotonically decreasing.
  // We use bisection search.

  let low = Math.min(...y) - 1; // Sufficiently low
  let high = Math.max(...y);    // Sufficiently high
  const tol = 1e-7;
  const maxIter = 50;

  let lambda = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    lambda = (low + high) / 2;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += Math.max(0, Math.min(upperBounds[i], y[i] - lambda));
    }

    if (Math.abs(sum - 1) < tol) break;

    if (sum > 1) {
      // Sum is too big, need to increase lambda (subtract more)
      low = lambda;
    } else {
      high = lambda;
    }
  }

  return y.map((yi, i) => Math.max(0, Math.min(upperBounds[i], yi - lambda)));
}

// Quadratic Programming Solver using Projected Gradient Descent
// Augmented with Jump Risk Gradient
function solveQP(
  muVec: number[],      // Expected returns
  sigmaMat: number[][], // Covariance matrix
  jumpParams: (JumpParams | null)[], // Jump parameters per asset
  upperBounds: number[], // Max weight per asset
  iterations: number = 10000,
  learningRate: number = 0.05
): number[] {
  const n = muVec.length;
  // Objective: Maximize w'mu - 0.5 * w'Sigma w + Sum(lambda * E[ln(1+wJ)])
  // Equivalent to Minimize 0.5 * w'Sigma w - w'mu - Sum(...)
  // Gradient of minimization objective: Sigma w - mu - Gradient(JumpTerm)

  let w = Array(n).fill(1 / n); // Start with equal weights
  const tol = 1e-9;

  // Adaptive learning rate parameters
  let alpha = learningRate;

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Diffusion Gradient: Sigma * w - mu
    const grad = matVec(sigmaMat, w).map((v, i) => v - muVec[i]);

    // 2. Jump Risk Gradient (Full-Information)
    // Gradient of - Sum(lambda * E[ln(1 + wJ)])
    // = - Sum(lambda * E[ J / (1 + wJ) ])
    // We subtract this from the total gradient (since we are minimizing)

    for (let i = 0; i < n; i++) {
      const params = jumpParams[i];
      if (params && params.lambda > 0) {
        const { lambda, mu: J, sigma: vol } = params;
        const w_i = w[i];

        // Taylor approximation of E[ J / (1 + wJ) ]
        // approx = J / (1 + wJ) - w * vol^2 / (1 + wJ)^3

        const denom = 1 + w_i * J;
        // Safety check to avoid singularity if w approaches -1/J (which is > 1 for negative J)
        if (denom > 1e-4) {
          const term1 = J / denom;
          const term2 = (w_i * vol * vol) / (Math.pow(denom, 3));
          const expectation = term1 - term2;

          // Add to gradient (subtracting the positive benefit = adding penalty)
          grad[i] -= lambda * expectation;
        } else {
          // Near singularity (ruin), gradient pushes back massively
          grad[i] -= lambda * -1000;
        }
      }
    }

    // Gradient Descent Step
    // w_new = w - alpha * grad
    const w_new = w.map((v, i) => v - alpha * grad[i]);

    // Projection onto Bounded Simplex
    const w_proj = projectToBoundedSimplex(w_new, upperBounds);

    // Check convergence
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(w_proj[i] - w[i]);

    w = w_proj;
    if (diff < tol) break;

    // Simple annealing to refine solution
    if (iter % 1000 === 0) alpha *= 0.9;
  }

  return w;
}

export function optimizePortfolio(
  assets: Asset[],
  correlation: number,
  covarianceMatrix?: number[][],
  maxWeight: number = 1.0, // Default to 100% cap
  isStressTest: boolean = false
): { weights: number[], portMu: number, portSigma: number } {
  if (assets.length === 0) return { weights: [], portMu: 0, portSigma: 0 };

  // 1. Prepare Inputs (Stocks Only)
  const n = assets.length;
  const muVec = assets.map(a => a.mu);

  // Construct Covariance Matrix (N x N)
  const sigmaMat: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (covarianceMatrix) {
        // If a pre-computed Ledoit-Wolf matrix exists, extract base correlation and inflate if necessary
        let cov = covarianceMatrix[i][j];
        if (isStressTest && i !== j) {
          const stdI = Math.sqrt(covarianceMatrix[i][i]);
          const stdJ = Math.sqrt(covarianceMatrix[j][j]);
          const currentCor = cov / (stdI * stdJ);
          const stressCor = Math.max(currentCor, 0.85); // Spike correlation to 0.85 minimum
          cov = stressCor * stdI * stdJ;
        }
        row.push(cov);
      } else {
        if (i === j) {
          row.push(assets[i].sigma * assets[i].sigma); // Variance on diagonal
        } else {
          const activeCor = isStressTest ? Math.max(correlation, 0.85) : correlation;
          row.push(activeCor * assets[i].sigma * assets[j].sigma); // Covariance off-diagonal
        }
      }
    }
    sigmaMat.push(row);
  }

  // Prepare Jump Parameters
  const jumpParams: (JumpParams | null)[] = assets.map(a => (a.lambda && a.lambda > 0) ? {
    lambda: a.lambda,
    mu: a.jumpMean || -0.05,
    sigma: a.jumpVol || 0.05
  } : null);

  // Prepare Upper Bounds
  const upperBounds = Array(n).fill(maxWeight);

  // 2. Solve for Optimal Weights (Stocks Only)
  const weights = solveQP(muVec, sigmaMat, jumpParams, upperBounds);

  // Normalize weights to sum to 1.0 (in case sum(upperBounds) < 1.0)
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum > 0 && Math.abs(weightSum - 1.0) > 1e-5) {
    for (let i = 0; i < n; i++) {
      weights[i] /= weightSum;
    }
  }

  // 3. Calculate Portfolio Stats
  let portMu = 0;
  let portVar = 0;

  for (let i = 0; i < n; i++) portMu += weights[i] * muVec[i];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portVar += weights[i] * weights[j] * sigmaMat[i][j];
    }
  }

  return {
    weights,
    portMu,
    portSigma: Math.sqrt(portVar)
  };
}
