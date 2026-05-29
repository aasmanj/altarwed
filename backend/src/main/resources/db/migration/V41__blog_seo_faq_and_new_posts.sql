-- Blog SEO pass:
--   1. Strip em dashes from live blog content (the repo-wide style sweep cannot
--      touch already-applied migrations without breaking Flyway checksums, so the
--      seeded content in V24/V28 is corrected here in a forward migration instead).
--   2. Add an FAQ section to the flagship "bible verses for weddings" post to
--      capture People-Also-Ask long-tail queries.
--   3. Add two new posts to keep the blog fresh and widen keyword coverage,
--      cross-linked to the existing posts for topical clustering.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove em dashes from all blog content. A spaced em dash becomes ", ";
--    any remaining bare em dash becomes a comma. NCHAR(8212) is U+2014.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE blog_posts
SET content = REPLACE(REPLACE(content, N' ' + NCHAR(8212) + N' ', N', '), NCHAR(8212), N','),
    updated_at = SYSUTCDATETIME()
WHERE content LIKE N'%' + NCHAR(8212) + N'%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Insert an FAQ block immediately before the closing CTA paragraph of the
--    flagship verses post. Targets "what is the most popular wedding bible verse",
--    "two becoming one verse", "cord of three strands", etc.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE blog_posts
SET content = REPLACE(
        content,
        N'<p>Ready to pin your favorite verse',
        N'<h2>Frequently Asked Questions</h2>
<h3>What is the most popular Bible verse for weddings?</h3>
<p>1 Corinthians 13:4-7, the "love is patient, love is kind" passage, is the most widely read scripture at Christian weddings. It defines love as action and commitment rather than a feeling, which is exactly what a marriage covenant requires.</p>
<h3>What Bible verse talks about two becoming one?</h3>
<p>Genesis 2:24 says, "That is why a man leaves his father and mother and is united to his wife, and they become one flesh." Jesus repeats it in Mark 10:8-9, adding, "Therefore what God has joined together, let no one separate."</p>
<h3>What is the cord of three strands verse?</h3>
<p>Ecclesiastes 4:12 says, "A cord of three strands is not quickly broken." It is the basis for the unity braid ceremony, where the third strand represents God woven into the marriage.</p>
<h3>What does the Bible say about marriage?</h3>
<p>Scripture treats marriage as a covenant established by God (Genesis 2:24), honored by all (Hebrews 13:4), and a living picture of Christ''s sacrificial love for the church (Ephesians 5:25). It is meant to be permanent, selfless, and centered on God.</p>
<h3>How many Bible verses should we use in our ceremony?</h3>
<p>Most Christian ceremonies include two to four scripture readings: an opening passage, one or two longer readings, and a benediction such as Numbers 6:24-26. Choose verses that reflect the themes you want your marriage to be known for.</p>
<p>Ready to pin your favorite verse'),
    updated_at = SYSUTCDATETIME()
WHERE slug = 'bible-verses-for-weddings';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. New post: "Christian Wedding Songs"
--     Target keyword: "christian wedding songs" / "worship songs for weddings"
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'christian-wedding-songs')
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'christian-wedding-songs',
    'Christian Wedding Songs: 40 Worship and Ceremony Ideas',
    'Worship songs, processional music, and recessional ideas for a Christ-centered ceremony and reception, organized by the moment they fit best.',
    '<p>Music sets the spiritual tone of a wedding more than almost any other element. The right worship song during the ceremony can turn a beautiful moment into a holy one, and a thoughtful processional can prepare your guests'' hearts before a single word is spoken.</p>

<p>Here are 40 Christian wedding song ideas, organized by the moment they fit best, from the processional through the first dance. Mix timeless hymns with modern worship to match the spirit of your ceremony.</p>

<h2>Processional</h2>
<p>As the wedding party and bride enter, choose something reverent and building. Instrumental versions keep the focus on the moment.</p>
<ul>
  <li>"Canon in D", Pachelbel (instrumental)</li>
  <li>"Great Is Thy Faithfulness" (instrumental or sung)</li>
  <li>"How Long Will I Love You", Ellie Goulding (instrumental arrangement)</li>
  <li>"All the Poor and Powerless", All Sons and Daughters</li>
  <li>"Holy Spirit", Francesca Battistelli</li>
  <li>"Be Thou My Vision" (hymn)</li>
