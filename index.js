import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Konfigurasi dasar
const config = {
    speed: 0.8,         // kecepatan mobil
    roadLength: 2.5,    // Panjang setiap potongan jalan
    roadCount: 150,      // Jarak pandang jalan
    roadWidth: 14,      // Lebar jalan
    steeringSpeed: 0.05, // Kecepatan kemudi
    maxSteerX: 5,     // Batas kemudi
    sandWidth: 10,      // Lebar pantai
    waterWidth: 200,    // Luas laut
    lanes: [-4, 0, 4],
};

const scene = new THREE.Scene();
// Warna langit
scene.background = new THREE.Color(0x87ceeb);
// Efek kabut
scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);
const cam = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
cam.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Ambient Light
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// Directional Light
const sun = new THREE.DirectionalLight(0xffebc2, 1.5);
sun.position.set(50, 100, 50);
sun.castShadow = true;

// Pengaturan kualitas dan jangkauan bayangan
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
scene.add(sun);

// Loader tekstur pantai
const textureLoader = new THREE.TextureLoader();
const waterTexture = textureLoader.load('./img/water_tex.jpg');
waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(50, 1);

const sandTexture = textureLoader.load('./img/sand_texture.jpg');
sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
sandTexture.repeat.set(50, 1);

// control mulai game
let gameStarted = false;
const dashboard = document.getElementById('dashboard');

const loader = new GLTFLoader();
let car = null;
let roads = [];
let environments = [];
let carPosX = 0;
let keys = {
    a: false,
    d: false,
    ArrowLeft: false,
    ArrowRight: false,
};


// Fungsi membuat pantai
function pantai(zPos) {
    const group = new THREE.Group();
    const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture, roughness: 0.8, metalness: 0.4 });
    const waterMat = new THREE.MeshStandardMaterial({
        map: waterTexture,
        color: 0x1060ff,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
    });

    const sandGeo = new THREE.PlaneGeometry(config.sandWidth, config.roadLength);
    const waterGeo = new THREE.PlaneGeometry(config.waterWidth, config.roadLength);

    const sandR = new THREE.Mesh(sandGeo, sandMat);
    sandR.rotation.x = -Math.PI / 2;
    sandR.position.set(config.roadWidth / 2 + config.sandWidth / 2, -1, zPos);
    sandR.receiveShadow = true;
    group.add(sandR);

    const sandL = sandR.clone();
    sandL.position.x = -sandR.position.x;
    group.add(sandL);

    // spawn pohon kelapa
    if (palmTreeModel) {
        if (Math.random() > 0.9) { 
            const tree = palmTreeModel.clone();
            const side = Math.random() > 0.5 ? 1 : -1;
            
            // Posisi di area pasir
            const treeX = (config.roadWidth / 2 + 2 + Math.random() * 5) * side;
            
            // Skala
            const s = 0.3 + Math.random() * 0.3;
            tree.scale.set(s, s, s);
            
            tree.position.set(treeX, -1, zPos);
            tree.rotation.y = Math.random() * Math.PI;
            
            group.add(tree);
        }
    }

    const waterR = new THREE.Mesh(waterGeo, waterMat);
    waterR.rotation.x = -Math.PI / 2;
    waterR.position.set(sandR.position.x + config.sandWidth / 2 + config.waterWidth / 2, -1.05, zPos);
    group.add(waterR);

    const waterL = waterR.clone();
    waterL.position.x = -waterR.position.x;
    group.add(waterL);

    return group;
}

