import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useTranslation } from 'react-i18next';
import MediaPlayer, { MediaPlayerRef } from './components/MediaPlayer';
import TrackTimeline from './components/TrackTimeline';
import TrackList from './components/TrackList';
import { extractTracks, rebuildMedia } from './services/FFmpegService';
import TrackEditModal from './components/TrackEditModal';
import { Button, Select, colors, typography, ModalOverlay } from './styles/designSystem';
import { Input } from './styles/designSystem';
import { Track } from './types/Track';
import { APIServiceInterface } from './services/APIServiceInterface';
import { TranscriptionAPIService } from './services/TranscriptionAPIService';
import { DubbingAPIService } from './services/DubbingAPIService';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: ${typography.fontFamily};
    background-color: ${colors.secondaryBackground};
    color: ${colors.black};
  }
`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
  background-color: ${colors.background};
`;

const Header = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 10px;
  padding: 5px;
  gap: 10px;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #ff6b6b;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 10px;
  background-color: ${props => props.active ? colors.primary : colors.desactivat};
  color: ${props => props.active ? colors.white : colors.black};
  border: none;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${props => props.active ? colors.primaryLight : colors.desactivatLight};
  }
`;

const VideoContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 30vh;
  width: 100%;
  margin: 0px;
`;

const ContentContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const TrackContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CenteredMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 1.2em;
  color: ${colors.primary};
