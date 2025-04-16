import * as THREE from 'three'; // Importing Three.js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Importing GLTFLoader

let scene, camera, renderer, model3D;
const canvas = document.getElementById('canvas');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');     // 2D overlay canvas
const overlayCtx = overlay.getContext('2d');     
// Initialize Three.js Scene
function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Load Glasses Model
function loadGlasses() {
  const loader = new GLTFLoader();
  loader.load('glass.glb', (gltf) => {
    model3D = gltf.scene;
    model3D.scale.set(0.5, 0.5, 0.5); // Scale down the model if it's too large
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

// Draw face landmarks as dots
function drawFaceMesh(landmarks) {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    overlayCtx.fillStyle = 'cyan';
  
    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i].x * overlay.width;
      const y = landmarks[i].y * overlay.height;
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, 1.5, 0, 2 * Math.PI);
      overlayCtx.fill();
    }
  }
  

// Handle FaceMesh Results and Position Glasses on Face
function onFaceResults(results) {
  if (!results.multiFaceLandmarks[0]) return;

  const landmarks = results.multiFaceLandmarks[0];
  drawFaceMesh(landmarks); // 👈 Draw the 2D face mesh on canvas

  if (!model3D) return;

  // Get the position of the eyes (left and right)
  const leftEye = landmarks[33]; // Left eye landmark
  const rightEye = landmarks[263]; // Right eye landmark

  // Calculate the average of the eye positions
  const x = (leftEye.x + rightEye.x) / 2;
  const y = (leftEye.y + rightEye.y) / 2;
  const z = (leftEye.z + rightEye.z) / 2;

  // Position the glasses model
  model3D.position.set(
    (x - 0.5) * 2,
    -(y - 0.5) * 2,
    z - 0.05
  );

  // Rotate the glasses to face forward (adjust if needed)
  model3D.rotation.set(0, Math.PI, 0);

  // Render the Three.js scene
  renderer.render(scene, camera);
}

// Start the Three.js scene and load the glasses model
initThree();
loadGlasses();
