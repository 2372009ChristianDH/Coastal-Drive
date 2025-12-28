import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Konfigurasi dasar
const config = {
    speed: 0.5,         // kecepatan mobil
    roadLength: 2.5,    // Panjang setiap potongan jalan
    roadCount: 50,      // Jarak pandang jalan
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
scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);
const cam = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
// Kamera diposisikan sedikit lebih rendah untuk kesan kecepatan
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
scene.add(sun);

// Loader tekstur pantai
const textureLoader = new THREE.TextureLoader();
const waterTexture = textureLoader.load('./img/water_texture.png');
waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(5, 5);

const sandTexture = textureLoader.load('./img/sand_texture.jpg');
sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
sandTexture.repeat.set(1, 10);

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
function pantai(zPos, modelPagar) {
    const group = new THREE.Group();
    const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture, roughness: 0.8 });
    const waterMat = new THREE.MeshStandardMaterial({ 
        map: waterTexture,
        roughness: 0.8,
        metalness: 0.1,
    });

    const sandGeo = new THREE.PlaneGeometry(config.sandWidth, config.roadLength);
    const waterGeo = new THREE.PlaneGeometry(config.waterWidth, config.roadLength);

    // --- POSISI PAGAR ---
    if (modelPagar) {
        // Pagar Kanan
        const fenceR = modelPagar.clone();
        // Letakkan tepat di pinggir jalan (roadWidth / 2)
        fenceR.position.set(config.roadWidth / 2, -0.8, zPos); 
        // Putar jika perlu menyesuaikan arah hadap pagar (contoh: 90 derajat)
        fenceR.rotation.y = Math.PI / 2; 
        group.add(fenceR);

        // Pagar Kiri
        const fenceL = modelPagar.clone();
        fenceL.position.set(-config.roadWidth / 2, -0.8, zPos);
        fenceL.rotation.y = -Math.PI / 2;
        group.add(fenceL);
    }

    const sandR = new THREE.Mesh(sandGeo, sandMat);
    sandR.rotation.x = -Math.PI / 2;
    sandR.position.set(config.roadWidth / 2 + config.sandWidth / 2, -1, zPos);
    sandR.receiveShadow = true;
    group.add(sandR);

    const sandL = sandR.clone();
    sandL.position.x = -sandR.position.x;
    group.add(sandL);

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

    // 1. Load Pagar Terlebih Dahulu
    const fenceGLTF = await loader.loadAsync('./models/Fence Long.glb');
    let fenceModel = fenceGLTF.scene;

    fenceModel.scale.set(1,1,1); 

    // 2. Load Jalan
    const roadGLTF = await loader.loadAsync('./models/Road Piece Straight.glb');
    const roadModel = roadGLTF.scene;

    for (let i = -2; i < config.roadCount; i++) {
        const z = -i * config.roadLength;
        
        // Buat jalan
        const road = roadModel.clone();
        road.traverse(n => {
            if (n.isMesh) {
                if (n.name === "mesh1357725606_1") n.visible = false;
                n.receiveShadow = true;
            }
        });
        road.scale.set(config.roadWidth, 1, 1);
        road.position.z = z;
        scene.add(road);
        roads.push(road);

        // Kirim fenceModel ke fungsi pantai
        const env = pantai(z, fenceModel); 
        scene.add(env);
        environments.push(env);
    }

    // Load Mobil
    const carGLTF = await loader.loadAsync('./models/Car Hatchback.glb');
    car = carGLTF.scene;

    car.scale.set(5, 5, 5);

    // warna body mobil
    car.traverse((child) => {
    if (child.isMesh) {
        if (child.name === "main_car_1") { 
            child.material.color.set(0xffff00); 
            child.material.metalness = 0.8;
            child.material.roughness = 0.2;
        }
        child.castShadow = true;
    }
});

    car.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
        }
    });

    car.matrixAutoUpdate = false;
    scene.add(car);

    draw();
}

loadAssets();


// Kontrol Keyboard
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;

    if (e.key.toLowerCase() === 'j' && !gameStarted) {
        gameStarted = true;
        dashboard.style.opacity = '0';
        setTimeout(() => {
            dashboard.style.display = 'none';
        }, 500);
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});


// Animasi Loop
const resetThreshold = 15; 
const totalLength = config.roadCount * config.roadLength;
const clock = new THREE.Clock();

let carTilt = 0;
let carSteer = 0;

// --- Tambahkan variabel ini di atas fungsi draw() ---
let speedMultiplier = 0; // Untuk transisi akselerasi

function draw() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // 1. Logika Update Mobil (Dijalankan baik saat idle maupun main agar posisi sama)
    if (car) {
        if (gameStarted) {
            // Kontrol input hanya aktif jika game sudah dimulai
            if (keys.a || keys.ArrowLeft) {
                carPosX -= config.steeringSpeed;
                carTilt = THREE.MathUtils.lerp(carTilt, 0.2, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, 0.2, 0.1);
            } else if (keys.d || keys.ArrowRight) {
                carPosX += config.steeringSpeed;
                carTilt = THREE.MathUtils.lerp(carTilt, -0.2, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, -0.2, 0.1);
            } else {
                carTilt = THREE.MathUtils.lerp(carTilt, 0, 0.1);
                carSteer = THREE.MathUtils.lerp(carSteer, 0, 0.1);
            }
        }

        carPosX = THREE.MathUtils.clamp(carPosX, -config.maxSteerX, config.maxSteerX);

        // Update Matrix Transformasi Mobil
        let tMatrix = new THREE.Matrix4().makeTranslation(carPosX, 0.25, 0);
        let sMatrix = new THREE.Matrix4().makeScale(5, 5, 5);
        let rMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI + carTilt, carSteer));
        let result = new THREE.Matrix4().multiplyMatrices(tMatrix, rMatrix).multiply(sMatrix);
        car.matrix.copy(result);

        // Update Kamera agar smooth mengikuti mobil
        const targetCamX = carPosX * 0.1;
        cam.position.x = THREE.MathUtils.lerp(cam.position.x, targetCamX, 0.05);
        cam.lookAt(carPosX * 0.05, 1, -10);
    }

    // 2. Logika Pergerakan Lingkungan
    if (gameStarted) {
        // Transisi akselerasi halus dari 0 ke config.speed
        speedMultiplier = THREE.MathUtils.lerp(speedMultiplier, 1, 0.02);
        const currentSpeed = config.speed * speedMultiplier;

        for (let i = 0; i < roads.length; i++) {
            roads[i].position.z += currentSpeed;
            environments[i].position.z += currentSpeed;

            if (roads[i].position.z > resetThreshold) {
                roads[i].position.z -= totalLength;
                environments[i].position.z -= totalLength;
            }
        }
    }

    renderer.render(scene, cam);
    requestAnimationFrame(draw);
}

draw();

window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});