`;

const CenteredContent = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

function App() {
  const { t, i18n } = useTranslation();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'list'>('timeline');
  const [mediaType, setMediaType] = useState<string>('');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const mediaRef = useRef<MediaPlayerRef | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isUUIDMode, setIsUUIDMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiService, setApiService] = useState<APIServiceInterface>(DubbingAPIService);
  const [isLoading, setIsLoading] = useState(false);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const uuidParam = params.get('uuid');
    const serviceParam = params.get('service');
    console.log("Initial useEffect - UUID param:", uuidParam, "Service param:", serviceParam);
    if (uuidParam) {
      setIsUUIDMode(true);
      setApiService(serviceParam === 'transcription' ? TranscriptionAPIService : DubbingAPIService);
      handleFileOrUUIDSelect(null, uuidParam);
    }
  }, []);

  const handleDownloadResult = async () => {
    if (mediaUrl && tracks.length > 0) {
      try {
        let fileToProcess: File;
        if (mediaFile) {
          fileToProcess = mediaFile;
        } else {
          // If we don't have a mediaFile (in case of UUID), we need to fetch it
          const response = await fetch(mediaUrl);
          const blob = await response.blob();
          fileToProcess = new File([blob], mediaFileName, { type: mediaType });
        }
        const newMediaBlob = await rebuildMedia(fileToProcess, tracks);
        const url = URL.createObjectURL(newMediaBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `output_${mediaFileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading result:", error);
      }
    }
  };

  const handleCloseMedia = () => {
    setMediaFile(null);
    setMediaUrl('');
    setTracks([]); // Ensure tracks are cleared
    setCurrentTime(0);
    setIsPlaying(false);
    setMediaType('');
    setMediaFileName('');
    if (mediaRef.current) {
      mediaRef.current.setCurrentTime(0);
    }
    // Revoke the object URL to free up memory
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
  };

  const handleTimeChange = (newTime: number) => {
    if (mediaRef.current) {
      mediaRef.current.setCurrentTime(newTime);
    }
  };

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
      if (mediaRef.current) {
        if (isPlaying) {
          mediaRef.current.pause();
          setIsPlaying(false);
        } else {
          mediaRef.current.play();
          setIsPlaying(true);
        }
      }
    }
  }, [isPlaying]);

  const handleTrackChange = (index: number, updatedTrack: Track) => {
    const newTracks = [...tracks];
    newTracks[index] = updatedTrack;
    setTracks(newTracks);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress, isPlaying]);

  useEffect(() => {
    const updateCurrentTime = () => {
      if (mediaRef.current) {
        setCurrentTime(mediaRef.current.currentTime);
      }
    };

    const interval = setInterval(updateCurrentTime, 100);

    return () => clearInterval(interval);
  }, []);

  const changeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  const handleFileOrUUIDSelect = useCallback(async (file: File | null, newUuid: string | null) => {
    console.log("handleFileOrUUIDSelect called with UUID:", newUuid);
    
    // Revoke existing object URL if there is one
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }

    // Clear existing tracks and errors before loading new media
    setTracks([]);
    setLoadError(null);
    setIsLoading(true);

    if (newUuid) {
      setMediaFile(null);
      try {
        console.log("Starting API calls for UUID:", newUuid);
        // Fetch video data and tracks data concurrently
        const [videoDataResponse, tracksDataResponse] = await Promise.all([
          apiService.loadVideoFromUUID(newUuid),
          apiService.loadTracksFromUUID(newUuid)
        ]);
        console.log("API calls completed for UUID:", newUuid);

        setMediaUrl(videoDataResponse.url);
        setMediaType(videoDataResponse.contentType);
        setMediaFileName(videoDataResponse.filename);
        setTracks(apiService.parseTracksFromJSON(tracksDataResponse));
      } catch (error) {
        console.error("Error loading media or tracks from UUID:", error);
        setLoadError('errorLoadingUUID');
      }
    } else if (file) {
      setMediaFile(file);
      setMediaType(file.type);
      setMediaFileName(file.name);
      try {
        const url = URL.createObjectURL(file);
        setMediaUrl(url);
        const extractedTracks = await extractTracks(file);
        setTracks(extractedTracks);
      } catch (error) {
        console.error("Error processing media file:", error);
        setTracks([]);
      }
    }
    setIsLoading(false);
  }, [apiService, mediaUrl]);

  const handleEditTrack = (track: Track) => {
    setEditingTrack(track);
  };

  const handleSaveTrack = (updatedTrack: Track) => {
    if (editingTrack) {
      const newTracks = tracks.map(t => 
        t.id === editingTrack.id ? updatedTrack : t
      );
      setTracks(newTracks);
      setEditingTrack(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      handleFileOrUUIDSelect(selectedFile, null);
    }
  };

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <Header>
          {mediaUrl && (
            <>
              {!isUUIDMode && (
                <Button onClick={() => {
                  handleCloseMedia();
                }}>{t('closeMedia')}</Button>
              )}
              <Button onClick={handleDownloadResult}>{t('downloadResult')}</Button>
            </>
          )}
          <Select onChange={changeLanguage} value={i18n.language}>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="ca">Català</option>
          </Select>
        </Header>
        <ContentContainer>
          {isLoading ? (
            <CenteredMessage>{t('loading')}</CenteredMessage>
          ) : mediaUrl ? (
            <>
              <VideoContainer>
                <MediaPlayer src={mediaUrl} tracks={tracks} ref={mediaRef} mediaType={mediaType} />
              </VideoContainer>
              <TrackContainer>
                {tracks.length > 0 && (
                  <>
                    <TabContainer>
                      <Tab active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>{t('timeline')}</Tab>
                      <Tab active={activeTab === 'list'} onClick={() => setActiveTab('list')}>{t('list')}</Tab>
                    </TabContainer>
                    {activeTab === 'timeline' ? (
                      <TrackTimeline
                        tracks={tracks}
                        setTracks={setTracks}
                        currentTime={currentTime}
                        onTimeChange={handleTimeChange}
                        onEditTrack={handleEditTrack}
                      />
                    ) : (
                      <TrackList
                        tracks={tracks}
                        onTrackChange={handleTrackChange}
                        onTimeChange={handleTimeChange}
                        onEditTrack={handleEditTrack}
                      />
                    )}
                  </>
                )}
              </TrackContainer>
            </>
          ) : loadError ? (
            <CenteredMessage>{t(loadError)}</CenteredMessage>
          ) : !isUUIDMode ? (
            <CenteredContent>
              <Input type="file" onChange={handleFileChange} />
              <Button onClick={handleSubmit} disabled={!selectedFile}>{t('openFile')}</Button>
            </CenteredContent>
          ) : null}
        </ContentContainer>
      </AppContainer>
      <TrackEditModal
        track={editingTrack}
        onSave={handleSaveTrack}
        onClose={() => setEditingTrack(null)}
        ModalOverlay={ModalOverlay}
      />
    </>
  );
}

export default App;
