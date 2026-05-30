// Programmatic-SEO content source for /ceremony-templates/[denomination].
//
// Why structured data instead of HTML strings (the blog pattern): these pages
// are author-controlled and static, so modelling them as typed objects lets the
// page render semantic, accessible markup with zero dangerouslySetInnerHTML /
// XSS surface, and keeps every guide structurally consistent. generateStaticParams
// emits ONLY the slugs defined here, so there are no thin, auto-generated pages
// for denominations we have not actually written (Google penalises doorway pages).
//
// To add a denomination: append a fully-written CeremonyGuide. The route, the
// index page, and the sitemap pick it up automatically.

// Static publish/review date for these evergreen guides. Used to populate the
// Article JSON-LD datePublished/dateModified (Google treats datePublished as a
// recommended field for Article rich results). Bump dateModified when a guide's
// content is meaningfully revised.
export const GUIDES_PUBLISHED_ISO = '2026-05-29'
export const GUIDES_MODIFIED_ISO = '2026-05-29'

// Fallback Article image for rich-result eligibility (Article requires an
// image). Self-hosted in /public so it cannot 404 like a hotlink.
export const GUIDES_IMAGE = 'https://www.altarwed.com/hero-wedding.jpg'

export interface CeremonyStep {
  step: string
  detail: string
}

export interface CeremonyGuide {
  slug: string
  denomination: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string[]
  durationNote: string
  order: CeremonyStep[]
  distinctives: { heading: string; body: string }[]
  scriptures: { ref: string; note: string }[]
  musicNote: string
  faq: { q: string; a: string }[]
}

