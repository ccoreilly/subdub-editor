import React, { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import styled from 'styled-components';
import { Subtitle } from '../services/FFmpegService';
import { MediaPlayerProps, MediaPlayerRef } from './MediaPlayer';
import { formatTime } from '../utils/timeUtils';

const MediaContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledVideo = styled.video`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const VideoPlayer = forwardRef<MediaPlayerRef, MediaPlayerProps>(({ src, subtitles, mediaType }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    get currentTime() {
      return videoRef.current ? videoRef.current.currentTime : 0;
    },
    setCurrentTime(time: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    play() {
      videoRef.current?.play();
    },
    pause() {
      videoRef.current?.pause();
    },
  }));

  const subtitlesUrl = useMemo(() => {
    if (subtitles.length === 0) return '';

    const vttContent = `WEBVTT

${subtitles.map((subtitle, index) => `
${index + 1}
${formatTime(subtitle.startTime)} --> ${formatTime(subtitle.startTime + subtitle.duration)}
${subtitle.text}
`).join('\n')}
`;

    const blob = new Blob([vttContent], { type: 'text/vtt' });
    return URL.createObjectURL(blob);
  }, [subtitles]);

  useEffect(() => {
    return () => {
      if (subtitlesUrl) {
        URL.revokeObjectURL(subtitlesUrl);
      }
    };
  }, [subtitlesUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = src;
    }
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.onerror = () => {
        console.error("Video error:", video.error);
      };
    }
  }, []);

  return (
    <MediaContainer>
      <StyledVideo ref={videoRef} controls>
        <source src={src} type={mediaType} />
        {subtitlesUrl && <track default kind="captions" srcLang="en" src={subtitlesUrl} />}
        Your browser does not support the video tag.
      </StyledVideo>
    </MediaContainer>
  );
});

export default VideoPlayer;