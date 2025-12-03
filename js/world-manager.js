import { CONFIG } from './config.js';
import { hash, seededRandom, getTerrainHeight } from './terrain.js';
import { createTexture } from './textures.js';
import { Character } from './character.js';

// ============================================
// WORLD MANAGER
// ============================================
export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = {};
        this.npcs = [];
        this.interiors = {};
        this.pendingChunks = new Set();
    }

    update(playerPos, delta) {
        const cx = Math.floor(playerPos.x / CONFIG.chunkSize);
        const cz = Math.floor(playerPos.z / CONFIG.chunkSize);

        for (let x = -CONFIG.renderDistance; x <= CONFIG.renderDistance; x++) {
            for (let z = -CONFIG.renderDistance; z <= CONFIG.renderDistance; z++) {
                const key = `${cx + x},${cz + z}`;
                if (!this.chunks[key] && !this.pendingChunks.has(key)) {
                    this.pendingChunks.add(key);
                    this.generateChunkAsync(cx + x, cz + z, key);
                }
            }
        }

        const keysToRemove = [];
        Object.keys(this.chunks).forEach(key => {
            const [kx, kz] = key.split(',').map(Number);
            if (Math.abs(kx - cx) > CONFIG.renderDistance + 1 ||
                Math.abs(kz - cz) > CONFIG.renderDistance + 1) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => {
            this.scene.remove(this.chunks[key]);
            delete this.chunks[key];
        });

        this.npcs.forEach(npc => npc.updateNPC(delta));
        this.updateLocationHUD(playerPos, cx, cz);
    }

    generateChunkAsync(cx, cz, key) {
        setTimeout(() => {
            if (this.chunks[key]) {
                this.pendingChunks.delete(key);
                return;
            }
            
            const chunk = this.generateChunk(cx, cz);
            this.chunks[key] = chunk;
            this.scene.add(chunk);
            this.pendingChunks.delete(key);
        }, 0);
    }

    generateChunk(cx, cz) {
        const group = new THREE.Group();
        const offsetX = cx * CONFIG.chunkSize;
        const offsetZ = cz * CONFIG.chunkSize;
        const isCity = hash(cx, cz) > CONFIG.cityThreshold;

        // Create terrain mesh with height variation
        const segments = 20;
        const groundGeo = new THREE.PlaneGeometry(CONFIG.chunkSize, CONFIG.chunkSize, segments, segments);
        const vertices = groundGeo.attributes.position.array;
        
        // Apply height to vertices
        for (let i = 0; i < vertices.length; i += 3) {
            const localX = vertices[i];
            const localZ = vertices[i + 1];
            const worldX = offsetX + localX + CONFIG.chunkSize / 2;
            const worldZ = offsetZ + localZ + CONFIG.chunkSize / 2;
            
            if (isCity) {
                vertices[i + 2] = 0.5; // Flat for city
            } else {
                vertices[i + 2] = getTerrainHeight(worldX, worldZ);
            }
        }
        
        groundGeo.computeVertexNormals();
        
        const groundMat = isCity
            ? new THREE.MeshLambertMaterial({ map: createTexture('asphalt', '#111') })
            : new THREE.MeshLambertMaterial({ map: createTexture('grass', '#2a4a2a') });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(offsetX + CONFIG.chunkSize / 2, 0, offsetZ + CONFIG.chunkSize / 2);
        ground.receiveShadow = true;
        group.add(ground);

        if (isCity) {
            this.generateCity(group, offsetX, offsetZ, cx, cz);
        } else {
            this.generateWilderness(group, offsetX, offsetZ, cx, cz);
        }

        return group;
    }

    generateCity(group, ox, oz, cx, cz) {
        const blockSize = 60;
        const roadWidth = 25;

        for (let x = 10; x < CONFIG.chunkSize - 10; x += blockSize) {
            for (let z = 10; z < CONFIG.chunkSize - 10; z += blockSize) {
                const w = blockSize - roadWidth;

                const sidewalk = new THREE.Mesh(
                    new THREE.BoxGeometry(w + 2, 1, w + 2),
                    new THREE.MeshLambertMaterial({ color: 0x333333 })
                );
                sidewalk.position.set(ox + x + w / 2, 1, oz + z + w / 2);
                group.add(sidewalk);

                if (Math.random() > 0.1) {
                    const h = 80 + Math.random() * 150;

                    const mat = new THREE.MeshLambertMaterial({
                        map: createTexture('concrete', '#444')
                    });
                    const building = new THREE.Mesh(
                        new THREE.BoxGeometry(w, h, w),
                        mat
                    );
                    building.position.set(ox + x + w / 2, h / 2 + 1.5, oz + z + w / 2);
                    building.castShadow = true;
                    group.add(building);

                    // Door on front (-Z side of building)
                    const doorMat = new THREE.MeshLambertMaterial({
                        map: createTexture('door', '#444')
                    });
                    const door = new THREE.Mesh(
                        new THREE.PlaneGeometry(8, 12),
                        doorMat
                    );
                    door.position.set(0, -h / 2 + 6, -w / 2 - 0.1);
                    door.userData = { type: 'door', seed: cx * 1000 + cz * 100 + x + z };
                    building.add(door);

                    // Streetlamp
                    const lamp = new THREE.Group();
                    const pole = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.5, 15),
                        new THREE.MeshLambertMaterial({ color: 0x111111 })
                    );
                    pole.position.y = 8;
                    lamp.add(pole);
                    
                    const bulb = new THREE.Mesh(
                        new THREE.BoxGeometry(4, 1, 2),
                        new THREE.MeshBasicMaterial({ color: 0xffffaa })
                    );
                    bulb.position.set(2, 15.5, 0);
                    lamp.add(bulb);
                    lamp.position.set(ox + x + w + 2, 0.5, oz + z + w + 2);
                    group.add(lamp);
                }
            }
        }

        if (Math.random() > 0.6) {
            const npc = new Character(false);
            npc.params.hairColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            npc.params.jacketColor = '#' + Math.floor(Math.random() * 8388607).toString(16).padStart(6, '0');
            npc.rebuild();
            npc.group.position.set(
                ox + CONFIG.chunkSize / 2 + (Math.random() - 0.5) * 40,
                0.5,
                oz + CONFIG.chunkSize / 2 + (Math.random() - 0.5) * 40
            );
            group.add(npc.group);
            this.npcs.push(npc);
        }
    }

    generateWilderness(group, ox, oz, cx, cz) {
        const seed = cx * 10000 + cz;

        const treeCount = 4 + Math.floor(seededRandom(seed) * 6);
        for (let i = 0; i < treeCount; i++) {
            const tx = ox + seededRandom(seed + i * 3) * CONFIG.chunkSize;
            const tz = oz + seededRandom(seed + i * 3 + 1) * CONFIG.chunkSize;
            const ty = getTerrainHeight(tx, tz);
            
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.5, 4, 6),
                new THREE.MeshLambertMaterial({ color: 0x4a3020 })
            );
            trunk.position.y = 2;
            tree.add(trunk);
            
            const leaves = new THREE.Mesh(
                new THREE.ConeGeometry(2.5, 5, 6),
                new THREE.MeshLambertMaterial({ color: 0x2a5a2a })
            );
            leaves.position.y = 6;
            tree.add(leaves);
            
            tree.position.set(tx, ty, tz);
            group.add(tree);
        }

        const rockCount = 2 + Math.floor(seededRandom(seed + 100) * 3);
        for (let i = 0; i < rockCount; i++) {
            const rx = ox + seededRandom(seed + i * 5 + 200) * CONFIG.chunkSize;
            const rz = oz + seededRandom(seed + i * 5 + 201) * CONFIG.chunkSize;
            const ry = getTerrainHeight(rx, rz);
            
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.5, 0),
                new THREE.MeshLambertMaterial({ color: 0x666666 })
            );
            rock.position.set(rx, ry + 0.4, rz);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            group.add(rock);
        }
    }

    createInterior(x, y, z, seed) {
        const key = `int_${seed}`;
        if (this.interiors[key]) return;

        const group = new THREE.Group();
        group.position.set(x, y, z);

        const w = 40, h = 15, d = 40;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshLambertMaterial({ map: createTexture('checkers', '#444') })
        );
        floor.rotation.x = -Math.PI / 2;
        group.add(floor);

        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = h;
        group.add(ceiling);

        const wallMat = new THREE.MeshLambertMaterial({ color: 0x444455, side: THREE.DoubleSide });
        const walls = [
            { pos: [0, h / 2, -d / 2], dim: [w, h, 1] },
            { pos: [0, h / 2, d / 2], dim: [w, h, 1] },
            { pos: [-w / 2, h / 2, 0], dim: [1, h, d] },
            { pos: [w / 2, h / 2, 0], dim: [1, h, d] }
        ];
        walls.forEach(cfg => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...cfg.dim), wallMat);
            mesh.position.set(...cfg.pos);
            group.add(mesh);
        });

        const exitDoor = new THREE.Mesh(
            new THREE.BoxGeometry(4, 8, 1),
            new THREE.MeshLambertMaterial({ color: 0xff0000 })
        );
        exitDoor.position.set(0, 4, d / 2 - 2);
        exitDoor.userData = { type: 'exit' };
        group.add(exitDoor);

        const light = new THREE.PointLight(0xffaa00, 1, 40);
        light.position.set(0, h - 2, 0);
        group.add(light);

        this.scene.add(group);
        this.interiors[key] = group;
    }

    updateLocationHUD(pos, cx, cz) {
        const isCity = hash(cx, cz) > CONFIG.cityThreshold;
        const cityNames = ['Neo-Tokyo', 'Cyber City', 'Metro Prime', 'Neon District', 'Grid Zero'];
        const wildNames = ['Wasteland', 'Dead Zone', 'Outskirts', 'Frontier'];

        const nameIndex = Math.abs(cx + cz * 7) % (isCity ? cityNames.length : wildNames.length);
        const areaName = isCity ? cityNames[nameIndex] : wildNames[nameIndex];

        const blockLetter = String.fromCharCode(65 + Math.abs(cx % 26));
        const blockNum = Math.abs(cz % 100);

        document.getElementById('hud-location').textContent = areaName;
        document.getElementById('hud-coords').textContent = `Block ${blockLetter}-${blockNum}`;
    }
}

// ============================================
