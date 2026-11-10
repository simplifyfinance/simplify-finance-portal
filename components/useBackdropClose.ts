'use client'
import { useRef } from 'react'

// A DRAG THAT ENDS OUTSIDE THE BOX IS NOT A CLICK OUTSIDE THE BOX.
//
// 10 Nov 2026. Fabio's team, on the milestone send screen: "if I highlight
// what is on the box 'anything else' and press ctrl C to copy, the data
// disappears."
//
// Ctrl+C was innocent. The highlighting did it.
//
// These dialogs close on a click on the dark backdrop. Select text in the
// Anything else box and drag a few pixels past the edge of the panel, and the
// mouse comes up on the backdrop. The browser then fires one click event on
// the nearest common ancestor of where the mouse went DOWN and where it came
// UP - which is the backdrop itself. So the panel's own stopPropagation never
// runs, because the click did not pass through the panel at all. The screen
// closes, and everything typed into it goes with it.
//
// It is worst on exactly the box people drag in, which is why it took this
// long to be reported as anything other than "it vanished".
//
// THE FIX IS TO ASK WHERE THE MOUSE WENT DOWN. Closing is something somebody
// means to do, and they mean it by pressing on the backdrop - not by letting
// go over it. Both ends have to be outside.
//
// Spread the result onto the backdrop element. The panel inside still wants
// its own stopPropagation for ordinary clicks.
export function useBackdropClose(onClose: () => void) {
  const downOnBackdrop = useRef(false)
  return {
    onMouseDown: (e: React.MouseEvent) => {
      downOnBackdrop.current = e.target === e.currentTarget
    },
    onClick: (e: React.MouseEvent) => {
      if (downOnBackdrop.current && e.target === e.currentTarget) onClose()
      downOnBackdrop.current = false
    },
  }
}
