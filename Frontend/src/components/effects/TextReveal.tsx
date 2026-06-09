import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TextRevealProps {
  children: string;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: { staggerChildren: staggerDelay },
  }),
};

const wordVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export const TextReveal = ({
  children,
  className,
  staggerDelay = 0.05,
}: TextRevealProps) => {
  const words = children.split(' ');

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={staggerDelay}
      variants={containerVariants}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.25em]"
          variants={wordVariants}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
};

/** For JSX content that includes <br/> and <span> — wraps each child in a reveal */
export const LineReveal = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 25, filter: 'blur(4px)' }}
    whileInView={{
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    }}
    viewport={{ once: true }}
  >
    {children}
  </motion.div>
);
