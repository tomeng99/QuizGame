import { useWindowDimensions } from "react-native";
import { stageMinWidth } from "../theme";
import type { Screen } from "../types";

/**
 * Whether this client should render the host's presentation ("stage") layout.
 *
 * True only for a host who is in a running game on a screen wide enough to present from — a
 * laptop driving a projector, a desktop, or a tablet in landscape. Players are on phones and
 * always get the base layout, and so does a host running the game from their own phone.
 *
 * `useWindowDimensions` re-renders on rotation and on a browser resize, so the layout follows
 * a host who drags the window onto a second screen mid-game.
 */
export function useStageLayout(isHost: boolean, screen: Screen): boolean {
  const { width } = useWindowDimensions();

  return isHost && screen === "game" && width >= stageMinWidth;
}
