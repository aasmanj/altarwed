-- Add cover photo to the existing ceremony order post (seeded in V24)
UPDATE blog_posts
SET cover_image = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-wedding-ceremony-order';

-- ─────────────────────────────────────────────────────────────────────────────
-- Post 1: "50 Bible Verses for Weddings"
-- Target keyword: "bible verses for weddings" (~40K/mo)
-- Cover: open Bible with wedding rings (Unsplash)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'bible-verses-for-weddings',
    '50 Bible Verses for Weddings: Scripture for Every Part of Your Ceremony',
    'The most meaningful Bible verses for Christian weddings, grouped by theme: love, covenant, unity, prayer, and joy. Use these in your vows, ceremony program, or wedding website.',
    '<p>Scripture is not just decoration at a Christian wedding. It is the foundation. The right verse, read at the right moment, can anchor your ceremony in something eternal and give your guests a window into what your marriage is actually about.</p>

<p>We have gathered 50 Bible verses for weddings, organized by theme, so you can find the right scripture for every part of your ceremony, from the processional to the benediction. Use them in your vows, your ceremony program, your wedding website, or as inspiration for your decorations.</p>

<h2>Love</h2>
<p>These passages define love not as a feeling but as a commitment. They are the most-read scripture at Christian weddings because they speak directly to what a marriage requires.</p>
<ul>
  <li><strong>1 Corinthians 13:4-7</strong> — "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It does not dishonor others, it is not self-seeking, it is not easily angered, it keeps no record of wrongs. Love does not delight in evil but rejoices with the truth. It always protects, always trusts, always hopes, always perseveres."</li>
  <li><strong>1 John 4:18</strong> — "There is no fear in love. But perfect love drives out fear, because fear has to do with punishment. The one who fears is not made perfect in love."</li>
  <li><strong>Romans 8:38-39</strong> — "For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord."</li>
  <li><strong>Song of Solomon 8:6-7</strong> — "Place me like a seal over your heart, like a seal on your arm; for love is as strong as death, its jealousy unyielding as the grave. It burns like blazing fire, like a mighty flame. Many waters cannot quench love; rivers cannot sweep it away."</li>
  <li><strong>1 John 4:7-8</strong> — "Dear friends, let us love one another, for love comes from God. Everyone who loves has been born of God and knows God. Whoever does not love does not know God, because God is love."</li>
  <li><strong>Proverbs 3:3-4</strong> — "Let love and faithfulness never leave you; bind them around your neck, write them on the tablet of your heart."</li>
  <li><strong>1 Corinthians 16:14</strong> — "Do everything in love."</li>
  <li><strong>Ephesians 4:2</strong> — "Be completely humble and gentle; be patient, bearing with one another in love."</li>
  <li><strong>Romans 13:8</strong> — "Let no debt remain outstanding, except the continuing debt to love one another, for whoever loves others has fulfilled the law."</li>
  <li><strong>John 15:12</strong> — "My command is this: Love each other as I have loved you."</li>
</ul>

<h2>Covenant</h2>
<p>Marriage in Scripture is always understood as a covenant, not a contract. A covenant is one-way, unconditional, and sealed by promise. These verses speak to that depth.</p>
<ul>
  <li><strong>Genesis 2:24</strong> — "That is why a man leaves his father and mother and is united to his wife, and they become one flesh."</li>
  <li><strong>Mark 10:9</strong> — "Therefore what God has joined together, let no one separate."</li>
  <li><strong>Ruth 1:16-17</strong> — "Where you go I will go, and where you stay I will stay. Your people will be my people and your God my God. Where you die I will die, and there I will be buried."</li>
  <li><strong>Malachi 2:14</strong> — "She is your partner, the wife of your marriage covenant."</li>
  <li><strong>Ecclesiastes 4:9-10</strong> — "Two are better than one, because they have a good return for their labor: If either of them falls down, one can help the other up."</li>
  <li><strong>Ecclesiastes 4:12</strong> — "A cord of three strands is not quickly broken."</li>
  <li><strong>Proverbs 18:22</strong> — "He who finds a wife finds what is good and receives favor from the Lord."</li>
  <li><strong>Genesis 2:18</strong> — "The Lord God said, ''It is not good for the man to be alone. I will make a helper suitable for him.''"</li>
  <li><strong>Hebrews 13:4</strong> — "Marriage should be honored by all, and the marriage bed kept pure, for God will judge the adulterer and all the sexually immoral."</li>
  <li><strong>Matthew 19:6</strong> — "So they are no longer two, but one flesh. Therefore what God has joined together, let no one separate."</li>
