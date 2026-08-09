import * as THREE from 'three';

// Owns the Three.js renderer/scene and the stereo render path:
//
//   scene -> render target (left half, right half) -> barrel-distortion
//   pass -> canvas
//
// The distortion pass exists because headset lenses pincushion whatever is
// on the screen, bowing straight lines outward. Pre-warping the image with
// the inverse (barrel) distortion means the two cancel and the world looks
// rectilinear through the glass.
//
// IPD is a prototype-only constant; expose it here so it is trivial to
// wire up to a calibration UI later without touching rendering logic.
export const DEFAULT_IPD_METERS = 0.063;

// Distance between the headset's two lens centres. The rendered image
// centres must land on these, not on the centres of the screen halves.
export const DEFAULT_LENS_SEPARATION_METERS = 0.063;

// Browsers expose no physical screen size, so density has to be assumed.
// ~420ppi is typical of a modern phone; the error this leaves is exactly
// why lens separation is user-adjustable at runtime.
const ASSUMED_SCREEN_PPI = 420;

// Radial distortion coefficients at strength 1.0, for a radius normalised
// so r = 1 at the furthest corner.
//
// The ratio between them matters as much as their size: k1 acts across the
// mid-field while k2 concentrates at the periphery. A k1-heavy profile
// curves the middle of the image — the world starts to feel like a sheet
// wrapped round a sphere — while still under-correcting the edges. Stock
// Cardboard v2 (k1 0.34, k2 0.55 in tan-angle units) works out near k1 ==
// k2 ~ 0.22 in these units, so strength ~2.4 reproduces that profile.
const BASE_K1 = 0.09;
const BASE_K2 = 0.093;

// Widening the frustum for warp margin costs centre resolution, since the
// same pixels now cover a wider field. Rendering above screen resolution
// buys it back; capped because the cost is quadratic.
const MAX_SUPERSAMPLE = 1.5;

