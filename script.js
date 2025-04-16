import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, model3D;
const canvas = document.getElementById('canvas');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');

// Initialize Three.js Scene
function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
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

// Draw face mesh points correctly scaled
function drawFaceMesh(landmarks) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.save();
  overlayCtx.scale(overlay.width, overlay.height); // scale normalized to screen
  overlayCtx.fillStyle = 'cyan';

  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    overlayCtx.beginPath();
    overlayCtx.arc(pt.x, pt.y, 0.003, 0, 2 * Math.PI); // size in normalized space
    overlayCtx.fill();
  }

  overlayCtx.restore();
}

// Handle FaceMesh Results and Position Glasses on Face
function onFaceResults(results) {
  if (!results.multiFaceLandmarks[0]) return;

  const landmarks = results.multiFaceLandmarks[0];
  drawFaceMesh(landmarks);

  if (!model3D) return;

  // Use eyes and nose bridge to better position the glasses
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[168];

  const x = (leftEye.x + rightEye.x) / 2;
  const y = (leftEye.y + rightEye.y) / 2;
  const z = (leftEye.z + rightEye.z) / 2;

  model3D.position.set(
    (x - 0.5) * 2,         // Horizontal centering
    -(y - 0.5) * 2,        // Vertical flip & centering
    z - 0.15               // Bring closer to face
  );

  renderer.render(scene, camera);
}

// Initialize
initThree();
loadGlasses();
