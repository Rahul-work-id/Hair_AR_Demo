import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, model3D;

const canvas = document.getElementById('canvas');
const video = document.getElementById('webcam');

// Remove overlay
const overlay = document.getElementById('overlay');
if (overlay) overlay.style.display = 'none';

const screenWidth = 480;
const screenHeight = 640;

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, screenWidth / screenHeight, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(screenWidth, screenHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
}

function loadGlasses() {
  const loader = new GLTFLoader();
  loader.load('glass.glb', (gltf) => {
    model3D = gltf.scene;
    model3D.scale.set(0.5, 0.5, 0.5);
    scene.add(model3D);
  });
}

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

// UI Elements
const webcamButton = document.getElementById('webcamButton');
let cameraFeed = null;

webcamButton.addEventListener('click', () => {
  webcamButton.style.display = 'none';

  cameraFeed = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: screenWidth,
    height: screenHeight,
  });

  cameraFeed.start();
});

// DOM References for blend shape columns
const column1 = document.getElementById('video-blend-shapes-column1');
const column2 = document.getElementById('video-blend-shapes-column2');

// Store DOM elements to update values efficiently
let blendShapeElements = {};

function onFaceResults(results) {
  if (!results.multiFaceLandmarks[0]) return;

  const landmarks = results.multiFaceLandmarks[0];
  const blendShapes = results.faceBlendShapes || [];

  // Position glasses model
  const reference = landmarks[168];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  if (model3D) {
    model3D.position.set(0, 0, 0);

    const eyeDir = new THREE.Vector3(
      -(rightEye.x - leftEye.x),
      -(rightEye.y - leftEye.y),
      -(rightEye.z - leftEye.z)
    );

    const lookTarget = new THREE.Vector3().copy(eyeDir).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), lookTarget);
    model3D.setRotationFromQuaternion(quaternion);
  }

  updateBlendShapeUI(blendShapes);
  renderer.render(scene, camera);
}

function updateBlendShapeUI(blendShapes) {
  if (!blendShapes.length) return;

  // Reset and repopulate once if blendShapeElements is empty
  if (Object.keys(blendShapeElements).length === 0) {
    column1.innerHTML = '';
    column2.innerHTML = '';

    blendShapes.forEach((shape, index) => {
      const li = document.createElement('li');
      li.className = 'blend-shapes-item';
      li.textContent = `${shape.categoryName}: 0.00`;
      const column = index % 2 === 0 ? column1 : column2;
      column.appendChild(li);
      blendShapeElements[shape.categoryName] = li;
    });
  }

  // Update values
  for (const shape of blendShapes) {
    const element = blendShapeElements[shape.categoryName];
    if (element) {
      element.textContent = `${shape.categoryName}: ${shape.score.toFixed(2)}`;
    }
  }
}

// Initialize
initThree();
loadGlasses();
