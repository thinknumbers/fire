// =====================================================
// Optimization Web Worker
// v1.304: Runs Michaud Resampled Optimization off the main thread
// =====================================================

// ---- Math Helpers (inlined for worker compatibility) ----

function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function dot(v1, v2) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) sum += v1[i] * v2[i];
    return sum;
}

function matMul(A, B) {
    const rA = A.length;
    const cA = A[0].length;
    const rB = B.length;
    const cB = B[0].length;
    if (cA !== rB) throw new Error("Matrix dimensions mismatch");
    let C = new Array(rA).fill(0).map(() => new Array(cB).fill(0));
    for (let i = 0; i < rA; i++) {
        for (let j = 0; j < cB; j++) {
            let sum = 0;
            for (let k = 0; k < cA; k++) sum += A[i][k] * B[k][j];
            C[i][j] = sum;
        }
    }
    return C;
}

function cholesky(Sigma) {
    const n = Sigma.length;
    const L = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let sum = 0;
            for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
            if (i === j) {
                const val = Sigma[i][i] - sum;
                if (val <= 0) return null;
                L[i][j] = Math.sqrt(val);
            } else {
                L[i][j] = (1.0 / L[j][j] * (Sigma[i][j] - sum));
            }
        }
    }
    return L;
}

function generateCorrelatedSample(L, means) {
    const n = means.length;
    const z = new Array(n).fill(0).map(() => randn());
    const x = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j <= i; j++) sum += L[i][j] * z[j];
        x[i] = means[i] + sum;
    }
    return x;
}

function getStats(history) {
    const T = history.length;
    const n = history[0].length;
    const mean = new Array(n).fill(0);
    for (let t = 0; t < T; t++) {
        for (let i = 0; i < n; i++) mean[i] += history[t][i];
    }
    for (let i = 0; i < n; i++) mean[i] /= T;
    const cov = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let t = 0; t < T; t++) {
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                cov[i][j] += (history[t][i] - mean[i]) * (history[t][j] - mean[j]);
            }
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) cov[i][j] /= (T - 1);
    }
    return { mean, cov };
}

// ---- PGD Solver ----

function projectConstraints(w, mean, targetRet, minW, maxW, groupConstraints = []) {
    let proj = [...w];
    const n = w.length;
    const MAX_PROJ_ITER = 100;

    for (let k = 0; k < MAX_PROJ_ITER; k++) {
        let changed = false;

        // 1. Box Constraints
        for (let i = 0; i < n; i++) {
            let val = proj[i];
            if (val < minW[i]) { val = minW[i]; changed = true; }
            if (val > maxW[i]) { val = maxW[i]; changed = true; }
            proj[i] = val;
        }

        // 2. Sum Constraint
        let currentSum = proj.reduce((a, b) => a + b, 0);
        let diff = (currentSum - 1.0);
        if (Math.abs(diff) > 1e-6) {
            for (let i = 0; i < n; i++) proj[i] -= diff / n;
            changed = true;
        }

        // 3. Return Constraint
        if (targetRet !== null) {
            const currentRet = dot(proj, mean);
            if (Math.abs(currentRet - targetRet) > 1e-6) {
                const muNormSq = dot(mean, mean) || 1e-9;
                const lambda = (currentRet - targetRet) / muNormSq;
                const step = mean.map(m => lambda * m);
                for (let i = 0; i < n; i++) proj[i] -= step[i];
                changed = true;
            }
        }

        // 4. Group Constraints
        if (groupConstraints && groupConstraints.length > 0) {
            groupConstraints.forEach(gc => {
                let subsetSum = 0;
                gc.indices.forEach(idx => subsetSum += proj[idx]);
                if (subsetSum > gc.max + 1e-6) {
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

        if (!changed && k > 2) break;
    }

    // Final Smart Normalization
    for (let attempt = 0; attempt < 50; attempt++) {
        let sum = proj.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) < 1e-6) break;
        const diff = 1.0 - sum;
        const eligibleIndices = [];
        if (diff > 0) {
            for (let i = 0; i < n; i++) if (proj[i] < maxW[i] - 1e-6) eligibleIndices.push(i);
        } else {
            for (let i = 0; i < n; i++) if (proj[i] > minW[i] + 1e-6) eligibleIndices.push(i);
        }
        if (eligibleIndices.length > 0) {
            const share = diff / eligibleIndices.length;
            eligibleIndices.forEach(idx => {
                proj[idx] += share;
                if (proj[idx] < minW[idx]) proj[idx] = minW[idx];
                if (proj[idx] > maxW[idx]) proj[idx] = maxW[idx];
            });
        } else {
            break;
        }
    }

    // Absolute fallback
    for (let i = 0; i < n; i++) {
        if (proj[i] < minW[i]) proj[i] = minW[i];
        if (proj[i] > maxW[i]) proj[i] = maxW[i];
    }

    return proj;
}

function solveMarkowitz(mean, cov, targetReturn, minWeights, maxWeights, groupConstraints = []) {
    const n = mean.length;
    let w = new Array(n).fill(1 / n);
    w = projectConstraints(w, mean, targetReturn, minWeights, maxWeights, groupConstraints);

    const LR_INIT = 0.1;
    const MAX_ITER = 300;
    const TOL = 1e-7;

    for (let iter = 0; iter < MAX_ITER; iter++) {
        const lr = LR_INIT / (1 + iter * 0.005);
        const Cw = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) Cw[i] += cov[i][j] * w[j];
        }
        let w_new = [...w];
        for (let i = 0; i < n; i++) w_new[i] -= lr * Cw[i];
        w_new = projectConstraints(w_new, mean, targetReturn, minWeights, maxWeights, groupConstraints);
        let diff = 0;
        for (let i = 0; i < n; i++) diff += Math.abs(w_new[i] - w[i]);
        w = w_new;
        if (diff < TOL) break;
    }

    const risk = Math.sqrt(dot(w, matMul(cov, w.map(v => [v])).map(r => r[0])));
    const ret = dot(w, mean);
    return { weights: w, risk, return: ret };
}

