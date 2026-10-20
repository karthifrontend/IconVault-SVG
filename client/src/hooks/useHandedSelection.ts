// The icons the bulk bar hands to the Sprite or Font section ("Generate sprite" / "Generate font"), and whether the checklist should open on arrival. They travel in the address (router state). The "open the checklist" flag is removed from the address right after the page has read it, so reloading the page or coming back to it does not pop the checklist up again.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readBuildSelection, type BuildSelectionState } from "../lib/loadAllIcons";

export function useHandedSelection(): BuildSelectionState | null {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, on arrival.
  const [arrived] = useState(() => readBuildSelection(location.state));
  const cleared = useRef(false);

  useEffect(() => {
    if (arrived?.openChecklist && !cleared.current) {
      cleared.current = true;
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { iconIds: arrived.iconIds } });
    }
  }, [arrived, navigate, location.pathname, location.search]);

  return arrived;
}
