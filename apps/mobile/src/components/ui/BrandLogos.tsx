import React from "react";
import Svg, { Path, G } from "react-native-svg";

/**
 * Official Google "G" mark.
 *
 * Reproduced per Google's Sign-In branding guidelines
 * (https://developers.google.com/identity/branding-guidelines): four-color
 * geometric "G" rendered at the size requested by the caller. Do not recolor
 * or stretch — Google requires the canonical palette.
 */
export function GoogleGMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

/**
 * Apple logo glyph (single-color).
 *
 * Reproduced per Apple's Sign in with Apple Human Interface Guidelines
 * (https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple).
 * The glyph color is passed by the caller so it can adapt to the surface
 * (white on a black button, black on a white button). The lucide Apple icon
 * we used previously is NOT the licensed Apple glyph and would fail App
 * Review brand compliance.
 */
export function AppleLogoMark({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <G>
        <Path
          fill={color}
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.9 96.8c30-35.6 27.3-68 26.4-79.7-26.5 1.5-57.2 18-74.7 38.3-19.3 21.8-30.6 48.7-28.2 79.1 28.6 2.2 54.6-12.5 76.5-37.7z"
        />
      </G>
    </Svg>
  );
}
