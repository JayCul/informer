import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Scroll reveal. Deliberately small: opacity and a short rise, once, with the
 * viewport margin set so content is already settled by the time it is read.
 * prefers-reduced-motion is handled globally in index.css.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