// Load Objek 3d
async function loadAssets() {
    // load pohon kelapa
    const palmGLTF = await loader.loadAsync('./models/Coconut palm tree.glb');
    palmTreeModel = palmGLTF.scene;
    palmTreeModel.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
        }
    });

    // Load Jalan
    const roadGLTF = await loader.loadAsync('./models/Road Piece Straight.glb');
    const roadModel = roadGLTF.scene;

    for (let i = -2; i < config.roadCount; i++) {
        const z = -i * config.roadLength;
        const road = roadModel.clone();

        road.scale.set(config.roadWidth, 1, 1);
        road.position.z = z;
        road.traverse(n => { if (n.isMesh) {
            n.receiveShadow = true; 
        }});
        scene.add(road);
        roads.push(road);

        const env = pantai(z);
        scene.add(env);
        environments.push(env);
    }

    // Load Mobil
    const carGLTF = await loader.loadAsync('./models/Car Hatchback.glb');
    car = carGLTF.scene;
    car.scale.set(5, 5, 5);
    car.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
        }
    });
    car.matrixAutoUpdate = false;
    scene.add(car);

    //load obstacles models
    const coneGLTF = await loader.loadAsync('./models/Traffic Cone.glb');
    coneModel = coneGLTF.scene;
    coneModel.traverse(n => { if (n.isMesh) n.castShadow = true; });

    const brokenCarGLTF = await loader.loadAsync('./models/Broken Car.glb');
    brokenCarModel = brokenCarGLTF.scene;
    brokenCarModel.traverse(n => { if (n.isMesh) {
        n.castShadow = true; 
    }});

    // Load model Alarm Clock dari Poly Pizza
    const clockGLTF = await loader.loadAsync('./models/Alarm Clock.glb');
    clockModel = clockGLTF.scene;
    clockModel.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.material.emissive = new THREE.Color(0xffff00);
            n.material.emissiveIntensity = 0.2;
        }
    });

    draw();
}

loadAssets();

function spawnObstacle() {
    if (!gameStarted || gameOver) return;

    const spawnType = Math.random();
    let obstacle;

    if (spawnType > 0.2) {
        obstacle = coneModel.clone();
        obstacle.scale.set(2, 2, 2);
        obstacle.userData.type = "slow";
    } else {
        obstacle = brokenCarModel.clone();
        obstacle.scale.set(1, 1, 1);
        obstacle.userData.type = "death";
        
        obstacle.rotation.y = Math.random() * Math.PI * 2; 
        if (Math.random() > 0.5) {
            obstacle.rotation.z = Math.PI; 
            obstacle.position.y = 1.2;     
        }
    }
    const randomX = (Math.random() - 0.5) * (config.maxSteerX * 2);
    obstacle.position.set(randomX, obstacle.position.y || 0, -250); 
    
    scene.add(obstacle);
    obstacles.push(obstacle);

    
}

let clockModel; 
let items = []; 

function spawnClock() {
    if (!gameStarted || !clockModel) return;

    const clockItem = clockModel.clone();
    clockItem.scale.set(18, 18, 18);

    const randomX = (Math.random() - 0.5) * (config.maxSteerX * 2);
    clockItem.position.set(randomX, 0.8, -250);

    scene.add(clockItem);
    items.push(clockItem);
}


// Kontrol Keyboard
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;

    if (e.key.toLowerCase() === 'j' && !gameStarted) {
        gameStarted = true;
        gameOver = false;

        // RESET TIMER & SCORE
        timeLeft = 100;
        distance = 0;

        timeDisplay.textContent = timeLeft;
        scoreDisplay.textContent = distance;

        dashboard.style.opacity = '0';
        dashboard.style.pointerEvents = 'none';

        setTimeout(() => {
            dashboard.style.display = 'none';
        }, 500);
    }

    const restartBtn = document.getElementById('restart-btn');

    restartBtn.addEventListener('click', () => {
        window.location.reload();
    });

});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Animasi Loop
const resetThreshold = 15;
const totalLength = config.roadCount * config.roadLength;
const clock = new THREE.Clock();
const speedDisplay = document.getElementById('speed-value');

let carTilt = 0;
let carSteer = 0;
let speedMultiplier = 0; 
let obstacles = [];
let coneModel, fenceModel, brokenCarModel;
let spawnTimer = 0;

let palmTreeModel;

// TImer dan Score
let timeLeft = 100;          
let distance = 0;          
let gameOver = false;

const timeDisplay = document.getElementById('time-value');
const scoreDisplay = document.getElementById('score-value');
const gameOverScreen = document.getElementById('game-over');
const finalScoreText = document.getElementById('final-score');


