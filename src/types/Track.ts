export interface Track {
  // A unique identifier for the track
  id: string;

  // The start time of the track in seconds
  start: number;

  // The end time of the track in seconds
  end: number;

  // An identifier for the speaker
  speaker_id: string;

  // The path to the original audio file
  path: string;

  // The original text content
  text: string;

  // A boolean indicating if this track is for dubbing
  for_dubbing: boolean;

  // The gender of the voice for SSML
  ssml_gender: string;

  // The translated text content
  translated_text: string;

  // The assigned voice for dubbing
  assigned_voice: string;

  // The pitch adjustment for the voice
  pitch: number;

  // The speed adjustment for the voice
  speed: number;

  // The volume gain in decibels
  volume_gain_db: number;

  // An optional path to the dubbed audio file
  dubbed_path: string;

  // An optional chunk size for processing
  chunk_size: number;
}
