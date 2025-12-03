import { WorldManager } from './world-manager.js';
import { WarManager } from './war-manager.js';
import { PlayerController } from './player-controller.js';
import { initCharCreator, logChat, setGender, updateMinimap } from './ui.js';

let scene, camera, renderer, clock;
let playerController, worldManager, warManager;
let isGameActive = false;
let previewChar;
const keys = {};
const mouse = { x: 0, y: 0 };

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x445566);
    scene.fog = new THREE.Fog(0x445566, 50, 350);

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        500
    );

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.imageRendering = 'pixelated';
    document.body.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xaabbcc, 0x444422, 0.6);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffee, 0.8);
    sun.position.set(100, 200, 100);
    scene.add(sun);

    clock = new THREE.Clock();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'KeyE' && isGameActive) {
            playerController.interact();
        }
        if (e.code === 'Enter') {
            const input = document.getElementById('chat-input');
            if (document.activeElement === input) {
                if (input.value.trim()) {
                    const username = document.getElementById('cc-username').value || 'Player';
                    logChat(username, input.value);
                    input.value = '';
                }
                input.blur();
                document.body.requestPointerLock();
            } else {
                input.focus();
                document.exitPointerLock();
            }
        }
    });

    window.addEventListener('keyup', e => {
        keys[e.code] = false;
    });

    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement === document.body) {
            mouse.x = e.movementX;
            mouse.y = e.movementY;
        }
    });

    document.getElementById('game-ui').addEventListener('click', () => {
        if (isGameActive) {
            document.body.requestPointerLock();
        }
    });

    setInterval(() => {
        document.getElementById('hud-clock').textContent = new Date().toLocaleTimeString('en-GB');
    }, 1000);

    previewChar = initCharCreator(() => isGameActive);
}

function startGame() {
    document.getElementById('char-creator').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';

    const username = document.getElementById('cc-username').value || 'Player';

    worldManager = new WorldManager(scene);
    warManager = new WarManager(scene);
    playerController = new PlayerController({ scene, camera, worldManager, logChat, keys, mouse });

    playerController.char.params = { ...previewChar.params };
    playerController.char.rebuild();

    isGameActive = true;
    document.body.requestPointerLock();

    logChat('System', `Welcome to Cyberia, ${username}!`);
    logChat('System', 'A war rages between three factions. Explore the world!');
    logChat('WarNet', 'ALERT: Combat detected in multiple sectors.');

    gameLoop();
}

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const delta = Math.min(clock.getDelta(), 0.1);

    if (isGameActive) {
        playerController.update(delta);
        worldManager.update(playerController.char.group.position, delta);
        warManager.update(delta, playerController.char.group.position);
        updateMinimap(playerController, worldManager, warManager);
    }

    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    init();

    window.setGender = (gender) => setGender(previewChar, gender);
    window.startGame = startGame;
});
