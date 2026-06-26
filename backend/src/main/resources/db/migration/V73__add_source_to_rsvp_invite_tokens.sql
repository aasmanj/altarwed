-- Records how an RSVP invite token was minted: 'SEARCH' (public find-invitation name search,
-- short-lived and rotatable in place) or 'INVITE' (couple-sent email invite, long-lived and
-- never rotated). Lets the unauthenticated search reuse a guest's existing search-token row
-- instead of inserting a new row on every name guess, bounding table growth on a public path,
-- while leaving the emailed invite link untouched.
-- Nullable: legacy rows stay NULL and are never treated as reusable search tokens.
ALTER TABLE rsvp_invite_tokens ADD source NVARCHAR(16) NULL;
