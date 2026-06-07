-- New blog post: "Wedding Dress Code Guide: What to Put on Your Invitation".
--
-- Bottom-of-funnel informational + intent page. Couples filling in their wedding
-- website hit a wall at the "dress code" field because they do not know which
-- code fits their venue and time of day (real feedback from our first couple).
-- This post answers exactly that and is linked directly from the dress-code
-- field in the website editor, so it doubles as in-product help and an SEO page.
--
-- Cover image reuses an existing self-hosted asset (no third-party hotlink, which
-- 404'd in prod before). A dedicated cover can replace it later.

IF NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'wedding-dress-code-guide')
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'wedding-dress-code-guide',
    'Wedding Dress Code Guide: What to Put on Your Invitation by Venue and Time',
    'Not sure what dress code to set for your wedding? Here is what each level means and how to choose the right one based on your venue and the time of day.',
    '<p>One of the most common questions couples freeze on while building their wedding website is the dress code. You want your guests to feel comfortable and look the part, but the labels (black tie, cocktail, semi-formal) are easy to mix up, and the right choice depends on where and when you are getting married.</p>

<p>This guide explains what each dress code means, then shows you how to pick the right one based on your venue and the time of day. When you are ready, you can set it in one click on your <a href="https://app.altarwed.com/register">free AltarWed wedding website</a>.</p>

<h2>The wedding dress codes, from most to least formal</h2>
<ul>
  <li><strong>White tie.</strong> The most formal level. Floor-length gowns for women, tailcoats and bow ties for men. Rare outside very formal evening weddings.</li>
  <li><strong>Black tie.</strong> Formal evening wear. Floor-length or elegant midi dresses, and tuxedos for men. Best for evening weddings at ballrooms, hotels, and upscale venues.</li>
  <li><strong>Formal, or black tie optional.</strong> A notch softer than black tie. A dark suit is acceptable in place of a tuxedo, and women wear a long dress, a dressy midi, or a formal cocktail dress. A safe, common choice for evening weddings.</li>
  <li><strong>Cocktail attire.</strong> Polished but not full-length. Knee-length or midi dresses, and a suit and tie for men. The most popular code for modern weddings, and a good default when you are unsure.</li>
  <li><strong>Semi-formal.</strong> A step down from cocktail. A dress or a nice separates outfit, and a suit (a tie is optional for daytime). Works well for afternoon and early-evening weddings.</li>
  <li><strong>Dressy casual.</strong> Put together but relaxed. A sundress or nice slacks, and a button-down shirt with or without a jacket. Good for daytime and outdoor celebrations.</li>
  <li><strong>Beach formal.</strong> Elevated but built for sand and sun. Flowing dresses and lightweight fabrics, linen suits, and footwear you can actually walk on sand in.</li>
  <li><strong>Casual.</strong> Comfortable everyday-nice clothing. Reserve this for very relaxed backyard or outdoor weddings, and be specific so guests are not unsure.</li>
</ul>

<h2>How to choose based on your venue</h2>
<p>The setting does most of the work for you:</p>
<ul>
  <li><strong>Church, cathedral, ballroom, or hotel:</strong> formal or black tie. A sacred or grand space calls for dressier attire.</li>
  <li><strong>Vineyard, estate, or garden:</strong> cocktail or semi-formal. Elegant but not stiff.</li>
  <li><strong>Barn, farm, or backyard:</strong> dressy casual or semi-formal. Tell guests if the ground is uneven so they skip thin heels.</li>
  <li><strong>Beach or tropical:</strong> beach formal. Light fabrics and sensible shoes.</li>
</ul>

<h2>How to choose based on the time of day</h2>
<p>Time of day shifts formality almost as much as the venue:</p>
<ul>
  <li><strong>Morning and early afternoon (before about 3 p.m.):</strong> lean lighter and less formal. Semi-formal or cocktail fits most daytime weddings, even at nicer venues.</li>
  <li><strong>Late afternoon (about 3 to 5 p.m.):</strong> cocktail is the sweet spot.</li>
  <li><strong>Evening (after about 5 to 6 p.m.):</strong> dress it up. Formal, black tie optional, or black tie. Evening weddings carry the most formality by default.</li>
</ul>

<h2>A quick way to decide</h2>
<p>If you are still unsure, combine the two: start with the venue, then adjust for time. A garden wedding at noon leans semi-formal; the same garden at 6 p.m. leans cocktail or formal. A ballroom in the evening is black tie or formal; the same ballroom for a midday brunch is cocktail. When in doubt, cocktail attire is the safest modern default, because it reads polished without asking guests to rent a tuxedo.</p>

<h2>Where to put the dress code</h2>
<p>You have two good options, and most couples use both:</p>
<ul>
  <li><strong>On your wedding website.</strong> The details section is the natural home for it, and you can add a sentence of context (for example, "Cocktail attire, the ceremony lawn is grass, so consider block heels").</li>
  <li><strong>On the invitation.</strong> Print it in the lower corner or on a details card. Keep it to the dress code name alone.</li>
</ul>
<p>However you share it, be consistent so guests are not getting different signals from the invitation and the website.</p>

<h2>Set your dress code in one click</h2>
<p>On AltarWed, the dress code lives right in your website details, alongside your venue, time, and travel info. Pick a standard option or write your own, and it appears on your public page for guests automatically. While you are there, map out your <a href="/blog/christian-wedding-ceremony-order">ceremony order of service</a> and choose your <a href="/blog/christian-wedding-songs">ceremony songs</a> so the whole day feels of a piece.</p>

<h2>Frequently Asked Questions</h2>
<h3>What is the most common wedding dress code?</h3>
<p>Cocktail attire. It is polished but accessible, works for most venues and times, and does not require guests to rent formalwear. It is the safest default if you are unsure.</p>
<h3>What is the difference between formal and black tie?</h3>
<p>Black tie means a tuxedo and a long or elegant dress, and is reserved for formal evening weddings. Formal, often written as "black tie optional," allows a dark suit instead of a tuxedo, so it is slightly more flexible while still dressy.</p>
<h3>Do I have to put a dress code on my invitation?</h3>
<p>No, it is optional. But including one (on the invitation, the website, or both) helps guests feel confident about what to wear and keeps your photos cohesive. If you skip it, guests will infer formality from the venue and time.</p>
<h3>What dress code is best for an outdoor or barn wedding?</h3>
<p>Dressy casual or semi-formal. Add a note if the ground is grass or gravel so guests choose appropriate shoes.</p>
<h3>What should guests wear to a daytime wedding?</h3>
<p>Lighter and less formal than an evening event. Semi-formal or cocktail attire suits most daytime weddings, even at nicer venues.</p>

<p>Ready to set yours? <a href="https://app.altarwed.com/register">Create your free wedding website on AltarWed</a> and add your dress code, venue, and details in minutes.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'Wedding Dress Code Guide: What to Put on Your Invitation (by Venue and Time)',
    'A simple guide to wedding dress codes: what black tie, cocktail, and semi-formal mean, and how to choose the right one for your venue and time of day.',
    'wedding dress code,what to wear to a wedding,wedding invitation wording,planning',
    '/blog-ceremony.jpg',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);
