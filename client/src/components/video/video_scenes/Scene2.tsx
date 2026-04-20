import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import icon from '@assets/FinVision360_Logo_H_only_chart_transparent_1776714834831.png';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45%] z-10 relative">
        <motion.div
          className="w-16 h-1 rounded-full bg-[#1A5CE8] mb-6"
          initial={{ scaleX: 0, originX: 0 }}
          animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.6 }}
        />
        
        <motion.h2 
          className="text-[4vw] font-bold text-white leading-tight mb-4"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
        >
          Net Worth<br/>Dashboard
        </motion.h2>

        <motion.p
          className="text-[1.8vw] text-[#eef0f6]/80"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          Track all assets & liabilities in one place. See your real-time net worth.
        </motion.p>
      </div>

      <div className="w-[45%] relative flex justify-center items-center">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/dashboard-abstract.png`}
          className="w-full object-contain drop-shadow-[0_0_50px_rgba(26,92,232,0.3)]"
          initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, rotateY: 0 } : { opacity: 0, scale: 0.8, rotateY: -30 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
        <motion.img 
          src={icon}
          className="absolute -right-10 top-0 w-[8vw] opacity-30"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
