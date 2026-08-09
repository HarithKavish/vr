import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { detectCapabilities, type VRCapabilities } from '../vr/VRCapabilities';
import { enterVRSession, exitVRSession, currentOrientation, isFullscreenActive } from '../vr/VRSession';
import { FallbackMotion } from '../vr/FallbackMotion';
import { Calibration } from '../vr/Calibration';
import { StereoRenderer } from '../vr/StereoRenderer';
import { buildBasicEnvironment } from '../environment/BasicEnvironment';
import { LandingScreen } from '../ui/LandingScreen';
import { Diagnostics, type DiagnosticsState } from '../ui/Diagnostics';

type Phase = 'landing' | 'starting' | 'active';

export function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('landing');
  const [caps, setCaps] = useState<VRCapabilities | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(true);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    vrActive: false,
    fullscreen: false,
    orientation: 'portrait',
    webXR: false,
    tracking: false,
    fps: 0,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stereoRendererRef = useRef<StereoRenderer | null>(null);
  const fallbackMotionRef = useRef<FallbackMotion | null>(null);
  const calibrationRef = useRef(new Calibration());
  const fpsRef = useRef({ frames: 0, lastSample: performance.now() });

  useEffect(() => {
    detectCapabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  const stopEverything = useCallback(() => {
    fallbackMotionRef.current?.stop();
    setPhase('landing');
    setDiagnostics((d) => ({ ...d, vrActive: false, tracking: false }));
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
        renderer.scene.add(buildBasicEnvironment());
        stereoRendererRef.current = renderer;
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
      setDiagnostics((d) => ({ ...d, vrActive: true, webXR: false }));
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
      stereoRenderer.renderStereoFrame();

      const fps = fpsRef.current;
      fps.frames += 1;
      const now = performance.now();
      if (now - fps.lastSample >= 500) {
        const currentFps = Math.round((fps.frames * 1000) / (now - fps.lastSample));
        fps.frames = 0;
        fps.lastSample = now;
        setDiagnostics((d) => ({
          ...d,
          fps: currentFps,
          fullscreen: isFullscreenActive(),
          orientation: currentOrientation(),
          tracking: fallbackMotionRef.current?.isReceivingData() ?? false,
        }));
      }
    });
  };

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

      {phase === 'active' && (
        <div className="vr-controls">
          <button className="vr-control-button" onClick={handleCenterView}>
            CENTER VIEW
          </button>
          <button className="vr-control-button vr-control-button--secondary" onClick={handleExitVR}>
            EXIT
          </button>
          <button
            className="vr-control-button vr-control-button--ghost"
            onClick={() => setDiagnosticsVisible((v) => !v)}
          >
            DIAG
          </button>
        </div>
      )}

      <Diagnostics state={diagnostics} visible={phase === 'active' && diagnosticsVisible} />
    </div>
  );
}
