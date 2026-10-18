# Public pages and homepage carousel

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

## Marketing navigation and layout

Pricing and Blog use the shared marketing navigation rather than replacing it with a Back to home action. Signed-out visitors retain Sign In and Get Started actions. Pricing uses blue/light-blue accents and a compact hero; Blog uses a matching compact hero while keeping its content-aligned width.

See `client/src/components/` for the public layout and `client/src/pages/{landing,pricing,blog}.tsx` for page content. Pricing call-to-action behavior differs for signed-in visitors; see [Pricing](Pricing_page.md).

## Homepage carousel

`client/src/components/landing-dashboard-carousel.tsx` replaces the old single dashboard preview with three slides, currently all showing the same dashboard illustration.

- Embla Carousel keeps all three slides mounted in a horizontal flex track.
- Every six seconds, the current slide moves left and the next enters from the right. Looping includes the third-to-first transition without a keyed fade/remount.
- Three centered dots indicate the active slide and allow selection. There are no visible arrow, pause/play, or counter controls.
- Hover or keyboard focus pauses autoplay. Reduced-motion preferences disable autoplay and use nonanimated manual navigation.
- Keyboard navigation supports arrows and Home/End; slide labeling and live-region behavior support assistive technology.
- To replace the illustrations later, set each entry's `src` and descriptive `alt` in the local `slides` array. An omitted `src` renders the existing `DashboardPreview`; no backend or database is involved.

## Signup

Signup includes a password-visibility eye control and red required-field markers. “How did you find us?” is required after the password field. Its options include search, social media, recommendations, school/teacher, advertisements, YouTube, podcast/blog, direct mail and Other.

The selection is submitted through Supabase user metadata and persisted as `users.discovery_source` during local-profile synchronization. Older users can have a null discovery source. Passwords remain in Supabase Auth, not the application's user profile table.

## Contact and feedback

The Contact Us form marks its required name, email, subject and message fields. Both Contact Us and authenticated feedback save their submissions before requesting a notification email. A mail failure must not invite duplicate resubmission after successful storage. See [notification handling](Resend_feedback_notifications.md).
