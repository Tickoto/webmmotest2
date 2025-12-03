import { CONFIG } from './config.js';
import { hash } from './terrain.js';
import { Character } from './character.js';

export function logChat(user, msg) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');

    const color = user === 'System' ? '#0f0' :
                  user === 'WarNet' ? '#f00' : '#8cf';

    div.innerHTML = `<span style="color:${color}">[${user}]:</span> ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

export function updateStatsHUD(stats) {
    const map = [
        ['res-health', stats.health.toFixed(0)],
        ['res-credits', Math.max(0, Math.floor(stats.credits)).toLocaleString()],
        ['res-salvage', Math.max(0, Math.floor(stats.salvage)).toString()],
        ['res-intel', Math.max(0, Math.floor(stats.intel)).toString()]
    ];
    map.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

export function showInteractionPanel(def, state, onAction) {
    const panel = document.getElementById('interaction-panel');
    const title = document.getElementById('interaction-title');
    const meta = document.getElementById('interaction-meta');
    const actions = document.getElementById('interaction-actions');
    const log = document.getElementById('interaction-log');

    if (!panel) return;

    panel.style.display = 'block';
    title.textContent = def.name;
    meta.textContent = `${def.rarity.toUpperCase()} · ${def.category} · Cooldown: ${state.cooldown.toFixed(1)}s`;
    actions.innerHTML = '';
    log.innerHTML = '';

    def.actions.forEach(action => {
        const btn = document.createElement('button');
        btn.textContent = action.toUpperCase();
        btn.addEventListener('click', () => {
            const result = onAction(action);
            if (result) renderInteractionLog(result);
        });
        actions.appendChild(btn);
    });

    document.getElementById('interaction-close')?.addEventListener('click', hideInteractionPanel, { once: true });
}

export function renderInteractionLog(outcome) {
    const log = document.getElementById('interaction-log');
    if (!log) return;
    const row = document.createElement('div');
    row.textContent = outcome.log || 'No response.';
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
}

export function hideInteractionPanel() {
    const panel = document.getElementById('interaction-panel');
    if (panel) panel.style.display = 'none';
}

export function updateMinimap(playerController, worldManager, warManager) {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 180, 180);

    const playerPos = playerController.char.group.position;
    const scale = 0.4;
    const cx = 90;
    const cy = 90;

    Object.keys(worldManager.chunks).forEach(key => {
        const [chunkX, chunkZ] = key.split(',').map(Number);
        const isCity = hash(chunkX, chunkZ) > CONFIG.cityThreshold;

        const screenX = cx + (chunkX * CONFIG.chunkSize + CONFIG.chunkSize / 2 - playerPos.x) * scale / 10;
        const screenY = cy + (chunkZ * CONFIG.chunkSize + CONFIG.chunkSize / 2 - playerPos.z) * scale / 10;

        ctx.fillStyle = isCity ? '#446' : '#242';
        ctx.fillRect(screenX - 5, screenY - 5, 10, 10);
    });

    warManager.units.forEach(unit => {
        const screenX = cx + (unit.mesh.position.x - playerPos.x) * scale;
        const screenY = cy + (unit.mesh.position.z - playerPos.z) * scale;

        if (screenX >= 0 && screenX <= 180 && screenY >= 0 && screenY <= 180) {
            const colors = ['#f44', '#4f4', '#44f'];
            ctx.fillStyle = colors[unit.faction];
            ctx.beginPath();
            ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
        cx + Math.sin(playerController.yaw) * 12,
        cy - Math.cos(playerController.yaw) * 12
    );
    ctx.stroke();
}

export function initCharCreator(isGameActive) {
    const container = document.getElementById('cc-preview');

    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x333333);

    const previewCamera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );
    previewCamera.position.set(0, 1.1, 3.5);
    previewCamera.lookAt(0, 1.0, 0);

    const previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    previewRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(previewRenderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 2);
    previewScene.add(dirLight);
    previewScene.add(new THREE.AmbientLight(0x555555));

    const previewChar = new Character(true);
    previewScene.add(previewChar.group);

    setupCreatorControls(previewChar);

    function animatePreview() {
        if (isGameActive()) return;
        requestAnimationFrame(animatePreview);
        previewChar.group.rotation.y += 0.01;
        previewRenderer.render(previewScene, previewCamera);
    }

    animatePreview();
    return previewChar;
}

export function setGender(previewChar, gender) {
    previewChar.params.gender = gender;
    previewChar.rebuild();

    document.getElementById('btn-male').classList.toggle('active', gender === 'male');
    document.getElementById('btn-female').classList.toggle('active', gender === 'female');
}

function setupCreatorControls(previewChar) {
    const controls = {
        'cc-height': (v) => previewChar.params.height = parseFloat(v),
        'cc-skin': (v) => previewChar.params.skin = v,
        'cc-hair': (v) => previewChar.params.hair = parseInt(v, 10),
        'cc-haircolor': (v) => previewChar.params.hairColor = v,
        'cc-jacket': (v) => previewChar.params.jacketColor = v,
        'cc-shirt': (v) => previewChar.params.shirtColor = v,
        'cc-pants': (v) => previewChar.params.pantsColor = v
    };

    Object.keys(controls).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', e => {
                controls[id](e.target.value);
                previewChar.rebuild();
            });
        }
    });
}
