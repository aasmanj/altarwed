import { createContext, useContext } from 'react'

// Which structured-data section a block wants to edit. These map to the
// scalar/relational data behind the data-driven card blocks:
//   'details'      -> venue, ceremony time, dress code, wedding date, RSVP deadline
//   'travel'       -> hotel blocks
//   'registry'     -> registry slots
//   'weddingParty' -> wedding party members (add/edit/reorder, without leaving the builder)
export type WebsiteSection = 'details' | 'travel' | 'registry' | 'weddingParty'

// Lets a deeply-nested BlockForm open the in-editor section drawer without prop
// drilling through SortableBlockList. SideBySideEditor provides the setter;
// BlockForm consumes it. Null when there is no provider (e.g. if BlockForm is
// ever rendered outside the side-by-side editor), in which case the caller
// falls back to navigating to the classic editor instead of opening a drawer.
export const BlockEditContext = createContext<((section: WebsiteSection) => void) | null>(null)

export function useOpenWebsiteSection() {
  return useContext(BlockEditContext)
}
