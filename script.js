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
renderer.setSize(video.videoWidth, video.videoHeight);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = "0";
renderer.domElement.style.left = "0";
renderer.domElement.style.zIndex = "3"; // Important - higher than video
renderer.domElement.style.pointerEvents = "none"; // So you can still click buttons

// Append the renderer above the video
document.getElementById("liveView").appendChild(renderer.domElement);
const scene = new THREE.Scene();
//const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 2;
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1).normalize();
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040); // Optional soft light
scene.add(ambientLight);

// Set up camera


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
    glass.position.set(0, 0, 0);         // Center of scene
    glass.scale.set(.5, .5, .5);           // Adjust scale if needed
    scene.add(glass);

    camera.lookAt(glass.position);
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
        results = await faceLandmarker.detectForVideo(video, nowInMs);
    }

    if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        console.log("Face landmarks updating ✅");
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
        //---------------------------------------------------------
        // Glass positioning & rotation
        if (glass && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];

            // Position using landmark #168 (between eyes)
            const center = landmarks[168];
            const leftEye = landmarks[33];   // Approx left eye corner
            const rightEye = landmarks[263]; // Approx right eye corner

            // Convert normalized to clip space and flip X
            const mirrorX = function (x) {
                return 1.0 - x; // Flip X horizontally
            };

            const centerVec = new THREE.Vector3(
                (mirrorX(center.x) - 0.5) * 2,
                -(center.y - 0.5) * 2,
                -center.z
            ).unproject(camera);
            glass.position.copy(centerVec);

            const leftVec = new THREE.Vector3(
                (mirrorX(leftEye.x) - 0.5) * 2,
                -(leftEye.y - 0.5) * 2,
                -leftEye.z
            ).unproject(camera);

            const rightVec = new THREE.Vector3(
                (mirrorX(rightEye.x) - 0.5) * 2,
                -(rightEye.y - 0.5) * 2,
                -rightEye.z
            ).unproject(camera);

            // Recalculate eye vector with mirrored X for roll
            const eyeVector = new THREE.Vector2(
                mirrorX(rightEye.x) - mirrorX(leftEye.x),
                rightEye.y - leftEye.y
            );
            const roll = Math.atan2(eyeVector.y, eyeVector.x);

            // Reverse sign of roll if needed (test both)
            glass.rotation.set(0, 0, -roll); // or -roll if needed

            // Adjust scale as before
            const eyeDistance = leftVec.distanceTo(rightVec);
            glass.scale.setScalar(eyeDistance * 1.2);

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
        renderer.render(scene, camera);
        window.requestAnimationFrame(predictWebcam);
    }
}
renderer.render(scene, camera);
function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) return;
    let html = "";
    blendShapes.forEach(shape => {
        htmlMaker += `
        <li class="blend-shapes-item">
          <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
          <span class="blend-shapes-value" style="width: calc(${shape.score * 100}% - 120px)">${shape.score.toFixed(4)}</span>
        </li>
      `;
    });
    el.innerHTML = html;
}

