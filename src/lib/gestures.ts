/**
 * A press can move the key out from under the pointer (the pressed style shifts
 * it, or a finger jitters). That leave is not a release. A leave onto another
 * key is a glissando and should release. A leave with the button up should too.
 */
export function shouldReleaseOnPointerLeave(
  trackingMidi: number | undefined,
  keyMidi: number,
  buttons: number,
  enteredAnotherKey: boolean,
): boolean {
  if (trackingMidi !== keyMidi) return false;
  if (buttons > 0 && !enteredAnotherKey) return false;
  return true;
}
