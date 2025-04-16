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

  // Fix orientation of entire point cloud if needed
  pointCloud.rotation.y = Math.PI; // optional: mirror around Y if required
}

// Load Glasses Model
function loadGlasses() {
  const loader = new GLTFLoader();
  loader.load('glass.glb', (gltf) => {
    model3D = gltf.scene;
    model3D.scale.set(0.5, 0.5, 0.5);
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
  width: 480,
  height: 640,
});

cameraFeed.start();

// Handle FaceMesh Results and Position Glasses on Face
function onFaceResults(results) {
  if (!results.multiFaceLandmarks[0]) return;

  const landmarks = results.multiFaceLandmarks[0];

  // Nose bridge as reference point
  const reference = landmarks[168];
  const offsetX = reference.x;
  const offsetY = reference.y;
  const offsetZ = reference.z;

  // Update face mesh point cloud
  const positionsAttr = pointGeometry.getAttribute('position');
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];

    // Flip X and Z for correct alignment
    const x = -(lm.x - offsetX) * 2;
    const y = -(lm.y - offsetY) * 2;
    const z = -(lm.z - offsetZ) * 2.5;

    positionsAttr.setXYZ(i, x, y, z);
  }
  positionsAttr.needsUpdate = true;

  // Update glasses position and orientation
  if (model3D) {
    // Center model at the origin of the point cloud
    model3D.position.set(0, 0, 0);

    // Compute look direction from eyes
    const leftEye = landmarks[33];     // outer left eye
    const rightEye = landmarks[263];   // outer right eye

    const eyeDir = new THREE.Vector3(
      -(rightEye.x - leftEye.x),
      -(rightEye.y - leftEye.y),
      -(rightEye.z - leftEye.z)
    );

    const lookTarget = new THREE.Vector3().copy(eyeDir).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), lookTarget);

    model3D.setRotationFromQuaternion(quaternion);
  }

  renderer.render(scene, camera);
}

// Initialize
initThree();
loadGlasses();
