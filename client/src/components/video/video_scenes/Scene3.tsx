import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 7000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { title: "Investments", desc: "Monitor brokerage & retirement", color: "#17897c" },
    { title: "Debt Management", desc: "Track mortgages & loans", color: "#e87c1a" },
    { title: "Retirement Planning", desc: "Interactive forecasts", color: "#7b2fbf" }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center pt-[5vh]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -50, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <motion.h2 
        className="text-[3.5vw] font-bold text-white mb-[8vh] text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        Complete Control.
      </motion.h2>

      <div className="flex gap-[4vw] px-[10vw] w-full justify-center">
        {features.map((f, i) => (
          <motion.div 
            key={i}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-[3vw] backdrop-blur-md"
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= i + 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="w-[3vw] h-[3vw] rounded-full mb-[2vw]" style={{ backgroundColor: f.color }} />
            <h3 className="text-[1.8vw] font-bold text-white mb-[1vw] leading-tight">{f.title}</h3>
            <p className="text-[1.2vw] text-[#eef0f6]/70 leading-snug">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.img 
        src={`${import.meta.env.BASE_URL}images/retirement-abstract.png`}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60vw] opacity-20 pointer-events-none mix-blend-screen"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.2 } : { opacity: 0 }}
        transition={{ duration: 2 }}
      />
    </motion.div>
  );
}
