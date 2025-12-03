import { CONFIG } from './config.js';

export class PhysicsSystem {
    constructor() {
        this.bodies = new Set();
        this.chunkColliders = new Map();
        this.dynamicVolumes = [];
    }

    registerBody(body) {
        const defaults = {
            mass: 1,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            radius: 0.5,
            height: 1.6,
            grounded: false,
            bounciness: 0.05,
            friction: CONFIG.groundFriction,
            damping: CONFIG.airDrag,
            slopeLimit: CONFIG.slopeLimit
        };
        const merged = Object.assign(defaults, body);
        this.bodies.add(merged);
        return merged;
    }

    addChunkColliders(key, colliders) {
        this.chunkColliders.set(key, colliders);
    }

    removeChunkColliders(key) {
        this.chunkColliders.delete(key);
    }

    getNearbyColliders(position) {
        const cx = Math.floor(position.x / CONFIG.chunkSize);
        const cz = Math.floor(position.z / CONFIG.chunkSize);
        const list = [];

        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const key = `${cx + x},${cz + z}`;
                const chunkList = this.chunkColliders.get(key);
                if (chunkList) list.push(...chunkList);
            }
        }

        return list;
    }

    registerDynamicVolume(box, effect) {
        this.dynamicVolumes.push({ box, effect });
    }

    step(delta, terrainSampler) {
        this.bodies.forEach(body => this.integrate(body, delta, terrainSampler));
    }

    integrate(body, delta, terrainSampler) {
        const gravity = new THREE.Vector3(0, -CONFIG.gravity, 0);
        body.velocity.addScaledVector(gravity, delta);

        body.velocity.x *= 1 - body.damping * delta;
        body.velocity.z *= 1 - body.damping * delta;

        const speed = body.velocity.length();
        if (speed > CONFIG.terminalVelocity) {
            body.velocity.setLength(CONFIG.terminalVelocity);
        }

        body.position.addScaledVector(body.velocity, delta);

        const colliders = this.getNearbyColliders(body.position);
        this.resolveCollisions(body, colliders);

        const groundHeight = terrainSampler(body.position.x, body.position.z);
        if (body.position.y < groundHeight) {
            const penetration = groundHeight - body.position.y;
            body.position.y = groundHeight;
            if (body.velocity.y < 0) body.velocity.y = 0;
            body.grounded = true;
            body.velocity.x *= Math.max(0, 1 - body.friction * delta);
            body.velocity.z *= Math.max(0, 1 - body.friction * delta);
            body.position.y += penetration > CONFIG.stepHeight ? 0 : CONFIG.stepHeight;
        } else {
            body.grounded = false;
        }

        this.applyVolumes(body, delta);
    }

    applyVolumes(body, delta) {
        this.dynamicVolumes.forEach(volume => {
            if (volume.box.containsPoint(body.position)) {
                volume.effect(body, delta);
            }
        });
    }

    resolveCollisions(body, colliders) {
        const radius = body.radius || 0.5;
        const height = body.height || 1.6;
        const bodyTop = body.position.y + height;

        for (const box of colliders) {
            if (body.position.y > box.max.y || bodyTop < box.min.y) continue;

            const closestX = Math.max(box.min.x, Math.min(body.position.x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(body.position.z, box.max.z));

            const dx = body.position.x - closestX;
            const dz = body.position.z - closestZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < radius * radius && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const push = radius - dist;
                const nx = dx / dist;
                const nz = dz / dist;

                body.position.x += nx * push;
                body.position.z += nz * push;

                if (body.velocity) {
                    const normal = new THREE.Vector3(nx, 0, nz);
                    const bounce = normal.clone().multiplyScalar(body.velocity.dot(normal) * (1 + body.bounciness));
                    body.velocity.sub(bounce);
                    body.velocity.multiplyScalar(0.9);
                }
            } else if (distSq <= 0.0001 && radius > 0) {
                body.position.z += radius * 0.5;
            }

            // Slope rejection
            const slopeNormal = new THREE.Vector3(0, 1, 0);
            const dot = slopeNormal.dot(new THREE.Vector3(0, 1, 0));
            if (dot < body.slopeLimit && body.grounded) {
                body.velocity.x *= 0.5;
                body.velocity.z *= 0.5;
            }
        }
    }
}
