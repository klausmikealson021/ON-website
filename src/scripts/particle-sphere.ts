
import * as THREE from 'three';

const ROOT_SELECTOR = '[data-particle-sphere]';
const CANVAS_SELECTOR = '[data-particle-sphere-canvas]';
const FALLBACK_SELECTOR = '[data-particle-sphere-fallback]';

const SPHERE_RADIUS = 1.08;
const SHELL_RADIUS = 1.22;
const HALO_RADIUS = 1.50;

type ParticleLayer = {
  name: string;
  count: number;
  positions: Float32Array;
  size: number;
  opacity: number;
  palette: [number, number, number];
  rotationSpeed: number;
};

function getParticleCount(): number {
  const deviceMemory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  const cpuCores = navigator.hardwareConcurrency || 8;

  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (deviceMemory <= 4 || cpuCores <= 4) return 2500;
  if (isSmallScreen || hasCoarsePointer) return 5000;
  if (deviceMemory >= 8 && cpuCores >= 8) return 15000;

  return 10000;
}

function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create particle texture.');
  }

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createCentralGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create central glow texture.');
  }

  const gradient = context.createRadialGradient(
    128, 128, 0,
    128, 128, 128
  );

  gradient.addColorStop(0, 'rgba(130,105,255,0.42)');
  gradient.addColorStop(0.22, 'rgba(75,115,255,0.23)');
  gradient.addColorStop(0.48, 'rgba(30,190,255,0.10)');
  gradient.addColorStop(1, 'rgba(30,190,255,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createCorePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const y = 2 * Math.random() - 1;
    const angle = Math.random() * Math.PI * 2;

    const horizontalRadius = Math.sqrt(1 - y * y);
    const radius = Math.cbrt(Math.random()) * SPHERE_RADIUS;

    const index = i * 3;

    positions[index] = Math.cos(angle) * horizontalRadius * radius;
    positions[index + 1] = y * radius;
    positions[index + 2] = Math.sin(angle) * horizontalRadius * radius;
  }

  return positions;
}

function createShellPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * ((i + 0.5) / count);
    const horizontalRadius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * i;
    const radius = SHELL_RADIUS + (Math.random() - 0.5) * 0.07;

    const index = i * 3;

    positions[index] = Math.cos(angle) * horizontalRadius * radius;
    positions[index + 1] = y * radius;
    positions[index + 2] = Math.sin(angle) * horizontalRadius * radius;
  }

  return positions;
}

function createHaloPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * ((i + 0.5) / count);
    const horizontalRadius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * i;
    const radius = HALO_RADIUS + (Math.random() - 0.5) * 0.34;

    const index = i * 3;

    positions[index] = Math.cos(angle) * horizontalRadius * radius;
    positions[index + 1] = y * radius;
    positions[index + 2] = Math.sin(angle) * horizontalRadius * radius;
  }

  return positions;
}

function createParticleColors(
  positions: Float32Array,
  palette: [number, number, number]
): Float32Array {
  const count = positions.length / 3;
  const colors = new Float32Array(count * 3);

  const colorA = new THREE.Color(palette[0]);
  const colorB = new THREE.Color(palette[1]);
  const colorC = new THREE.Color(palette[2]);

  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const index = i * 3;

    const x = positions[index];
    const y = positions[index + 1];
    const z = positions[index + 2];

    const angle = Math.atan2(z, x);

    const variation =
      (Math.sin(angle * 2.5 + y * 4.0) + 1) * 0.5;

    const verticalBlend = THREE.MathUtils.clamp(
      (y / 1.6 + 1) * 0.5,
      0,
      1
    );

    const blend = THREE.MathUtils.clamp(
      variation * 0.65 + verticalBlend * 0.35,
      0,
      1
    );

    if (blend < 0.5) {
      tempColor.lerpColors(colorA, colorB, blend * 2);
    } else {
      tempColor.lerpColors(colorB, colorC, (blend - 0.5) * 2);
    }

    colors[index] = tempColor.r;
    colors[index + 1] = tempColor.g;
    colors[index + 2] = tempColor.b;
  }

  return colors;
}

