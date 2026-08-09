import type { VRCapabilities } from '../vr/VRCapabilities';
import { PermissionStatus } from './PermissionStatus';

interface LandingScreenProps {
  caps: VRCapabilities | null;
  errorMessage: string | null;
  starting: boolean;
  onEnterVR: () => void;
}

export function LandingScreen({ caps, errorMessage, starting, onEnterVR }: LandingScreenProps): JSX.Element {
  return (
    <div className="landing">
      <h1 className="landing-title">VR HOME</h1>
      <p className="landing-subtitle">Put your phone into the VR headset.</p>

      <button className="enter-vr-button" onClick={onEnterVR} disabled={starting}>
        {starting ? 'ENTERING…' : 'ENTER VR'}
      </button>

      {errorMessage && <div className="landing-error">{errorMessage}</div>}

      <PermissionStatus caps={caps} />
    </div>
  );
}
