import { useState, useRef, useEffect } from 'react';

type RecordingState = 'idle' | 'setup' | 'recording' | 'done';

export function VideoRecorder({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordingState>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, []);

  const totalDuration = 6000 + 7000 + 8000 + 7000 + 6000;

  const startRecording = async () => {
    setState('setup');
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30, displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setDownloadUrl(URL.createObjectURL(blob));
        setState('done');
        stream.getTracks().forEach(t => t.stop());
      };

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };

      mediaRecorderRef.current = recorder;

      let c = 3;
      setCountdown(c);
      setState('setup');
      const tick = setInterval(() => {
        c--;
        setCountdown(c);
        if (c === 0) {
          clearInterval(tick);
          recorder.start(100);
          setState('recording');
          setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
          }, totalDuration + 500);
        }
      }, 1000);
    } catch {
      setState('idle');
    }
  };

  const stopEarly = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="relative w-full h-screen">
      {children}

      {state === 'idle' && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Record Video
          </button>
        </div>
      )}

      {state === 'setup' && countdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center text-white">
            <div className="text-8xl font-bold mb-4" style={{ fontFamily: 'monospace' }}>{countdown}</div>
            <p className="text-lg text-white/70">Recording starts in...</p>
          </div>
        </div>
      )}

      {state === 'recording' && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/20 text-white text-sm px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording…
          </div>
          <button
            onClick={stopEarly}
            className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition-all"
          >
            Stop
          </button>
        </div>
      )}

      {state === 'done' && downloadUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e2a4a] border border-white/20 rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Video Ready</h2>
            <p className="text-white/60 text-sm mb-6">Your video has been captured as a WebM file. Most players and platforms support it — or convert to MP4 free at <span className="text-blue-400">cloudconvert.com</span>.</p>
            <a
              href={downloadUrl}
              download="FinVision360-explainer.webm"
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors mb-3"
            >
              Download Video
            </a>
            <button
              onClick={() => { setDownloadUrl(null); setState('idle'); }}
              className="block w-full text-white/50 hover:text-white/80 text-sm py-2 transition-colors"
            >
              Record Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
