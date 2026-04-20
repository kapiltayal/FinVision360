import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '@assets/FinVision360_Logo_H_(transparent)_1776714495394.png';
import icon from '@assets/FinVision360_Logo_H_only_chart_transparent_1776714834831.png';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.img 
          src={logo} 
          alt="FinVision360" 
          className="w-[40vw] max-w-[600px] mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />

        <motion.h1 
          className="text-[3.5vw] font-bold text-white text-center tracking-tight leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          360° Visibility Into Your<br/>
          <span className="text-[#1A5CE8]">Personal Finances.</span>
        </motion.h1>

        <motion.p
          className="text-[1.5vw] text-[#eef0f6]/70 mt-6"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          Track, Monitor, and Grow.
        </motion.p>
      </div>

      {/* Floating Icon Background Element */}
      <motion.img 
        src={icon}
        className="absolute right-[15%] top-[20%] w-[15vw] opacity-10"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
