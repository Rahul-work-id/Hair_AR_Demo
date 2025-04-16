let scene, camera, renderer, model3D;
const canvas = document.getElementById('canvas');

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function loadGlasses() {
  const loader = new THREE.GLTFLoader();
  loader.load('glass.glb', gltf => {
    model3D = gltf.scene;
    scene.add(model3D);
  });
}

const video = document.getElementById('video');

const faceMesh = new FaceMesh({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(onFaceResults);

const cameraFeed = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480
});
cameraFeed.start();

function onFaceResults(results) {
    if (!results.multiFaceLandmarks[0] || !model3D) return;
  
    const landmarks = results.multiFaceLandmarks[0];
  
    const leftEye = landmarks[33]; // or use 133 for better alignment
    const rightEye = landmarks[263];
  
    const x = (leftEye.x + rightEye.x) / 2;
    const y = (leftEye.y + rightEye.y) / 2;
    const z = (leftEye.z + rightEye.z) / 2;
  
    model3D.position.set(
      (x - 0.5) * 2,       // horizontal position
      -(y - 0.5) * 2,      // vertical position
      z
    );
  
    renderer.render(scene, camera);
  }
  