</ul>

<h2>Unity</h2>
<p>These verses speak to the miracle of two people becoming one, and the shared life that follows.</p>
<ul>
  <li><strong>Colossians 3:14</strong> — "And over all these virtues put on love, which binds them all together in perfect unity."</li>
  <li><strong>Colossians 3:12-13</strong> — "Therefore, as God''s chosen people, holy and dearly loved, clothe yourselves with compassion, kindness, humility, gentleness and patience. Bear with each other and forgive one another if any of you has a grievance against someone."</li>
  <li><strong>Ephesians 5:25</strong> — "Husbands, love your wives, just as Christ loved the church and gave himself up for her."</li>
  <li><strong>Ephesians 4:32</strong> — "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you."</li>
  <li><strong>Philippians 2:2</strong> — "Then make my joy complete by being like-minded, having the same love, being one in spirit and of one mind."</li>
  <li><strong>Romans 12:10</strong> — "Be devoted to one another in love. Honor one another above yourselves."</li>
  <li><strong>Amos 3:3</strong> — "Do two walk together unless they have agreed to do so?"</li>
  <li><strong>Romans 15:7</strong> — "Accept one another, then, just as Christ accepted you, in order to bring praise to God."</li>
  <li><strong>1 Peter 3:7</strong> — "Husbands, in the same way be considerate as you live with your wives, and treat them with respect as the weaker partner and as heirs with you of the gracious gift of life."</li>
  <li><strong>Psalm 133:1</strong> — "How good and pleasant it is when God''s people live together in unity!"</li>
</ul>

<h2>Prayer and Faith</h2>
<p>A marriage built on prayer is a marriage built to last. These verses are perfect for the opening prayer, the benediction, or a reading from a family member.</p>
<ul>
  <li><strong>Philippians 4:6-7</strong> — "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus."</li>
  <li><strong>Matthew 18:20</strong> — "For where two or three gather in my name, there am I with them."</li>
  <li><strong>Joshua 24:15</strong> — "But as for me and my household, we will serve the Lord."</li>
  <li><strong>Proverbs 31:10</strong> — "A wife of noble character who can find? She is worth far more than rubies."</li>
  <li><strong>Psalm 34:3</strong> — "Glorify the Lord with me; let us exalt his name together."</li>
  <li><strong>Jeremiah 29:11</strong> — "''For I know the plans I have for you,'' declares the Lord, ''plans to prosper you and not to harm you, plans to give you hope and a future.''"</li>
  <li><strong>Psalm 37:4</strong> — "Take delight in the Lord, and he will give you the desires of your heart."</li>
  <li><strong>Psalm 127:1</strong> — "Unless the Lord builds the house, the builders labor in vain."</li>
  <li><strong>Matthew 6:33</strong> — "But seek first his kingdom and his righteousness, and all these things will be given to you as well."</li>
  <li><strong>Proverbs 19:14</strong> — "Houses and wealth are inherited from parents, but a prudent wife is from the Lord."</li>
</ul>

