// Basic Vector and Matrix operations for Optimization

// Box-Muller transform for standard normal distribution
export function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Vector Dot Product
export function dot(v1, v2) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) sum += v1[i] * v2[i];
  return sum;
}

// Matrix Multiplication (A * B)
export function matMul(A, B) {
  const rA = A.length;
  const cA = A[0].length;
  const rB = B.length;
  const cB = B[0].length;
  if (cA !== rB) throw new Error("Matrix dimensions mismatch");
  
  let C = new Array(rA).fill(0).map(() => new Array(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    for (let j = 0; j < cB; j++) {
      let sum = 0;
      for (let k = 0; k < cA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

// Matrix Transpose
export function transpose(A) {
  return A[0].map((_, c) => A.map(r => r[c]));
}

// Cholesky Decomposition (Sigma = L * L^T)
export function cholesky(Sigma) {
  const n = Sigma.length;
  const L = new Array(n).fill(0).map(() => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const val = Sigma[i][i] - sum;
        if (val <= 0) return null; // Not positive definite
        L[i][j] = Math.sqrt(val);
      } else {
        L[i][j] = (1.0 / L[j][j] * (Sigma[i][j] - sum));
      }
    }
  }
  return L;
}

// Generate Correlated Random Returns
// L: Cholesky Lower Triangle
// means: Vector of mean returns
export function generateCorrelatedSample(L, means) {
  const n = means.length;
  const z = new Array(n).fill(0).map(() => randn()); // Uncorrelated standard normal
  
  // x = Mu + L * z
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += L[i][j] * z[j];
    }
    x[i] = means[i] + sum;
  }
  return x;
}

// Calculate Mean and Covariance from a Sample History
// history: Array of [r1, r2, ... rn] vectors
export function getStats(history) {
    const T = history.length;
    const n = history[0].length;
    
    // Mean
    const mean = new Array(n).fill(0);
    for(let t=0; t<T; t++) {
        for(let i=0; i<n; i++) mean[i] += history[t][i];
    }
    for(let i=0; i<n; i++) mean[i] /= T;

    // Covariance
    const cov = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for(let t=0; t<T; t++) {
        for(let i=0; i<n; i++) {
            for(let j=0; j<n; j++) {
                cov[i][j] += (history[t][i] - mean[i]) * (history[t][j] - mean[j]);
            }
        }
    }
    // Sample Covariance (divide by T-1)
    for(let i=0; i<n; i++) {
        for(let j=0; j<n; j++) cov[i][j] /= (T - 1);
    }

    return { mean, cov };
}
