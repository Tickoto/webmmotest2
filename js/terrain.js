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

function zoneField(wx, wz) {
    const coarse = perlin(wx * 0.002, wz * 0.002);
    const warp = perlin((wx + 700) * 0.006, (wz - 1200) * 0.006);
    const combined = (coarse * 0.65 + warp * 0.35);
    return combined;
}

function blendedBiome(wx, wz) {
    const size = CONFIG.chunkSize;
    const cx = Math.floor(wx / size);
    const cz = Math.floor(wz / size);
    const biome = biomeAt(cx, cz);
    const neighbors = [
        biomeAt(cx + 1, cz),
        biomeAt(cx - 1, cz),
        biomeAt(cx, cz + 1),
        biomeAt(cx, cz - 1)
    ];

    const lx = wx - cx * size;
    const lz = wz - cz * size;
    const tx = Math.min(lx / size, 1 - lx / size);
    const tz = Math.min(lz / size, 1 - lz / size);
    const edge = Math.min(tx, tz);
    const blendStrength = THREE.MathUtils.smoothstep(edge, 0, CONFIG.edgeBlendDistance / size);

    const mixTarget = neighbors[Math.floor(hash(cx, cz) * neighbors.length)];
    return blendBiomes(biome, mixTarget, blendStrength);
}

function blendBiomes(a, b, t) {
    if (!b) return a;
    return {
        key: `${a.key}_${b.key}`,
        label: t > 0.5 ? b.label : a.label,
        primaryColor: t > 0.5 ? b.primaryColor : a.primaryColor,
        altitudeBias: lerp(a.altitudeBias, b.altitudeBias, t),
        humidity: lerp(a.humidity, b.humidity, t),
        flora: t > 0.5 ? b.flora : a.flora,
        ambientSound: t > 0.5 ? b.ambientSound : a.ambientSound
    };
}

function cityMask(wx, wz) {
    const field = zoneField(wx, wz);
    const edgeNoise = perlin(wx * 0.01, wz * 0.01) * 0.25;
    const intensity = THREE.MathUtils.clamp((field + edgeNoise) * 0.6 + 0.3, -1, 1);
    const mask = THREE.MathUtils.smoothstep(intensity, CONFIG.cityThreshold - 0.15, CONFIG.cityThreshold + 0.15);
    return mask;
}

export function getTerrainHeight(wx, wz) {
    const biome = blendedBiome(wx, wz);
    const cityInfluence = cityMask(wx, wz);

    const baseHeight = fbm(wx * 0.01, wz * 0.01, 5, 2, 0.45) * 12;
    const detail = fbm(wx * 0.04, wz * 0.04, 3, 2.7, 0.5) * 2.5;
    const ridgeHeight = ridge(Math.abs(perlin(wx * 0.02, wz * 0.02))) * 6;

    const biomeOffset = biome.altitudeBias * 10;
    const riverInfluence = riverMask(wx, wz) * -5;

    let height = baseHeight + detail + ridgeHeight + biomeOffset + riverInfluence;

    const urbanPlateau = THREE.MathUtils.lerp(height, 0.75, cityInfluence);
    const blend = THREE.MathUtils.smoothstep(cityInfluence, 0.28, 0.7);

    height = lerp(height, urbanPlateau, blend);
    height = Math.max(height, -25);

    return height;
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
