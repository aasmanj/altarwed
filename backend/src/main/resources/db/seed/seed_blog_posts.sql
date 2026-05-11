-- Seed initial blog posts for SEO launch
-- Run this manually after V23 migration has applied.
-- Target keywords: "bible verses for weddings" (40K/mo), "christian wedding vows" (18K/mo)

INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published)
VALUES (
  NEWID(),
  'bible-verses-for-weddings',
  '40 Bible Verses for Your Wedding Ceremony',
  'The most meaningful scripture for Christian weddings, organized by theme: covenant, love, unity, and God''s blessing. Use these verses in your ceremony, vows, invitations, and wedding website.',
  '<h2>Scripture That Centers Your Wedding on God</h2>
<p>A Christian wedding is more than a celebration — it''s a covenant made before God and witnessed by your community. Choosing the right scripture for your ceremony, vows, and decorations helps every element point back to that truth.</p>
<p>We''ve organized 40 of the most meaningful Bible verses into four themes, so you can find exactly the right words for each moment of your wedding day.</p>

<h2>Verses About Covenant &amp; Marriage</h2>
<p>These verses speak directly to what marriage is in God''s design — a sacred, unbreakable covenant.</p>
<ul>
  <li><strong>Genesis 2:24</strong> — "Therefore a man shall leave his father and his mother and hold fast to his wife, and they shall become one flesh."</li>
  <li><strong>Mark 10:9</strong> — "Therefore what God has joined together, let no one separate."</li>
  <li><strong>Ecclesiastes 4:9–12</strong> — "Two are better than one, because they have a good return for their labor... A cord of three strands is not quickly broken."</li>
  <li><strong>Malachi 2:14</strong> — "...the LORD is witness between you and the wife of your youth, because you have been faithless to her, though she is your companion and your wife by covenant."</li>
  <li><strong>Proverbs 18:22</strong> — "He who finds a wife finds what is good and receives favor from the LORD."</li>
</ul>

<h2>Verses About Love</h2>
<p>These passages are among the most read at Christian weddings — for good reason. They describe the kind of love that only God can sustain.</p>
<ul>
  <li><strong>1 Corinthians 13:4–8</strong> — "Love is patient, love is kind. It does not envy, it does not boast, it is not proud... Love never fails."</li>
  <li><strong>Song of Solomon 3:4</strong> — "I have found the one my heart loves."</li>
  <li><strong>1 John 4:7–8</strong> — "Dear friends, let us love one another, for love comes from God... Whoever does not love does not know God, because God is love."</li>
  <li><strong>Romans 12:10</strong> — "Be devoted to one another in love. Honor one another above yourselves."</li>
  <li><strong>1 Peter 4:8</strong> — "Above all, love each other deeply, because love covers over a multitude of sins."</li>
  <li><strong>John 15:12</strong> — "My command is this: Love each other as I have loved you."</li>
  <li><strong>Ephesians 4:2–3</strong> — "Be completely humble and gentle; be patient, bearing with one another in love, making every effort to keep the unity of the Spirit through the bond of peace."</li>
</ul>

<h2>Verses About Unity &amp; Partnership</h2>
<p>Marriage is two becoming one — these verses celebrate the gift of a faithful partner and the strength that comes from walking together.</p>
<ul>
  <li><strong>Ruth 1:16–17</strong> — "Where you go I will go, and where you stay I will stay. Your people will be my people and your God my God."</li>
  <li><strong>Proverbs 31:10–11</strong> — "A wife of noble character who can find? She is worth far more than rubies. Her husband has full confidence in her..."</li>
  <li><strong>Colossians 3:14</strong> — "And over all these virtues put on love, which binds them all together in perfect unity."</li>
  <li><strong>Ephesians 5:25,33</strong> — "Husbands, love your wives, just as Christ loved the church and gave himself up for her... each one of you also must love his wife as he loves himself, and the wife must respect her husband."</li>
  <li><strong>Philippians 2:2</strong> — "Then make my joy complete by being like-minded, having the same love, being one in spirit and of one mind."</li>
  <li><strong>Amos 3:3</strong> — "Do two walk together unless they have agreed to do so?"</li>
</ul>

<h2>Verses About God''s Blessing on Your Marriage</h2>
<p>Use these at the close of your ceremony, in your vows, or on your wedding website to invite God into every day of your marriage.</p>
<ul>
  <li><strong>Jeremiah 29:11</strong> — "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future."</li>
  <li><strong>Numbers 6:24–26</strong> — "The LORD bless you and keep you; the LORD make his face shine on you and be gracious to you; the LORD turn his face toward you and give you peace."</li>
  <li><strong>Psalm 128:1–4</strong> — "Blessed are all who fear the LORD, who walk in obedience to him... Your wife will be like a fruitful vine within your house..."</li>
  <li><strong>Matthew 19:6</strong> — "So they are no longer two, but one flesh. Therefore what God has joined together, let no one separate."</li>
  <li><strong>Isaiah 43:1</strong> — "Do not fear, for I have redeemed you; I have summoned you by name; you are mine."</li>
  <li><strong>Psalm 37:4</strong> — "Delight yourself in the LORD, and he will give you the desires of your heart."</li>
</ul>

<h2>How to Use These Verses</h2>
<p>Here are a few ways to weave scripture into your wedding day:</p>
<ul>
  <li><strong>Ceremony reading:</strong> Ask a family member or friend to read a passage aloud during the service.</li>
  <li><strong>Vows:</strong> Incorporate a verse into your personal vows as the foundation of your promises.</li>
  <li><strong>Wedding website:</strong> Pin a verse to your public wedding website — your guests will see it when they RSVP or view your story.</li>
  <li><strong>Programs &amp; stationery:</strong> Print a verse on your order of service or wedding invitations.</li>
  <li><strong>Décor:</strong> Calligraphy a meaningful verse for your ceremony backdrop or reception tables.</li>
</ul>

<p>AltarWed''s scripture browser lets you search and pin any of these verses directly to your wedding website. <a href="https://app.altarwed.com/register">Create your free account</a> to get started.</p>',
  'Jordan Aasman',
  SYSUTCDATETIME(),
  '40 Bible Verses for Your Wedding Ceremony | AltarWed',
  'The most meaningful Bible verses for Christian weddings, organized by theme: covenant, love, unity, and blessing. Use in your ceremony, vows, or wedding website.',
  'Scripture,Ceremony',
  NULL,
  1
);

