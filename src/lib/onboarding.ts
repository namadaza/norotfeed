import { createHash } from "crypto";
import type { FeedItem } from "./types";

export const SIGN_UP_PATH = "/sign-up";
export const ONBOARDING_WELCOME_ID = "onboarding-welcome";

export type OnboardingFeedItem = Extract<FeedItem, { type: "onboarding" }>;

const ONBOARDING_ITEMS: OnboardingFeedItem[] = [
  {
    type: "onboarding",
    id: ONBOARDING_WELCOME_ID,
    key: ONBOARDING_WELCOME_ID,
    tone: "welcome",
    eyebrow: "Welcome",
    title: "Your feed, your way, no brain rot.",
    body: "Add your book highlights, RSS feeds, and favorite artists. Randomized and served to you in a brain nourishing feed.",
    ctaLabel: "Stop the rot",
    ctaHref: SIGN_UP_PATH,
  },
  {
    type: "onboarding",
    id: "onboarding-tip-rss",
    key: "onboarding-tip-rss",
    tone: "tip",
    eyebrow: "No Rot Tip",
    title: "Bring in the things you actually read",
    body: "Start with a few RSS feeds and let the feed surface signal instead of noise.",
    ctaLabel: "Join free",
    ctaHref: SIGN_UP_PATH,
  },
  {
    type: "onboarding",
    id: "onboarding-tip-books",
    key: "onboarding-tip-books",
    tone: "tip",
    eyebrow: "No Rot Tip",
    title: "Your books can talk back",
    body: "Add highlights and pull the best lines back into the mix when you want them.",
    ctaLabel: "Get started",
    ctaHref: SIGN_UP_PATH,
  },
  {
    type: "onboarding",
    id: "onboarding-tip-art",
    key: "onboarding-tip-art",
    tone: "tip",
    eyebrow: "No Rot Tip",
    title: "Let art interrupt the scroll",
    body: "Follow favorite artists so the feed keeps breathing with a little color and surprise.",
    ctaLabel: "Make it yours",
    ctaHref: SIGN_UP_PATH,
  },
  {
    type: "onboarding",
    id: "onboarding-tip-options",
    key: "onboarding-tip-options",
    tone: "tip",
    eyebrow: "No Rot Tip",
    title: "Tune the feed anytime",
    body: "Switch between highlights, RSS, art, and more from Feed Options whenever the mood changes.",
    ctaLabel: "Stop the rot",
    ctaHref: SIGN_UP_PATH,
  },
  {
    type: "onboarding",
    id: "onboarding-tip-options",
    key: "onboarding-tip-options",
    tone: "tip",
    eyebrow: "No Rot Tip",
    title: "Learn more with AI",
    body: "Clicking Learn More opens a new Google Gemini chat thread, pre-loaded with content from a post",
    ctaLabel: "Stop the rot",
    ctaHref: SIGN_UP_PATH,
  },
];

function makeSeededRandom(seed: string): () => number {
  const hash = createHash("sha256").update(seed).digest();
  let state = hash.readUInt32LE(0) || 1;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function injectOnboardingItems(items: FeedItem[], seed: string): FeedItem[] {
  const [welcome, ...tips] = ONBOARDING_ITEMS;
  const shuffledTips = shuffleWithSeed(tips, makeSeededRandom(`${seed}:onboarding:tips`));

  if (items.length === 0) {
    return [welcome, ...shuffledTips].map((item, index) => ({
      ...item,
      key: `${item.id}:${seed}:${index}`,
    }));
  }

  const ordered: FeedItem[] = [welcome];
  let onboardingIndex = 0;

  for (let index = 0; index < items.length; index++) {
    ordered.push(items[index]);
    if ((index + 1) % 3 === 0) {
      const tip = shuffledTips[((index + 1) / 3 - 1) % shuffledTips.length];
      if (tip) {
        ordered.push({
          ...tip,
          key: `${tip.id}:${seed}:${onboardingIndex++}`,
        });
      }
    }
  }

  return ordered.map((item, index) =>
    item.type === "onboarding"
      ? { ...item, key: index === 0 ? `${item.id}:${seed}:welcome` : item.key }
      : item,
  );
}

export function getWelcomeOnboardingItem(): OnboardingFeedItem {
  return ONBOARDING_ITEMS[0];
}
