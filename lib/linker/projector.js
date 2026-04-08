// src/linker/projector.ts
// 简化 PCA 降维：将高维向量投影到 2D 平面
// 使用幂迭代求协方差矩阵的前两个特征向量作为投影方向
function mean(vectors) {
    const dim = vectors[0].length;
    const mu = new Array(dim).fill(0);
    for (const v of vectors) {
        for (let i = 0; i < dim; i++)
            mu[i] += v[i];
    }
    return mu.map(x => x / vectors.length);
}
function center(vectors, mu) {
    return vectors.map(v => v.map((x, i) => x - mu[i]));
}
function covarianceMatrix(vectors) {
    const dim = vectors[0].length;
    const C = Array.from({ length: dim }, () => new Array(dim).fill(0));
    for (const v of vectors) {
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                C[i][j] += v[i] * v[j];
            }
        }
    }
    return C.map(row => row.map(x => x / vectors.length));
}
function norm(arr) {
    const len = Math.sqrt(arr.reduce((s, x) => s + x * x, 0));
    return arr.map(x => x / len);
}
function powerIteration(A, nIter = 50) {
    let v = norm(A[0].map(() => Math.random() + 0.1));
    for (let k = 0; k < nIter; k++) {
        const Av = A.map(row => row.reduce((s, x, i) => s + x * v[i], 0));
        v = norm(Av);
    }
    return v;
}
/**
 * 将一组向量降维到 2D
 * 使用简化的 PCA：取协方差矩阵的前两个特征向量作为投影方向
 * @param vectors  二维数组，每行一个向量，长度相同
 * @returns 二维数组，每行一个 2D 坐标，范围约 [-1, 1]
 */
export function projectTo2D(vectors) {
    if (vectors.length <= 1) {
        return vectors.map(() => [0, 0]);
    }
    if (vectors.length === 2) {
        return [[-0.5, 0], [0.5, 0]];
    }
    const dim = vectors[0].length;
    const mu = mean(vectors);
    const Xc = center(vectors, mu);
    const C = covarianceMatrix(Xc);
    // PC1：用幂迭代求第一主成分
    const pc1 = powerIteration(C, 60);
    // Deflate：去除第一主成分方向的投影
    const Xc2 = Xc.map(v => {
        const proj = v.reduce((s, x, i) => s + x * pc1[i], 0);
        return v.map((x, i) => x - proj * pc1[i]);
    });
    // PC2：对 deflation 后的数据求第二主成分
    const C2 = covarianceMatrix(Xc2);
    let pc2 = powerIteration(C2, 60);
    // 确保 pc1 和 pc2 正交
    const dot = pc1.reduce((s, x, i) => s + x * pc2[i], 0);
    const pc2Adj = pc2.map((x, i) => x - dot * pc1[i]);
    const n2 = Math.sqrt(pc2Adj.reduce((s, x) => s + x * x, 0));
    if (n2 > 1e-6) {
        pc2 = pc2Adj.map(x => x / n2);
    }
    else {
        // fallback：取一个与 pc1 正交的向量
        pc2[0] = -pc1[1] || 1;
        pc2[1] = pc1[0] || 0;
    }
    // 投影到 2D
    const result = vectors.map(v => {
        const p = v.map((x, i) => x - mu[i]);
        return [
            p.reduce((s, x, i) => s + x * pc1[i], 0),
            p.reduce((s, x, i) => s + x * pc2[i], 0),
        ];
    });
    // 归一化到 [-1, 1] 范围
    const xs = result.map(r => r[0]);
    const ys = result.map(r => r[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xRange = xMax - xMin, yRange = yMax - yMin;
    const range = Math.max(xRange, yRange, 1e-8);
    // 如果归一化前坐标范围很小（PCA 失效/数值不稳定），用圆形均匀分布
    if (xRange < 0.05 && yRange < 0.05) {
        return vectors.map((_, i) => {
            const angle = (2 * Math.PI * i) / vectors.length;
            return [Math.cos(angle), Math.sin(angle)];
        });
    }
    // 如果归一化后范围仍然较小，重新 spread
    const xSpread = xRange / range, ySpread = yRange / range;
    if (xSpread < 0.3 || ySpread < 0.3) {
        const spreadFactor = Math.max(xSpread, ySpread, 0.01);
        return result.map(([x, y]) => [x / spreadFactor, y / spreadFactor]);
    }
    return result.map(([x, y]) => [(x - xMin) / range * 2 - 1, (y - yMin) / range * 2 - 1]);
}
