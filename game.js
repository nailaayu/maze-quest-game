const canvas = document.getElementById("gameCanvas");
const scoreText = document.getElementById("scoreText");

const music = document.getElementById("gameMusic");
const runAudio = document.getElementById("runSound");
const coinAudio = document.getElementById("coinSound");
const winAudio = document.getElementById("winSound");
const loseAudio = document.getElementById("loseSound");

const volume = parseFloat(localStorage.getItem("mazeVolume") || "0.75");

[music, runAudio, coinAudio, winAudio, loseAudio].forEach(audio => {
    audio.volume = volume;
});

const difficulty = localStorage.getItem("mazeDifficulty") || "mudah";

const MAPS = {
    mudah: [
        "111111111111",
        "S00000000001",
        "101111011101",
        "100001010001",
        "111101010111",
        "100001000001",
        "101111110101",
        "100000000101",
        "101011111101",
        "1000000000E1",
        "111111111111"
    ],
    menengah: [
        "111111111111111",
        "S00000010000001",
        "101111010111101",
        "101000010100001",
        "101011110101111",
        "100010000100001",
        "111010111111101",
        "100010100000001",
        "101110101111101",
        "100000100000101",
        "101111111110101",
        "1000000000000E1",
        "111111111111111"
    ],
    susah: [
        "11111111111111111",
        "S0000010000000001",
        "10111010111111101",
        "10100010100000101",
        "10101110101110101",
        "10001000101000101",
        "11101111101011101",
        "10001000001010001",
        "10111011111010111",
        "10000010000010001",
        "11111010111111101",
        "10001010100000001",
        "10101010101111111",
        "101000001000000E1",
        "11111111111111111"
    ]
};

const maze = MAPS[difficulty];
const rows = maze.length;
const cols = maze[0].length;
const cell = 4; 

let scene, camera, renderer;
let playerX = -999, playerZ = -999, yaw = 0;
let exitX = 999, exitZ = 999;

let keys = {};
let coins = [];
let score = 0;
let gameFinished = false;
let audioActivated = false;
let mapReady = false; 
let flashlight, flashlightTarget;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = null; 

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(25, 45, 15);
    sunLight.castShadow = true;
    scene.add(sunLight);

    flashlight = new THREE.SpotLight(0xffffff, 1.3, 35, Math.PI / 4, 0.3, 1);
    flashlight.castShadow = true;
    scene.add(flashlight);

    flashlightTarget = new THREE.Object3D();
    scene.add(flashlightTarget);
    flashlight.target = flashlightTarget;

    buildMaze();
    setupControls();

    window.addEventListener("resize", resize);
}

function buildMaze() {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x557a46, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6f5643, roughness: 0.7 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x503a2a, roughness: 0.8 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols * cell, rows * cell), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((cols * cell) / 2 - cell / 2, 0, (rows * cell) / 2 - cell / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    let startGridX = 0, startGridZ = 0;
    let endGridX = 0, endGridZ = 0;

    for (let z = 0; z < rows; z++) {
        for (let x = 0; x < cols; x++) {
            const tile = maze[z][x];

            if (tile === "S") {
                playerX = x * cell;
                playerZ = z * cell;
                startGridX = x;
                startGridZ = z;
                yaw = Math.PI / 2; 
            }
            if (tile === "E") {
                exitX = x * cell;
                exitZ = z * cell;
                endGridX = x;
                endGridZ = z;
            }
            if (tile === "1") {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(cell, 3.2, cell), wallMat);
                wall.position.set(x * cell, 1.6, z * cell);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);

                const topWall = new THREE.Mesh(new THREE.BoxGeometry(cell * 1.01, 0.2, cell * 1.01), topMat);
                topWall.position.set(x * cell, 3.2, z * cell);
                topWall.castShadow = true;
                scene.add(topWall);
            }
        }
    }

    createExit();
    generatePathGuideCoins(startGridX, startGridZ, endGridX, endGridZ);
    mapReady = true;
}

function generatePathGuideCoins(sx, sz, ex, ez) {
    let queue = [[{x: sx, z: sz}]];
    let visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    visited[sz][sx] = true;
    let mainPath = [];

    while (queue.length > 0) {
        let path = queue.shift();
        let current = path[path.length - 1];

        if (current.x === ex && current.z === ez) {
            mainPath = path;
            break;
        }

        const directions = [{x:1, z:0}, {x:-1, z:0}, {x:0, z:1}, {x:0, z:-1}];
        for (let dir of directions) {
            let nx = current.x + dir.x;
            let nz = current.z + dir.z;

            if (nx >= 0 && nz >= 0 && nx < cols && nz < rows) {
                if (!visited[nz][nx] && maze[nz][nx] !== "1") {
                    visited[nz][nx] = true;
                    queue.push([...path, {x: nx, z: nz}]);
                }
            }
        }
    }

    mainPath.forEach((node, index) => {
        if ((node.x === sx && node.z === sz) || (node.x === ex && node.z === ez)) return;
        createCoin(node.x, node.z);
    });
}

