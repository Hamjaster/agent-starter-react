'use client';

import { MotionConfig } from 'motion/react';

/**
 * Every route fades in with CSS, so text paints without waiting for JavaScript (opacity only,
 * so fixed and sticky children keep working). MotionConfig makes every motion component
 * respect the visitor's reduced-motion setting.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="animate-page-in">{children}</div>
    </MotionConfig>
  );
}