<h2>Joy and Blessing</h2>
<p>A Christian wedding is a celebration. These verses express the joy of a day that glorifies God and begins something new.</p>
<ul>
  <li><strong>Psalm 118:24</strong> — "The Lord has done it this very day; let us rejoice today and be glad."</li>
  <li><strong>John 15:11</strong> — "I have told you this so that my joy may be in you and that your joy may be complete."</li>
  <li><strong>Numbers 6:24-26</strong> — "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace."</li>
  <li><strong>Psalm 20:4</strong> — "May he give you the desire of your heart and make all your plans succeed."</li>
  <li><strong>Isaiah 62:5</strong> — "As a bridegroom rejoices over his bride, so will your God rejoice over you."</li>
  <li><strong>Zephaniah 3:17</strong> — "The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you; in his love he will no longer rebuke you, but will rejoice over you with singing."</li>
  <li><strong>Psalm 28:7</strong> — "The Lord is my strength and my shield; my heart trusts in him, and he helps me. My heart leaps for joy, and with my song I praise him."</li>
  <li><strong>3 John 1:4</strong> — "I have no greater joy than to hear that my children are walking in the truth."</li>
  <li><strong>Psalm 16:11</strong> — "You make known to me the path of life; you will fill me with joy in your presence, with eternal pleasures at your right hand."</li>
  <li><strong>Romans 15:13</strong> — "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit."</li>
</ul>

<h2>How to Use These Verses</h2>
<p>Here are practical ways to weave these 50 Bible verses into your wedding:</p>
<ul>
  <li><strong>Ceremony program:</strong> Print two or three verses on the inside cover. Choose one from each of your themes.</li>
  <li><strong>Scripture reading:</strong> Ask a family member or friend to read one passage aloud. 1 Corinthians 13, Ruth 1:16-17, and Colossians 3:12-14 are all excellent reading-length passages.</li>
  <li><strong>Vows:</strong> Weave a short phrase from scripture into your personal vows. "As God''s chosen people, clothe yourselves with compassion" translates beautifully into a vow promise.</li>
  <li><strong>Wedding website:</strong> Pin your favorite verse to your AltarWed wedding website. It will appear as a banner above your ceremony details.</li>
  <li><strong>Signage and decor:</strong> Calligraphy prints of Ecclesiastes 4:12, Mark 10:9, or Song of Solomon 8:6 are popular at Christian weddings.</li>
  <li><strong>Benediction:</strong> Numbers 6:24-26 has been the standard Christian blessing for thousands of years. Close your ceremony with it.</li>
</ul>

<p>Ready to pin your favorite verse to your wedding website? <a href="https://app.altarwed.com/register">AltarWed gives every couple a free wedding website</a> with a built-in scripture banner and ceremony builder.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'Bible Verses for Weddings: 50 Scripture Passages for Your Ceremony',
    '50 Bible verses for weddings organized by theme: love, covenant, unity, prayer, and joy. Perfect for vows, programs, and ceremony readings.',
    'scripture,bible verses,christian wedding,ceremony',
    'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=1200&q=80',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Post 2: "How to Write Christian Wedding Vows"
-- Target keyword: "christian wedding vows" (~18K/mo)
-- Cover: couple exchanging vows at altar (Unsplash)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'christian-wedding-vows',
    'How to Write Christian Wedding Vows: A Complete Guide with Examples',
    'A practical guide to writing Christian wedding vows from scratch or adapting traditional language. Includes structure, scripture to weave in, sample opening lines, and what to avoid.',
    '<p>Writing your own wedding vows is one of the most meaningful things you will do in preparation for your wedding day. It is also one of the most intimidating. A blank page and the weight of forever is a lot to face at once.</p>

<p>This guide will walk you through everything you need to write Christian wedding vows that are personal, scripture-rooted, and memorable. Whether you are starting from scratch or adapting traditional language, you will have a clear framework by the end.</p>

<h2>What Makes Vows Christian?</h2>
<p>Traditional wedding vows in almost every denomination have the same shape: a promise, a set of conditions, and a duration. "I take you to be my lawfully wedded wife, to have and to hold, from this day forward, for better for worse, for richer for poorer, in sickness and in health, to love and to cherish, until death do us part."</p>

<p>What makes vows distinctly Christian is not a specific formula but a specific foundation. Christian vows acknowledge three things:</p>
<ol>
  <li><strong>The source of the commitment:</strong> You are making this promise before God, as an act of faith, not just before witnesses as a legal declaration.</li>
  <li><strong>The covenant nature:</strong> You are not signing a contract with exit clauses. You are entering a covenant. The language should reflect that.</li>
  <li><strong>The gospel shape:</strong> Christian marriage mirrors Christ''s relationship with the church: unconditional, sacrificial, committed regardless of performance. Your vows can reflect that shape.</li>
