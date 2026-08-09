export interface DiagnosticsState {
  vrActive: boolean;
  fullscreen: boolean;
  orientation: 'portrait' | 'landscape';
  webXR: boolean;
  tracking: boolean;
  fps: number;
  lensSeparationMm: number;
}

export function Diagnostics({
  state,
  visible,
}: {
  state: DiagnosticsState;
  visible: boolean;
}): JSX.Element | null {
  if (!visible) return null;

  return (
    <div className="diagnostics">
      <div>VR: {state.vrActive ? 'Active' : 'Inactive'}</div>
      <div>Fullscreen: {state.fullscreen ? 'Yes' : 'No'}</div>
      <div>Orientation: {state.orientation}</div>
      <div>WebXR: {state.webXR ? 'Yes' : 'No (fallback)'}</div>
      <div>Tracking: {state.tracking ? 'Active' : 'Idle'}</div>
      <div>FPS: {state.fps}</div>
      <div>Eye sep: {state.lensSeparationMm.toFixed(0)}mm</div>
    </div>
  );
}
