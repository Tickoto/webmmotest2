import { CONFIG } from './config.js';

export function hash(x, z) {
    return Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
}

export function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function noise2D(x, z) {
    const X = Math.floor(x) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const zf = z - Math.floor(z);

    const h00 = hash(X, Z);
    const h10 = hash(X + 1, Z);
    const h01 = hash(X, Z + 1);
    const h11 = hash(X + 1, Z + 1);

    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);

    return h00 * (1 - u) * (1 - v) +
           h10 * u * (1 - v) +
           h01 * (1 - u) * v +
           h11 * u * v;
}

export function getTerrainHeight(wx, wz) {
    let height = 0;
    height += noise2D(wx * 0.02, wz * 0.02) * 8;
    height += noise2D(wx * 0.05, wz * 0.05) * 4;
    height += noise2D(wx * 0.1, wz * 0.1) * 2;

    const chunkSize = CONFIG.chunkSize;
    const cx = Math.floor(wx / chunkSize);
    const cz = Math.floor(wz / chunkSize);
    const isCity = hash(cx, cz) > CONFIG.cityThreshold;
    const cityHeight = 0.5;

    let blended = isCity ? cityHeight : height;

    const lx = wx - cx * chunkSize;
    const lz = wz - cz * chunkSize;
    const smooth = CONFIG.edgeBlendDistance;

    const neighbors = [
        { dx: -1, dz: 0, dist: lx },
        { dx: 1, dz: 0, dist: chunkSize - lx },
        { dx: 0, dz: -1, dist: lz },
        { dx: 0, dz: 1, dist: chunkSize - lz },
        { dx: -1, dz: -1, dist: Math.min(lx, lz) },
        { dx: 1, dz: -1, dist: Math.min(chunkSize - lx, lz) },
        { dx: -1, dz: 1, dist: Math.min(lx, chunkSize - lz) },
        { dx: 1, dz: 1, dist: Math.min(chunkSize - lx, chunkSize - lz) }
    ];

    neighbors.forEach(n => {
        if (n.dist > smooth) return;

        const neighborCity = hash(cx + n.dx, cz + n.dz) > CONFIG.cityThreshold;
        if (neighborCity === isCity) return;

        const targetHeight = neighborCity ? cityHeight : height;
        const t = Math.min(1, n.dist / smooth);
        blended = targetHeight + (blended - targetHeight) * t;
    });

    return blended;
}