const DISTORTION_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Samples the rendered eye image at a radially expanded offset, which
// squeezes the periphery inward — the barrel pre-warp. Tone mapping and
// colour-space conversion happen here because three.js only applies them
// when drawing to the canvas, and the scene now lands in a render target.
// This runs once per output pixel across the whole canvas, so everything
// that is constant for a frame is folded into uniforms on the CPU. The
// radius normalisation is carried in uNormScale, and the 1/fMax that used
// to be a per-fragment divide is premultiplied into the coefficients —
// algebraically identical, but it removes a division from every pixel.
// Both eye centres share y = 0.5, so only x needs interpolating.
const DISTORTION_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uCenterX;
  uniform vec2 uNormScale;
  uniform float uInvFMax;
  uniform float uK1n;
  uniform float uK2n;
  varying vec2 vUv;

  void main() {
    float eye = step(0.5, vUv.x);
    vec2 local = vec2((vUv.x - eye * 0.5) * 2.0, vUv.y);

    // The widened render keeps its optical axis at the same place as the
    // screen's lens centre, so one centre serves for both.
    vec2 center = vec2(mix(uCenterX.x, uCenterX.y, eye), 0.5);

    vec2 offset = local - center;
    vec2 normalised = offset * uNormScale;
    float r2 = dot(normalised, normalised);
    float scale = uInvFMax + uK1n * r2 + uK2n * r2 * r2;

    vec2 sourceLocal = center + offset * scale;

    // Branchless: the warp reaches the render target's edge exactly, so
    // only floating-point overshoot at the extreme corners falls outside.
    // Masking beats branching around a texture fetch, which would make
    // neighbouring pixels at the edge diverge.
    vec2 clamped = clamp(sourceLocal, 0.0, 1.0);
    float inside = step(0.0, sourceLocal.x) * step(sourceLocal.x, 1.0)
                 * step(0.0, sourceLocal.y) * step(sourceLocal.y, 1.0);

    vec2 sourceUv = vec2(clamped.x * 0.5 + eye * 0.5, clamped.y);

    gl_FragColor = texture2D(tDiffuse, sourceUv) * inside;
    gl_FragColor.a = 1.0;

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class StereoRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new THREE.Group();

  private readonly leftCamera: THREE.PerspectiveCamera;
  private readonly rightCamera: THREE.PerspectiveCamera;
  private ipd = DEFAULT_IPD_METERS;
  private lensSeparation = DEFAULT_LENS_SEPARATION_METERS;
  private distortionStrength = 1;
  private fieldOfView = 75;
  private lastWidth = 0;
  private lastHeight = 0;
  private readonly sizeScratch = new THREE.Vector2();

  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly distortionScene = new THREE.Scene();
  private readonly distortionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly distortionMaterial: THREE.ShaderMaterial;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Real shadow maps, rendered twice per frame (once per eye) — a
    // deliberate perf trade for visual realism on this build.
    this.renderer.shadowMap.enabled = true;
    // Point-light shadows sample a 9-tap kernel under PCF and PCFSoft
    // alike, and a single tap under Basic. Since only one of the nine
    // downlights casts at all, its shadow is already faint enough that the
    // softening barely registers: swapping to Basic measured a peak
    // difference of 15/255 across 0.02% of pixels, while removing eight
    // dependent texture fetches from every shadow-receiving fragment —
    // the floor included.
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    // Shadow maps are re-rendered inside every renderer.render() call, so
    // stereo pays for them twice per frame even though they are entirely
    // view-independent. The scene is also completely static — only the
    // camera moves — so they are rendered once and reused. Measured at 224
    // of 380 draw calls per frame, for pixel-identical output.
    this.renderer.shadowMap.autoUpdate = false;
    // Filmic tone mapping + a correct sRGB output pipeline. This is the
    // single largest "photographic vs. CG" difference available without
    // post-processing: it rolls off bright emissives instead of clipping
    // them to flat white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Half float keeps the dark night scene free of banding, since the
    // scene no longer writes straight to the 8-bit canvas. MSAA has to be
    // requested explicitly (the canvas antialias flag does not cover render
    // targets) but stays at 2x: supersampling already antialiases, and on a
    // phone the bandwidth of 4x on a half-float target costs more than it
    // returns.
    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 2,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });

    this.distortionMaterial = new THREE.ShaderMaterial({
      vertexShader: DISTORTION_VERTEX,
      fragmentShader: DISTORTION_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uCenterX: { value: new THREE.Vector2(0.5, 0.5) },
        uNormScale: { value: new THREE.Vector2(1, 1) },
        uInvFMax: { value: 1 },
        uK1n: { value: 0 },
        uK2n: { value: 0 },
      },
    });
    this.distortionScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.distortionMaterial));

    // Far plane must clear the city (~330m out). Near stays at 0.1 rather
    // than 0.05 to keep enough depth precision across that larger range.
    this.leftCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.rightCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.rig.add(this.leftCamera, this.rightCamera);
    this.rig.position.set(0, 1.6, 0); // average standing eye height, room center
    this.scene.add(this.rig);

    this.setIPD(this.ipd);
  }

  setIPD(meters: number): void {
    this.ipd = meters;
    this.leftCamera.position.x = -meters / 2;
    this.rightCamera.position.x = meters / 2;
  }

  getIPD(): number {
    return this.ipd;
  }

  resize(width: number, height: number): void {
    // Layout can transiently report a zero dimension mid fullscreen/
    // orientation transition; a NaN/Infinity aspect would otherwise poison
    // the projection matrix and render nothing until the next valid resize.
    if (width <= 0 || height <= 0) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.renderer.setSize(width, height, false);

    const halfAspect = width / 2 / height;
    this.leftCamera.aspect = halfAspect;
    this.rightCamera.aspect = halfAspect;
    this.applyEyeProjections();
  }

  setLensSeparation(meters: number): void {
    this.lensSeparation = Math.min(0.085, Math.max(0.045, meters));
    this.applyEyeProjections();
  }

  getLensSeparation(): number {
    return this.lensSeparation;
  }

  // 0 disables the warp entirely, which is the escape hatch if a given
  // headset's lenses need none.
  setDistortionStrength(strength: number): void {
    this.distortionStrength = Math.min(3, Math.max(0, strength));
    this.applyEyeProjections();
  }

  getDistortionStrength(): number {
    return this.distortionStrength;
  }

  // Rendered field of view has to match what the lenses actually present,
  // or the world swims as you turn: too narrow a render stretched across a
  // wider optical field makes flat walls bulge and corners round off. The
  // true value depends on lens magnification and eye relief, which the
  // browser cannot know, so it is dialled in by eye.
  setFieldOfView(degrees: number): void {
    this.fieldOfView = Math.min(105, Math.max(45, degrees));
    this.applyEyeProjections();
  }

  getFieldOfView(): number {
    return this.fieldOfView;
  }

  // Rebuilds both eye frusta and every uniform the distortion pass depends
  // on. These are computed together because the widened field of view, the
  // off-axis term and the sampling centres are all functions of each other.
  private applyEyeProjections(): void {
    if (this.lastWidth <= 0 || this.lastHeight <= 0) return;

    const k1 = BASE_K1 * this.distortionStrength;
    const k2 = BASE_K2 * this.distortionStrength;

    // Shift, in NDC, that puts each eye's optical centre on its lens centre.
    const physicalWidth = (this.lastWidth * (window.devicePixelRatio || 1) / ASSUMED_SCREEN_PPI) * 0.0254;
    const halfViewportWidth = physicalWidth / 4;
    const ndcShift = halfViewportWidth > 0
      ? (halfViewportWidth - this.lensSeparation / 2) / halfViewportWidth
      : 0;

    const screenCenterLeftX = (1 + ndcShift) / 2;
    const screenCenterRightX = (1 - ndcShift) / 2;

    // Aspect of a single eye's viewport, used so the distortion radius is
    // isotropic in physical pixels rather than in UV space.
    const aspect = this.lastWidth / 2 / this.lastHeight;

    // The warp pulls the periphery inward, so the render must cover more
    // than the screen does or the edges would come back black. Size that
    // margin from the furthest corner, which is the worst case.
    let maxR2 = 0;
    for (const [cornerX, cornerY] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const dx = (cornerX - screenCenterLeftX) * 2 * aspect;
      const dy = (cornerY - 0.5) * 2;
      maxR2 = Math.max(maxR2, dx * dx + dy * dy);
    }
    // With the radius normalised to that corner, the worst-case expansion
    // is simply f(1) — about 19% at full strength, rather than something
    // that balloons with the aspect ratio.
    const fMax = 1 + k1 + k2;

    // The warp magnifies the centre by exactly fMax, so rendering fMax
    // larger restores one rendered texel per screen pixel there. Without
    // this, turning the warp up visibly softens the image.
    const supersample = Math.min(fMax, MAX_SUPERSAMPLE);
    const pixelRatio = this.renderer.getPixelRatio();
    this.renderTarget.setSize(
      Math.floor(this.lastWidth * pixelRatio * supersample),
      Math.floor(this.lastHeight * pixelRatio * supersample),
    );

    this.leftCamera.fov = this.fieldOfView;
    this.rightCamera.fov = this.fieldOfView;
    this.leftCamera.updateProjectionMatrix();
    this.rightCamera.updateProjectionMatrix();

    // Widening the frustum scales the focal terms down. The off-axis term
    // is deliberately left alone: scaling it too would drag the optical
    // axis toward the middle and shrink the margin on the far side, which
    // is exactly where the warp reaches furthest. Holding the axis fixed
    // makes both edges land exactly on the render target's edges.
    for (const camera of [this.leftCamera, this.rightCamera]) {
      const sign = camera === this.leftCamera ? -1 : 1;
      const elements = camera.projectionMatrix.elements;
      elements[0] /= fMax;
      elements[5] /= fMax;
      elements[8] = sign * ndcShift;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }

    // Fold the radius normalisation into the scale applied to the offset,
    // so the shader's dot product yields r^2 directly, and premultiply
    // 1/fMax into the coefficients to retire the per-fragment divide.
    const uniforms = this.distortionMaterial.uniforms;
    const invFMax = 1 / fMax;
    const normalise = maxR2 > 0 ? 1 / Math.sqrt(maxR2) : 1;
    uniforms.uNormScale.value.set(2 * aspect * normalise, 2 * normalise);
    uniforms.uInvFMax.value = invFMax;
    uniforms.uK1n.value = k1 * invFMax;
    uniforms.uK2n.value = k2 * invFMax;
    uniforms.uCenterX.value.set(screenCenterLeftX, screenCenterRightX);
  }

  // Re-renders the shadow maps on the next frame. Must be called once the
  // scene's lights and casters exist, and again if anything that casts or
  // receives a shadow ever moves.
  requestShadowUpdate(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  setRigQuaternion(quaternion: THREE.Quaternion): void {
    this.rig.quaternion.copy(quaternion);
  }

  renderStereoFrame(): void {
    this.renderer.getSize(this.sizeScratch);
    const width = this.sizeScratch.x;
    const height = this.sizeScratch.y;
    if (width <= 0 || height <= 0) return;

    const targetWidth = this.renderTarget.width;
    const targetHeight = this.renderTarget.height;
    const halfTarget = Math.floor(targetWidth / 2);

    // Render-target viewports come from the target itself, in its own
    // pixels — renderer.setViewport only applies when drawing to the canvas.
    this.renderTarget.scissorTest = true;

    this.renderTarget.viewport.set(0, 0, halfTarget, targetHeight);
    this.renderTarget.scissor.set(0, 0, halfTarget, targetHeight);
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.leftCamera);

    this.renderTarget.viewport.set(halfTarget, 0, targetWidth - halfTarget, targetHeight);
    this.renderTarget.scissor.set(halfTarget, 0, targetWidth - halfTarget, targetHeight);
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.rightCamera);

    this.renderTarget.scissorTest = false;
    this.renderer.setRenderTarget(null);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.render(this.distortionScene, this.distortionCamera);
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.distortionMaterial.dispose();
    this.renderer.dispose();
  }
}
