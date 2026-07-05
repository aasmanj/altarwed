// Touch-reveal convention (issue #299). This file is the documented home of the
// pattern; use the constant instead of retyping the classes.
//
// Any control hidden until hover (opacity-0 group-hover:opacity-100) is unreachable
// on touch devices, where hover never fires. The fix, first used on the wedding-party
// photo overlay (WeddingPartyManager), is Tailwind's arbitrary media variant
// [@media(hover:none)]: on hover-incapable devices the control is simply always
// visible. focus-within is included so the reveal also happens when the keyboard
// tabs into an otherwise-invisible control.
//
// Pointer events are deliberately NOT part of this constant. If the revealed layer
// is a full-bleed overlay covering a clickable surface underneath (the PhotosPage
// enlarge button, for example), keep the overlay container pointer-events-none at
// all times and put pointer-events-auto on each control inside it. That way taps
// on a control hit the control, while taps between controls fall through to the
// surface below on every input type.
export const TOUCH_REVEAL =
  'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'