</ol>

<h2>Traditional vs. Personal Vows</h2>
<p>Many churches require couples to use traditional denominational vows, especially in liturgical traditions like Catholic, Lutheran, Episcopal, and Presbyterian. If you are being married in a church, check with your pastor before deciding to write your own.</p>

<p>If you do have freedom to write your own, the structure below will help you write something personal without losing the covenantal weight of what you are saying.</p>

<h2>The Structure of Great Christian Vows</h2>
<p>Strong Christian vows have four parts. You do not have to include all four, but this framework will help you cover what matters.</p>

<h3>1. The Declaration</h3>
<p>Begin by orienting the vow. You are not reciting a poem. You are speaking directly to your partner about something real and permanent.</p>
<p>Example openings:</p>
<ul>
  <li>"Before God and these witnesses, I give you myself."</li>
  <li>"I have prayed for you before I knew you. Today I receive you as God''s gift."</li>
  <li>"From this moment forward, I choose you. Not because of who you are today, but because of who God is making us together."</li>
</ul>

<h3>2. The Promise</h3>
<p>This is the heart of the vow. Be specific. Vague promises ("I promise to always love you") are less meaningful than concrete ones ("I promise to listen before I speak, to pray for you when I cannot fix it, and to fight for our marriage even when it is hard").</p>
<p>Consider promises around:</p>
<ul>
  <li>How you will handle conflict</li>
  <li>What your faith commitment means for how you will lead or serve in the marriage</li>
  <li>The kind of spouse you want to be, not just the kind you feel like right now</li>
</ul>

<h3>3. The Scripture</h3>
<p>You do not need to quote a verse directly, but weaving scripture into your vows anchors them in something beyond sentiment. Phrases that translate well into vow language:</p>
<ul>
  <li>From 1 Corinthians 13: "I choose to be patient with you and kind to you. I will not keep score."</li>
  <li>From Colossians 3: "I will clothe myself in compassion, kindness, and humility as your spouse."</li>
  <li>From Ecclesiastes 4: "I will be your partner and your strength, so that when either of us falls, the other helps them up."</li>
  <li>From Ephesians 5: "I will love you the way Christ loves the church: completely, without condition, without reservation."</li>
</ul>

<h3>4. The Duration</h3>
<p>End with permanence. Your vow should communicate that this is not contingent on circumstances, feelings, or performance.</p>
<ul>
  <li>"This covenant is my gift to you, today and for every day God gives us."</li>
  <li>"Until death parts us, I am yours."</li>
  <li>"Before God and these witnesses, I give you my word."</li>
</ul>

<h2>Sample Christian Wedding Vows</h2>

<h3>Sample 1: Traditional with personal language</h3>
<blockquote>
<p>"[Name], I take you as my husband/wife before God and these witnesses. I promise to love you not as a feeling that comes and goes, but as a choice I make every morning. I will be patient with you when patience is hard, and kind to you when kindness costs me something. I will honor the covenant we are making today, in every season of our lives, for richer or for poorer, in sickness and in health, for better or for worse, until God calls one of us home. I give you my word and my life. Before God, I am yours."</p>
</blockquote>

<h3>Sample 2: Scripture-forward</h3>
<blockquote>
<p>"[Name], today I receive you as God''s gift to me. Scripture says a cord of three strands is not quickly broken. I want God to be the third strand in our marriage from this day forward. I promise to love you the way Christ loves the church: not because you earn it, but because I have given my word. I promise to be quick to listen and slow to speak. I promise to forgive you as I have been forgiven. I give you all of me, as I am, for as long as I live."</p>
</blockquote>

<h3>Sample 3: Shorter, personal</h3>
<blockquote>
<p>"[Name], I love you. I have prayed for this day and for you. Today I make you a promise before God: I will choose you, every day. I will fight for our marriage, not with you. I will pray for you, serve you, and build a life with you that honors God. This is my covenant to you. I am yours."</p>
</blockquote>

