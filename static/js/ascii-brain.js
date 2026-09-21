import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BRAIN_MODEL_URL = new URL("../models/brain.glb", import.meta.url).href;
const RAMP = " .:-=+*#%@";
const MAX_YAW = 0.52;
const MAX_PITCH = 0.32;
const FOLLOW = 0.085;
const IDLE_YAW = 0.045;
const IDLE_PITCH = 0.02;

const pointer = { x: 0, y: 0 };
const damped = { x: 0, y: 0 };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const asciiEl = document.getElementById("ascii-brain");
if (!asciiEl) {
  throw new Error("Missing #ascii-brain");
}

const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
const metricsCtx = document.createElement("canvas").getContext("2d");

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.domElement.style.display = "none";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
camera.position.set(0, 0.14, 3.48);
camera.lookAt(0, 0.14, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const key = new THREE.DirectionalLight(0xffffff, 1.25);
key.position.set(2.1, 2.4, 3.2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.32);
fill.position.set(-2.8, 0.3, 1.6);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.4);
rim.position.set(-0.2, 1.4, -3.2);
scene.add(rim);

const pivot = new THREE.Group();
scene.add(pivot);

const brain = await loadBrain();
pivot.add(brain);

let cols = 0;
let rows = 0;
let charW = 8;
let charH = 13;

window.addEventListener(
  "pointermove",
  (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  },
  { passive: true }
);

window.addEventListener("resize", resize, { passive: true });
resize();
requestAnimationFrame(tick);

async function loadBrain() {
  const gltf = await new GLTFLoader().loadAsync(BRAIN_MODEL_URL);
  const model = gltf.scene;
  const material = new THREE.MeshPhongMaterial({
    color: 0xe8e8e8,
    specular: 0x2c2c2c,
    shininess: 14,
  });

  model.traverse((node) => {
    if (node.isMesh) {
      node.material = material;
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const fitted = new THREE.Group();
  fitted.add(model);
  fitted.scale.setScalar(2.32 / Math.max(size.x, size.y, size.z));
  fitted.rotation.set(0.12, -1.05, 0.05);
  return fitted;
}

function measureGlyph() {
  const style = getComputedStyle(asciiEl);
  const fontSize = parseFloat(style.fontSize) || 13;
  const lineHeight =
    style.lineHeight === "normal" ? fontSize : parseFloat(style.lineHeight) || fontSize;
  metricsCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return {
    charW: Math.max(1, metricsCtx.measureText("M").width),
    charH: Math.max(1, lineHeight),
  };
}

function resize() {
  const glyph = measureGlyph();
  charW = glyph.charW;
  charH = glyph.charH;

  const width = asciiEl.clientWidth;
  const height = asciiEl.clientHeight;
  cols = Math.min(220, Math.max(48, Math.floor(width / charW)));
  rows = Math.min(120, Math.max(28, Math.floor(height / charH)));

  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  renderer.setSize(cols, rows, false);
  camera.aspect = (cols * charW) / (rows * charH);
  camera.updateProjectionMatrix();
}

function luminanceToChar(luma) {
  const contrasted = Math.min(1, Math.max(0, Math.pow(luma, 0.78) * 1.18));
  const index = Math.min(RAMP.length - 1, (contrasted * RAMP.length) | 0);
  return RAMP.charAt(index);
}

function asciify() {
  sampleCtx.clearRect(0, 0, cols, rows);
  sampleCtx.drawImage(renderer.domElement, 0, 0, cols, rows);
  const { data } = sampleCtx.getImageData(0, 0, cols, rows);
  const lines = new Array(rows);

  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < cols; x += 1) {
      const offset = (y * cols + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 18) {
        line += " ";
        continue;
      }
      const luma =
        (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) /
        255;
      line += luminanceToChar(luma);
    }
    lines[y] = line;
  }

  asciiEl.textContent = lines.join("\n");
}

function tick(time) {
  if (!reduceMotion) {
    damped.x += (pointer.x - damped.x) * FOLLOW;
    damped.y += (pointer.y - damped.y) * FOLLOW;
    const idle = time * 0.00045;
    pivot.rotation.y = damped.x * MAX_YAW + Math.sin(idle) * IDLE_YAW;
    pivot.rotation.x = damped.y * MAX_PITCH + Math.sin(idle * 0.85) * IDLE_PITCH;
    pivot.position.x = damped.x * 0.08;
    pivot.position.y = damped.y * -0.05;
  }

  renderer.render(scene, camera);
  asciify();
  requestAnimationFrame(tick);
}
