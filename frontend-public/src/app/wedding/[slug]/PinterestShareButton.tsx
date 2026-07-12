'use client'

// Pinterest "Save" control for the public wedding page (issue #374). Pinterest is a
// named paid ad channel, so this closes the organic loop: a guest (or the couple)
// can pin the site with the couple's chosen hero image and it lands on Pinterest as
// a rich pin (the Article Open Graph meta lives in the wedding layout).
//
// Progressive enhancement: it renders a real <a> whose href is the Pinterest pin
// builder, so it works with zero JavaScript (SSR/SEO safe, keyboard accessible).
// When JS is available, onClick upgrades that navigation to Pinterest's recommended
// centered popup instead of a full tab switch. rel="noopener" severs the opener
// reference so the popup cannot script back into this page (reverse tabnabbing).

interface PinterestShareButtonProps {
  // Canonical absolute URL of the wedding page being pinned.
  url: string
  // Absolute URL of the hero image Pinterest should attach to the pin.
  media: string
  // Pin caption. Pinterest allows up to 500 chars; we pass a short faith-first blurb.
  description: string
}

export default function PinterestShareButton({ url, media, description }: PinterestShareButtonProps) {
  const shareUrl =
    'https://www.pinterest.com/pin/create/button/' +
    `?url=${encodeURIComponent(url)}` +
    `&media=${encodeURIComponent(media)}` +
    `&description=${encodeURIComponent(description)}`

  function openPopup(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modifier-clicks (open-in-new-tab) and non-primary buttons behave natively.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    const w = 750
    const h = 550
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
    const popup = window.open(
      shareUrl,
      'altarwed-pinterest-share',
      `width=${w},height=${h},left=${left},top=${top},noopener`,
    )
    // Popup blocked (or the browser ignored the features): fall back to a plain
    // navigation so the share still happens.
    if (!popup) window.location.href = shareUrl
  }

  return (
    <a
      href={shareUrl}
      onClick={openPopup}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="pinterest-share"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#e60023] text-white text-xs font-semibold hover:bg-[#ad081b] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#e60023]"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345c-.091.378-.293 1.194-.333 1.361-.052.22-.174.266-.401.16-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146A12 12 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
      Save to Pinterest
    </a>
  )
}
