import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useReducedMotion, useIsTouch } from '../../hooks/useReducedMotion';

export const BackgroundEffects = () => {
  const reduced = useReducedMotion();
  const isTouch = useIsTouch();

  // Cursor tracking
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const smoothX = useSpring(mouseX, { damping: 25, stiffness: 150 });
  const smoothY = useSpring(mouseY, { damping: 25, stiffness: 150 });

  // Secondary glow — trails behind with heavier damping
  const trailX = useSpring(mouseX, { damping: 50, stiffness: 60 });
  const trailY = useSpring(mouseY, { damping: 50, stiffness: 60 });

  const rafId = useRef(0);

  useEffect(() => {
    if (isTouch || reduced) return;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isTouch, reduced, mouseX, mouseY]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Animated gradient orbs — clamped inside viewport */}
      <div
        className="absolute top-0 left-0 h-[300px] w-[300px] sm:h-[400px] sm:w-[400px] md:h-[600px] md:w-[600px] rounded-full opacity-[0.09]"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.6) 0%, transparent 70%)',
          filter: 'blur(40px)',
          willChange: 'transform',
        }}
      />
      <div
        className="absolute bottom-0 right-0 h-[250px] w-[250px] sm:h-[350px] sm:w-[350px] md:h-[500px] md:w-[500px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, rgba(93,23,37,0.7) 0%, transparent 70%)',
          filter: 'blur(40px)',
          willChange: 'transform',
        }}
      />

      {/* Club light glow — cursor-following, large soft area with color cycling */}
      {!isTouch && !reduced && (
        <>
          {/* Primary glow — follows cursor */}
          <motion.div
            style={{
              x: smoothX,
              y: smoothY,
              translateX: '-50%',
              translateY: '-50%',
            }}
            className="fixed z-10 max-w-[100vw] max-h-[100vh]"
          >
            <div
              style={{
                width: 'min(600px, 70vw)',
                height: 'min(600px, 70vw)',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(255,107,53,0.10) 0%, rgba(255,107,53,0.05) 30%, rgba(255,80,40,0.02) 55%, transparent 75%)',
                willChange: 'transform',
              }}
            />
          </motion.div>

          {/* Secondary glow — trails behind, different color tone */}
          <motion.div
            style={{
              x: trailX,
              y: trailY,
              translateX: '-50%',
              translateY: '-50%',
            }}
            className="fixed z-10 max-w-[100vw] max-h-[100vh]"
          >
            <div
              style={{
                width: 'min(500px, 60vw)',
                height: 'min(500px, 60vw)',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(180,50,70,0.07) 0%, rgba(140,40,60,0.035) 30%, rgba(93,23,37,0.012) 55%, transparent 75%)',
                willChange: 'transform',
              }}
            />
          </motion.div>
        </>
      )}
    </div>
  );
};
