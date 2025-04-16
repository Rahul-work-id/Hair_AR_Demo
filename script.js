import * as THREE from 'three'; // Importing Three.js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Importing GLTFLoader

let scene, camera, renderer, model3D;
const canvas = document.getElementById('canvas');
const video = document.getElementById('video');

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
     // Scale down the model if it's too large
     model3D.scale.set(0.05, 0.05, 0.05);   
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
    if (!results.multiFaceLandmarks[0] || !model3D) return;

    const landmarks = results.multiFaceLandmarks[0];
  
    // Get the position of the eyes (left and right)
    const leftEye = landmarks[33]; // Left eye landmark
    const rightEye = landmarks[263]; // Right eye landmark
  
    // Calculate the average of the eye positions
    const x = (leftEye.x + rightEye.x) / 2;
    const y = (leftEye.y + rightEye.y) / 2;
    const z = (leftEye.z + rightEye.z) / 2;
  
    // Apply scaling and positioning based on the landmarks
    // Position the glasses directly over the eyes, and adjust the z-depth to bring it closer to the face
    model3D.position.set(
      (x - 0.5) * 2,       // Adjust the horizontal position (fine-tune this value)
      -(y - 0.5) * 2,      // Adjust the vertical position (fine-tune this value)
      z - 0.05            // Adjust z-position to bring glasses closer to the face
    );
  
    // Optionally, rotate the glasses to face the camera or the user's view
    model3D.rotation.set(0, Math.PI, 0); // Adjust this based on the glasses model orientation
  
    // Render the scene
    renderer.render(scene, camera);
}

// Start the Three.js scene and load the glasses model
initThree();
loadGlasses();
