/**
 * Keeps every incoming link on the one native screen.
 *
 * Noto's screens live inside the WebView, so expo-router has nothing to route
 * `noto://memory` or a share's `noto://expo-sharing` to — left alone it would
 * show its "unmatched route" page instead of Noto. The link itself still
 * reaches `useNativeIntake`, which hands it to the interface.
 */
export function redirectSystemPath(): string {
  return '/';
}