</ul>

<h2>Worship During the Ceremony</h2>
<p>Many Christian couples include a congregational worship song after the vows or before the prayer. This invites the whole room to worship together.</p>
<ul>
  <li>"How Great Is Our God", Chris Tomlin</li>
  <li>"10,000 Reasons (Bless the Lord)", Matt Redman</li>
  <li>"Build My Life", Pat Barrett</li>
  <li>"Goodness of God", Bethel Music</li>
  <li>"The Blessing", Kari Jobe and Cody Carnes</li>
  <li>"Great Are You Lord", All Sons and Daughters</li>
  <li>"In Christ Alone", Keith and Kristyn Getty</li>
</ul>

<h2>The Unity Moment</h2>
<p>If your ceremony includes a unity ritual such as the cord of three strands or a unity candle, a quiet worship song underneath it is powerful. See our <a href="/blog/christian-unity-ceremony-ideas">guide to Christian unity ceremony ideas</a> for the rituals themselves.</p>
<ul>
  <li>"I Get to Love You", Ruelle</li>
  <li>"Ever Be", Bethel Music</li>
  <li>"First Time", Hollyn</li>
  <li>"Cord of Three Strands", many arrangements</li>
  <li>"Holy Water", We the Kingdom</li>
</ul>

<h2>Recessional</h2>
<p>After the pronouncement, send everyone out on a high. The recessional should feel like a celebration.</p>
<ul>
  <li>"Joyful, Joyful, We Adore Thee" (hymn)</li>
  <li>"This Is Amazing Grace", Phil Wickham</li>
  <li>"Happy Day", Tim Hughes</li>
  <li>"Marry Me", Train (instrumental)</li>
  <li>"Glorious Day", Passion</li>
</ul>

<h2>First Dance</h2>
<p>The first dance can still honor your faith. These songs balance romance with a Christ-centered message.</p>
<ul>
  <li>"I Get to Love You", Ruelle</li>
  <li>"Thousand Years", Christina Perri</li>
  <li>"Yours Forever", Joel Vaughn</li>
  <li>"Beloved", Jordan Feliz</li>
  <li>"From the Day", The Oh Hellos</li>
</ul>

<h2>Reception Worship</h2>
<p>Some couples include one worship set at the reception, often before dinner or as a closing moment. Keep it short and singable.</p>
<ul>
  <li>"Reckless Love", Cory Asbury</li>
  <li>"Living Hope", Phil Wickham</li>
  <li>"Gratitude", Brandon Lake</li>
  <li>"O Come to the Altar", Elevation Worship</li>
</ul>

<h2>How to Choose Your Songs</h2>
<p>Two practical tips. First, confirm with your venue or church whether secular music is permitted during the ceremony itself; many churches have guidelines. Second, give your musicians or DJ your list at least a month out, and mark which songs are non-negotiable. Pair your music choices with your <a href="/blog/christian-wedding-ceremony-order">ceremony order of service</a> so each song lands at the right moment.</p>

<p>Planning your ceremony? <a href="https://app.altarwed.com/register">AltarWed gives every couple a free ceremony builder</a> where you can lay out your order of service and note the music for each section.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'Christian Wedding Songs: 40 Worship and Ceremony Ideas',
    '40 Christian wedding song ideas for the processional, worship, unity moment, recessional, and first dance. Build a Christ-centered ceremony playlist.',
    'music,christian wedding songs,worship,ceremony',
    'https://images.unsplash.com/photo-1550005809-91ad75fb315f?w=1200&q=80',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. New post: "Christian Unity Ceremony Ideas"
