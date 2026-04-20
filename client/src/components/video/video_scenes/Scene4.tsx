import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
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
      className="absolute inset-0 flex items-center justify-between px-[10vw] flex-row-reverse"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45%] z-10 relative">
        <motion.div
          className="w-16 h-1 rounded-full bg-[#7b2fbf] mb-6"
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
          AI-Powered<br/>Advisor
        </motion.h2>

        <motion.p
          className="text-[1.8vw] text-[#eef0f6]/80 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          Personalized debt strategies. "What-if" scenario modeling. Intelligent net worth forecasting.
        </motion.p>
      </div>

      <div className="w-[45%] relative flex justify-center items-center">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/ai-abstract.png`}
          className="w-[80%] object-contain drop-shadow-[0_0_60px_rgba(123,47,191,0.4)] mix-blend-screen"
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.5, rotate: -20 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-[#7b2fbf]/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>
    </motion.div>
  );
}
