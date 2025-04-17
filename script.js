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
        //---------------------------------------------------------||||||||||||||||||||||
        // Glass positioning & rotation
        if (hat && results.faceLandmarks) {

            // 1. Pull out the 3×4 pose matrix
            // 1. Grab the three key landmarks:
            const lm = results.faceLandmarks[0];
            const forehead = lm[10];
            const leftEar = lm[127];
            const rightEar = lm[356];

            // 2. Helper to convert normalized landmark → world coords
            function toWorld(pt) {
                // flip X if your video is mirrored:
                const x = (1 - pt.x - 0.5) * 2;
                const y = -(pt.y - 0.5) * 2;
                const z = -pt.z;
                return new THREE.Vector3(x, y, z).unproject(camera);
            }

            // 3. Compute world positions
            const worldForehead = toWorld(forehead);
            const worldLeftEar = toWorld(leftEar);
            const worldRightEar = toWorld(rightEar);

            // 4. Position: forehead + tiny lift (in world units)
            const headLift = worldLeftEar.distanceTo(worldRightEar) * 0.2;
            hat.position.copy(worldForehead).add(new THREE.Vector3(0, headLift, 0));

            // 5. Scale: ear‑to‑ear width
            const earDist = worldLeftEar.distanceTo(worldRightEar);
            hat.scale.setScalar(earDist * 0.8);

            // 6. Rotate: make the hat’s “brim” face the same direction as your ears
            //    We build a quaternion that aligns the hat’s X‑axis with the ear vector:
            const earVec = worldRightEar.clone().sub(worldLeftEar).normalize();
            // assuming the hat’s local +X goes “across” the head:
            const hatQuat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                earVec
            );
            hat.setRotationFromQuaternion(hatQuat);

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

