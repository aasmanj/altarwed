package com.altarwed.application.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

// All fields nullable, only non-null fields are applied (patch semantics).
public record UpdateWeddingWebsiteRequest(

        @Size(max = 100) String partnerOneName,
        @Size(max = 100) String partnerTwoName,
        LocalDate weddingDate,
        LocalDate engagementDate,

        // Security (issue #351): heroPhotoUrl is interpolated into the Lob postcard HTML as a
        // background-image URL that Lob's server-side renderer fetches, and it is the next/image
        // src on the public site, so an attacker-controlled scheme/host is an SSRF vector
        // (file:///..., http://169.254.169.254/..., etc.). Require the https scheme: this is set
        // only from our Azure Blob upload (always https), so it blocks file:// and plain-http
        // fetch targets without a functional change. Null/empty stay valid (clearing the hero).
        // A stricter blob-host allowlist (which would also block https-to-internal-IP) is the
        // follow-up; it needs a product call on whether an external hero URL is ever legitimate.
        @Pattern(regexp = "^(https://\\S+)?$", message = "Hero photo URL must be an https link")
        @Size(max = 500) String heroPhotoUrl,
        @Size(max = 200) String heroTagline,
        // V57: hero focal point (0.0–1.0 range). null = no change.
        Double heroFocalPointX,
        Double heroFocalPointY,
        // V57: CSS hex color string for the tagline text (e.g. "#ffffff"). null = no change.
        @Pattern(regexp = "^#[0-9a-fA-F]{3,8}$") @Size(max = 20) String heroTaglineColor,

        @Size(max = 10000) String ourStory,
        @Size(max = 200) String scriptureReference,
        @Size(max = 10000) String scriptureText,
        // V57: translation code (e.g. "ESV", "NIV"). null = no change.
        @Size(max = 20) String scriptureTranslation,

        @Size(max = 200) String venueName,
        @Size(max = 300) String venueAddress,
        @Size(max = 100) String venueCity,
        @Size(max = 50)  String venueState,
        @Size(max = 50)  String ceremonyTime,
        @Size(max = 100) String dressCode,
        // V58: venue photo URL and additional info.
        @Size(max = 2000) String venuePhotoUrl,
        @Size(max = 10000) String venueAdditionalInfo,

        @Size(max = 200) String hotelName,
        @Size(max = 500) String hotelUrl,
        @Size(max = 10000) String hotelDetails,

        @Size(max = 500) String registryUrl1,
        @Size(max = 100) String registryLabel1,
        @Size(max = 500) String registryUrl2,
        @Size(max = 100) String registryLabel2,
        @Size(max = 500) String registryUrl3,
        @Size(max = 100) String registryLabel3,

        LocalDate rsvpDeadline,

        @Size(max = 10000) String partnerOneVows,
        @Size(max = 10000) String partnerTwoVows,

        @Digits(integer = 8, fraction = 2) BigDecimal goalBudget,

        // V34: opaque CSV / JSON. Frontend builds them; backend never inspects.
        @Size(max = 500)   String hiddenTabs,
        @Size(max = 4000)  String customTabLabels,

        // V59: CSS hex color string for the site's accent color (e.g. "#d4af6a"). null = no change.
        @Pattern(regexp = "^#[0-9a-fA-F]{3,8}$") @Size(max = 20) String accentColor,

        // V62: CSS hex color string for the scripture banner background. null = no change; empty string = clear (use default gradient).
        @Pattern(regexp = "^(#[0-9a-fA-F]{3,8})?$") @Size(max = 20) String scriptureBackgroundColor
) {}