INSERT INTO blog_posts (id, slug, title, excerpt, content, author, published_at, seo_title, seo_desc, tags, cover_image, is_published)
VALUES (
  NEWID(),
  'christian-wedding-vows',
  'Christian Wedding Vow Examples & Templates',
  'Traditional and modern Christian wedding vow templates rooted in scripture. Customize them for your denomination, your story, and your covenant.',
  '<h2>Your Vows Are a Covenant, Not Just Words</h2>
<p>Christian wedding vows are among the most sacred words you will ever speak. Unlike a contract, a covenant is unconditional — you are not promising to love your spouse if they perform, but committing to love them as Christ loves the church: sacrificially, faithfully, and without condition.</p>
<p>The templates below give you a starting point. Customize them with your own story, scripture, and the specific ways you want to love your spouse.</p>

<h2>Traditional Christian Vows</h2>
<p>These classic vows have been spoken in Christian churches for centuries. They are simple, weighty, and deeply rooted in the theology of marriage as covenant.</p>

<h3>Traditional Protestant Vows</h3>
<blockquote>
  <p>I, [Name], take you, [Name], to be my lawfully wedded [husband/wife], to have and to hold from this day forward, for better, for worse, for richer, for poorer, in sickness and in health, to love and to cherish, until death do us part, according to God''s holy ordinance — and thereto I pledge you my faith.</p>
</blockquote>

<h3>Traditional Catholic Vows</h3>
<blockquote>
  <p>I, [Name], take you, [Name], to be my [husband/wife]. I promise to be true to you in good times and in bad, in sickness and in health. I will love you and honor you all the days of my life.</p>
</blockquote>

<h2>Modern Christian Vow Templates</h2>
<p>These vows incorporate scripture and speak more directly to the covenant nature of Christian marriage.</p>

<h3>Scripture-Based Vow (Ephesians 5)</h3>
<blockquote>
  <p>[Name], I love you and I choose you this day as my [husband/wife]. I promise to walk beside you in faith, to love you as Christ loves the church — sacrificially and without condition. I will honor you, serve you, and remain faithful to you until God calls us home. This is my covenant before God and these witnesses.</p>
</blockquote>

<h3>Covenant-Focused Vow</h3>
<blockquote>
  <p>[Name], today I enter into a covenant with you before God. I promise to love you patiently and kindly, to bear all things and hope all things with you. I will pray with you and for you. I will choose you again every day, in every season, for the rest of my life. Where you go, I will go. Your God is my God.</p>
</blockquote>

<h3>Simple & Personal</h3>
<blockquote>
  <p>[Name], I have found the one my heart loves, and I will spend my life showing you what that means. I promise to love you in the way God calls me to — putting you above myself, being slow to anger and quick to forgive, and building a home where faith is at the center of everything. I am yours, completely, for life.</p>
</blockquote>

<h2>Tips for Writing Your Own Christian Vows</h2>
<p>Personal vows are more meaningful when they are specific to your relationship. Here are a few questions to help you write yours:</p>
<ul>
  <li><strong>What drew you to them?</strong> What did you first notice — their faith, their kindness, the way they serve others?</li>
  <li><strong>What do you most want to promise them?</strong> Beyond "love and cherish" — what specific commitments matter most to your relationship?</li>
  <li><strong>What scripture has shaped your relationship?</strong> Is there a verse that feels like it was written for your story?</li>
  <li><strong>What are you choosing?</strong> Vows are a choice, not a feeling. What are you choosing to do regardless of circumstances?</li>
</ul>

<h2>Denomination-Specific Notes</h2>
<p>Some denominations have requirements about the exact wording of vows. Here''s a quick guide:</p>
<ul>
  <li><strong>Catholic:</strong> The Church requires the traditional form of consent. Personal additions are welcome but must be approved by your priest.</li>
  <li><strong>Baptist & non-denominational:</strong> Great freedom here. Personal vows are warmly welcomed.</li>
  <li><strong>Presbyterian/Reformed:</strong> Check with your pastor — many allow personal vows alongside the traditional questions.</li>
  <li><strong>Methodist:</strong> The United Methodist Book of Worship includes traditional vows, but personalization is common.</li>
  <li><strong>Lutheran:</strong> ELCA and LCMS may differ — ask your pastor about their preferred form.</li>
</ul>

<h2>Practice Out Loud</h2>
<p>Whatever vows you choose, practice saying them aloud — ideally to each other — before the wedding day. Hearing your own voice speak the words makes them feel real, and it will help you stay composed when emotions are high on the day.</p>

<p>AltarWed''s vow builder includes writing prompts, scripture shortcuts, and a private side-by-side preview so you and your partner can work on your vows separately, then read them together. <a href="https://app.altarwed.com/register">Create your free account</a> to get started.</p>',
  'Jordan Aasman',
  SYSUTCDATETIME(),
  'Christian Wedding Vow Examples & Templates | AltarWed',
  'Traditional and modern Christian wedding vow templates rooted in scripture. Customize for your denomination and your covenant.',
  'Vows,Ceremony',
  NULL,
  1
);
