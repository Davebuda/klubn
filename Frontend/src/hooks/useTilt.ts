import { useCallback, useRef } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion';

interface TiltValues {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  scale: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onMouseEnter: () => void;
}

export function useTilt(intensity: number = 8): TiltValues {
  const cache = useRef<{ rect: DOMRect | null }>({ rect: null });

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawScale = useMotionValue(1);

  const rotateX = useSpring(rawX, { damping: 20, stiffness: 300 });
  const rotateY = useSpring(rawY, { damping: 20, stiffness: 300 });
  const scale = useSpring(rawScale, { damping: 20, stiffness: 300 });

  const onMouseEnter = useCallback(() => {
    rawScale.set(1.02);
  }, [rawScale]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (!cache.current.rect) {
        cache.current.rect = el.getBoundingClientRect();
      }
      const rect = cache.current.rect;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      rawX.set(-((y - centerY) / centerY) * intensity);
      rawY.set(((x - centerX) / centerX) * intensity);
    },
    [intensity, rawX, rawY],
  );

  const onMouseLeave = useCallback(() => {
    cache.current.rect = null;
    rawX.set(0);
    rawY.set(0);
    rawScale.set(1);
  }, [rawX, rawY, rawScale]);

  return { rotateX, rotateY, scale, onMouseMove, onMouseLeave, onMouseEnter };
}
