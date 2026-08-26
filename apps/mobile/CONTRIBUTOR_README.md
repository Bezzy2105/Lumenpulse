# Contributor Guidelines - Lumenpulse Mobile

Welcome! We're excited to have you contribute to the Lumenpulse Mobile app. This document outlines the workflows and expectations for contributors.

## Development Environment Setup

### 1. Emulator / Simulator Setup

- **Android**: Install [Android Studio](https://developer.android.com/studio) and set up a Virtual Device (AVD).
- **iOS (Mac only)**: Install [Xcode](https://developer.apple.com/xcode/) and its simulators.
- **Physical Device**: Install [Expo Go](https://expo.dev/expo-go) from the App Store or Play Store.

### 2. Branching & PR Workflow

- **Branch Naming**: Use `feat/`, `fix/`, or `docs/` prefixes (e.g., `feat/add-news-feed`).
- **PR Requirements**:
  - Include screenshots or screen recordings of UI changes.
  - Ensure all linting and type checks pass.
  - Link the related issue (e.g., `Closes #123`).

## Coding Standards

- **TypeScript**: Strict mode is enabled. Use proper interfaces/types for all data.
- **Styling**: Use `StyleSheet` with the project's design system colors. Avoid inline styles where possible.
- **Components**: Prefer functional components with hooks.

## Testing Expectations

- **UI Verification**: Test on at least one physical device or emulator/simulator.
- **Responsive Design**: Ensure components layout correctly on different screen sizes (phones and tablets).
- **Environment**: Verify the app handles missing environment variables gracefully.

## Integration with Backend

- Use the `API_BASE_URL` from `.env`.
- For Stellar/Soroban features, refer to the `packages/stellar-sdk` documentation.

## Getting Help

If you're stuck, please mention @Cedarich in your issue or PR, or join our community Discord.