// ---- Resampled Optimization ----

function runResampledOptimization(assets, correlations, constraints, forecastConfidence, numSimulations, groupConstraints = []) {
    const n = assets.length;
    const mu_0 = assets.map(a => a.return);
    const sigma_0 = assets.map(a => a.stdev);

    const cov_0 = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            cov_0[i][j] = correlations[i][j] * sigma_0[i] * sigma_0[j];
        }
    }

    let L = cholesky(cov_0);
    if (!L) {
        L = new Array(n).fill(0).map((_, i) => new Array(n).fill(0).map((_, j) => i === j ? sigma_0[i] : 0));
    }

    const M_POINTS = 101;
    let allFrontiers = [];

    for (let sim = 0; sim < numSimulations; sim++) {
        let history = [];
        for (let t = 0; t < forecastConfidence; t++) {
            history.push(generateCorrelatedSample(L, mu_0));
        }
        const { mean: mu_sim, cov: cov_sim } = getStats(history);

        const possibleMin = Math.min(...mu_sim);
        const possibleMax = Math.max(...mu_sim);

        let simFrontier = [];
        for (let p = 0; p < M_POINTS; p++) {
            const t = p / (M_POINTS - 1);
            const target = possibleMin + t * (possibleMax - possibleMin);
            const sol = solveMarkowitz(mu_sim, cov_sim, target, constraints.minWeights, constraints.maxWeights, groupConstraints);
            simFrontier.push(sol);
        }
        allFrontiers.push(simFrontier);

        // Report progress per simulation (include entity context for global progress)
        if (sim % 10 === 0 || sim === numSimulations - 1) {
            self.postMessage({ type: 'progress', simulation: sim + 1, total: numSimulations, entityIndex: self._currentEntityIndex, totalEntities: self._totalEntities });
        }
    }

    // Average weights by rank
    let averagedFrontier = [];
    for (let p = 0; p < M_POINTS; p++) {
        let avgW = new Array(n).fill(0);
        for (let sim = 0; sim < numSimulations; sim++) {
            const w = allFrontiers[sim][p].weights;
            for (let i = 0; i < n; i++) avgW[i] += w[i];
        }
        for (let i = 0; i < n; i++) avgW[i] /= numSimulations;

        const finalRet = dot(avgW, mu_0);
        let Cw = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) Cw[i] += cov_0[i][j] * avgW[j];
        }
        const finalVar = dot(avgW, Cw);
        const finalRisk = Math.sqrt(finalVar);

        averagedFrontier.push({
            id: p + 1,
            label: `Rank ${p + 1}`,
            weights: avgW,
            return: finalRet,
            risk: finalRisk
        });
    }

    return {
        frontier: averagedFrontier,
        simulations: allFrontiers
    };
}

// ---- Worker Message Handler ----
// Receives entity optimization tasks, runs them, returns results

self.onmessage = function (e) {
    const { entityTasks, activeCorrelations, confidenceT, numSimulations } = e.data;

    const results = {};
    const totalEntities = entityTasks.length;

    entityTasks.forEach((task, entityIdx) => {
        const { entityType, entityOptAssets, constraints, groupConstraints } = task;

        // Set entity context for progress messages
        self._currentEntityIndex = entityIdx;
        self._totalEntities = totalEntities;

        self.postMessage({
            type: 'entity_start',
            entityType,
            entityIndex: entityIdx,
            totalEntities
        });

        const entityResult = runResampledOptimization(
            entityOptAssets,
            activeCorrelations,
            constraints,
            confidenceT,
            numSimulations,
            groupConstraints
        );

        results[entityType] = {
            frontier: entityResult.frontier,
            simulations: entityResult.simulations
        };

        self.postMessage({
            type: 'entity_done',
            entityType,
            entityIndex: entityIdx,
            totalEntities
        });
    });

    self.postMessage({ type: 'complete', results });
};
