-- V96: hero presentation controls for the public wedding page (issue #360).
--
-- hero_overlay_darkness: 0-100 intensity of the dark scrim gradient drawn over the hero
-- photo so the white couple names stay legible on bright photos. null = the pre-#360
-- default (70). The value is a bounded integer, never raw CSS: the
-- UpdateWeddingWebsiteRequest @Min/@Max clamps it server-side and the public renderer
-- derives the gradient alpha stops from the clamped number, so no attacker-controlled
-- string can ever reach the public <style> sink.
--
-- hero_layout: how the hero photo fills its section. "full" = the pre-#360 full-bleed
-- cover crop; "framed" = contain the whole photo (no aggressive crop) so portrait heroes
-- show fully. null = "full". Stored as a short allowlisted key (backend @Pattern rejects
-- anything else, frontend safeHeroLayout re-validates), never a raw CSS value.
--
-- Both columns are nullable and additive: an existing site with both null renders exactly
-- as it did before this migration. Migration number may need bumping to the next free
-- V{n} if another PR lands a higher-numbered migration before this one merges.
ALTER TABLE wedding_websites ADD
    hero_overlay_darkness INT NULL,
    hero_layout NVARCHAR(20) NULL;
