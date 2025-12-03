import { CONFIG } from './config.js';

export class PhysicsSystem {
    constructor() {
        this.bodies = new Set();
        this.chunkColliders = new Map();
    }

    registerBody(body) {
        this.bodies.add(body);
        return body;
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

    step(delta, terrainSampler) {
        this.bodies.forEach(body => this.integrate(body, delta, terrainSampler));
    }

    integrate(body, delta, terrainSampler) {
        body.velocity.y -= CONFIG.gravity * delta;

        body.position.addScaledVector(body.velocity, delta);

        const colliders = this.getNearbyColliders(body.position);
        this.resolveCollisions(body, colliders);

        const ground = terrainSampler(body.position.x, body.position.z);
        if (body.position.y < ground) {
            body.position.y = ground;
            if (body.velocity.y < 0) body.velocity.y = 0;
            body.grounded = true;
        } else {
            body.grounded = false;
        }
    }

    resolveCollisions(body, colliders) {
        const radius = body.radius || 0.5;
        const bodyTop = body.position.y + (body.height || 1.6);

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
                    body.velocity.x *= 0.6;
                    body.velocity.z *= 0.6;
                }
            } else if (distSq <= 0.0001 && radius > 0) {
                body.position.z += radius * 0.5;
            }
        }
    }
}