<h2>What to Avoid</h2>
<ul>
  <li><strong>Describing instead of promising:</strong> "You make me laugh every day" is a description. "I promise to always make time to laugh with you" is a vow. Vows are forward-looking commitments.</li>
  <li><strong>Conditional language:</strong> Avoid "as long as" or "if you" framing. A covenant has no exit clauses.</li>
  <li><strong>Inside jokes only you understand:</strong> Your vows are public. Save private moments for private letters to each other.</li>
  <li><strong>Reading from your phone:</strong> Print your vows on a small card. It keeps your eyes on your partner, not a screen.</li>
  <li><strong>Going over three minutes:</strong> 200 to 300 words is the sweet spot. Longer is not more meaningful.</li>
</ul>

<h2>Practical Tips</h2>
<ul>
  <li>Write a first draft alone, then have a trusted friend listen to it before the wedding.</li>
  <li>Read it aloud multiple times. Vows that sound good silently can be hard to deliver with emotion in front of a crowd.</li>
  <li>Do not memorize. Read from a card. There is no prize for memorizing your vows.</li>
  <li>End with your partner''s name. "Before God, I am yours, [Name]" lands differently than ending with a general statement.</li>
</ul>

<p>Once your vows are written, save them in <a href="https://app.altarwed.com/register">AltarWed''s vow builder</a>, which gives both partners a side-by-side preview before the wedding day.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'How to Write Christian Wedding Vows: Guide + Examples',
    'A practical guide to writing Christian wedding vows with structure tips, scripture to weave in, sample opening lines, and three full examples.',
    'vows,christian wedding vows,wedding planning',
    'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=1200&q=80',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Post 3: "Christian Wedding Planning Checklist"