function createCoin(x, z) {
    const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16),
        new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3
        })
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.set(x * cell, 0.8, z * cell);
    coin.castShadow = true;
    scene.add(coin);
    coins.push({ mesh: coin, collected: false });
}

function createExit() {
    const exitObj = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.1, 32),
        new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 1.2
        })
    );
    exitObj.position.set(exitX, 0.05, exitZ);
    scene.add(exitObj);
}

function setupControls() {
    document.addEventListener("keydown", e => { 
        keys[e.key.toLowerCase()] = true; 
        if (!audioActivated) {
            music.play().catch(() => {});
            audioActivated = true;
        }
    });
    document.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
}

function animate() {
    if (gameFinished) return;
    requestAnimationFrame(animate);

    updatePlayerCamera();
    updateCoins();

    renderer.render(scene, camera);
}

function updatePlayerCamera() {
    let moveX = 0;
    let moveZ = 0;
    const speed = 0.11;
    const turnSpeed = 0.045;

    if (keys["a"] || keys["arrowleft"]) yaw += turnSpeed;
    if (keys["d"] || keys["arrowright"]) yaw -= turnSpeed;

    const forwardX = Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    if (keys["w"] || keys["arrowup"]) {
        moveX += forwardX * speed;
        moveZ += forwardZ * speed;
    }
    if (keys["s"] || keys["arrowdown"]) {
        moveX -= forwardX * speed;
        moveZ -= forwardZ * speed;
    }

    const buffer = 0.65; 
    let nextX = playerX + moveX;
    let nextZ = playerZ + moveZ;

    if (!checkCollision(nextX, playerZ, buffer)) playerX = nextX;
    if (!checkCollision(playerX, nextZ, buffer)) playerZ = nextZ;

    camera.position.set(playerX, 1.45, playerZ);
    
    const targetX = playerX + forwardX;
    const targetZ = playerZ + forwardZ;
    camera.lookAt(targetX, 1.45, targetZ);

    flashlight.position.set(playerX, 1.45, playerZ);
    flashlightTarget.position.set(playerX + forwardX * 5, 1.45, playerZ + forwardZ * 5);

    if (moveX !== 0 || moveZ !== 0) {
        if (runAudio.paused) runAudio.play().catch(() => {});
    } else {
        runAudio.pause();
    }

    if (mapReady && distance2D(playerX, playerZ, exitX, exitZ) < 1.8) {
        checkWinCondition();
    }
}

function updateCoins() {
    coins.forEach(coin => {
        if (coin.collected) return;

        coin.mesh.rotation.z += 0.05;
        coin.mesh.position.y = 0.8 + Math.sin(Date.now() * 0.004 + coin.mesh.position.x) * 0.06;

        if (distance2D(playerX, playerZ, coin.mesh.position.x, coin.mesh.position.z) < 1.1) {
            coin.collected = true;
            coin.mesh.visible = false;
            score++;
            scoreText.textContent = "COIN " + score + " / 10";
            coinAudio.currentTime = 0;
            coinAudio.play().catch(() => {});
        }
    });
}

function checkCollision(px, pz, r) {
    const points = [
        { x: px - r, z: pz - r },
        { x: px + r, z: pz - r },
        { x: px - r, z: pz + r },
        { x: px + r, z: pz + r }
    ];
    for (let p of points) {
        const gx = Math.round(p.x / cell);
        const gz = Math.round(p.z / cell);

        if (gx < 0 || gz < 0 || gx >= cols || gz >= rows) return true;
        if (maze[gz][gx] === "1") return true;
    }
    return false;
}

function checkWinCondition() {
    gameFinished = true;
    music.pause();
    runAudio.pause();

    localStorage.setItem("lastScore", score);

    if (score >= 10) {
        winAudio.currentTime = 0;
        winAudio.play().catch(() => {});
        
        let currentScores = JSON.parse(localStorage.getItem('mazeScores') || '[]');
        currentScores.push({
            score: score,
            difficulty: difficulty.toUpperCase(),
            date: new Date().toLocaleDateString('id-ID')
        });
        currentScores.sort((a, b) => b.score - a.score);
        localStorage.setItem('mazeScores', JSON.stringify(currentScores));

        setTimeout(() => {
            window.location.replace("win.html");
        }, 80);
    } else {
        loseAudio.currentTime = 0;
        loseAudio.play().catch(() => {});
        setTimeout(() => {
            window.location.replace("gameover.html");
        }, 80);
    }
}

function distance2D(x1, z1, x2, z2) {
    return Math.hypot(x1 - x2, z1 - z2);
}

function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}