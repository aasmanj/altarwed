package com.altarwed.domain.model;

// Each block type has a corresponding frontend renderer in
// frontend-public/src/components/blocks. The backend treats content_json as opaque
// and only validates that the type is one of these enum values.
public enum BlockType {
    TEXT,
    HEADING,
    IMAGE,
    SCRIPTURE,
    DIVIDER,
    VENUE_CARD,
    HOTEL_CARD,
    REGISTRY_CARD,
    COUNTDOWN,
    RSVP_CTA,
    WEDDING_PARTY_GRID,
    PHOTO_ALBUM_GRID,
    VOWS_PREVIEW
}
