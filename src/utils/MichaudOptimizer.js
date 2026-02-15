import { cholesky, generateCorrelatedSample, getStats, dot, matMul } from './mathHelpers';

// ---------------------------------------------------------
// 1. PROJECTED GRADIENT DESCENT (PGD) SOLVER for Markowitz
// ---------------------------------------------------------
// ---------------------------------------------------------
// 1. PROJECTED GRADIENT DESCENT (PGD) SOLVER for Markowitz
// ---------------------------------------------------------

function solveMarkowitz(mean, cov, targetReturn, minWeights, maxWeights, groupConstraints = []) {
    const n = mean.length;
    // Initial guess: Equal weights (normalized to constraints if needed)
    let w = new Array(n).fill(1/n); 
    w = projectConstraints(w, mean, targetReturn, minWeights, maxWeights, groupConstraints); // Valid start
    
    // Hyperparameters
    const LR_INIT = 0.1; // Initial learning rate
    const MAX_ITER = 300; // v1.278: Increased from 150 for better convergence
    const TOL = 1e-7; // Tighter convergence tolerance
    
    // Projected Gradient Descent with adaptive learning rate
    for(let iter=0; iter<MAX_ITER; iter++) {
        // Adaptive LR: decay over iterations for stability
        const lr = LR_INIT / (1 + iter * 0.005);
        
        // Step A: Gradient Step (Minimize Variance)
        // Grad(0.5 * w'Cw) = Cw
        const Cw = new Array(n).fill(0);
        for(let i=0; i<n; i++) {
            for(let j=0; j<n; j++) Cw[i] += cov[i][j] * w[j];
        }
        
        let w_new = [...w];
        for(let i=0; i<n; i++) w_new[i] -= lr * Cw[i];
        
        // Step B: Project to constraints
        w_new = projectConstraints(w_new, mean, targetReturn, minWeights, maxWeights, groupConstraints);
        
        // Check Convergence (Change in w)
        let diff = 0;
        for(let i=0; i<n; i++) diff += Math.abs(w_new[i] - w[i]);
        w = w_new;
        
        if (diff < TOL) break; // Early exit for performance
    }
    
    const risk = Math.sqrt(dot(w, matMul(cov, w.map(v=>[v])).map(r=>r[0])));
    const ret = dot(w, mean);
    
    return { weights: w, risk, return: ret };
}

export function projectConstraints(w, mean, targetRet, minW, maxW, groupConstraints = []) {
  let proj = [...w];
  const n = w.length;
  
  // Dykstra's Alternating Projections for intersection of convex sets
  const MAX_PROJ_ITER = 20; // Reduced from 50 (usually converges in 5-10)
  
  for(let k=0; k<MAX_PROJ_ITER; k++) { 
      
      let changed = false;

      // 1. Box Constraints (Strict Clamp)
      for(let i=0; i<n; i++) {
          let val = proj[i];
          if (val < minW[i]) { val = minW[i]; changed = true; }
          if (val > maxW[i]) { val = maxW[i]; changed = true; }
          proj[i] = val;
      }
      
      // 2. Sum Constraint (Scalar shift)
      let currentSum = proj.reduce((a,b)=>a+b, 0);
      let diff = (currentSum - 1.0);
      if (Math.abs(diff) > 1e-6) {
          // Determine active set (assets not at boundary)? 
          // Simple uniform shift is robust enough if we iterate.
          for(let i=0; i<n; i++) proj[i] -= diff/n;
          changed = true;
      }
      
      // 3. Return Constraint
      if (targetRet !== null) {
          const currentRet = dot(proj, mean);
          if (Math.abs(currentRet - targetRet) > 1e-6) {
             const muNormSq = dot(mean, mean) || 1e-9;
             const lambda = (currentRet - targetRet) / muNormSq;
             const step = mean.map(m => lambda * m); 
             for(let i=0; i<n; i++) proj[i] -= step[i];
             changed = true;
          }
      }

      // 4. Group Constraints
      if (groupConstraints && groupConstraints.length > 0) {
          groupConstraints.forEach(gc => {
             let subsetSum = 0;
             gc.indices.forEach(idx => subsetSum += proj[idx]);
             if (subsetSum > gc.max + 1e-6) { // Tolerance check
                 const diff = subsetSum - gc.max;
                 const k = gc.indices.length;
                 if (k > 0) {
                     const sub = diff / k;
                     gc.indices.forEach(idx => proj[idx] -= sub);
                     changed = true;
                 }
             }
          });
      }
      
      if (!changed && k > 2) break; // Early exit
  }

  // Final Smart Normalization (Safety Net for Sum=1)
  // Ensure we satisfy Min/Max AND Sum=1
  for(let attempt=0; attempt<10; attempt++) {
      let sum = proj.reduce((a,b)=>a+b, 0);
      if (Math.abs(sum - 1.0) < 1e-6) break;

      const diff = 1.0 - sum; // Positive means we need to ADD weight
      
      // Distribute diff to assets that have room
      const eligibleIndices = [];
      if (diff > 0) {
          // Add to those below max
          for(let i=0; i<n; i++) if (proj[i] < maxW[i] - 1e-6) eligibleIndices.push(i);
      } else {
          // Subtract from those above min
          for(let i=0; i<n; i++) if (proj[i] > minW[i] + 1e-6) eligibleIndices.push(i);
      }
      
      if (eligibleIndices.length > 0) {
          const share = diff / eligibleIndices.length;
          eligibleIndices.forEach(idx => {
             proj[idx] += share;
             // Clamp immediately to stay valid
             if (proj[idx] < minW[idx]) proj[idx] = minW[idx];
             if (proj[idx] > maxW[idx]) proj[idx] = maxW[idx];
          });
      } else {
          break; // Cannot satisfy
      }
  }

  // Absolute fallback: strict clamp (priority min > others)
  // This guarantees Min Constraints are NEVER violated, even if Sum != 1 slightly.
  for(let i=0; i<n; i++) {
        if (proj[i] < minW[i]) proj[i] = minW[i];
        if (proj[i] > maxW[i]) proj[i] = maxW[i];
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
export function runResampledOptimization(assets, correlations, constraints, forecastConfidence, numSimulations = 50, groupConstraints = []) {
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
    
    const M_POINTS = 101; // v1.275: Increased from 51 for finer frontier resolution
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
             const sol = solveMarkowitz(mu_sim, cov_sim, target, constraints.minWeights, constraints.maxWeights, groupConstraints);
             
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
