import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "./tasks-vision.js";

const demosSection = document.getElementById("demos");
const column1 = document.getElementById("video-blend-shapes-column1");
const column2 = document.getElementById("video-blend-shapes-column2");

let faceLandmarker;
let runningMode = "IMAGE";
let webcamRunning = false;
const videoWidth = 480;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const renderer = new THREE.WebGLRenderer({ alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
let glass;

const loader = new GLTFLoader();
document.getElementById("liveView").appendChild(renderer.domElement);

async function preLoadAssets() {
    const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode,
        numFaces: 1
    });
    demosSection.classList.remove("invisible");
}

preLoadAssets();

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    const enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

function enableCam() {
    if (!faceLandmarker) {
        console.log("Wait! faceLandmarker not loaded yet.");
        return;
    }

    webcamRunning = !webcamRunning;
    const btn = document.getElementById("webcamButton");
    btn.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            // Recalculate camera and renderer when video is loaded
            const aspectRatio = video.videoWidth / video.videoHeight;
            camera.aspect = aspectRatio;
            camera.updateProjectionMatrix();

            renderer.setSize(video.videoWidth, video.videoHeight);
            canvasElement.width = video.videoWidth;
            canvasElement.height = video.videoHeight;
            video.width = video.videoWidth;
            video.height = video.videoHeight;

            camera.position.z = 2;
            predictWebcam();
        });
    });
}

loader.load('glass.glb', (gltf) => {
    console.log("Model loaded");
    glass = gltf.scene;
    glass.scale.set(0.5, 0.5, 0.5);
    scene.add(glass);
}, undefined, (error) => {
    console.error("Error loading model:", error);
});

const drawingUtils = new DrawingUtils(canvasCtx);
let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode });
    }

    const nowInMs = Date.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, nowInMs);
    }

    // Resize canvas to match video dimensions
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030", lineWidth: 1 });
        }

        // Glass positioning
        if (glass) {
            const point = results.faceLandmarks[0][168];
            const x = (point.x - 0.5) * 2;
            const y = -(point.y - 0.5) * 2;
            const z = -point.z;
            glass.position.set(x, y, z);
        }
    }

    // Draw blend shapes (Optional)
    if (results.faceBlendshapes) {
        const blendShapes = results.faceBlendshapes[0].categories;
        const halfLength = Math.ceil(blendShapes.length / 2);
        const column1Blend = blendShapes.slice(0, halfLength);
        const column2Blend = blendShapes.slice(halfLength);
        // drawBlendShapes(column1, column1Blend);
        // drawBlendShapes(column2, column2Blend);
    }

    renderer.render(scene, camera);

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) return;
    let html = "";
    blendShapes.forEach(shape => {
        html += `
            <li class="blend-shapes-item">
                <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
                <span class="blend-shapes-value" style="width: calc(${shape.score * 100}% - 120px)">${shape.score.toFixed(4)}</span>
            </li>
        `;
    });
    el.innerHTML = html;
}
