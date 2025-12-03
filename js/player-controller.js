import { CONFIG } from './config.js';
import { sampleTerrain } from './terrain.js';
import { Character } from './character.js';
import { hideInteractionPanel, renderInteractionLog, showInteractionPanel, updateStatsHUD } from './ui.js';

export class PlayerController {
    constructor({ scene, camera, worldManager, logChat, keys, mouse, physics, interactionManager, environment }) {
        this.scene = scene;
        this.camera = camera;
        this.worldManager = worldManager;
        this.logChat = logChat;
        this.keys = keys;
        this.mouse = mouse;
        this.physics = physics;
        this.interactionManager = interactionManager;
        this.environment = environment;

        this.char = new Character(true);
        this.scene.add(this.char.group);

        this.physicsBody = this.physics.registerBody({
            position: this.char.group.position,
            velocity: new THREE.Vector3(),
            radius: 0.7,
            height: 1.7,
            grounded: false
        });

        this.yaw = 0;
        this.pitch = 0;
        this.savedOutdoorPos = new THREE.Vector3();
        this.isInInterior = false;
        this.stamina = CONFIG.maxStamina;
        this.stats = {
            health: 100,
            credits: 120,
            intel: 0,
            salvage: 12
        };
    }

    update(delta) {
        const pos = this.char.group.position;

        this.yaw -= this.mouse.x * 0.0025;
        this.pitch -= this.mouse.y * 0.0025;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
        this.mouse.x = 0;
        this.mouse.y = 0;

        const running = this.keys['ShiftLeft'] && this.stamina > 0;
        const crouching = this.keys['ControlLeft'];
        const speed = crouching ? CONFIG.crouchSpeed : running ? CONFIG.runSpeed : CONFIG.speed;
        let dx = 0, dz = 0;

        if (this.keys['KeyW']) dz = 1;
        if (this.keys['KeyS']) dz = -1;
        if (this.keys['KeyA']) dx = -1;
        if (this.keys['KeyD']) dx = 1;

        const moveDir = new THREE.Vector3(dx, 0, dz);
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        }

        const targetVel = moveDir.multiplyScalar(speed);
        const accel = this.physicsBody.grounded ? CONFIG.groundAccel : CONFIG.airAccel;
        const lerpFactor = Math.min(1, accel * delta);

        this.physicsBody.velocity.x = THREE.MathUtils.lerp(this.physicsBody.velocity.x, targetVel.x, lerpFactor);
        this.physicsBody.velocity.z = THREE.MathUtils.lerp(this.physicsBody.velocity.z, targetVel.z, lerpFactor);

        if (this.keys['Space'] && this.physicsBody.grounded) {
            this.physicsBody.velocity.y = CONFIG.jumpSpeed;
            this.physicsBody.grounded = false;
        }

        this.char.group.rotation.y = this.yaw + Math.PI;
        this.char.animate(targetVel.length());

        this.updateStamina(delta, running);

        if (this.isInInterior) {
            if (pos.y < 500) pos.y = 500;
        }

        const terrainSampler = (x, z) => this.isInInterior ? { height: 500, normal: new THREE.Vector3(0, 1, 0) } : sampleTerrain(x, z);
        this.physics.step(delta, terrainSampler);

        const camDist = 7;
        const camHeight = crouching ? 2.5 : 3.5;

        const desiredPos = new THREE.Vector3(
            pos.x - Math.sin(this.yaw) * camDist * Math.cos(this.pitch),
            pos.y + camHeight + Math.sin(this.pitch) * camDist,
            pos.z - Math.cos(this.yaw) * camDist * Math.cos(this.pitch)
        );
        this.camera.position.lerp(desiredPos, CONFIG.cameraLag);
        this.camera.lookAt(pos.x, pos.y + 1.5, pos.z);

        this.scanInteractions();
        updateStatsHUD(this.stats);
    }

    updateStamina(delta, running) {
        if (running && this.physicsBody.velocity.lengthSq() > 0.01) {
            this.stamina = Math.max(0, this.stamina - CONFIG.staminaDrainRate * delta);
        } else {
            this.stamina = Math.min(CONFIG.maxStamina, this.stamina + CONFIG.staminaRecoveryRate * delta);
        }
        const bar = document.getElementById('hud-stamina-fill');
        if (bar) {
            bar.style.width = `${(this.stamina / CONFIG.maxStamina) * 100}%`;
        }
    }

    scanInteractions() {
        const data = this.interactionManager.findClosest(this.char, this.camera);
        const prompt = document.getElementById('interaction-prompt');
        if (data) {
            prompt.style.display = 'block';
            prompt.textContent = `E - ${data.def.name} (${data.def.rarity})`;
        } else {
            prompt.style.display = 'none';
        }
    }

    interact() {
        hideInteractionPanel();
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
            } else if (data && data.type === 'interactive') {
                const state = this.interactionManager.getState(data.seed);
                showInteractionPanel(data.def, state, (action) => this.resolveInteraction(data, action));
                document.exitPointerLock();
                return;
            }
        }

        this.logChat('System', 'Nothing to interact with.');
    }

    resolveInteraction(data, action) {
        const outcome = this.interactionManager.performAction(data.def, data.seed, action, this.stats);
        this.applyOutcome(outcome);
        return outcome;
    }

    applyOutcome(outcome) {
        if (!outcome) return;
        if (outcome.credits) this.stats.credits = Math.max(0, this.stats.credits + outcome.credits);
        if (outcome.salvage) this.stats.salvage = Math.max(0, this.stats.salvage + outcome.salvage);
        if (outcome.intel) this.stats.intel = Math.max(0, this.stats.intel + outcome.intel);
        if (outcome.stamina) this.stamina = Math.max(0, Math.min(CONFIG.maxStamina, this.stamina + outcome.stamina));
        if (outcome.health) this.stats.health = Math.max(0, Math.min(100, this.stats.health + outcome.health));
        if (outcome.log) this.logChat('System', outcome.log);
        renderInteractionLog(outcome);
    }

    enterInterior(seed) {
        this.savedOutdoorPos.copy(this.char.group.position);
        const ix = seed * 5000;
        const iy = 500;

        this.worldManager.createInterior(ix, iy, ix, seed);
        this.char.group.position.set(ix, iy + 1, ix);
        this.physicsBody.velocity.set(0, 0, 0);
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
        this.physicsBody.velocity.set(0, 0, 0);
        this.isInInterior = false;

        this.logChat('System', 'Exiting building...');
    }
}
