import { CONFIG } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);

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
            bounciness: 0.02,
            friction: CONFIG.groundFriction,
            damping: CONFIG.airDrag,
            slopeLimit: CONFIG.slopeLimit,
            maxSpeed: 75
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
        const subSteps = Math.max(1, Math.ceil(delta / 0.016));
        const stepDelta = delta / subSteps;
        for (let i = 0; i < subSteps; i++) {
            this.bodies.forEach(body => this.integrate(body, stepDelta, terrainSampler));
        }
    }

    integrate(body, delta, terrainSampler) {
        const terrain = terrainSampler(body.position.x, body.position.z);
        const groundHeight = terrain.height ?? terrain;
        const groundNormal = terrain.normal ?? UP;

        body.velocity.y -= CONFIG.gravity * delta;
        body.velocity.x *= 1 - body.damping * delta;
        body.velocity.z *= 1 - body.damping * delta;

        const proposed = body.velocity.clone().multiplyScalar(delta);
        body.position.add(proposed);

        const colliders = this.getNearbyColliders(body.position);
        this.resolveCollisions(body, colliders);

        const surface = terrainSampler(body.position.x, body.position.z);
        const snapHeight = surface.height ?? surface;
        const snapNormal = surface.normal ?? groundNormal;

        const distanceToGround = body.position.y - snapHeight;
        if (distanceToGround <= CONFIG.groundSnapMargin) {
            body.grounded = true;
            body.position.y = snapHeight + 0.05;
            this.alignVelocityToNormal(body, snapNormal, delta);
        } else {
            body.grounded = false;
        }

        this.applyVolumes(body, delta);
        this.capSpeed(body);
    }

    alignVelocityToNormal(body, normal, delta) {
        const v = body.velocity.clone();
        const normalComponent = normal.clone().multiplyScalar(v.dot(normal));
        const tangential = v.sub(normalComponent);

        if (normal.dot(UP) < body.slopeLimit) {
            tangential.multiplyScalar(0.3);
        }

        tangential.multiplyScalar(1 - body.friction * delta * CONFIG.groundStickiness);
        body.velocity.copy(tangential);
        if (body.velocity.y > 0) body.velocity.y = 0;
    }

    capSpeed(body) {
        const speed = body.velocity.length();
        if (speed > body.maxSpeed) {
            body.velocity.setLength(body.maxSpeed);
        }
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
        const bodyBottom = body.position.y;

        for (const box of colliders) {
            if (bodyTop < box.min.y || bodyBottom > box.max.y) continue;

            const closestX = Math.max(box.min.x, Math.min(body.position.x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(body.position.z, box.max.z));

            const dx = body.position.x - closestX;
            const dz = body.position.z - closestZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < radius * radius && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const push = radius - dist + 0.001;
                const nx = dx / dist;
                const nz = dz / dist;

                body.position.x += nx * push;
                body.position.z += nz * push;

                const normal = new THREE.Vector3(nx, 0, nz);
                const velDot = body.velocity.dot(normal);
                if (velDot < 0) {
                    body.velocity.sub(normal.multiplyScalar(velDot));
                    body.velocity.multiplyScalar(0.85);
                }
            } else if (distSq <= 0.0001 && radius > 0) {
                body.position.z += radius * 0.5;
            }

            if (bodyBottom < box.max.y && bodyBottom > box.min.y) {
                body.position.y = box.max.y + 0.05;
                body.velocity.y = Math.max(0, body.velocity.y);
                body.grounded = true;
            }
        }
    }
}
