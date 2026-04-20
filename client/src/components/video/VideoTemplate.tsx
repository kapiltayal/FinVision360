import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { VideoRecorder } from './VideoRecorder';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  open: 6000,
  dashboard: 7000,
  features: 8000,
  ai: 7000,
  close: 6000
};

function VideoContent() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#1e2a4a]">
      {/* Persistent Background Video */}
      <div className="absolute inset-0 opacity-40">
        <video 
          src={`${import.meta.env.BASE_URL}videos/data-grid.mp4`} 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Persistent Midground Gradient / Shapes */}
      <motion.div
        className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px]"
        animate={{
          background: [
            'radial-gradient(circle, rgba(26,92,232,0.15), transparent)',
            'radial-gradient(circle, rgba(23,137,124,0.15), transparent)',
            'radial-gradient(circle, rgba(123,47,191,0.15), transparent)',
            'radial-gradient(circle, rgba(26,92,232,0.15), transparent)',
            'radial-gradient(circle, rgba(23,137,124,0.15), transparent)'
          ][currentScene],
          x: ['-20%', '10%', '-10%', '30%', '-20%'][currentScene],
          y: ['-20%', '-10%', '20%', '0%', '-20%'][currentScene],
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="dashboard" />}
        {currentScene === 2 && <Scene3 key="features" />}
        {currentScene === 3 && <Scene4 key="ai" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}

export default function VideoTemplate() {
  return (
    <VideoRecorder>
      <VideoContent />
    </VideoRecorder>
  );
}