-- Target keyword: "christian wedding checklist" (~8K/mo)
-- Cover: couple planning with notebook and flowers (Unsplash)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published, created_at, updated_at)
VALUES (
    NEWID(),
    'christian-wedding-planning-checklist',
    'The Complete Christian Wedding Planning Checklist (12+ Months)',
    'A faith-first wedding planning checklist organized by timeline. Covers everything from choosing a church and pastor to your final week walkthrough, with spiritual milestones alongside the logistics.',
    '<p>Wedding planning is overwhelming by default. Add in the spiritual dimensions of a Christian ceremony and you have a checklist that most wedding websites do not cover. This guide gives you a complete Christian wedding planning timeline, from the moment you get engaged through the week of your wedding, with the faith-specific milestones built in alongside the logistics.</p>

<h2>12+ Months Before the Wedding</h2>

<h3>Spiritual Foundation</h3>
<ul>
  <li>Begin pre-marital counseling with your pastor or a licensed Christian counselor. Most churches require 4 to 8 sessions and prefer you start early. Do not skip this. Couples who complete pre-marital counseling have measurably lower divorce rates.</li>
  <li>Pray together as a couple about your wedding vision and your marriage vision. Write down what you believe God is calling your marriage to be about.</li>
  <li>Agree on which church or venue will host the ceremony and confirm availability with your pastor.</li>
</ul>

<h3>Logistics</h3>
<ul>
  <li>Set your wedding date and budget.</li>
  <li>Create your AltarWed wedding website and share it with close family so they can follow along as you plan.</li>
  <li>Book your venue and officiant. Both fill up fast, especially for peak wedding season (May through October).</li>
  <li>Begin your guest list.</li>
  <li>Book your photographer and videographer. Christian-owned vendors who understand the significance of the ceremony often produce the most meaningful work.</li>
</ul>

<h2>9 to 12 Months Before</h2>

<h3>Spiritual</h3>
<ul>
  <li>Continue pre-marital counseling.</li>
  <li>Begin discussing your ceremony order with your pastor. Decide which elements you want: readings, worship, communion, prayer over the couple from congregation.</li>
  <li>Choose your scripture passages. Use the <a href="/blog/bible-verses-for-weddings">50 Bible verses for weddings</a> guide to narrow down your choices.</li>
</ul>

<h3>Logistics</h3>
<ul>
  <li>Book your caterer, florist, and music.</li>
  <li>Begin dress and suit shopping.</li>
  <li>Book your honeymoon travel.</li>
  <li>Send save-the-dates. AltarWed can send faith-themed digital save-the-dates directly from your dashboard.</li>
</ul>

<h2>6 to 9 Months Before</h2>

<h3>Spiritual</h3>
<ul>
  <li>Finalize your ceremony order of service. Use AltarWed''s ceremony builder to lay it out section by section.</li>
  <li>Decide whether you will write personal vows or use traditional denominational vows. If personal, begin drafting. Read the <a href="/blog/christian-wedding-vows">guide to writing Christian vows</a> for structure and samples.</li>
  <li>Choose who will give the scripture readings and confirm with them.</li>
</ul>

<h3>Logistics</h3>
<ul>
  <li>Book hair, makeup, and transportation.</li>
  <li>Choose your wedding party and formally ask them.</li>
  <li>Register at two to three registries. Amazon, Target, and Zola all work well. AltarWed lets you link all three on your wedding website.</li>
  <li>Order invitations.</li>
</ul>

<h2>3 to 6 Months Before</h2>

<h3>Spiritual</h3>
<ul>
  <li>Complete pre-marital counseling if you have not already.</li>
  <li>Finalize your vows. Have someone you trust listen to them before the wedding.</li>
  <li>Plan your wedding prayer strategy: who prays, when, and over what. Opening prayer, prayer over the rings, benediction, and a congregational prayer for the couple are all worth discussing with your pastor.</li>
</ul>

<h3>Logistics</h3>
<ul>
  <li>Send invitations (10 to 12 weeks before the wedding).</li>
  <li>Finalize your menu with the caterer.</li>
  <li>Purchase wedding rings.</li>
  <li>Book your rehearsal dinner venue.</li>
  <li>Finalize your seating chart in AltarWed once RSVPs come in.</li>
</ul>

<h2>1 to 3 Months Before</h2>

<h3>Spiritual</h3>
<ul>
  <li>Confirm final ceremony details with your pastor. Walk through the order of service together.</li>
  <li>Consider writing a private letter to your future spouse to be delivered on the wedding morning.</li>
  <li>Plan a time of prayer with your immediate family before the ceremony, separate from the rehearsal.</li>
</ul>

<h3>Logistics</h3>
<ul>
  <li>Confirm all vendor bookings.</li>
  <li>Chase RSVP stragglers. AltarWed can send reminder emails to guests who have not responded.</li>
  <li>Finalize your seating chart and any special accommodation needs.</li>
  <li>Schedule dress fittings.</li>
  <li>Prepare wedding day timeline and share with vendors and wedding party.</li>
</ul>

<h2>The Week Of</h2>
<ul>
  <li>Attend your rehearsal and rehearsal dinner. Keep the tone warm but focused. Everyone needs to know where they stand, when they walk, and what they do.</li>
  <li>Deliver final payments and tips to vendors.</li>
  <li>Get adequate sleep the two nights before. You will not regret it.</li>
  <li>Spend quiet time in prayer the morning of your wedding. Even fifteen minutes alone with God before the day begins will ground you in what it is actually about.</li>
  <li>Exchange private letters or words with your future spouse before the ceremony if you have planned to do so.</li>
</ul>

<h2>A Note on Pacing</h2>
<p>The most common mistake in wedding planning is front-loading the fun decisions (venue, dress, photographer) while deferring the spiritually important ones (pre-marital counseling, vows, ceremony design) until the last few months. The ceremony is the point. Everything else serves it.</p>

<p>AltarWed''s built-in wedding checklist includes 27 faith-first tasks organized by category, from spiritually significant milestones to vendor booking deadlines. <a href="https://app.altarwed.com/register">Create your free account</a> and your checklist is ready on day one.</p>',
    'AltarWed',
    SYSUTCDATETIME(),
    'Christian Wedding Planning Checklist: 12-Month Timeline',
    'A complete Christian wedding planning checklist organized by timeline, with spiritual milestones alongside logistics from engagement to wedding day.',
    'wedding planning,checklist,christian wedding,timeline',
    'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=1200&q=80',
    1,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);
