// Handles the browser-level plumbing that must happen inside the user gesture:
// fullscreen + landscape orientation lock. Isolated so the rest of the app
// never touches these vendor-prefixed / partially-supported browser APIs directly.

export interface VRSessionWarning {
  step: 'fullscreen' | 'orientation';
  message: string;
}

export interface VRSessionResult {
  fullscreenActive: boolean;
  orientationLocked: boolean;
  warnings: VRSessionWarning[];
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

async function requestFullscreenCompat(el: FullscreenElement): Promise<boolean> {
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

async function requestLandscapeLock(): Promise<boolean> {
  try {
    const orientation = screen.orientation as LockableScreenOrientation;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function enterVRSession(root: HTMLElement): Promise<VRSessionResult> {
  const warnings: VRSessionWarning[] = [];

  const fullscreenActive = await requestFullscreenCompat(root);
  if (!fullscreenActive) {
    warnings.push({
      step: 'fullscreen',
      message: 'Fullscreen unavailable. Your browser does not allow this page to enter fullscreen.',
    });
  }

  const orientationLocked = await requestLandscapeLock();
  if (!orientationLocked) {
    warnings.push({
      step: 'orientation',
      message: 'Landscape lock unavailable. Rotate your phone to landscape manually.',
    });
  }

  return { fullscreenActive, orientationLocked, warnings };
}

export async function exitVRSession(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock();
    }
  } catch {
    // Nothing actionable if exit fails; the user can navigate away.
  }
}

export function isFullscreenActive(): boolean {
  return !!document.fullscreenElement;
}

export function currentOrientation(): 'portrait' | 'landscape' {
  if (screen.orientation && screen.orientation.type) {
    return screen.orientation.type.startsWith('landscape') ? 'landscape' : 'portrait';
  }
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}
