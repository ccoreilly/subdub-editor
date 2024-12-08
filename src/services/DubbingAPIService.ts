import { Track } from "../types/Track";
import { DubbingAPIServiceInterface } from "./APIServiceInterface";
import { v4 as uuidv4 } from "uuid";
import { speakerService } from "./SpeakerService";
import { matxaSynthesisProvider } from "./MatxaSynthesisProvider";
import { getI18n } from "react-i18next";

const API_BASE_URL =
  process.env.DUBBING_API_BASE_URL || "http://192.168.178.152:8700";

export type DubbingJSON = {
  start: number;
  end: number;
  speaker_id: string;
  path: string;
  text: string;
  for_dubbing: boolean;
  gender: string;
  translated_text: string;
  assigned_voice: string;
  pitch: number;
  speed: number;
  volume_gain_db: number;
  dubbed_path: string;
  id: number;
};

type RegenerateDubbingJSON = DubbingJSON & {
  operation: "update" | "delete";
};

export const uuidExists = async (uuid: string): Promise<boolean> => {
  const response = await fetch(`${API_BASE_URL}/uuid_exists/?uuid=${uuid}`);
  if (!response.ok) {
    throw new Error("UUID does not exist");
  }
  return response.json();
};

export const getMediaUrl = (uuid: string, revision: string): string => {
  return `${API_BASE_URL}/get_file/?uuid=${uuid}&ext=dub&revision=${revision}`;
};

export const getSilentVideoUrl = (uuid: string): string => {
  return `${API_BASE_URL}/get_regenerate_file/?uuid=${uuid}&name=original_video`;
};

export const loadOriginalVocalsFromUUID = async (
  uuid: string
): Promise<ArrayBuffer> => {
  const response = await fetch(getOriginalVocalsUrl(uuid));
  if (!response.ok) {
    throw new Error("Failed to load original audio");
  }
  return response.arrayBuffer();
};

export const loadDubbedVocalsFromUUID = async (
  uuid: string
): Promise<ArrayBuffer> => {
  const response = await fetch(getDubbedVocalsUrl(uuid));
  if (!response.ok) {
    throw new Error("Failed to load original audio");
  }
  return response.arrayBuffer();
};

export const loadBackgroundAudioFromUUID = async (
  uuid: string
): Promise<ArrayBuffer> => {
  const response = await fetch(getBackgroundAudioUrl(uuid));
  if (!response.ok) {
    throw new Error("Failed to load background audio");
  }
  return response.arrayBuffer();
};

export const loadTracksFromUUID = async (
  uuid: string
): Promise<DubbingJSON> => {
  const response = await fetch(`${API_BASE_URL}/get_utterances?uuid=${uuid}`);
  if (!response.ok) {
    throw new Error("Failed to load dubbing data");
  }
  return response.json();
};

export const parseTracksFromJSON = (utterances: DubbingJSON[]): Track[] => {
  const tracks: Track[] = [];
  for (const utterance of utterances) {
    speakerService.setSpeaker({
      id: utterance.speaker_id,
      name: `${getI18n().t("speaker")} ${utterance.speaker_id.slice(-2)}`,
      voice: matxaSynthesisProvider.getVoice(utterance.assigned_voice),
    });

    const text = utterance.text || "";
    const translated_text = utterance.translated_text || "";

    tracks.push({
      id: utterance.id,
      start: utterance.start || 0,
      end: utterance.end || 0,
      speaker_id: utterance.speaker_id,
      path: utterance.path || "",
      text: text,
      original_text: text,
      for_dubbing: utterance.for_dubbing || false,
      ssml_gender: utterance.gender || "",
      translated_text: translated_text,
      original_translated_text: translated_text,
      pitch: utterance.pitch || 0,
      speed: utterance.speed || 1,
      volume_gain_db: utterance.volume_gain_db || 0,
      dubbed_path: utterance.dubbed_path,
      chunk_size: 0,
      needsResynthesis: false,
    });
  }

  speakerService.sortSpeakers();

  return tracks;
};

export const loadDubbedUtterance = async (
  uuid: string,
  id: number
): Promise<ArrayBuffer> => {
  const response = await fetch(
    `${API_BASE_URL}/get_dubbed_utterance/?uuid=${uuid}&id=${id}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load dubbed utterance: ${id}`);
  }
  return response.arrayBuffer();
};

export const getBackgroundAudioUrl = (uuid: string): string => {
  return `${API_BASE_URL}/get_regenerate_file/?uuid=${uuid}&name=no_vocals`;
};

export const getOriginalVocalsUrl = (uuid: string): string => {
  return `${API_BASE_URL}/get_regenerate_file/?uuid=${uuid}&name=vocals`;
};

export const getDubbedVocalsUrl = (uuid: string): string => {
  return `${API_BASE_URL}/get_regenerate_file/?uuid=${uuid}&name=dubbed_vocals`;
};

export const regenerateVideo = async (
  uuid: string,
  tracks: Track[]
): Promise<void> => {
  // Filter out deleted tracks and convert to DubbingJSON format
  const utteranceUpdate: RegenerateDubbingJSON[] = [];

  for (const track of tracks) {
    if (!track.updated && !track.deleted) {
      continue;
    }

    utteranceUpdate.push({
      id: track.id,
      start: track.start,
      end: track.end,
      speaker_id: track.speaker_id,
      path: track.path,
      text: track.text,
      for_dubbing: track.for_dubbing,
      gender: track.ssml_gender,
      translated_text: track.translated_text || "",
      assigned_voice:
        speakerService.getSpeakerById(track.speaker_id)?.voice?.id || "",
      pitch: track.pitch,
      speed: track.speed,
      volume_gain_db: track.volume_gain_db,
      dubbed_path: track.dubbed_path,
      operation: track.deleted ? "delete" : "update",
    });
  }

  const response = await fetch(`${API_BASE_URL}/regenerate_video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uuid,
      utterance_update: utteranceUpdate,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to regenerate video");
  }
};

export const DubbingAPIService: DubbingAPIServiceInterface = {
  loadOriginalVocalsFromUUID,
  loadBackgroundAudioFromUUID,
  loadDubbedVocalsFromUUID,
  loadTracksFromUUID,
  parseTracksFromJSON,
  uuidExists,
  getMediaUrl,
  getSilentVideoUrl,
  loadDubbedUtterance,
  getBackgroundAudioUrl,
  getOriginalVocalsUrl,
  getDubbedVocalsUrl,
  regenerateVideo,
};
