export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    gcpVoice: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" }
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "hi-IN", name: "hi-IN-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    gcpVoice: { languageCode: "es-ES", name: "es-ES-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    gcpVoice: { languageCode: "fr-FR", name: "fr-FR-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    gcpVoice: { languageCode: "de-DE", name: "de-DE-Neural2-F", ssmlGender: "FEMALE" }
  },
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    gcpVoice: { languageCode: "it-IT", name: "it-IT-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇧🇷",
    gcpVoice: { languageCode: "pt-BR", name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    gcpVoice: { languageCode: "ja-JP", name: "ja-JP-Neural2-B", ssmlGender: "FEMALE" }
  },
  {
    code: "zh",
    name: "Chinese (Mandarin)",
    nativeName: "中文",
    flag: "🇨🇳",
    gcpVoice: { languageCode: "cmn-CN", name: "cmn-CN-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    gcpVoice: { languageCode: "ar-XA", name: "ar-XA-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    gcpVoice: { languageCode: "ru-RU", name: "ru-RU-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    gcpVoice: { languageCode: "ko-KR", name: "ko-KR-Neural2-A", ssmlGender: "FEMALE" }
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "bn-IN", name: "bn-IN-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "ta-IN", name: "ta-IN-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "te-IN", name: "te-IN-Standard-A", ssmlGender: "FEMALE" }
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "mr-IN", name: "mr-IN-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "gu-IN", name: "gu-IN-Wavenet-A", ssmlGender: "FEMALE" }
  },
  {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    flag: "🇮🇳",
    gcpVoice: { languageCode: "pa-IN", name: "pa-IN-Wavenet-A", ssmlGender: "FEMALE" }
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
