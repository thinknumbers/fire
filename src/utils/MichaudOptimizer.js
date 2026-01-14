import { cholesky, generateCorrelatedSample, getStats, dot, matMul } from './mathHelpers';

// ---------------------------------------------------------
// 1. PROJECTED GRADIENT DESCENT (PGD) SOLVER for Markowitz
// ---------------------------------------------------------
// Minimizes Variance w'Cw subject to w'Mu = TargetReturn AND Sum(w)=1 AND 0<=w<=1
// Note: We use a penalty method or direct projection for equality constraints.

function solveMarkowitz(mean, cov, targetReturn, minWeights, maxWeights) {
    const n = mean.length;
    // Initial guess: Equal weights (normalized to constraints if needed)
    let w = new Array(n).fill(1/n); 
    
    // Hyperparameters
    // Hyperparameters
    const LR = 0.5; // Increased from 0.01 for decimal inputs
    const MAX_ITER = 1000;
    
    // Simple Gradient Descent with Projection
    for(let iter=0; iter<MAX_ITER; iter++) {
        // Gradient of Variance: 2 * C * w
        // But we want to Minimize 0.5 * w'Cw - lambda*(w'Mu - R) - gamma*(sum w - 1)
        // Let's use a simpler approach: Min Variance, then Project to satisfy Return & Budget
        
        // 1. Calculate Gradient of Risk (Variance)
        // Grad = 2 * Cov * w
        // Actually, let's minimize Risk w.r.t constraints directly?
        // It's hard to do purely with projection if we have double equality constraints.
        // Alternative: Use "Critical Line Algorithm" logic or simplified iterative approach.
        // Simplified: 
        // Gradient Update -> w = w - lr * (Cov * w)
        // Then Project w to satisfy Sum=1, w'Mu=Target, Min<=w<=Max.
        
        // Step A: Gradient Step (Minimize Variance)
        const Cw = new Array(n).fill(0);
        for(let i=0; i<n; i++) {
            for(let j=0; j<n; j++) Cw[i] += cov[i][j] * w[j];
        }
        
        // Update w
        for(let i=0; i<n; i++) w[i] -= LR * Cw[i];
        
        // Step B: Project to constraints
        // Iterative Projection to satisfy:
        // 1. Bounds (Min/Max)
        // 2. Sum = 1
        // 3. Return = Target
        w = projectConstraints(w, mean, targetReturn, minWeights, maxWeights);
    }
    
    const risk = Math.sqrt(dot(w, matMul(cov, w.map(v=>[v])).map(r=>r[0])));
    const ret = dot(w, mean);
    
    return { weights: w, risk, return: ret };
}

function projectConstraints(w, mean, targetRet, minW, maxW) {
  let proj = [...w];
  const n = w.length;
  
  // Dykstra's Alternating Projections for intersection of convex sets
  // 1. Box Constraints (Min/Max)
  // 2. Hyperplane (Sum = 1)
  // 3. Hyperplane (Return = Target)
  
  for(let k=0; k<10; k++) { // 10 cycles usually enough
      
      // 1. Box
      for(let i=0; i<n; i++) {
          if (proj[i] < minW[i]) proj[i] = minW[i];
          if (proj[i] > maxW[i]) proj[i] = maxW[i];
      }
      
      // 2. Sum Constraint (Scalar shift)
      // w_new = w_old - (sum(w_old) - 1)/n
      let currentSum = proj.reduce((a,b)=>a+b, 0);
      let diff = (currentSum - 1);
      // Determine active set (who can move) to be smarter? 
      // Simple scalar shift first:
      for(let i=0; i<n; i++) proj[i] -= diff/n;
      
      // 3. Return Constraint
      // Projection onto w'Mu = R
      // w_new = w_old - (w_old'Mu - R)/||Mu||^2 * Mu
      // Only do this if we are targeting a specific return point
      if (targetRet !== null) {
          const currentRet = dot(proj, mean);
          const muNormSq = dot(mean, mean) || 1e-9;
          const lambda = (currentRet - targetRet) / muNormSq;
          
          // Limit step size to avoid instability? No, projection is exact.
          const step = mean.map(m => lambda * m); 
          for(let i=0; i<n; i++) proj[i] -= step[i];
      }
  }
  return proj;
}

// ---------------------------------------------------------
// 2. RESAMPLING LOGIC
// ---------------------------------------------------------

/**
 * Runs the Michaud Resampled Efficiency process.
 * 
 * @param {Array} assets - Asset definitions with 'return', 'stdev' (0.05 format).
 * @param {Array} correlations - NxN correlation matrix.
 * @param {Object} constraints - { minWeights: [], maxWeights: [] }
 * @param {Number} forecastConfidence - T (sample size), e.g., 20 (Low), 50 (Med), 100 (High).
 * @param {Number} numSimulations - N, e.g., 50 or 100.
 */
