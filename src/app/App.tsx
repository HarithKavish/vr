import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { detectCapabilities, type VRCapabilities } from '../vr/VRCapabilities';
import { enterVRSession, exitVRSession, currentOrientation, isFullscreenActive } from '../vr/VRSession';
import { FallbackMotion } from '../vr/FallbackMotion';
import { Calibration } from '../vr/Calibration';
import { StereoRenderer } from '../vr/StereoRenderer';
import { buildEnvironment } from '../environment/BasicEnvironment';
import { VRInterface } from '../vr/VRInterface';
import { LandingScreen } from '../ui/LandingScreen';

type Phase = 'landing' | 'starting' | 'active';

// Longest pause allowed between taps still counted as one gesture. Generous,
// because a headset lever is a clumsier input than a fingertip.
const TRIPLE_TAP_GAP_MS = 800;

export function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('landing');
  const [caps, setCaps] = useState<VRCapabilities | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stereoRendererRef = useRef<StereoRenderer | null>(null);
  const fallbackMotionRef = useRef<FallbackMotion | null>(null);
  const vrInterfaceRef = useRef<VRInterface | null>(null);
  const calibrationRef = useRef(new Calibration());
  const fpsRef = useRef({ frames: 0, lastSample: performance.now() });
  const tapTimesRef = useRef<number[]>([]);
  // Diagnostics live in a ref, not React state: they refresh twice a second
  // and now render into the scene, so routing them through React would only
  // re-render the tree for nothing.
  const statsRef = useRef({ fps: 0 });

  useEffect(() => {
    detectCapabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  const stopEverything = useCallback(() => {
    fallbackMotionRef.current?.stop();
    setPhase('landing');
  }, []);

  const handleEnterVR = useCallback(async () => {
    if (!caps || !containerRef.current || !canvasRef.current) return;

    setPhase('starting');
    setErrorMessage(null);

    try {
      const sessionResult = await enterVRSession(containerRef.current);
      if (sessionResult.warnings.length > 0) {
        setErrorMessage(sessionResult.warnings.map((w) => w.message).join(' '));
      }

      if (!stereoRendererRef.current) {
        const renderer = new StereoRenderer(canvasRef.current);
        buildEnvironment(renderer.scene, renderer.renderer);
        stereoRendererRef.current = renderer;

        // All controls live in the scene so they render through the same
        // stereo path as the room and appear properly in both eyes.
        const ui = new VRInterface([
          { id: 'center', label: 'CENTER', row: 0, onSelect: () => handleCenterView() },
          { id: 'info', label: 'INFO', row: 0, onSelect: () => ui.setInfoVisible(!ui.isInfoVisible()) },
          { id: 'exit', label: 'EXIT', row: 0, onSelect: () => void handleExitVR() },
          { id: 'eye-minus', label: 'EYE −', row: 1, onSelect: () => adjustLensSeparation(-2) },
          { id: 'eye-plus', label: 'EYE +', row: 1, onSelect: () => adjustLensSeparation(2) },
          { id: 'warp-minus', label: 'WARP −', row: 1, onSelect: () => adjustDistortion(-0.15) },
          { id: 'warp-plus', label: 'WARP +', row: 1, onSelect: () => adjustDistortion(0.15) },
        ]);
        ui.attachReticle(renderer.rig);
        renderer.scene.add(ui.group);
        vrInterfaceRef.current = ui;
      }
      const stereoRenderer = stereoRendererRef.current;
      stereoRenderer.resize(window.innerWidth, window.innerHeight);
      calibrationRef.current.reset();

      // Fullscreen/orientation-lock transitions above often settle a beat
      // after their promises resolve, so re-measure a couple of frames out
      // to catch dimensions that hadn't landed yet on the first resize.
      requestAnimationFrame(() => {
        stereoRendererRef.current?.resize(window.innerWidth, window.innerHeight);
        requestAnimationFrame(() => {
          stereoRendererRef.current?.resize(window.innerWidth, window.innerHeight);
        });
      });

      // Tracking uses DeviceOrientation exclusively this phase. WebXR's
      // immersive-vr path requires a paired headset runtime most phones
      // don't have (isSessionSupported can report true with nothing behind
      // it), and driving an 'inline' session on the same WebGL context as
      // our own manual rendering risks undefined browser behavior. caps.*
      // WebXR fields remain purely informational in the diagnostics/status UI.
      if (caps.deviceOrientationNeedsPermission) {
        const granted = await FallbackMotion.requestPermission();
        if (!granted) {
          setErrorMessage('Motion permission denied. Enable motion/sensor access for this website and try again.');
          setPhase('landing');
          return;
        }
      }
      const motion = new FallbackMotion();
      motion.start();
      fallbackMotionRef.current = motion;

      startRenderLoop(stereoRenderer);
      refreshInfoPanel();
      setPhase('active');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start VR session.';
      setErrorMessage(message);
      setPhase('landing');
    }
  }, [caps, stopEverything]);

  const startRenderLoop = (stereoRenderer: StereoRenderer) => {
    const tmpQuat = new THREE.Quaternion();
    const calibratedQuat = new THREE.Quaternion();

    stereoRenderer.renderer.setAnimationLoop(() => {
      const motion = fallbackMotionRef.current;
      if (motion) {
        motion.getQuaternion(tmpQuat);
        calibrationRef.current.apply(tmpQuat, calibratedQuat);
        stereoRenderer.setRigQuaternion(calibratedQuat);
      }

      // Gaze pointing has to resolve before drawing so the reticle and any
      // hover highlight land in the same frame the user is looking at.
      vrInterfaceRef.current?.update(stereoRenderer.rig);
      stereoRenderer.renderStereoFrame();

      const fps = fpsRef.current;
      fps.frames += 1;
      const now = performance.now();
      if (now - fps.lastSample >= 500) {
        statsRef.current.fps = Math.round((fps.frames * 1000) / (now - fps.lastSample));
        fps.frames = 0;
        fps.lastSample = now;
        refreshInfoPanel();
      }
    });
  };

  const refreshInfoPanel = useCallback(() => {
    const ui = vrInterfaceRef.current;
    const renderer = stereoRendererRef.current;
    if (!ui || !renderer) return;
    ui.setInfoLines([
      `FPS        ${statsRef.current.fps}`,
      `Fullscreen ${isFullscreenActive() ? 'yes' : 'no'}`,
      `Orient     ${currentOrientation()}`,
      `Tracking   ${fallbackMotionRef.current?.isReceivingData() ? 'active' : 'idle'}`,
      `Eye sep    ${(renderer.getLensSeparation() * 1000).toFixed(0)}mm`,
      `Warp       ${renderer.getDistortionStrength().toFixed(2)}`,
      '',
      'Tap x3 off-menu to recentre',
    ]);
  }, []);

  // Nudges the two images together or apart until they fuse. The correct
  // value depends on the headset's lens spacing and on the phone's true
  // pixel density, neither of which the browser can report, so this has to
  // be adjustable by the person actually looking through the lenses.
  const adjustLensSeparation = useCallback((deltaMm: number) => {
    const renderer = stereoRendererRef.current;
    if (!renderer) return;
    renderer.setLensSeparation(renderer.getLensSeparation() + deltaMm / 1000);
    refreshInfoPanel();
  }, [refreshInfoPanel]);

  // Lens pincushion varies by headset, so the amount of counter-warp does
  // too. 0 turns it off entirely for lenses that need none.
  const adjustDistortion = useCallback((delta: number) => {
    const renderer = stereoRendererRef.current;
    if (!renderer) return;
    renderer.setDistortionStrength(renderer.getDistortionStrength() + delta);
    refreshInfoPanel();
  }, [refreshInfoPanel]);

  const handleCenterView = useCallback(() => {
    const motion = fallbackMotionRef.current;
    if (!motion) return;
    const q = new THREE.Quaternion();
    motion.getQuaternion(q);
    calibrationRef.current.center(q);
  }, []);

  const handleExitVR = useCallback(async () => {
    stereoRendererRef.current?.renderer.setAnimationLoop(null);
    fallbackMotionRef.current?.stop();
    fallbackMotionRef.current = null;
    await exitVRSession();
    stopEverything();
  }, [stopEverything]);

  // Keep the reticle out of the scene while not presenting, so re-entering
  // VR does not stack a second one on the rig.
  useEffect(() => {
    return () => {
      vrInterfaceRef.current?.dispose();
      vrInterfaceRef.current = null;
    };
  }, []);

  // The headset's button is just a capacitive tap on the screen, and it
  // lands wherever the lever touches — so any tap anywhere counts as a
  // select on whatever the reticle is currently over.
  //
  // Three taps on empty space recentres the view. Taps that hit a button
  // deliberately do not count toward that: otherwise tapping EYE + three
  // times to adjust separation would recentre instead, and a stray triple
  // tap aimed at EXIT would be destructive.
  useEffect(() => {
    if (phase !== 'active') return;

    const onTap = (event: Event) => {
      event.preventDefault();
      const ui = vrInterfaceRef.current;
      if (!ui) return;

      if (ui.activate()) {
        tapTimesRef.current.length = 0;
        return;
      }

      const now = performance.now();
      const taps = tapTimesRef.current;
      if (taps.length > 0 && now - taps[taps.length - 1] > TRIPLE_TAP_GAP_MS) {
        taps.length = 0;
      }
      taps.push(now);
      if (taps.length >= 3) {
        taps.length = 0;
        handleCenterView();
      }
    };

    window.addEventListener('pointerdown', onTap);
    return () => window.removeEventListener('pointerdown', onTap);
  }, [phase, handleCenterView]);

  useEffect(() => {
    const onResize = () => {
      stereoRendererRef.current?.resize(window.innerWidth, window.innerHeight);
    };
    // 'resize' alone is unreliable right after a fullscreen/orientation-lock
    // transition on mobile — those settle asynchronously, sometimes without
    // firing 'resize' at all, leaving the canvas sized to stale dimensions.
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onResize);
    screen.orientation?.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      screen.orientation?.removeEventListener('change', onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      stereoRendererRef.current?.renderer.setAnimationLoop(null);
      fallbackMotionRef.current?.stop();
    };
  }, []);

  return (
    <div ref={containerRef} className="vr-root">
      <canvas
        ref={canvasRef}
        className="vr-canvas"
        style={{ display: phase === 'active' ? 'block' : 'none' }}
      />

      {phase !== 'active' && (
        <LandingScreen
          caps={caps}
          errorMessage={errorMessage}
          starting={phase === 'starting'}
          onEnterVR={handleEnterVR}
        />
      )}

      {/* No DOM overlay while active: a flat HTML layer sits on top of both
          eyes at once and cannot be fused, so every control and readout is
          scene geometry instead — see VRInterface. */}
    </div>
  );
}
