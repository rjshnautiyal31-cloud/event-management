import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Storage as GoogleCloudStorage } from "@google-cloud/storage";
import { env } from "../../config/env.js";

// Helper to determine Content-Type
function guessMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mov": return "video/quicktime";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".srt": return "text/plain";
    case ".json": return "application/json";
    default: return "application/octet-stream";
  }
}

// 1. Local Disk Storage Provider (Zero-Cost Local Dev & Fallback)
class LocalStorageProvider {
  constructor() {
    this.name = "local";
    this.uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
  }

  async uploadFile(fileBuffer, filename, mimetype) {
    const filePath = path.join(this.uploadDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fileBuffer);
    const baseUrl = (env.publicUrl || `http://localhost:${env.port}`).replace(/\/+$/, "");
    return `${baseUrl}/uploads/${filename}`;
  }

  getLocalFilePath(filename) {
    return path.join(this.uploadDir, filename);
  }
}

// 2. AWS S3 & Cloudflare R2 Storage Provider (S3-Compatible Cloud Storage)
class S3StorageProvider {
  constructor() {
    this.name = "s3";
    const clientConfig = {
      region: env.s3Region || "auto",
      credentials: {
        accessKeyId: env.awsAccessKeyId || "",
        secretAccessKey: env.awsSecretAccessKey || ""
      }
    };

    if (env.s3Endpoint) {
      clientConfig.endpoint = env.s3Endpoint;
      if (!env.s3Endpoint.includes("r2.cloudflarestorage.com")) {
        clientConfig.forcePathStyle = true;
      }
    }

    this.client = new S3Client(clientConfig);
  }

  async uploadFile(fileBuffer, filename, mimetype) {
    const contentType = mimetype || guessMimeType(filename);
    const command = new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: filename,
      Body: fileBuffer,
      ContentType: contentType
    });

    await this.client.send(command);

    // 1. If custom public CDN / R2 public domain is provided
    if (env.s3PublicDomain) {
      return `${env.s3PublicDomain.replace(/\/+$/, "")}/${filename}`;
    }

    // 2. Cloudflare R2 endpoint URL fallback
    if (env.s3Endpoint && env.s3Endpoint.includes("r2.cloudflarestorage.com")) {
      return `${env.s3Endpoint.replace(/\/+$/, "")}/${env.s3Bucket}/${filename}`;
    }

    // 3. AWS S3 Standard URL
    const region = env.s3Region || "us-east-1";
    return `https://${env.s3Bucket}.s3.${region}.amazonaws.com/${filename}`;
  }
}

// 3. Google Cloud Storage (GCS) Provider (Reuses GCP Credentials / Project)
class GCSStorageProvider {
  constructor() {
    this.name = "gcs";
    const serviceAccountPath = path.join(process.cwd(), "gcp-service-account.json");
    
    const options = {
      projectId: env.googleCloudProject
    };

    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fsSync.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      } else if (fsSync.existsSync(serviceAccountPath)) {
        options.keyFilename = serviceAccountPath;
      }
      // If neither file exists on disk, GoogleCloudStorage automatically uses Cloud Run Application Default Credentials (ADC)
    } catch (_) {}

    this.storage = new GoogleCloudStorage(options);
    this.bucketName = env.gcsBucket || env.s3Bucket || "event-story-media";
  }

  async uploadFile(fileBuffer, filename, mimetype) {
    const contentType = mimetype || guessMimeType(filename);
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filename);

    await file.save(fileBuffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000"
      }
    });

    return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
  }
}

// Singletons
const localAdapter = new LocalStorageProvider();
let s3Adapter = null;
let gcsAdapter = null;

export function resetStorageAdapters() {
  s3Adapter = null;
  gcsAdapter = null;
}

export function getStorageProvider() {
  const provider = (env.storageProvider || "").toLowerCase();

  // Explicit GCS or GCS bucket configured
  if (provider === "gcs" || (env.gcsBucket && !env.awsAccessKeyId)) {
    if (!gcsAdapter) gcsAdapter = new GCSStorageProvider();
    return gcsAdapter;
  }

  // Explicit S3, Cloudflare R2, or AWS keys present
  if (provider === "s3" || provider === "r2" || (env.awsAccessKeyId && env.s3Bucket)) {
    if (!s3Adapter) s3Adapter = new S3StorageProvider();
    return s3Adapter;
  }

  // Default: Local disk storage
  return localAdapter;
}

// Universal helper to upload any file buffer
export async function uploadAssetBuffer(fileBuffer, filename, mimetype) {
  const storage = getStorageProvider();
  return storage.uploadFile(fileBuffer, filename, mimetype);
}

/**
 * Builds a clean, unique storage key for a story asset directly under {story-name}_{shortId}/
 * E.g., sarah-wedding_a1b2c3/audio/song_123.mp3
 *       sarah-wedding_a1b2c3/scenes/raw/upload_123.jpg
 *       sarah-wedding_a1b2c3/scenes/clips/scene_1_clip_123.mp4
 *       sarah-wedding_a1b2c3/renders/rendered_video_1080p_123.mp4
 */
export function buildStoryStorageKey({ projectId, title = "", category = "scenes", filename }) {
  let slug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  if (!slug) slug = "story";

  const shortId = projectId ? projectId.toString().slice(-6) : Date.now().toString().slice(-6);
  const storyFolder = `${slug}_${shortId}`;

  const cleanFilename = path.basename(filename);
  if (category) {
    const cleanCategory = category.replace(/^\/+|\/+$/g, "");
    return `${storyFolder}/${cleanCategory}/${cleanFilename}`;
  }
  return `${storyFolder}/${cleanFilename}`;
}