function createParticleMaterial(
  opacity: number,
  interactionUniforms: {
    uInteractionPosition: { value: THREE.Vector3 };
    uInteractionStrength: { value: number };
    uInteractionRadius: { value: number };
    uInteractionMode: { value: number };
  }
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...interactionUniforms,
      uPixelRatio: {
        value: Math.min(window.devicePixelRatio || 1, 1.5),
      },
      uOpacity: {
        value: opacity,
      },
    },

    vertexShader: `
      attribute vec3 color;
attribute float aSize;

uniform float uPixelRatio;
uniform vec3 uInteractionPosition;
uniform float uInteractionStrength;
uniform float uInteractionRadius;
uniform float uInteractionMode;

varying vec3 vColor;
varying float vInteraction;

void main() {
  vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  vec3 toPointer = uInteractionPosition - worldPosition;
  float pointerDistance = length(toPointer);

  float influence = 1.0 - smoothstep(
    0.0,
    uInteractionRadius,
    pointerDistance
  );

  influence = pow(influence, 1.35);

  vec3 direction = pointerDistance > 0.0001
    ? toPointer / pointerDistance
    : vec3(0.0);

  // Positive mode attracts particles; negative mode repels them.
  float displacement = uInteractionStrength * influence * uInteractionMode;

  worldPosition += direction * displacement;

  // Add a subtle depth response around the interaction point.
  float depthResponse = influence * uInteractionStrength * 0.12;
  worldPosition.z += depthResponse * uInteractionMode;

  vInteraction = influence;
  vColor = color * (1.0 + influence * 0.85);

  vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);

  gl_PointSize =
    aSize *
    uPixelRatio *
    (1.0 + influence * 0.35) *
    (260.0 / max(1.0, -mvPosition.z));

  gl_Position = projectionMatrix * mvPosition;
}
    `,

    fragmentShader: `
      uniform float uOpacity;

varying vec3 vColor;
varying float vInteraction;

void main() {
  float distanceFromCenter =
    length(gl_PointCoord - vec2(0.5));

  float core = 1.0 - smoothstep(0.02, 0.19, distanceFromCenter);
  float glow = 1.0 - smoothstep(0.12, 0.50, distanceFromCenter);

  float interactionGlow = vInteraction * 0.35;

  float alpha =
    (core * 0.82 + glow * 0.28 + interactionGlow * glow)
    * uOpacity;

  if (alpha < 0.008) discard;

  vec3 finalColor =
    vColor * (1.0 + core * 0.65 + interactionGlow);

  gl_FragColor = vec4(finalColor, alpha);
}
    `,

    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createParticleLayer(
  parent: THREE.Group,
  layer: ParticleLayer,
  interactionUniforms: {
    uInteractionPosition: { value: THREE.Vector3 };
    uInteractionStrength: { value: number };
    uInteractionRadius: { value: number };
    uInteractionMode: { value: number };
  }
): void {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(layer.positions, 3)
  );

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      createParticleColors(layer.positions, layer.palette),
      3
    )
  );

  const sizes = new Float32Array(layer.count);

  for (let i = 0; i < layer.count; i++) {
    sizes[i] = layer.size * (0.65 + Math.random() * 0.8);
  }

  geometry.setAttribute(
    'aSize',
    new THREE.BufferAttribute(sizes, 1)
  );

  geometry.computeBoundingSphere();

  const material = createParticleMaterial(layer.opacity, interactionUniforms);
  const points = new THREE.Points(geometry, material);

  points.name = layer.name;

  parent.add(points);
}

function createCentralGlow(scene: THREE.Scene): THREE.Sprite {
  const texture = createCentralGlowTexture();

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const glow = new THREE.Sprite(material);

  glow.name = 'particle-central-glow';
  glow.scale.set(3.5, 3.5, 1);
  glow.position.set(0, 0, -0.5);
  glow.renderOrder = -1;

  scene.add(glow);

  return glow;
}

type TrailState = {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  ages: Float32Array;
  cursor: number;
  lastPoint: THREE.Vector3;
  hasLastPoint: boolean;
};


