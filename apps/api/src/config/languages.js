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
      male: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" }
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
      male: { languageCode: "hi-IN", name: "hi-IN-Neural2-B", ssmlGender: "MALE" }
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
      male: { languageCode: "en-IN", name: "en-IN-Neural2-B", ssmlGender: "MALE" }
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

export function getLanguageGcpVoice(code = "en", voiceType = "female") {
  const config = getLanguageConfig(code);
  const isMale = String(voiceType).toLowerCase() === "male";
  if (isMale && config.gcpVoices?.male) {
    return config.gcpVoices.male;
  }
  return config.gcpVoices?.female || config.gcpVoice;
}
