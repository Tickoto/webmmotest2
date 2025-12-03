import { CONFIG } from './config.js';
import { getTerrainHeight } from './terrain.js';
import { Character } from './character.js';

// ============================================
// PLAYER CONTROLLER
// ============================================
export class PlayerController {
    constructor({ scene, camera, worldManager, logChat, keys, mouse }) {
        this.scene = scene;
        this.camera = camera;
        this.worldManager = worldManager;
        this.logChat = logChat;
        this.keys = keys;
        this.mouse = mouse;

        this.char = new Character(true);
        this.scene.add(this.char.group);

        this.yaw = 0;
        this.pitch = 0;
        this.savedOutdoorPos = new THREE.Vector3();
        this.isInInterior = false;
    }

    update(delta) {
        const pos = this.char.group.position;

        // Mouse look
        this.yaw -= this.mouse.x * 0.002;
        this.pitch -= this.mouse.y * 0.002;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
        this.mouse.x = 0;
        this.mouse.y = 0;

        // Movement
        const speed = this.keys['ShiftLeft'] ? CONFIG.runSpeed : CONFIG.speed;
        let dx = 0, dz = 0;

        if (this.keys['KeyW']) dz = 1;
        if (this.keys['KeyS']) dz = -1;
        if (this.keys['KeyA']) dx = -1;
        if (this.keys['KeyD']) dx = 1;

        if (dx !== 0 || dz !== 0) {
            const moveDir = new THREE.Vector3(dx, 0, dz)
                .normalize()
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

            pos.x += moveDir.x * speed * delta;
            pos.z += moveDir.z * speed * delta;
            
            // Character faces camera direction (model faces -Z, so add PI)
            this.char.group.rotation.y = this.yaw + Math.PI;
            this.char.animate(speed);
        } else {
            this.char.group.rotation.y = this.yaw + Math.PI;
            this.char.animate(0);
        }

        // Terrain following
        if (!this.isInInterior) {
            const terrainY = getTerrainHeight(pos.x, pos.z);
            pos.y = terrainY;
        } else {
            if (pos.y < 500) pos.y = 500;
        }

        // Camera behind player
        const camDist = 7;
        const camHeight = 3.5;

        this.camera.position.x = pos.x - Math.sin(this.yaw) * camDist * Math.cos(this.pitch);
        this.camera.position.z = pos.z - Math.cos(this.yaw) * camDist * Math.cos(this.pitch);
        this.camera.position.y = pos.y + camHeight + Math.sin(this.pitch) * camDist;
        this.camera.lookAt(pos.x, pos.y + 1.5, pos.z);
    }

    interact() {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children, true);

        for (const hit of intersects) {
            if (hit.distance > 15) continue;

            let data = hit.object.userData;
            if (!data.type && hit.object.parent) {
                data = hit.object.parent.userData;
            }

            if (data && data.type === 'door') {
                this.enterInterior(data.seed);
                return;
            } else if (data && data.type === 'exit') {
                this.exitInterior();
                return;
            }
        }

        this.logChat('System', 'Nothing to interact with.');
    }

    enterInterior(seed) {
        this.savedOutdoorPos.copy(this.char.group.position);
        const ix = seed * 5000;
        const iy = 500;

        this.worldManager.createInterior(ix, iy, ix, seed);
        this.char.group.position.set(ix, iy + 1, ix);
        this.isInInterior = true;

        this.logChat('System', 'Entering building...');
    }

    exitInterior() {
        if (this.savedOutdoorPos.lengthSq() > 0) {
            this.char.group.position.copy(this.savedOutdoorPos);
            this.char.group.position.z += 5;
        } else {
            this.char.group.position.set(0, 0, 0);
        }
        this.isInInterior = false;

        this.logChat('System', 'Exiting building...');
    }
}

// ============================================