--     Target keyword: "unity ceremony ideas" / "cord of three strands"
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'christian-unity-ceremony-ideas')
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'christian-unity-ceremony-ideas',
    'Christian Unity Ceremony Ideas: Cord of Three Strands and More',
    'Meaningful unity ceremony ideas for Christian weddings, including the cord of three strands, unity candle, communion, and foot washing, with the scripture behind each.',
    '<p>A unity ceremony is a symbolic moment during the wedding where the couple visibly becomes one. For Christian couples, the best unity rituals do more than symbolize two people joining; they point to God as the center of the marriage.</p>

<p>Here are the most meaningful Christian unity ceremony ideas, with the scripture and the practical how-to behind each one. Pick the one that best reflects your faith and your story.</p>

<h2>Cord of Three Strands</h2>
<p><strong>Scripture:</strong> Ecclesiastes 4:12, "A cord of three strands is not quickly broken."</p>
<p>The couple braids three cords together, usually while a reader explains that the third strand represents God. The finished braid is strong precisely because of the third strand. It is one of the most popular Christian unity rituals because the meaning is immediate and the keepsake lasts.</p>
<p><strong>How to do it:</strong> Use three ribbons or cords, often gold for God and two colors for the couple. Anchor them at the top, braid together during a short reading or worship song, and keep the braid as a reminder in your home.</p>

<h2>Unity Candle</h2>
<p><strong>Scripture:</strong> Genesis 2:24, "they become one flesh."</p>
<p>Two outer candles, often lit by the mothers of the couple, represent the two individuals and families. The couple uses them together to light one central candle, symbolizing two lives becoming one.</p>
<p><strong>How to do it:</strong> Place three candles on a stand at the front. After the vows, the couple lights the center candle together. An outdoor ceremony may need hurricane glass to shield the flame from wind.</p>

<h2>Communion</h2>
<p><strong>Scripture:</strong> 1 Corinthians 11:23-26.</p>
<p>The couple takes communion together as their first act as husband and wife, often served by the officiating pastor. It centers the marriage on the gospel from the very first moment.</p>
<p><strong>How to do it:</strong> Coordinate with your pastor, who will lead the words of institution. Some couples invite the whole congregation to take communion; others keep it just for the two of them.</p>

<h2>Foot Washing</h2>
<p><strong>Scripture:</strong> John 13:14, where Jesus washes the disciples'' feet.</p>
<p>The couple washes each other''s feet as a vivid picture of the servant love that marriage requires. It is humble, countercultural, and deeply moving for guests to witness.</p>
<p><strong>How to do it:</strong> Set out a basin, water, and a towel. The couple takes turns, often in silence or under a quiet worship song. Plan seating and footwear in advance so it flows smoothly.</p>

<h2>Sand Ceremony</h2>
<p><strong>Scripture:</strong> Genesis 2:24, the two becoming one.</p>
<p>Each partner pours sand of a different color into a shared vessel. The grains mix together so completely that they can never be separated, picturing the permanence of the covenant. This works especially well for blended families, where children can each add a color.</p>

<h2>Prayer Over the Couple</h2>
<p><strong>Scripture:</strong> Philippians 4:6-7.</p>
<p>Rather than a physical object, the unity moment is a prayer. The pastor, parents, or the whole congregation prays over the couple, asking God to bless and keep the marriage. It is simple, requires no props, and invites everyone present to participate.</p>

<h2>Choosing the Right Ritual</h2>
<p>You do not need more than one unity element. Choose the one that resonates most, confirm it fits your venue and denomination, and pair it with a verse from our <a href="/blog/bible-verses-for-weddings">Bible verses for weddings</a> guide. Then slot it into your <a href="/blog/christian-wedding-ceremony-order">ceremony order of service</a>, usually right after the vows and before the pronouncement.</p>

<p>Designing your ceremony? <a href="https://app.altarwed.com/register">AltarWed''s free ceremony builder</a> lets you add a unity moment to your order of service and share the full program with your wedding party.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'Christian Unity Ceremony Ideas: Cord of Three Strands and More',
    'Christian unity ceremony ideas including the cord of three strands, unity candle, communion, and foot washing, with the scripture and meaning behind each.',
    'ceremony,unity ceremony,cord of three strands,traditions',
    'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200&q=80',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);
