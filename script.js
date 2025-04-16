import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "./tasks-vision.js";

// DOM elements
const canvas = document.getElementById('canvas');
//const video = document.getElementById('video');
const column1 = document.getElementById("video-blend-shapes-column1");
const column2 = document.getElementById("video-blend-shapes-column2");

let scene, camera, renderer, model3D;
let faceLandmarker;
let webcamRunning = false;

// Initialize Three.js
function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 480 / 640, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(480, 640);
  renderer.setPixelRatio(window.devicePixelRatio);
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

// Preload MediaPipe Assets
async function preLoadAssets() {
  const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
}

// Setup Webcam
const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

function enableCam() {
  if (!faceLandmarker) {
    console.log("FaceLandmarker not loaded yet.");
    return;
  }
  if (webcamRunning) {
    webcamRunning = false;
  } else {
    webcamRunning = true;
  }

  const constraints = { video: true };
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    videoElement.srcObject = stream;
    videoElement.addEventListener("loadeddata", predictWebcam);
  });
}

// Predict on Webcam Feed
async function predictWebcam() {
  const results = await faceLandmarker.detectForVideo(videoElement, Date.now());

  if (results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      // Drawing Face Landmarks
      const drawingUtils = new DrawingUtils(canvasCtx);
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });

      // Glasses position from face landmarks
      const reference = landmarks[168]; // Nose bridge
      const leftEye = landmarks[33];     // Left eye
      const rightEye = landmarks[263];   // Right eye

      // Calculate position and rotation for glasses model based on face landmarks
      updateGlassesPosition(reference, leftEye, rightEye);
    }
  }

  // BlendShapes for facial expressions
  const blendShapes = results.faceBlendshapes;
  const halfLength = Math.ceil(blendShapes[0].categories.length / 2);
  const column1BlendShapes = blendShapes[0].categories.slice(0, halfLength);
  const column2BlendShapes = blendShapes[0].categories.slice(halfLength);

  drawBlendShapes(column1, column1BlendShapes);
  drawBlendShapes(column2, column2BlendShapes);

  // Continuously call predictWebcam when webcam is running
  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// Update Glasses Position Based on Face Landmarks
function updateGlassesPosition(reference, leftEye, rightEye) {
  if (model3D) {
    // Update position (adjust the Z offset as needed)
    model3D.position.set(reference.x - 0.1, reference.y, reference.z + 0.2);

    // Rotate glasses model to align with the face's eye direction
    const eyeDir = new THREE.Vector3(-(rightEye.x - leftEye.x), -(rightEye.y - leftEye.y), -(rightEye.z - leftEye.z));
    const lookTarget = new THREE.Vector3().copy(eyeDir).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), lookTarget);
    model3D.setRotationFromQuaternion(quaternion);
  }
}

// Drawing Blend Shapes
function drawBlendShapes(el, blendShapes) {
  if (!blendShapes.length) return;

  let htmlMaker = "";
  blendShapes.forEach((shape) => {
    htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${shape.score * 100}% - 120px)">${shape.score.toFixed(4)}</span>
      </li>
    `;
  });
  el.innerHTML = htmlMaker;
}

// Initialize and Start
initThree();
loadGlasses();
preLoadAssets();
