import { useEffect, useRef } from "react";
import { IS_MOBILE } from "./platform";

/**
 * On the phone, makes the system Back button close an open editor, form or
 * panel instead of leaving the app. Does nothing on desktop.
 */
export function useBackClose(active: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!IS_MOBILE || !active) return;
    window.history.pushState({ devtrackPanel: true }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the screen: neutralise the extra history entry so a later
      // Back press doesn't reopen or skip anything.
      if (window.history.state?.devtrackPanel) window.history.replaceState(null, "");
    };
  }, [active]);
}