function draw() {
    const delta = clock.getDelta();
    if (gameStarted && !gameOver) {

        // Timer
        timeLeft -= delta;
        if (timeLeft <= 0) {
            timeLeft = 0;
            endGame();
        }
        timeDisplay.textContent = Math.ceil(timeLeft);

        // Score berdasarkan jarak
        const meterPerSecond = 20; 
        distance += meterPerSecond * speedMultiplier * delta;
        scoreDisplay.textContent = Math.floor(distance);
    }

    const time = clock.getElapsedTime();

    // 1. Logika Mobil
    if (car) {
        if (gameStarted) {
            // Kontrol input hanya aktif jika game sudah dimulai
            if (keys.a || keys.ArrowLeft) {
                carPosX -= config.steeringSpeed;
                carTilt = THREE.MathUtils.lerp(carTilt, 0.2, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, 0.1, 0.05);
            } else if (keys.d || keys.ArrowRight) {
                carPosX += config.steeringSpeed;
                carTilt = THREE.MathUtils.lerp(carTilt, -0.2, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, -0.1, 0.05);
            } else {
                carTilt = THREE.MathUtils.lerp(carTilt, 0, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, 0, 0.1);
            }
        }

        carPosX = THREE.MathUtils.clamp(carPosX, -config.maxSteerX, config.maxSteerX);

        // Update Matrix Transformasi Mobil
        let tMatrix = new THREE.Matrix4().makeTranslation(carPosX, 0.25, 0);
        let sMatrix = new THREE.Matrix4().makeScale(5, 5, 5);
        let rMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI + carSteer, carTilt));
        let result = new THREE.Matrix4().multiplyMatrices(tMatrix, rMatrix).multiply(sMatrix);
        car.matrix.copy(result);

        // Update Kamera agar smooth mengikuti mobil
        const targetCamX = carPosX * 0.1;
        cam.position.x = THREE.MathUtils.lerp(cam.position.x, targetCamX, 0.05);
        cam.lookAt(carPosX * 0.05, 1, -10);
    }

    // 2. Logika jalan
    if (gameStarted && !gameOver) {

        const currentSpeed = config.speed * speedMultiplier;
        speedMultiplier = THREE.MathUtils.lerp(speedMultiplier, 1, 0.001);

        for (let i = 0; i < roads.length; i++) {
            roads[i].position.z += currentSpeed;
            environments[i].position.z += currentSpeed;

            if (roads[i].position.z > resetThreshold) {
                roads[i].position.z -= totalLength;
                environments[i].position.z -= totalLength;
            }
        }

        //spawn clock
        spawnTimer += delta;
        if (spawnTimer > 1.5) {
            spawnObstacle();
            if (Math.random() < 0.15) { 
                spawnClock();
            }
            spawnTimer = 0;
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.position.z += currentSpeed;
            item.rotation.y += delta * 2; // Animasi putar
            const dx = carPosX - item.position.x;
            const dz = 0 - item.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
                timeLeft += 5; // Tambah 5 detik
                scene.remove(item);
                items.splice(i, 1);
                continue;
            }
            if (item.position.z > resetThreshold) { scene.remove(item); items.splice(i, 1); }
        }

        // Update speedometer
        const currentKmh = Math.floor(currentSpeed * 125);
        speedDisplay.textContent = currentKmh.toString();
    }

    //3. Logika obstacle slowdown
    if (gameStarted) {
        spawnTimer += delta;
        if (spawnTimer > 1.5) { 
            spawnObstacle();
            spawnTimer = 0;
        }

        // Update posisi obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.position.z += config.speed * speedMultiplier;

            // Hapus obstacle jika sudah melewati mobil
            if (car && !gameOver) {
                const carBox = new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(carPosX, 0.5, 0),
                    new THREE.Vector3(1, 1, 1)
                );
                const obsBox = new THREE.Box3().setFromObject(obs);

                if (carBox.intersectsBox(obsBox)) {
                    if (obs.userData.type === "death") {
                        endGame();
                    } else {
                    speedMultiplier = 0.01; 
                    scene.remove(obs);
                    obstacles.splice(i, 1);
                    continue;
                    }
                }
            }
            if (obs.position.z > resetThreshold) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }
    }

    renderer.render(scene, cam);
    requestAnimationFrame(draw);
}

draw();

function endGame() {
    gameOver = true;
    gameStarted = false;

    finalScoreText.textContent = Math.floor(distance) + " M";
    gameOverScreen.style.display = "flex";
}


window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});