import * as THREE from "three";

const RAMP = " .:-=+*#%@";
const MAX_YAW = 0.42;
const MAX_PITCH = 0.28;
const FOLLOW = 0.085;
const IDLE_YAW = 0.04;
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
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
camera.position.set(0, 0, 3.15);

const pivot = new THREE.Group();
scene.add(pivot);

const texture = await new THREE.TextureLoader().loadAsync("static/img/brain.png");
texture.colorSpace = THREE.SRGBColorSpace;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.anisotropy = 4;

const imageAspect = texture.image.width / Math.max(1, texture.image.height);
const planeHeight = 2.08;
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(planeHeight * imageAspect, planeHeight),
  new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
);
pivot.add(plane);

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
  const contrasted = Math.min(1, Math.max(0, Math.pow(luma, 0.72) * 1.12));
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
      if (alpha < 24) {
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
    pivot.position.x = damped.x * 0.1;
    pivot.position.y = damped.y * -0.06;
  }

  renderer.render(scene, camera);
  asciify();
  requestAnimationFrame(tick);
}
