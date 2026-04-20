import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '@assets/FinVision360_Logo_H_(transparent)_1776714495394.png';
import icon from '@assets/FinVision360_Logo_H_only_chart_transparent_1776714834831.png';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, filter: 'blur(20px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="absolute inset-0 bg-[#1A5CE8]/10 mix-blend-overlay" />

      <motion.img 
        src={icon}
        className="w-[8vw] mb-[4vw] opacity-90"
        initial={{ opacity: 0, y: 50, scale: 0.5 }}
        animate={phase >= 1 ? { opacity: 0.9, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />

      <motion.img 
        src={logo} 
        alt="FinVision360" 
        className="w-[45vw] max-w-[700px] mb-[3vw]"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        className="text-[1.8vw] font-medium text-[#eef0f6] tracking-wide uppercase"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1, delay: 0.4 }}
      >
        Your Finances, In Focus.
      </motion.div>
    </motion.div>
  );
}
