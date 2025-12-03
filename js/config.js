export const CONFIG = {
    chunkSize: 200,
    renderDistance: 2,
    cityThreshold: 0.45,
    gravity: 38.5,
    terminalVelocity: 150,
    speed: 20.0,
    runSpeed: 35.0,
    crouchSpeed: 12.0,
    jumpSpeed: 15.5,
    groundAccel: 10.0,
    airAccel: 4.25,
    groundFriction: 10.0,
    airDrag: 0.35,
    slopeLimit: 0.92,
    stepHeight: 0.75,
    edgeBlendDistance: 18,
    interactionRange: 18,
    interactionScanAngle: Math.PI / 5,
    objectDensity: 0.35,
    rareObjectChance: 0.08,
    biomeSeed: 7777,
    dayLength: 720,
    weatherChangeInterval: 240,
    ambientWindBase: 0.3,
    ambientWindVariance: 0.55,
    hazardTickInterval: 5,
    staminaDrainRate: 6,
    staminaRecoveryRate: 10,
    maxStamina: 100,
    cameraLag: 0.35
};

export const FACTIONS = [
    { name: "Iron Legion", color: 0xcc0000, key: 'red' },
    { name: "Cyber Syndicate", color: 0x00cc00, key: 'green' },
    { name: "Azure Alliance", color: 0x0044cc, key: 'blue' }
];

export const BIOMES = [
    {
        key: 'wasteland',
        label: 'Cracked Wasteland',
        primaryColor: '#2a4a2a',
        altitudeBias: 0.1,
        humidity: 0.2,
        flora: ['charred stump', 'ashen shrub', 'rusted sign'],
        ambientSound: 'wind'
    },
    {
        key: 'marsh',
        label: 'Toxic Marsh',
        primaryColor: '#1f332a',
        altitudeBias: -0.15,
        humidity: 0.85,
        flora: ['bulb reed', 'glow lily', 'fungal bloom'],
        ambientSound: 'drip'
    },
    {
        key: 'highlands',
        label: 'Highlands',
        primaryColor: '#365d7a',
        altitudeBias: 0.35,
        humidity: 0.45,
        flora: ['pine cluster', 'rock shelf', 'sky vine'],
        ambientSound: 'gust'
    },
    {
        key: 'crystal',
        label: 'Crystaline Steppe',
        primaryColor: '#4a4a7a',
        altitudeBias: 0.05,
        humidity: 0.3,
        flora: ['crystal shard', 'prism bloom', 'lumen grass'],
        ambientSound: 'hum'
    },
    {
        key: 'oasis',
        label: 'Desert Oasis',
        primaryColor: '#5a4a2a',
        altitudeBias: -0.05,
        humidity: 0.6,
        flora: ['palm stalk', 'succulent', 'cattail'],
        ambientSound: 'water'
    }
];
