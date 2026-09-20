import React from 'react';
import appIcon from '../../assets/app-icon.png';

// Full-screen wait state while the session and the administrator check resolve.
// Exported both ways so the ui barrel can re-export it by either form.
export function Splash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#FFFFFF] via-[#DCDCDC]/20 to-[#FFFFFF]"
    >
      <div className="w-14 h-14 rounded-[16px] overflow-hidden shadow-[0_8px_20px_rgba(65,65,65,0.08)]">
        <img src={appIcon} alt="" className="w-full h-full object-cover" />
      </div>
      <div
        aria-hidden="true"
        className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-[#78003F] border-opacity-40"
      />
      <span className="sr-only">Loading SimuFlow</span>
    </div>
  );
}

export default Splash;
