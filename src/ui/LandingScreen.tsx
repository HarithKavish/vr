import type { VRCapabilities } from '../vr/VRCapabilities';
import { PermissionStatus } from './PermissionStatus';
import { ThemeToggle } from './ThemeToggle';

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
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="https://harithkavish.com/">
            <img className="brand__mark" src="/icon-192.png" alt="" aria-hidden="true" />
            <span className="brand__text">
              <span className="brand__name">Harith Kavish</span>
              <span className="brand__descriptor">VR</span>
            </span>
          </a>
          <div className="site-header__actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

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

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__copy">© {new Date().getFullYear()} Harith Kavish</p>
        </div>
      </footer>
    </div>
  );
}
