-- New blog post: "How to Make a Free Christian Wedding Website".
--
-- Strategy: this is a bottom-of-funnel ("commercial intent") page, not another
-- informational post. People searching "christian wedding website" or "free
-- wedding website" are ready to build one right now, which is exactly the
-- action AltarWed wants, so the page doubles as an SEO landing page and a
-- conversion asset (usable as an ad destination too). It cross-links to the
-- existing informational posts for topical clustering and funnels to register.
--
-- Cover image is self-hosted at /public/blog-christian-wedding-website.jpg
-- (relative URL) rather than a third-party hotlink, consistent with the homepage
-- and wedding-site fixes: a hotlinked Unsplash cover already returned a 404 in
-- prod once.

IF NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'christian-wedding-website')
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'christian-wedding-website',
    'How to Make a Free Christian Wedding Website',
    'A step-by-step guide to building a free Christian wedding website: what to include, when to share it, etiquette, and how to set one up in minutes.',
    '<p>A wedding website has become the simplest way to share the details of your day, collect RSVPs, and point guests to your registry, all in one place. For Christian couples, it is also a chance to set the tone: to let your guests know from the first click that this is a covenant before God, not just a celebration.</p>

<p>This guide walks through what belongs on a Christian wedding website, the etiquette of sharing it, and how to build one for free in a few minutes.</p>

<h2>Why have a wedding website at all?</h2>
<p>Three practical reasons. It cuts down on the questions you would otherwise answer one text at a time (What time? Where do we park? Is there a hotel block?). It gives older relatives and busy friends a single link they can return to. And it lets you collect RSVPs and meal choices digitally instead of chasing paper cards. A good website does the logistical work so you can focus on the marriage.</p>

<h2>What to include on a Christian wedding website</h2>
<p>You do not need every section below, but the strongest sites cover most of these:</p>
<ul>
  <li><strong>Your story.</strong> How you met, how God brought you together, and the moment you knew. Guests love this, and it is the heart of a faith-centered site.</li>
  <li><strong>A scripture or verse.</strong> One passage that defines your marriage sets the spiritual tone immediately. If you are still choosing, see our <a href="/blog/bible-verses-for-weddings">40 Bible verses for your wedding ceremony</a>.</li>
  <li><strong>The details.</strong> Date, ceremony time, venue, address, and dress code. Keep it skimmable.</li>
  <li><strong>Travel and accommodations.</strong> Hotel blocks, directions, and parking for out-of-town guests.</li>
  <li><strong>Registry.</strong> Link out to where you are registered rather than listing items on the page.</li>
  <li><strong>Wedding party.</strong> A short intro to the people standing with you.</li>
  <li><strong>RSVP.</strong> A digital RSVP with meal preferences and a plus-one field saves you weeks of follow-up.</li>
</ul>

<h2>Christian wedding website etiquette</h2>
<p>A few conventions worth following:</p>
<ul>
  <li><strong>Keep registry links off the invitation itself.</strong> Put them on the website, where asking feels natural rather than transactional.</li>
  <li><strong>Share the link on your save-the-date.</strong> That gives guests the most time to book travel.</li>
  <li><strong>Do not post your home address publicly.</strong> Share travel details for the venue, not where you live.</li>
  <li><strong>Set an RSVP deadline.</strong> Three to four weeks before the wedding gives your caterer and seating chart room to breathe.</li>
</ul>

<h2>How to make your free Christian wedding website</h2>
<p>You can build one on AltarWed in minutes, with no credit card and no design skills required:</p>
<ol>
  <li><strong>Create a free account.</strong> <a href="https://app.altarwed.com/register">Sign up here</a> and tell us your names and wedding date.</li>
  <li><strong>Pick your link.</strong> Every couple gets a shareable address at altarwed.com/wedding/your-names.</li>
  <li><strong>Add your story and a verse.</strong> Use the side-by-side editor to write your story and pin a scripture from the built-in browser.</li>
  <li><strong>Fill in the details.</strong> Venue, travel, registry, and wedding party each have their own section.</li>
  <li><strong>Turn on RSVP.</strong> Add your guests and let them respond online, with meal choices and dietary notes.</li>
  <li><strong>Publish and share.</strong> Send the link on your save-the-date and watch the RSVPs come in.</li>
</ol>

<h2>Free vs paid wedding website builders</h2>
<p>Most major builders give you a free site and charge for a custom domain or premium templates. AltarWed keeps the wedding website free for every couple, with the faith-first tools (scripture browser, ceremony builder, and vow writer) included rather than locked behind a tier. A custom domain is a future add-on, but you never have to pay to publish and share your site.</p>

<h2>Tie it into the rest of your planning</h2>
<p>Your website is one piece of a Christ-centered wedding. Once it is live, map out your <a href="/blog/christian-wedding-ceremony-order">ceremony order of service</a> and choose your <a href="/blog/christian-wedding-songs">worship and ceremony songs</a> so every part of the day points to the same thing.</p>

<h2>Frequently Asked Questions</h2>
<h3>Is a wedding website free?</h3>
<p>On AltarWed, yes. Every couple gets a free, shareable wedding website with story, scripture, registry, travel, photos, and RSVP. You only pay if you later add an optional upgrade such as a custom domain.</p>
<h3>Do I really need a wedding website?</h3>
<p>It is not required, but it saves you from answering the same logistics questions over and over, gives guests one reliable link, and lets you collect RSVPs and meal choices digitally. For most couples it pays for itself in saved time.</p>
<h3>What should a Christian wedding website include?</h3>
<p>At minimum: your story, a scripture that reflects your marriage, the date and venue, travel details, your registry link, and an RSVP. A wedding party section and a photo gallery are nice additions.</p>
<h3>When should I share my wedding website?</h3>
<p>Share it on your save-the-date, roughly six to eight months before the wedding, so out-of-town guests have time to book travel. Keep it updated as details firm up.</p>
<h3>How long does it take to make one?</h3>
<p>You can publish a basic site in well under an hour. Start with your names, date, and a verse, then add the other sections as your plans come together.</p>

<p>Ready to build yours? <a href="https://app.altarwed.com/register">Create your free Christian wedding website on AltarWed</a> and have a shareable link in minutes.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'How to Make a Free Christian Wedding Website (Step by Step)',
    'Build a free Christian wedding website in minutes. What to include, sharing etiquette, free vs paid builders, and a step-by-step setup guide for couples.',
    'wedding website,christian wedding website,free wedding website,planning',
    '/blog-christian-wedding-website.jpg',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);