export const CEREMONY_GUIDES: CeremonyGuide[] = [
  {
    slug: 'catholic',
    denomination: 'Catholic',
    title: 'Catholic Wedding Ceremony Order',
    metaTitle: 'Catholic Wedding Ceremony Order: Full Nuptial Mass Outline',
    metaDescription:
      'A complete Catholic wedding ceremony order, from the processional through the Nuptial Mass and recessional, with the readings, blessings, and traditions explained.',
    intro: [
      'A Catholic wedding is a sacrament, not only a celebration. The Church teaches that in marriage the couple themselves are the ministers of the sacrament, and the priest or deacon serves as the Church’s official witness. That conviction shapes the entire order of service.',
      'A Catholic wedding can take two forms: a full Nuptial Mass, which includes the Liturgy of the Eucharist and usually runs about an hour, or a ceremony without Mass, often chosen when one partner is not Catholic. The outline below covers the full Nuptial Mass; simply omit the Liturgy of the Eucharist for the shorter form.',
    ],
    durationNote: 'A full Nuptial Mass typically runs 45 to 60 minutes. A ceremony without Mass runs about 30 minutes.',
    order: [
      { step: 'Processional and Entrance', detail: 'The priest, ministers, wedding party, and the couple enter, often to a sacred processional. In many parishes the bride and groom are each accompanied by both parents.' },
      { step: 'Greeting and Opening Prayer', detail: 'The priest welcomes the assembly, then prays the Collect, the opening prayer that gathers the intentions of everyone present.' },
      { step: 'Liturgy of the Word', detail: 'A reading from the Old Testament, a Responsorial Psalm, a New Testament reading, the Gospel acclamation, and the Gospel itself, followed by the homily. Couples choose their own readings from the Church’s approved options.' },
      { step: 'The Rite of Marriage', detail: 'The priest questions the couple about their freedom, faithfulness, and openness to children. The couple then exchange consent, the vows that form the sacrament.' },
      { step: 'Exchange of Rings', detail: 'The rings are blessed and exchanged as a sign of love and fidelity. Some cultures add the arras (coins) and the lasso or veil here.' },
      { step: 'Nuptial Blessing', detail: 'A solemn blessing prayed over the couple, one of the high points of the rite, asking God to keep the marriage strong.' },
      { step: 'Liturgy of the Eucharist', detail: 'In a full Mass, the offertory, Eucharistic Prayer, and Communion follow. Catholic guests receive Communion; the couple often present the gifts.' },
      { step: 'Concluding Rite and Recessional', detail: 'A final blessing is given, the marriage is recorded, and the newly married couple lead the recessional out of the church.' },
    ],
    distinctives: [
      { heading: 'Marriage is a sacrament', body: 'The Church sees marriage as a permanent, exclusive covenant that mirrors Christ’s love for the Church. This is why a Catholic wedding normally takes place inside a church, before the Blessed Sacrament.' },
      { heading: 'Preparation is required', body: 'Most dioceses require several months of marriage preparation (often called Pre-Cana) before the wedding. Begin contacting your parish at least six months ahead, sometimes a year.' },
      { heading: 'Mass or no Mass', body: 'If one partner is not Catholic, a ceremony without the Eucharist is common and fully valid. Discuss which form fits your situation with your priest.' },
    ],
    scriptures: [
      { ref: 'Genesis 2:18-24', note: 'The creation of man and woman, the first picture of two becoming one.' },
      { ref: 'Tobit 8:4-8', note: 'A beloved nuptial prayer from the Old Testament, asking God’s mercy on the marriage.' },
      { ref: '1 Corinthians 13:1-13', note: 'The definition of love that anchors the Christian vision of marriage.' },
      { ref: 'John 2:1-11', note: 'The wedding at Cana, where Jesus performs his first miracle at a marriage feast.' },
    ],
    musicNote: 'Music in a Nuptial Mass is liturgical first. Sacred pieces such as Ave Maria, Panis Angelicus, and traditional hymns are common, while many parishes restrict secular love songs to the reception. Confirm your parish’s music guidelines early.',
    faq: [
      { q: 'How long is a Catholic wedding ceremony?', a: 'A full Nuptial Mass runs about 45 to 60 minutes. A ceremony without Mass is roughly 30 minutes.' },
      { q: 'Do both people have to be Catholic?', a: 'No. A Catholic can marry a baptized non-Catholic or a non-baptized person with the proper dispensation from the diocese. These weddings are usually celebrated without a Mass.' },
      { q: 'What is Pre-Cana?', a: 'Pre-Cana is the marriage preparation the Church requires before a Catholic wedding. It covers communication, finances, faith, and family, and is arranged through your parish or diocese.' },
      { q: 'Can we write our own vows?', a: 'The consent (the vows that make the sacrament) follows the Church’s approved wording. You personalize the wedding through your choice of readings, music, and any cultural traditions, rather than by rewriting the vows themselves.' },
    ],
  },
  {
    slug: 'baptist',
    denomination: 'Baptist',
    title: 'Baptist Wedding Ceremony Order',
    metaTitle: 'Baptist Wedding Ceremony Order: A Gospel-Centered Outline',
    metaDescription:
      'A complete Baptist wedding ceremony order, from the processional through the vows, unity ceremony, and pronouncement, with the scripture and traditions behind each part.',
    intro: [
      'A Baptist wedding centers on the gospel and on Scripture. Baptists understand marriage as a covenant established by God rather than a sacrament administered by the church, so the ceremony is built around the Word, the couple’s promises before God, and the witness of the gathered congregation.',
      'Baptist ceremonies are flexible and tend to be warm and personal. The outline below is the most common shape, but pastors freely adjust the order, the message, and the traditions to fit each couple.',
    ],
    durationNote: 'A Baptist ceremony usually runs 20 to 30 minutes, longer if it includes communion or extended worship.',
    order: [
      { step: 'Prelude and Processional', detail: 'Guests are seated to music, then the wedding party and the bride enter. Many Baptist weddings keep this simple and reverent.' },
      { step: 'Welcome and Invocation', detail: 'The pastor welcomes everyone and opens in prayer, inviting God’s presence over the ceremony.' },
      { step: 'Giving Away or Presentation', detail: 'A parent or both parents present the bride, a moment that honors the families joining together.' },
      { step: 'Scripture Reading and Message', detail: 'The pastor reads Scripture and gives a short message on marriage, often gospel-centered and addressed directly to the couple. This is the heart of a Baptist ceremony.' },
      { step: 'Exchange of Vows', detail: 'The couple make their promises before God and the congregation. Vows may be traditional or personalized.' },
      { step: 'Exchange of Rings', detail: 'The rings are given as a lasting symbol of the covenant being made.' },
      { step: 'Unity Ceremony', detail: 'Many couples include a unity moment such as a unity candle or the cord of three strands, picturing God woven into the marriage.' },
      { step: 'Prayer for the Couple', detail: 'The pastor, and sometimes family or the whole congregation, prays a blessing over the new marriage.' },
      { step: 'Pronouncement and Kiss', detail: 'The pastor pronounces the couple husband and wife, and they share their first kiss as a married couple.' },
      { step: 'Presentation and Recessional', detail: 'The couple are introduced for the first time and lead the recessional as the congregation celebrates.' },
    ],
    distinctives: [
      { heading: 'Covenant, not sacrament', body: 'Baptists view marriage as a covenant before God rather than a sacrament that confers grace. The promises and the Word take center stage.' },
      { heading: 'The message matters', body: 'A short, gospel-centered message to the couple is a defining feature. It frames the marriage in terms of Christ’s love and the couple’s shared faith.' },
      { heading: 'Flexible and personal', body: 'There is no fixed liturgy, so couples have real freedom in vows, music, and traditions. Communion is sometimes included but is not required.' },
    ],
    scriptures: [
      { ref: 'Genesis 2:24', note: 'A man and woman becoming one flesh, the foundation of marriage.' },
      { ref: 'Ecclesiastes 4:9-12', note: 'The cord of three strands, often read during the unity ceremony.' },
      { ref: '1 Corinthians 13:4-7', note: 'Love is patient, love is kind, the most read passage at Christian weddings.' },
      { ref: 'Ephesians 5:22-33', note: 'Marriage as a picture of Christ and the church.' },
    ],
    musicNote: 'Baptist weddings often mix traditional hymns such as Great Is Thy Faithfulness with contemporary worship. Congregational singing is welcome, and a worship song after the vows is a common touch.',
    faq: [
      { q: 'How long is a Baptist wedding ceremony?', a: 'Most run 20 to 30 minutes. Adding communion or a longer worship set extends it.' },
      { q: 'Is communion part of a Baptist wedding?', a: 'It can be, but it is optional. Some couples take communion together as their first act as husband and wife; many do not include it.' },
      { q: 'Can we write our own vows?', a: 'Yes. Baptist ceremonies are flexible, so couples often personalize their vows or blend traditional and written promises. Confirm with your pastor.' },
      { q: 'Does a Baptist wedding have to be in a church?', a: 'No. While many take place in a church, Baptist weddings are regularly held in other venues with a pastor officiating.' },
    ],
  },
  {
    slug: 'non-denominational',
    denomination: 'Non-denominational',
    title: 'Non-denominational Christian Wedding Ceremony Order',
    metaTitle: 'Non-denominational Christian Wedding Ceremony Order and Outline',
    metaDescription:
      'A flexible non-denominational Christian wedding ceremony order, from processional to recessional, with room for personalized vows, worship, and unity traditions.',
    intro: [
      'A non-denominational Christian wedding keeps Christ at the center while giving the couple maximum freedom in how the day unfolds. Without a fixed denominational liturgy, the officiant and couple shape the ceremony around their own story, their faith, and the traditions that mean the most to them.',
      'This freedom is why non-denominational ceremonies are so popular: contemporary worship, personalized vows, and non-church venues are all common. The outline below is a reliable starting point that you can rearrange or trim.',
    ],
    durationNote: 'A non-denominational ceremony usually runs 20 to 30 minutes, depending on worship, communion, and the length of the vows.',
    order: [
      { step: 'Processional', detail: 'The wedding party and the couple enter, often to a meaningful song rather than a traditional march.' },
      { step: 'Welcome and Opening Prayer', detail: 'The officiant welcomes guests and opens in prayer, setting a Christ-centered tone from the start.' },
      { step: 'Worship Song (optional)', detail: 'Many couples include a worship song early in the ceremony, inviting the whole room to worship together.' },
      { step: 'Message or Charge to the Couple', detail: 'The officiant shares a short, faith-centered message and charges the couple to build their marriage on Christ.' },
      { step: 'Exchange of Vows', detail: 'Personalized vows are especially common here, often alongside a traditional set of promises.' },
      { step: 'Exchange of Rings', detail: 'The rings are exchanged as a symbol of the covenant and a daily reminder of the promises made.' },
      { step: 'Unity Ceremony', detail: 'A unity candle, cord of three strands, or sand ceremony pictures two lives, and God, becoming one.' },
      { step: 'Communion or Prayer (optional)', detail: 'Some couples take communion together or invite a time of prayer over the marriage.' },
      { step: 'Pronouncement and First Kiss', detail: 'The officiant pronounces the couple married, and they share their first kiss.' },
      { step: 'Recessional', detail: 'The couple are introduced and exit to a celebratory song as the guests rejoice.' },
    ],
    distinctives: [
      { heading: 'Maximum flexibility', body: 'With no denominational liturgy to follow, you can arrange the ceremony however best tells your story, as long as Christ stays at the center.' },
      { heading: 'Contemporary worship', body: 'Modern worship music and a worship moment during the ceremony are hallmarks of the non-denominational style.' },
      { heading: 'Any venue, any officiant', body: 'These weddings are often held in gardens, barns, and event spaces, led by a pastor or an ordained friend or family member.' },
    ],
    scriptures: [
      { ref: '1 Corinthians 13:4-8', note: 'The enduring description of love that shapes the marriage.' },
      { ref: 'Colossians 3:12-14', note: 'Put on love, which binds everything together in perfect unity.' },
      { ref: 'Ecclesiastes 4:12', note: 'A cord of three strands is not quickly broken, ideal for a unity moment.' },
      { ref: 'Mark 10:6-9', note: 'What God has joined together, let no one separate.' },
    ],
    musicNote: 'Non-denominational ceremonies lean contemporary. Worship songs from artists such as Phil Wickham, Bethel Music, and Elevation Worship are popular, and couples often walk in to a meaningful song rather than a classical march.',
    faq: [
      { q: 'What is a non-denominational Christian wedding?', a: 'It is a Christ-centered ceremony that is not tied to a specific denomination’s liturgy, giving the couple freedom to shape the service while keeping their faith central.' },
      { q: 'Can we personalize everything?', a: 'Largely, yes. Vows, music, readings, and traditions are all open. The constant is a clear focus on Christ at the heart of the marriage.' },
      { q: 'Who can officiate?', a: 'A pastor, or an ordained friend or family member, can officiate. Confirm the legal officiant requirements for your state.' },
      { q: 'Does it have to be in a church?', a: 'No. Non-denominational weddings are frequently held in non-church venues such as gardens, barns, and event halls.' },
    ],
  },
]

export function getGuide(slug: string): CeremonyGuide | undefined {
  return CEREMONY_GUIDES.find((g) => g.slug === slug)
}
