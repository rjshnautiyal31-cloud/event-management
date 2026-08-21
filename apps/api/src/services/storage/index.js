import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

// Local Disk Storage Provider (Zero-Cost Local Dev)
class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
  }

  async uploadFile(fileBuffer, filename) {
    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, fileBuffer);
    return `http://localhost:${env.port}/uploads/${filename}`;
  }
}

// AWS S3 / Cloudflare R2 Storage Provider (Cloud Production)
class S3StorageProvider {
  constructor() {
    this.client = new S3Client({
      region: env.s3Region || "us-east-1",
      endpoint: env.s3Endpoint || undefined,
      credentials: {
        accessKeyId: env.awsAccessKeyId || "",
        secretAccessKey: env.awsSecretAccessKey || ""
      }
    });
  }

  async uploadFile(fileBuffer, filename) {
    const command = new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: filename,
      Body: fileBuffer
    });
    await this.client.send(command);
    return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${filename}`;
  }
}

const localAdapter = new LocalStorageProvider();
const s3Adapter = new S3StorageProvider();

export function getStorageProvider() {
  return env.storageProvider === "s3" ? s3Adapter : localAdapter;
}
