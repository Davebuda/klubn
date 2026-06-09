import { useMemo } from 'react';
import { useReducedMotion, useIsTouch } from '../../hooks/useReducedMotion';

const PARTICLE_COUNT = 10;

interface Particle {
  id: number;
  size: number;
  left: string;
  duration: string;
  delay: string;
  opacity: number;
  drift: string;
  color: string;
}

export const FloatingParticles = () => {
  const reduced = useReducedMotion();
  const isTouch = useIsTouch();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const isOrange = Math.random() > 0.5;
      return {
        id: i,
        size: 2 + Math.random() * 2,
        left: `${Math.random() * 100}%`,
        duration: `${18 + Math.random() * 25}s`,
        delay: `${-Math.random() * 30}s`,
        opacity: 0.08 + Math.random() * 0.15,
        drift: `${-30 + Math.random() * 60}px`,
        color: isOrange
          ? `rgba(255,107,53,${0.3 + Math.random() * 0.3})`
          : `rgba(255,255,255,${0.15 + Math.random() * 0.2})`,
      };
    });
  }, []);

  if (reduced || isTouch) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            bottom: '-10px',
            backgroundColor: p.color,
            animation: `float-up ${p.duration} linear ${p.delay} infinite`,
            ['--particle-opacity' as string]: p.opacity,
            ['--particle-drift' as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
};
