// Detects browser/device capabilities relevant to the VR pipeline.
// Every field is the result of an actual feature test, not a UA sniff.

export interface VRCapabilities {
  deviceLabel: string;
  browserLabel: string;
  isMobile: boolean;
  hasTouch: boolean;
  fullscreenSupported: boolean;
  orientationLockSupported: boolean;
  webXRSupported: boolean;
  immersiveVRSupported: boolean;
  deviceOrientationSupported: boolean;
  deviceMotionSupported: boolean;
  deviceOrientationNeedsPermission: boolean;
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectBrowserLabel(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  return 'Unknown';
}

async function detectImmersiveVR(): Promise<boolean> {
  const nav = navigator as Navigator & { xr?: XRSystem };
  if (!nav.xr) return false;
  try {
    return await nav.xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<VRCapabilities> {
  const nav = navigator as Navigator & {
    xr?: XRSystem;
    userAgentData?: { mobile?: boolean };
  };

  const isMobile =
    nav.userAgentData?.mobile ??
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const fullscreenSupported = !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as unknown as Record<string, unknown>)
      .webkitRequestFullscreen
  );

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  const orientationLockSupported = !!(orientation && typeof orientation.lock === 'function');

  const webXRSupported = !!nav.xr;
  const immersiveVRSupported = webXRSupported ? await detectImmersiveVR() : false;

  const deviceOrientationSupported = typeof DeviceOrientationEvent !== 'undefined';
  const deviceMotionSupported = typeof DeviceMotionEvent !== 'undefined';

  const deviceOrientationNeedsPermission =
    deviceOrientationSupported &&
    typeof (DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    }).requestPermission === 'function';

  return {
    deviceLabel: detectDeviceLabel(),
    browserLabel: detectBrowserLabel(),
    isMobile,
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    fullscreenSupported,
    orientationLockSupported,
    webXRSupported,
    immersiveVRSupported,
    deviceOrientationSupported,
    deviceMotionSupported,
    deviceOrientationNeedsPermission,
  };
}
