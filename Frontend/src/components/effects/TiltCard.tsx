import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTilt } from '../../hooks/useTilt';
import { useIsTouch, useReducedMotion } from '../../hooks/useReducedMotion';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export const TiltCard = ({ children, className, intensity = 8 }: TiltCardProps) => {
  const isTouch = useIsTouch();
  const reduced = useReducedMotion();
  const { rotateX, rotateY, scale, onMouseMove, onMouseLeave, onMouseEnter } =
    useTilt(intensity);

  if (isTouch || reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 800,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </motion.div>
  );
};
