import { useState, useEffect, useRef } from 'react';

interface UseVideoPlayerOptions {
  durations: Record<string, number>;
}

interface UseVideoPlayerResult {
  currentScene: number;
}

export function useVideoPlayer({ durations }: UseVideoPlayerOptions): UseVideoPlayerResult {
  const [currentScene, setCurrentScene] = useState(0);
  const hasStoppedRef = useRef(false);
  const sceneKeys = Object.keys(durations);
  const totalScenes = sceneKeys.length;

  useEffect(() => {
    (window as any).startRecording?.();

    let sceneIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advance = () => {
      const duration = durations[sceneKeys[sceneIndex]];
      timeoutId = setTimeout(() => {
        sceneIndex = (sceneIndex + 1) % totalScenes;
        if (sceneIndex === 0 && !hasStoppedRef.current) {
          hasStoppedRef.current = true;
          (window as any).stopRecording?.();
        }
        setCurrentScene(sceneIndex);
        advance();
      }, duration);
    };

    advance();

    return () => clearTimeout(timeoutId);
  }, []);

  return { currentScene };
}
