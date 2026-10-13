export const SIGNUP_DISCOVERY_SOURCES = [
  "Google / Search engine",
  "Social media (Instagram, TikTok, X, etc.)",
  "Friend or family recommendation",
  "School or teacher",
  "Online advertisement",
  "YouTube",
  "Podcast or blog",
  "Direct Mail",
  "Other",
] as const;

export type SignupDiscoverySource = (typeof SIGNUP_DISCOVERY_SOURCES)[number];
