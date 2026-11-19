export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    ttsLangCode: "en",
    gcpVoice: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
    gcpVoices: {
      female: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
      male: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
      speaker_a: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
      speaker_b: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
      narrator: { languageCode: "en-US", name: "en-US-Neural2-J", ssmlGender: "MALE" },
      narrator_female: { languageCode: "en-US", name: "en-US-Neural2-C", ssmlGender: "FEMALE" }
    },
    elevenLabsVoices: {
      female: "21m00Tcm4TlvDq8ikWAM",      // Rachel
      male: "pNInz6obpgDQGcFmaJgB",        // Adam
      narrator: "VR6AewLTigWG4xSOukaG",    // Arnold / Deep Announcer
      narrator_female: "EXAVITQu4vr4xnSDxMaL" // Bella
    }
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    ttsLangCode: "hi",
    gcpVoice: { languageCode: "hi-IN", name: "hi-IN-Neural2-A", ssmlGender: "FEMALE" },
    gcpVoices: {
      female: { languageCode: "hi-IN", name: "hi-IN-Neural2-A", ssmlGender: "FEMALE" },
      male: { languageCode: "hi-IN", name: "hi-IN-Neural2-B", ssmlGender: "MALE" },
      speaker_a: { languageCode: "hi-IN", name: "hi-IN-Neural2-A", ssmlGender: "FEMALE" },
      speaker_b: { languageCode: "hi-IN", name: "hi-IN-Neural2-B", ssmlGender: "MALE" },
      narrator: { languageCode: "hi-IN", name: "hi-IN-Neural2-C", ssmlGender: "MALE" },
      narrator_female: { languageCode: "hi-IN", name: "hi-IN-Neural2-D", ssmlGender: "FEMALE" }
    },
    elevenLabsVoices: {
      female: "21m00Tcm4TlvDq8ikWAM",
      male: "pNInz6obpgDQGcFmaJgB",
      narrator: "onwK4e9ZLuTAKqWW03F9",
      narrator_female: "EXAVITQu4vr4xnSDxMaL"
    }
  },
  {
    code: "hinglish",
    name: "Hinglish",
    nativeName: "Hindi + English",
    flag: "🇮🇳",
    ttsLangCode: "hi",
    gcpVoice: { languageCode: "en-IN", name: "en-IN-Neural2-A", ssmlGender: "FEMALE" },
    gcpVoices: {
      female: { languageCode: "en-IN", name: "en-IN-Neural2-A", ssmlGender: "FEMALE" },
      male: { languageCode: "en-IN", name: "en-IN-Neural2-B", ssmlGender: "MALE" },
      speaker_a: { languageCode: "en-IN", name: "en-IN-Neural2-A", ssmlGender: "FEMALE" },
      speaker_b: { languageCode: "en-IN", name: "en-IN-Neural2-B", ssmlGender: "MALE" },
      narrator: { languageCode: "en-IN", name: "en-IN-Neural2-C", ssmlGender: "MALE" },
      narrator_female: { languageCode: "en-IN", name: "en-IN-Neural2-D", ssmlGender: "FEMALE" }
    },
    elevenLabsVoices: {
      female: "21m00Tcm4TlvDq8ikWAM",
      male: "pNInz6obpgDQGcFmaJgB",
      narrator: "onwK4e9ZLuTAKqWW03F9",
      narrator_female: "EXAVITQu4vr4xnSDxMaL"
    }
  }
];

export function getLanguageConfig(code = "en") {
  if (!code) return SUPPORTED_LANGUAGES[0];
  const normalized = String(code).trim().toLowerCase();
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized || l.name.toLowerCase() === normalized
  );
  return match || SUPPORTED_LANGUAGES[0];
}

export function getLanguageGcpVoice(code = "en", voiceType = "female", voiceRole = "") {
  const config = getLanguageConfig(code);
  const role = String(voiceRole || "").toLowerCase();
  const isMale = String(voiceType || "").toLowerCase() === "male";

  if (role === "narrator") {
    if (!isMale && config.gcpVoices?.narrator_female) {
      return config.gcpVoices.narrator_female;
    }
    if (config.gcpVoices?.narrator) {
      return config.gcpVoices.narrator;
    }
  }
  if (role === "speaker_b") {
    return isMale
      ? (config.gcpVoices?.speaker_b || config.gcpVoices?.male || config.gcpVoice)
      : (config.gcpVoices?.narrator_female || config.gcpVoices?.female || config.gcpVoice);
  }
  if (isMale && config.gcpVoices?.male) {
    return config.gcpVoices.male;
  }
  return config.gcpVoices?.female || config.gcpVoice;
}
