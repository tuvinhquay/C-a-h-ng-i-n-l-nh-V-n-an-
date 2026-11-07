import { useEffect, useRef } from "react";

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pauseForReducedMotion = () => {
      if (motionPreference.matches) video.pause();
    };

    pauseForReducedMotion();
    motionPreference.addEventListener("change", pauseForReducedMotion);
    return () => motionPreference.removeEventListener("change", pauseForReducedMotion);
  }, []);

  return (
    <div className="video-background" aria-hidden="true">
      <video
        ref={videoRef}
        className="video-background__media"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
      >
        <source src="/media/videonen.mp4" type="video/mp4" />
      </video>
      <div className="video-background__overlay" />
    </div>
  );
}
