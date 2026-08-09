import type { VRCapabilities } from '../vr/VRCapabilities';

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className="status-value">{value}</span>
    </div>
  );
}

function yesNo(value: boolean): string {
  return value ? '✓' : '✗';
}

export function PermissionStatus({ caps }: { caps: VRCapabilities | null }): JSX.Element {
  if (!caps) {
    return <div className="status-panel status-panel--loading">Checking device capabilities...</div>;
  }

  return (
    <div className="status-panel">
      <Row label="Device" value={caps.deviceLabel} />
      <Row label="Browser" value={caps.browserLabel} />
      <Row label="WebXR" value={caps.webXRSupported ? 'Available' : 'Unavailable'} />
      <Row label="Immersive VR" value={caps.immersiveVRSupported ? yesNo(true) : yesNo(false)} />
      <Row label="Fullscreen" value={yesNo(caps.fullscreenSupported)} />
      <Row label="Landscape lock" value={yesNo(caps.orientationLockSupported)} />
      <Row
        label="Motion sensors"
        value={caps.deviceOrientationSupported ? 'Available' : 'Unavailable'}
      />
    </div>
  );
}
