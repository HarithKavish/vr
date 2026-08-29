import type { VRCapabilities } from '../vr/VRCapabilities';
import { PermissionStatus } from './PermissionStatus';

interface LandingScreenProps {
  caps: VRCapabilities | null;
  errorMessage: string | null;
  starting: boolean;
  onEnterVR: () => void;
}

// Laid out with the shared theme's shell so this reads as a sibling of the
// other sites in the family rather than a one-off page.
export function LandingScreen({ caps, errorMessage, starting, onEnterVR }: LandingScreenProps): JSX.Element {
  return (
    <div className="site-shell">
      <harith-header
        site-title="Harith Kavish"
        site-tagline="VR"
        brand-href="https://harithkavish.com/"
        brand-mark="/icon-192.png"
        google-client-id="776989554929-6qev44ls5pdf3n2h6ktiheja5anm91so.apps.googleusercontent.com"
      ></harith-header>

      <main className="site-main">
        <div className="section-head">
          <h1 className="section-head__title">VR</h1>
          <p className="section-head__lead">A room you can look around, from a phone in a headset.</p>
        </div>

        <div className="vr-launcher">
          <div className="vr-launcher__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={onEnterVR}
              disabled={starting}
            >
              {starting ? 'Entering…' : 'Enter VR'}
            </button>
            <span className="vr-capability__label">Put your phone into the headset first.</span>
          </div>

          {errorMessage && <p className="vr-error">{errorMessage}</p>}

          <PermissionStatus caps={caps} />
        </div>
      </main>

      <harith-footer copyright-text="Harith Kavish"></harith-footer>
    </div>
  );
}
