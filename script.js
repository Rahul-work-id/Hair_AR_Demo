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
camera.position.set(0, 0, 0);
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1).normalize();
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040); // Optional soft light
scene.add(ambientLight);

// Set up camera


let glass;
let hat;
let faceOccluder;
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
        outputFacialTransformationMatrixes: true,
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

            camera.position.set(0, 0, 0);
            predictWebcam();
        });
    });
}

loader.load('hat.glb', (gltf) => {
    console.log("Model loaded");
    hat = gltf.scene;
    hat.position.set(0, 0, 0);         // Center of scene
    hat.scale.set(1, 1, 1);           // Adjust scale if needed
    scene.add(hat);

    const occluderMaterial = new THREE.MeshBasicMaterial({
        colorWrite: false, // Don't render color
        depthWrite: true   // Write to depth buffer
    });

    const occluderGeometry = new THREE.SphereGeometry(0.5, 32, 32); // You can tweak size
    faceOccluder = new THREE.Mesh(occluderGeometry, occluderMaterial);
    scene.add(faceOccluder);

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

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results && results.faceLandmarks?.length > 0) {
        const landmarks = results.faceLandmarks[0];

        // Drawing landmarks
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0", lineWidth: 1 });

        // Hat logic
        if (hat && landmarks) {
            const forehead = landmarks[10];
            const leftEar = landmarks[127];
            const rightEar = landmarks[356];

            function toWorld(pt) {
                const x = (1 - pt.x - 0.5) * 2;
                const y = -(pt.y - 0.5) * 2;
                const z = -pt.z;
                return new THREE.Vector3(x, y, z).unproject(camera);
            }

            const worldForehead = toWorld(forehead);
            const worldLeftEar = toWorld(leftEar);
            const worldRightEar = toWorld(rightEar);

            const earVec = worldRightEar.clone().sub(worldLeftEar).normalize();
            const flatEarVec = new THREE.Vector3(earVec.x, 0, earVec.z).normalize();

            const yawQuat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(-1, 0, 0),
                flatEarVec
            );

            const earDistance = worldLeftEar.distanceTo(worldRightEar);
            const headLift = earDistance * 0.2;

            // Calculate the pitch rotation (tilt)
            const pitchVec = worldForehead.clone().sub(worldLeftEar).normalize();
            const pitchQuat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1), // assuming world up vector
                pitchVec
            );

            // Apply transformations to the hat
            hat.position.copy(worldForehead).add(new THREE.Vector3(0, headLift, 0));
            hat.scale.setScalar(earDistance * 0.8);
            hat.quaternion.copy(yawQuat).multiply(pitchQuat); // combine yaw and pitch

            // Apply the same transformations to the hair
            if (hair) {
                hair.position.copy(worldForehead).add(new THREE.Vector3(0, headLift * 0.9, 0));
                hair.scale.setScalar(earDistance); // or tweak for your model

                const invertedYawQuat = yawQuat.clone();
                invertedYawQuat.y *= -1;
                invertedYawQuat.w *= -1;

                // Apply combined rotation of yaw and pitch to hair
                hair.quaternion.copy(invertedYawQuat).multiply(pitchQuat);
            }

            // Occluder: Position & scale to match head
            if (faceOccluder) {
                faceOccluder.position.copy(worldForehead).add(new THREE.Vector3(0, headLift * 0.8, 0));
                faceOccluder.scale.setScalar(earDistance * 0.5);
                faceOccluder.quaternion.copy(yawQuat);
            }
        }

    }

    renderer.render(scene, camera);

    if (webcamRunning) {
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

