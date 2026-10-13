export const SIGNUP_REFERRAL_SOURCES = [
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

export type SignupReferralSource = typeof SIGNUP_REFERRAL_SOURCES[number];

export function isSignupReferralSource(value: unknown): value is SignupReferralSource {
  return typeof value === "string"
    && SIGNUP_REFERRAL_SOURCES.some((source) => source === value);
}