export function runResampledOptimization(assets, correlations, constraints, forecastConfidence, numSimulations = 50) {
    const n = assets.length;
    // 1. Convert Inputs to Mu and Sigma
    const mu_0 = assets.map(a => a.return);
    const sigma_0 = assets.map(a => a.stdev);
    
    // Covariance = Corr_ij * Sig_i * Sig_j
    const cov_0 = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for(let i=0; i<n; i++) {
        for(let j=0; j<n; j++) {
            cov_0[i][j] = correlations[i][j] * sigma_0[i] * sigma_0[j];
        }
    }
    
    // Verify Positive Definite
    let L = cholesky(cov_0);
    if (!L) {
        console.error("Covariance matrix not positive definite. Falling back to diagonal.");
        // Fallback: zero correlations
        L = new Array(n).fill(0).map((_, i) => new Array(n).fill(0).map((_, j) => i===j ? sigma_0[i] : 0));
    }
    
    // 2. Generate Frontiers for N histories
    // We want to bin by Rank. 
    // Let's define the Grid of "Return Levels" based on the BASE CASE Min/Max.
    // First, find Base min/max returns logic? 
    // Michaud bins by RANK (1 to M). "1" = Min Var, "M" = Max Return.
    // We calculate the 51 portfolios for each history.
    
    const M_POINTS = 50; // Higher resolution for better binning
    let allFrontiers = []; // Array of [ {w, r, sig} ... M_POINTS ]
    
    for(let sim=0; sim<numSimulations; sim++) {
        // A. Resample History
        // Generate T Months of returns based on Mu_0, Cov_0
        let history = [];
        for(let t=0; t<forecastConfidence; t++) {
            history.push(generateCorrelatedSample(L, mu_0));
        }
        
        // B. Calculate Sample Stats (Mu_sim, Cov_sim)
        const { mean: mu_sim, cov: cov_sim } = getStats(history);
        
        // C. Calculate Frontier for this history
        // Find GMV (Global Min Var) and Max Ret portfolios for THIS history
        // 1. Approx Min Return = Min(Mu_sim)
        // 2. Approx Max Return = Max(Mu_sim)
        const minR = Math.min(...mu_sim) * 0.9; // slack
        const maxR = Math.max(...mu_sim) * 1.1; 
        
        // Actually, we want to solve for "Rank".
        // Let's solve for M points equally spaced between Min and Max possible returns of that set.
        // Wait, solving strictly for Return can be unstable if constraints make it impossible.
        // Better: Solve for Lambda (Risk Aversion) from 0 to infinity?
        // Simple approach: Equispaced Target Returns from Min(Assets) to Max(Assets).
        
        const possibleMin = Math.min(...mu_sim);
        const possibleMax = Math.max(...mu_sim);
        
        let simFrontier = [];
        
        for(let p=0; p<M_POINTS; p++) {
             // Interpolate target
             const t = p / (M_POINTS - 1);
             const target = possibleMin + t * (possibleMax - possibleMin);
             
             // Solve
             const sol = solveMarkowitz(mu_sim, cov_sim, target, constraints.minWeights, constraints.maxWeights);
             
             // Important: We assume 'sol' is the optimal weights for this HISTORY's view.
             simFrontier.push(sol);
        }
        allFrontiers.push(simFrontier);
    }
    
    // 3. Average Weights by Rank
    // All Frontiers have M_POINTS, ordered from Low Ret to High Ret.
    // Rank k corresponds to index k.
    
    let averagedFrontier = [];
    
    for(let p=0; p<M_POINTS; p++) {
        // Average weights for Rank p
        let avgW = new Array(n).fill(0);
        
        for(let sim=0; sim<numSimulations; sim++) {
            const w = allFrontiers[sim][p].weights;
            for(let i=0; i<n; i++) avgW[i] += w[i];
        }
        
        // Divide by N
        for(let i=0; i<n; i++) avgW[i] /= numSimulations;
        
        // 4. Calculate Final Stats for this Averaged Portfolio
        // Using the TRUE (Base) parameters `mu_0` and `cov_0`
        // Real Risk/Return comes from the Base Truth, not the simulation stats.
        
        const finalRet = dot(avgW, mu_0);
        // Variance = w' Cov_0 w
        // Cov_0 * w
        let Cw = new Array(n).fill(0);
        for(let i=0; i<n; i++) {
            for(let j=0; j<n; j++) Cw[i] += cov_0[i][j] * avgW[j];
        }
        const finalVar = dot(avgW, Cw);
        const finalRisk = Math.sqrt(finalVar);
        
        averagedFrontier.push({
            id: p+1,
            label: `Rank ${p+1}`,
            weights: avgW,
            return: finalRet,
            risk: finalRisk
        });
    }
    
    return { 
        frontier: averagedFrontier, 
        simulations: allFrontiers // Return raw data for "Cloud" if needed (though it's huge)
    }; 
}
