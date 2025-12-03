import { CONFIG, BIOMES } from './config.js';

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export function hash(x, z) {
    return Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
}

export function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function gradient(ix, iz) {
    const angle = 2 * Math.PI * hash(ix, iz);
    return { x: Math.cos(angle), z: Math.sin(angle) };
}

function perlin(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const sx = fade(x - x0);
    const sz = fade(z - z0);

    const g00 = gradient(x0, z0);
    const g10 = gradient(x1, z0);
    const g01 = gradient(x0, z1);
    const g11 = gradient(x1, z1);

    const dx0 = x - x0;
    const dz0 = z - z0;
    const dx1 = x - x1;
    const dz1 = z - z1;

    const n00 = g00.x * dx0 + g00.z * dz0;
    const n10 = g10.x * dx1 + g10.z * dz0;
    const n01 = g01.x * dx0 + g01.z * dz1;
    const n11 = g11.x * dx1 + g11.z * dz1;

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sz);
}

function ridge(value) {
    return 2 * (0.5 - Math.abs(0.5 - value));
}

function fbm(x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amplitude * perlin(x * frequency, z * frequency);
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return sum;
}

function biomeAt(cx, cz) {
    const noise = perlin((cx + CONFIG.biomeSeed) * 0.15, (cz + CONFIG.biomeSeed) * 0.15);
    const index = Math.abs(Math.floor((noise + 1) * 0.5 * BIOMES.length)) % BIOMES.length;
    return BIOMES[index];
}

function riverMask(wx, wz) {
    const flow = ridge(Math.abs(perlin(wx * 0.004, wz * 0.004)));
    return Math.pow(1 - flow, 2);
}

export function getTerrainHeight(wx, wz) {
    const chunkSize = CONFIG.chunkSize;
    const cx = Math.floor(wx / chunkSize);
    const cz = Math.floor(wz / chunkSize);
    const lx = wx - cx * chunkSize;
    const lz = wz - cz * chunkSize;
    const smooth = CONFIG.edgeBlendDistance;

    const baseHeight = fbm(wx * 0.01, wz * 0.01, 5, 2, 0.45) * 12;
    const detail = fbm(wx * 0.04, wz * 0.04, 3, 2.7, 0.5) * 2.5;
    const ridgeHeight = ridge(Math.abs(perlin(wx * 0.02, wz * 0.02))) * 6;

    const biome = biomeAt(cx, cz);
    const biomeOffset = biome.altitudeBias * 10;

    const waterInfluence = riverMask(wx, wz) * -5;
    let height = baseHeight + detail + ridgeHeight + biomeOffset + waterInfluence;

    const isCity = hash(cx, cz) > CONFIG.cityThreshold;
    const cityHeight = 0.5;
    let blended = isCity ? cityHeight : height;

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
        const targetBiome = biomeAt(cx + n.dx, cz + n.dz);
        const neighborHeight = fbm((wx + n.dx * chunkSize) * 0.01, (wz + n.dz * chunkSize) * 0.01, 5, 2, 0.45) * 12 +
            fbm((wx + n.dx * chunkSize) * 0.04, (wz + n.dz * chunkSize) * 0.04, 3, 2.7, 0.5) * 2.5 +
            ridge(Math.abs(perlin((wx + n.dx * chunkSize) * 0.02, (wz + n.dz * chunkSize) * 0.02))) * 6 +
            targetBiome.altitudeBias * 10 +
            riverMask(wx + n.dx * chunkSize, wz + n.dz * chunkSize) * -5;

        if (neighborCity === isCity) {
            const t = Math.min(1, n.dist / smooth);
            blended = neighborHeight + (blended - neighborHeight) * t;
        } else {
            const targetHeight = neighborCity ? cityHeight : neighborHeight;
            const t = Math.min(1, n.dist / smooth);
            blended = targetHeight + (blended - targetHeight) * t;
        }
    });

    return blended;
}

export function biomeInfoAtPosition(wx, wz) {
    const cx = Math.floor(wx / CONFIG.chunkSize);
    const cz = Math.floor(wz / CONFIG.chunkSize);
    return biomeAt(cx, cz);
}

export function decorateTerrainNormal(wx, wz) {
    const eps = 0.5;
    const hL = getTerrainHeight(wx - eps, wz);
    const hR = getTerrainHeight(wx + eps, wz);
    const hD = getTerrainHeight(wx, wz - eps);
    const hU = getTerrainHeight(wx, wz + eps);
    const normal = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
    normal.normalize();
    return normal;
}
