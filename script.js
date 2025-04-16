
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "./tasks-vision.js";
const demosSection = document.getElementById("demos");
const column1 = document.getElementById("video-blend-shapes-column1");
const column2 = document.getElementById("video-blend-shapes-column2");
let faceLandmarker;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoWidth = 480;
// Preload :
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

/********************************************************************
 Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// Setup three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, videoWidth / (videoWidth * (video.videoHeight / video.videoWidth)), 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(videoWidth, videoWidth * (video.videoHeight / video.videoWidth));
document.getElementById("liveView").appendChild(renderer.domElement);

// Position camera
camera.position.z = 2;

// Load glass model
let glass;
const loader = new GLTFLoader();
loader.load('glass.glb', (gltf) => {
    glass = gltf.scene;
    glass.scale.set(0.1, 0.1, 0.1); // scale based on your model size
    scene.add(glass);
});

// Check if webcam access is supported.


function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.

if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.

function enableCam(event) {
    if (!faceLandmarker) {
        console.log("Wait! faceLandmarker not loaded yet.");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

// Update video and canvas size dynamically for responsiveness
async function predictWebcam() {
    const radio = video.videoHeight / video.videoWidth;
    
    // Set the width to 100% of the container and adjust height automatically
    video.style.width = "100%";
    video.style.height = "auto";

    // Adjust canvas size based on video size
    const videoContainerWidth = document.getElementById("liveView").clientWidth;
    const videoHeight = videoContainerWidth * radio;

    canvasElement.style.width = videoContainerWidth + "px";
    canvasElement.style.height = videoHeight + "px";
    canvasElement.width = videoContainerWidth;
    canvasElement.height = videoHeight;

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode: runningMode });
    }
    let nowInMs = Date.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, nowInMs);
    }
    if (results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" , lineWidth: 1});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" , lineWidth: 1});
        }
        // console.log(results);
    }
    if (results.faceLandmarks && glass) {
        const landmarks = results.faceLandmarks[0];
    
        // Get landmark between eyes (use point 168 for nose bridge)
        const point = landmarks[168];
    
        // Convert normalized coordinates to 3D space for three.js
        const x = (point.x - 0.5) * 2;
        const y = -(point.y - 0.5) * 2;
        const z = -point.z; // z is negative in 3D
    
        glass.position.set(x, y, z);
    }
    const blendShapes = results.faceBlendshapes;
    const halfLength = Math.ceil(blendShapes[0].categories.length / 2);
    const column1BlendShapes = blendShapes[0].categories.slice(0, halfLength);
    const column2BlendShapes = blendShapes[0].categories.slice(halfLength);

    //drawBlendShapes(column1, column1BlendShapes);
    //drawBlendShapes(column2, column2BlendShapes);
    renderer.render(scene, camera);
    // Recursively call this function to keep predicting when the browser is ready
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}


function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
      return;
    }
    let htmlMaker = "";
    blendShapes.map((shape) => {
      htmlMaker += `
        <li class="blend-shapes-item">
          <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
          <span class="blend-shapes-value" style="width: calc(${shape.score * 100}% - 120px)">${shape.score.toFixed(4)}</span>
        </li>
      `;
    });
    el.innerHTML = htmlMaker;
  }