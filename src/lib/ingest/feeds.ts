/**
 * Canonical lists of default RSS follows and WikiArt artist pages.
 * Shared by the ingest scripts (scripts/**) and the refresh-feed workflow
 * (src/workflows/refresh-feed.ts) so they never drift.
 */

/**
 * Each entry is either a publication URL, where the ingest logic appends
 * `/feed`, or a direct RSS feed URL ending in `/feed` or `/rss`.
 */
export const RSS_FOLLOWS: string[] = [
  "https://www.afterbabel.com",
  "https://www.aporiamagazine.com",
  "https://www.arktosjournal.com",
  "https://www.avdullahyousef.com",
  "https://www.beautyofsaas.com",
  "https://bheria.substack.com",
  "https://www.dropsitenews.com",
  "https://escalationtrap.substack.com",
  "https://georgenoble.substack.com",
  "https://www.greentape.pub",
  "https://heavenlyorder.substack.com",
  "https://ibnabeeomar.substack.com",
  "https://www.infinitescroll.us",
  "https://theiqrafiles.com/feed/",
  "https://jason807.substack.com",
  "https://jalalayn.substack.com",
  "https://kasurian.com",
  "https://www.khawatir.blog",
  "https://kyla.substack.com",
  "https://www.lennysnewsletter.com",
  "https://meaningness.substack.com",
  "https://mazmhussain.substack.com",
  "https://michaeljburry.substack.com",
  "https://mikecormack.substack.com",
  "https://www.themazaj.org",
  "https://naifalbidh.substack.com",
  "https://newsletter.outbound.kitchen",
  "https://occasionalreflections.substack.com",
  "https://on.substack.com",
  "https://postapathy.substack.com",
  "https://predictivehistory.substack.com",
  "https://saadyacoob.substack.com",
  "https://somaliki.substack.com",
  "https://subscribe.martyrmade.com",
  "https://thewaxingcrescent.substack.com",
  "https://www.bleepingcomputer.com/feed/",
  "https://www.wheresyoured.at/rss/",
  "https://www.404media.co",
];

/**
 * WikiArt artist URL slugs ingested as default (global) artwork.
 */
export const ARTIST_PAGES = [
  "zainul-abedin",
  "sm-sultan",
  "edouard-manet",
  "claude-monet",
  "ahmad-musa",
  "mir-ali-tabrizi",
  "ustad-mansur",
  "sultan-muhammad",
  "alexandre-gabriel-decamps",
  "jean-leon-gerome",
  "johan-jongkind",
  "henri-edmond-cross",
  "vincent-van-gogh",
  "santiago-rusinol",
  "charles-reiffel",
  "konstantinos-volanakis",
  "maurice-braun",
  "jose-maria-velasco",
  "m-f-husain",
  "abanindranath-tagore",
];
