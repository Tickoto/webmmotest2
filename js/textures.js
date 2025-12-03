const textureCache = {};

export function createTexture(type, colorHex) {
    const key = type + colorHex;
    if (textureCache[key]) return textureCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const color = new THREE.Color(colorHex);

    ctx.fillStyle = color.getStyle();
    ctx.fillRect(0, 0, 128, 128);

    if (type === 'asphalt') {
        for (let i = 0; i < 1500; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#050505';
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        }
    }
    else if (type === 'concrete') {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 128, 128);
        ctx.fillStyle = '#050a15';
        for (let y = 10; y < 128; y += 25) {
            for (let x = 10; x < 128; x += 25) {
                if (Math.random() > 0.2) ctx.fillRect(x, y, 15, 18);
            }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 100, 128, 28);
    }
    else if (type === 'door') {
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#222';
        ctx.fillRect(10, 10, 108, 108);
        ctx.fillStyle = '#111';
        ctx.fillRect(90, 60, 10, 10);
    }
    else if (type === 'denim') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 2000; i++) {
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, 5, 128);
        ctx.fillRect(123, 0, 5, 128);
    }
    else if (type === 'face') {
        ctx.fillStyle = colorHex || '#ffe0bd';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#111';
        ctx.fillRect(25, 55, 25, 12);
        ctx.fillRect(78, 55, 25, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(27, 57, 21, 8);
        ctx.fillRect(80, 57, 21, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(35, 59, 8, 8);
        ctx.fillRect(88, 59, 8, 8);
        ctx.fillStyle = '#222';
        ctx.fillRect(25, 48, 25, 3);
        ctx.fillRect(78, 48, 25, 3);
        ctx.fillStyle = '#aa6666';
        ctx.fillRect(54, 95, 20, 4);
    }
    else if (type === 'jacket_back') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 500; i++) {
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        }
        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(64, 64, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.moveTo(64, 40);
        ctx.lineTo(45, 75);
        ctx.lineTo(83, 75);
        ctx.fill();
    }
    else if (type === 'leather') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 500; i++) {
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        }
    }
    else if (type === 'checkers') {
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillRect(64, 64, 64, 64);
    }
    else if (type === 'skin') {
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 128, 128);
    }
    else if (type === 'grass') {
        ctx.fillStyle = '#2a4a2a';
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#1a3a1a' : '#3a5a3a';
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    textureCache[key] = tex;
    return tex;
}
