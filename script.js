import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, model3D;
let pointCloud, pointGeometry, pointMaterial;

const canvas = document.getElementById('canvas');
const video = document.getElementById('video');

// Remove overlay
const overlay = document.getElementById('overlay');
if (overlay) overlay.style.display = 'none';

// Initialize Three.js Scene
function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Point cloud setup
  const pointCount = 468;
  const positions = new Float32Array(pointCount * 3);
  pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointMaterial = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.01 });
  pointCloud = new THREE.Points(pointGeometry, pointMaterial);
  scene.add(pointCloud);
}

// Load Glasses Model
function loadGlasses() {
  const loader = new GLTFLoader();
  loader.load('glass.glb', (gltf) => {
    model3D = gltf.scene;
    model3D.scale.set(0.5, 0.5, 0.5);
    model3D.rotation.set(0, -Math.PI, 0); // Fix flipped model
    scene.add(model3D);
  });
}

// MediaPipe FaceMesh Setup
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onFaceResults);

// Set up Webcam and start FaceMesh tracking
const cameraFeed = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480,
});

cameraFeed.start();

// Handle FaceMesh Results and Position Glasses on Face
function onFaceResults(results) {
  if (!results.multiFaceLandmarks[0]) return;

  const landmarks = results.multiFaceLandmarks[0];

  // 🎯 Update 3D Point Cloud
  const positionsAttr = pointGeometry.getAttribute('position');
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    positionsAttr.setXYZ(
      i,
      (lm.x - 0.5) * 2,
      -(lm.y - 0.5) * 2,
      lm.z - 0.1
    );
  }
  positionsAttr.needsUpdate = true;

  // 🕶 Position Glasses
  if (model3D) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const x = (leftEye.x + rightEye.x) / 2;
    const y = (leftEye.y + rightEye.y) / 2;
    const z = (leftEye.z + rightEye.z) / 2;

    model3D.position.set(
      (x - 0.5) * 2,
      -(y - 0.5) * 2,
      z - 0.15
    );
  }

  // 🎥 Render Scene
  renderer.render(scene, camera);
}

// Initialize
initThree();
loadGlasses();