function createParticleTrail(scene: THREE.Scene): TrailState {
  const count = 42;
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const ages = new Float32Array(count);
  ages.fill(10);
  sizes.fill(0.045);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (260.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float core = 1.0 - smoothstep(0.02, 0.22, d);
        float halo = 1.0 - smoothstep(0.12, 0.5, d);
        float alpha = (core * 0.78 + halo * 0.34) * vAlpha;
        if (alpha < 0.006) discard;
        vec3 color = mix(vec3(0.16, 0.78, 1.0), vec3(0.68, 0.38, 1.0), 1.0 - vAlpha);
        gl_FragColor = vec4(color * 1.35, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'particle-interaction-trail';
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  return {
    geometry,
    positions,
    alphas,
    sizes,
    ages,
    cursor: 0,
    lastPoint: new THREE.Vector3(),
    hasLastPoint: false,
  };
}

function addTrailPoint(trail: TrailState, point: THREE.Vector3): void {
  if (trail.hasLastPoint && trail.lastPoint.distanceToSquared(point) < 0.0016) {
    return;
  }

  const index = trail.cursor;
  const offset = index * 3;

  trail.positions[offset] = point.x;
  trail.positions[offset + 1] = point.y;
  trail.positions[offset + 2] = point.z + 0.025;
  trail.ages[index] = 0;
  trail.alphas[index] = 1;
  trail.sizes[index] = 0.035 + Math.random() * 0.035;

  trail.cursor = (trail.cursor + 1) % trail.ages.length;
  trail.lastPoint.copy(point);
  trail.hasLastPoint = true;

  (trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  (trail.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  (trail.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
}

function initializeParticleSphere(root: HTMLElement): void {
  const canvas =
    root.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);

  const fallback =
    root.querySelector<HTMLElement>(FALLBACK_SELECTOR);

  if (!canvas) {
    console.error('[ParticleSphere] Canvas element was not found.');
    return;
  }

  let renderer: THREE.WebGLRenderer;

  try {
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });

    if (!context) {
      throw new Error('WebGL 2 is not supported by this browser.');
    }

    renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.error(
      '[ParticleSphere] Renderer initialization failed:',
      error
    );

    if (fallback) {
      fallback.hidden = false;
    }

    return;
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  // Pointer-driven particle field. Uniforms are shared by all three layers,
  // so one pointer update drives the entire field without per-particle CPU work.
  const interactionUniforms = {
    uInteractionPosition: { value: new THREE.Vector3(0, 0, 0) },
    uInteractionStrength: { value: 0 },
    uInteractionRadius: { value: 1.15 },
    uInteractionMode: { value: 1 }, // 1 = attract, -1 = repel
  };
  const interactionTarget = new THREE.Vector3(0, 0, 0);
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const interactionRaycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let interactionStrengthTarget = 0;
  let pointerSpeed = 0;
let pointerSpeedTarget = 0;

let lastInteractionPointerTime = 0;

const lastInteractionPointer = new THREE.Vector2();

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.5)
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const totalParticles = getParticleCount();

  const coreCount = Math.round(totalParticles * 0.6);
  const shellCount = Math.round(totalParticles * 0.3);
  const haloCount = totalParticles - coreCount - shellCount;

  // Each layer has its own group so it can rotate independently.
  const coreGroup = new THREE.Group();
  const shellGroup = new THREE.Group();
  const haloGroup = new THREE.Group();

  coreGroup.name = 'particle-core-group';
  shellGroup.name = 'particle-shell-group';
  haloGroup.name = 'particle-halo-group';

  scene.add(coreGroup, shellGroup, haloGroup);

  // Mouse tracking and drag interaction state.
  const mouseTarget = new THREE.Vector2(0, 0);
  const mouseCurrent = new THREE.Vector2(0, 0);
  const dragRotation = new THREE.Vector2(0, 0);
  const dragStart = new THREE.Vector2(0, 0);
  const dragVelocity = new THREE.Vector2(0, 0);
  let lastDragTime = 0;

  const mouseInfluence = 0.12;
  const mouseSmoothing = 0.045;
  const dragSensitivity = 0.006;
  const maxDragTilt = 0.65;
  const maxInertiaSpeed = 3.2;
  const inertiaDamping = 4.2;

  let isDragging = false;
  let activePointerId: number | null = null;

  // Store the autonomous rotation separately so pointer movement never
  // accumulates into an uncontrolled rotation drift.
  let coreRotationY = 0;
  let shellRotationY = 0;
  let haloRotationY = 0;

  const glow = createCentralGlow(scene);

  const trail = createParticleTrail(scene);

  const layers: ParticleLayer[] = [
    {
      name: 'particle-core',
      count: coreCount,
      positions: createCorePositions(coreCount),
      size: 0.038,
      opacity: 0.78,
      palette: [0x252c80, 0x6554d9, 0x91baff],
      rotationSpeed: 0.055,
    },
    {
      name: 'particle-shell',
      count: shellCount,
      positions: createShellPositions(shellCount),
      size: 0.046,
      opacity: 0.95,
      palette: [0x536eff, 0x83e8ff, 0xc3a6ff],
      rotationSpeed: -0.035,
    },
    {
      name: 'particle-halo',
      count: haloCount,
      positions: createHaloPositions(haloCount),
      size: 0.043,
      opacity: 0.72,
      palette: [0x26b9dc, 0x688aff, 0xb16cff],
      rotationSpeed: 0.075,
    },
  ];

  createParticleLayer(coreGroup, layers[0], interactionUniforms);
  createParticleLayer(shellGroup, layers[1], interactionUniforms);
  createParticleLayer(haloGroup, layers[2], interactionUniforms);

  const reducedMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  let isInViewport = false;
  let isPageVisible = !document.hidden;
  let isContextLost = false;
  let animationFrameId = 0;
  let elapsedTime = 0;
  let previousTime = 0;

  function updateInteractionFromPointer(event: PointerEvent): void {
  const rect = root.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  const now = event.timeStamp;

  if (lastInteractionPointerTime > 0) {
    const elapsed = Math.max(
      (now - lastInteractionPointerTime) / 1000,
      1 / 120
    );

    const distance = Math.hypot(
      event.clientX - lastInteractionPointer.x,
      event.clientY - lastInteractionPointer.y
    );

    const normalizedSpeed =
      distance / Math.max(rect.width, rect.height) / elapsed;

    pointerSpeedTarget = THREE.MathUtils.clamp(
      normalizedSpeed / 2.5,
      0,
      1
    );
  }

  lastInteractionPointer.set(event.clientX, event.clientY);
  lastInteractionPointerTime = now;

  pointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  );

  interactionRaycaster.setFromCamera(pointerNdc, camera);

  interactionRaycaster.ray.intersectPlane(
    interactionPlane,
    interactionTarget
  );

  const isRepelling = isDragging;

  interactionUniforms.uInteractionMode.value =
    isRepelling ? -1 : 1;

  interactionUniforms.uInteractionRadius.value =
    isRepelling ? 1.4 : 1.15;

  const baseStrength = isRepelling ? 0.82 : 0.58;
  const speedBoost = pointerSpeedTarget * 0.22;

  interactionStrengthTarget = baseStrength + speedBoost;

  addTrailPoint(trail, interactionTarget);
}
  function handlePointerDown(event: PointerEvent): void {
    // Drag is intentionally limited to the primary mouse button.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    event.preventDefault();

    isDragging = true;
    activePointerId = event.pointerId;
    dragStart.set(event.clientX, event.clientY);
    dragVelocity.set(0, 0);
    lastDragTime = event.timeStamp;
    mouseTarget.set(0, 0);
    updateInteractionFromPointer(event);
    root.style.cursor = 'grabbing';

    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Window-level pointer listeners below still allow the drag to finish.
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;

    updateInteractionFromPointer(event);

    if (isDragging && event.pointerId === activePointerId) {
      event.preventDefault();

      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      const now = event.timeStamp;
      const elapsed = Math.max((now - lastDragTime) / 1000, 1 / 120);

      dragStart.set(event.clientX, event.clientY);
      lastDragTime = now;

      const rotationDeltaY = deltaX * dragSensitivity;
      const rotationDeltaX = deltaY * dragSensitivity;

      dragRotation.y += rotationDeltaY;
      dragRotation.x = THREE.MathUtils.clamp(
        dragRotation.x + rotationDeltaX,
        -maxDragTilt,
        maxDragTilt
      );

      // Estimate angular velocity from the latest pointer movement.
      dragVelocity.y = THREE.MathUtils.clamp(
        (rotationDeltaY / elapsed) * 0.72,
        -maxInertiaSpeed,
        maxInertiaSpeed
      );

      dragVelocity.x = THREE.MathUtils.clamp(
        (rotationDeltaX / elapsed) * 0.72,
        -maxInertiaSpeed,
        maxInertiaSpeed
      );

      return;
    }

    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    mouseTarget.x = THREE.MathUtils.clamp((x - 0.5) * 2, -1, 1);
    mouseTarget.y = THREE.MathUtils.clamp((y - 0.5) * 2, -1, 1);
  }

  function finishDrag(event?: PointerEvent): void {
    if (!isDragging) return;
    if (event && activePointerId !== null && event.pointerId !== activePointerId) return;

    const pointerId = activePointerId;
    isDragging = false;
    lastDragTime = 0;
    activePointerId = null;
    interactionUniforms.uInteractionMode.value = 1;
    root.style.cursor = '';

    if (pointerId !== null && root.hasPointerCapture(pointerId)) {
      root.releasePointerCapture(pointerId);
    }
  }

  function handlePointerLeave(): void {
    if (!isDragging) {
      mouseTarget.set(0, 0);
      interactionStrengthTarget = 0;
      trail.hasLastPoint = false;
    }
  }

  root.addEventListener('pointerdown', handlePointerDown);
  root.addEventListener('pointermove', handlePointerMove);
  root.addEventListener('pointerup', finishDrag);
  root.addEventListener('pointercancel', finishDrag);
  root.addEventListener('lostpointercapture', finishDrag);
  root.addEventListener('pointerleave', handlePointerLeave);
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  function render(): void {
    renderer.render(scene, camera);
  }

  function resize(): void {
    const width = root.clientWidth;
    const height = root.clientHeight;

    if (width <= 0 || height <= 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
    render();
  }

  function stopAnimation(): void {
    if (animationFrameId !== 0) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    }

    previousTime = 0;
  }

  function animate(now: number): void {
    animationFrameId = 0;

    if (
      !isInViewport ||
      !isPageVisible ||
      isContextLost ||
      reducedMotionQuery.matches
    ) {
      return;
    }

    if (previousTime === 0) {
      previousTime = now;
    }

    const delta = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    elapsedTime += delta;
    pointerSpeed = THREE.MathUtils.damp(
  pointerSpeed,
  pointerSpeedTarget,
  6,
  delta
);

pointerSpeedTarget = THREE.MathUtils.damp(
  pointerSpeedTarget,
  0,
  3,
  delta
);

    // Smoothly blend the GPU interaction field to avoid abrupt particle jumps.
    const interactionStrength = interactionUniforms.uInteractionStrength;
    interactionStrength.value = THREE.MathUtils.damp(
      interactionStrength.value,
      interactionStrengthTarget,
      8,
      delta
    );
    interactionUniforms.uInteractionPosition.value.lerp(interactionTarget, 1 - Math.exp(-12 * delta));


    // Age the small, fixed-size trail on the CPU; particle deformation remains GPU-based.
    const trailLifetime = 0.72;
    for (let i = 0; i < trail.ages.length; i++) {
      trail.ages[i] += delta;
      const life = THREE.MathUtils.clamp(1 - trail.ages[i] / trailLifetime, 0, 1);
      trail.alphas[i] = life * life;
    }
    (trail.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;

    // Smooth hover tracking, unless the user is actively dragging.
    if (!isDragging) {
      mouseCurrent.lerp(mouseTarget, mouseSmoothing);

      // Continue the drag rotation briefly after release, then ease it out.
      if (Math.abs(dragVelocity.x) > 0.001 || Math.abs(dragVelocity.y) > 0.001) {
        dragRotation.y += dragVelocity.y * delta;

        const nextTilt = dragRotation.x + dragVelocity.x * delta;
        dragRotation.x = THREE.MathUtils.clamp(
          nextTilt,
          -maxDragTilt,
          maxDragTilt
        );

        if (dragRotation.x !== nextTilt) {
          dragVelocity.x = 0;
        }

        const damping = Math.exp(-inertiaDamping * delta);
        dragVelocity.multiplyScalar(damping);

        if (Math.abs(dragVelocity.x) <= 0.001) dragVelocity.x = 0;
        if (Math.abs(dragVelocity.y) <= 0.001) dragVelocity.y = 0;
      }
    }

    const mouseTiltX = mouseCurrent.y * mouseInfluence;
    const mouseTiltY = mouseCurrent.x * mouseInfluence;

    // Autonomous rotation remains independent from pointer interaction.
    coreRotationY += layers[0].rotationSpeed * delta;
    shellRotationY += layers[1].rotationSpeed * delta;
    haloRotationY += layers[2].rotationSpeed * delta;

    coreGroup.rotation.y = coreRotationY + dragRotation.y + mouseTiltY;
    shellGroup.rotation.y =
      shellRotationY + dragRotation.y * 0.92 + mouseTiltY * 0.85;
    haloGroup.rotation.y =
      haloRotationY + dragRotation.y * 1.08 + mouseTiltY * 1.15;

    // Drag and its inertia add a direct tilt while hover adds a smaller responsive tilt.
    coreGroup.rotation.x =
      Math.sin(elapsedTime * 0.18) * 0.035 + dragRotation.x - mouseTiltX;

    shellGroup.rotation.x =
      Math.sin(elapsedTime * 0.13 + 1) * 0.055 +
      dragRotation.x * 0.92 - mouseTiltX * 0.8;

    haloGroup.rotation.x =
      Math.sin(elapsedTime * 0.22 + 2) * 0.075 +
      dragRotation.x * 1.08 - mouseTiltX * 1.2;

    coreGroup.rotation.z = Math.sin(elapsedTime * 0.12) * 0.025;
    shellGroup.rotation.z = Math.sin(elapsedTime * 0.10 + 1) * 0.035;
    haloGroup.rotation.z = Math.sin(elapsedTime * 0.16 + 2) * 0.045;

    // Gentle central glow pulse.
    const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 0.8);

    const glowMaterial = glow.material as THREE.SpriteMaterial;

    glowMaterial.opacity = 0.72 + pulse * 0.20;
// Move the central glow gently toward the mouse.
    glow.position.x = mouseCurrent.x * 0.22;
    glow.position.y = -mouseCurrent.y * 0.22;
    const glowScale = 3.35 + pulse * 0.18;
    glow.scale.set(glowScale, glowScale, 1);

    render();

    animationFrameId = requestAnimationFrame(animate);
  }

  function startAnimation(): void {
    if (
      animationFrameId !== 0 ||
      !isInViewport ||
      !isPageVisible ||
      isContextLost ||
      reducedMotionQuery.matches
    ) {
      return;
    }

    previousTime = 0;

    animationFrameId = requestAnimationFrame(animate);
  }

  function updateAnimationState(): void {
    if (
      isInViewport &&
      isPageVisible &&
      !isContextLost &&
      !reducedMotionQuery.matches
    ) {
      startAnimation();
    } else {
      stopAnimation();
      render();
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === root) {
          isInViewport = entry.isIntersecting;
          updateAnimationState();
        }
      }
    },
    {
      threshold: 0.05,
    }
  );

  intersectionObserver.observe(root);

  const handleVisibilityChange = (): void => {
    isPageVisible = !document.hidden;
    updateAnimationState();
  };

  const handleMotionPreferenceChange = (): void => {
    updateAnimationState();
  };

  const handleContextLost = (event: Event): void => {
    event.preventDefault();

    isContextLost = true;
    stopAnimation();

    console.warn('[ParticleSphere] WebGL context was lost.');
  };

  const handleContextRestored = (): void => {
    isContextLost = false;

    resize();
    updateAnimationState();

    console.info('[ParticleSphere] WebGL context was restored.');
  };

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  );

  reducedMotionQuery.addEventListener(
    'change',
    handleMotionPreferenceChange
  );

  canvas.addEventListener(
    'webglcontextlost',
    handleContextLost
  );

  canvas.addEventListener(
    'webglcontextrestored',
    handleContextRestored
  );

  resize();

  if (fallback) {
    fallback.hidden = true;
  }

  console.info('[ParticleSphere] Galactic appearance initialized.');

  console.info('[ParticleSphere] Particle geometry initialized.', {
    total: totalParticles,
    core: coreCount,
    shell: shellCount,
    halo: haloCount,
  });

  console.info('[ParticleSphere] Independent animation initialized.');
  console.info('[ParticleSphere] GPU particle attraction/repulsion initialized.');
  console.info('[ParticleSphere] Particle trail and enhanced GPU interaction initialized.');

  console.info('[ParticleSphere] WebGL 2 renderer initialized.');

  updateAnimationState();

  // Keep lifecycle references available for future cleanup work.
  void resizeObserver;
  void intersectionObserver;
}

function startParticleSpheres(): void {
  const roots =
    document.querySelectorAll<HTMLElement>(ROOT_SELECTOR);

  roots.forEach((root) => {
    if (root.dataset.initialized === 'true') return;

    root.dataset.initialized = 'true';
    initializeParticleSphere(root);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startParticleSpheres,
    { once: true }
  );
} else {
  startParticleSpheres();
}
