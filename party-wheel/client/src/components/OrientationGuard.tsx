import { useEffect, useState } from "react";

/**
 * Phase 6: OrientationGuard
 * Detects portrait orientation and shows overlay.
 * Locks screen orientation to landscape on supported devices.
 */
export function OrientationGuard({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    // Check initial orientation
    const checkOrientation = () => {
      const isPort = window.innerHeight > window.innerWidth;
      setIsPortrait(isPort);
    };

    checkOrientation();

    // Listen for orientation changes
    window.addEventListener("orientationchange", checkOrientation);
    window.addEventListener("resize", checkOrientation);

    // Try to lock orientation to landscape (if API available)
    if ((screen.orientation as any)?.lock) {
      (screen.orientation as any).lock("landscape").catch(() => {
        // Silently fail if lock not supported
      });
    }

    return () => {
      window.removeEventListener("orientationchange", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, []);

  if (isPortrait) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center px-4">
          <div className="text-4xl mb-4">📱</div>
          <h1 className="text-2xl font-orbitron text-violet-400 mb-2">
            ROTATE YOUR DEVICE
          </h1>
          <p className="text-gray-300 font-inter">
            AI4U Party Wheel is best experienced in landscape mode.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
