import type { VRCapabilities } from '../vr/VRCapabilities';

// The shared theme's pill states map onto capability results directly:
// live for supported, planned for unsupported, neutral for plain facts.
function Capability({ label, value, state }: { label: string; value: string; state: 'live' | 'planned' | 'neutral' }): JSX.Element {
  return (
    <li className="vr-capability">
      <span className="vr-capability__label">{label}</span>
      <span className={`pill pill--${state}`}>{value}</span>
    </li>
  );
}

function supported(value: boolean): 'live' | 'planned' {
  return value ? 'live' : 'planned';
}

export function PermissionStatus({ caps }: { caps: VRCapabilities | null }): JSX.Element {
  if (!caps) {
    return <p className="vr-capability__label">Checking device capabilities…</p>;
  }

  return (
    <div className="panel">
      <h2 className="panel__title">This device</h2>
      <ul className="vr-capabilities">
        <Capability label="Device" value={caps.deviceLabel} state="neutral" />
        <Capability label="Browser" value={caps.browserLabel} state="neutral" />
        <Capability
          label="Motion sensors"
          value={caps.deviceOrientationSupported ? 'Available' : 'Unavailable'}
          state={supported(caps.deviceOrientationSupported)}
        />
        <Capability
          label="Fullscreen"
          value={caps.fullscreenSupported ? 'Available' : 'Unavailable'}
          state={supported(caps.fullscreenSupported)}
        />
        <Capability
          label="Landscape lock"
          value={caps.orientationLockSupported ? 'Available' : 'Unavailable'}
          state={supported(caps.orientationLockSupported)}
        />
        <Capability
          label="WebXR"
          value={caps.webXRSupported ? 'Available' : 'Unavailable'}
          state={supported(caps.webXRSupported)}
        />
      </ul>
    </div>
  );
}
