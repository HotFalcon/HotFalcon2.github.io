# Wallet reader gesture research

Reviewed 2026-10-01. Scope: reduce accidental vertical movement in reader mode and slow horizontal settling.

## What Apple documents

- Apple's Wallet guide describes selecting a pass and holding the phone near a reader for contactless passes. It does not specify the reader view's drag-dismiss threshold, axis-lock ratio, spring constants, or paging duration. We cannot claim exact Wallet parity from this documentation. [Use passes in Wallet](https://support.apple.com/en-gb/guide/iphone/iphe7aa3336/ios)
- Gesture feedback should remain responsive and predictable, and gesture shortcuts should have familiar alternative controls. System edge gestures should not conflict with application gestures. [Apple HIG: Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures/)
- Native swipe recognition requires travel predominantly in its intended direction. Apple distinguishes discrete swipes from interactive transitions; tracking a card under the finger is an interactive drag. [Handling swipe gestures](https://developer.apple.com/documentation/uikit/handling-swipe-gestures)
- UIKit exposes directional scrolling and independent horizontal/vertical bounce controls. This supports treating paging and vertical movement as distinct interaction decisions, but does not disclose Wallet's implementation. [UIScrollView.bounces](https://developer.apple.com/documentation/uikit/uiscrollview/bounces)
- Apple recommends realistic motion that follows gestures, brief feedback, and allowing people to interrupt ongoing motion. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Apple's spring guidance emphasizes continuity of position and velocity, carrying gesture velocity into the release animation, and a smooth gradual rest. A spring need not bounce. Duration should first be tuned to the desired pacing; zero bounce is a useful starting point. Perceptual duration differs from final settling time. [WWDC23: Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)

## Practical recommendations for this web implementation

The following are design recommendations, not measured Apple Wallet constants:

1. Lock the reader's page/body position so a slightly diagonal horizontal drag cannot scroll the whole screen or reveal document overflow. Keep any genuinely scrollable details screen independent.
2. Use a small initial movement dead zone, then choose a single gesture axis. Require a clear vertical lead before beginning a dismiss gesture; once a horizontal drag is accepted, never switch that same gesture to dismissal.
3. Require an intentional downward pull before leaving reader mode. Upward or short vertical drags should settle back. If a vertical drag is visually supported, damp its displacement so the card feels anchored, and determine dismissal from unscaled finger travel plus direction. Keep Done or another explicit exit available.
4. Keep horizontal movement directly under the finger. Slow the release-to-page transition, not the touch response. Start around 500–650 ms for visible settling with a smooth, non-bouncy curve, then tune against the supplied recording and a physical iPhone. This duration is a proposed product tuning range, not an Apple specification.
5. Preserve current animation position when someone touches an in-flight snap; preferably preserve velocity as well. Avoid jumping to the destination before a new drag. Use reduced-motion alternatives.

## Verification cases

- Tiny vertical jitter and diagonal left/right swipes leave reader mode open and the page fixed.
- A deliberate downward pull can still exit, while upward pulls return to rest.
- Slow drags, fast flicks, canceled gestures, edge cards, and swiping again during settling do not jump or dismiss accidentally.
- Dots, selected pass, and reader animation settle together; reduced motion remains usable.
- Test on physical iPhone Safari and Home Screen mode. Desktop mobile emulation cannot establish native iOS gesture parity.
