// src/mastra/lib/genai.ts — unified Gemini client (Mastra migration)
// Preserves Vertex vs API-key dual mode from src/genai-client.js

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const GCLOUD_CANDIDATES = [
  `${process.env.HOME || ""}/google-cloud-sdk/bin/gcloud`,
  "/opt/homebrew/share/google-cloud-sdk/bin/gcloud",
  "/usr/local/share/google-cloud-sdk/bin/gcloud",
  "gcloud",
];
const gcloudBin = () => GCLOUD_CANDIDATES.find((p) => p === "gcloud" || existsSync(p));

export const isVertex = () =>
  String(process.env.GOOGLE_GENAI_USE_VERTEXAI || "").toLowerCase() === "true";

export function makeClient() {
  if (isVertex()) {
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      throw new Error("GOOGLE_GENAI_USE_VERTEXAI=true requires GOOGLE_CLOUD_PROJECT in .env");
    }
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    });
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export function adcToken(): string {
  return execFileSync(gcloudBin()!, ["auth", "application-default", "print-access-token"], {
    encoding: "utf8",
  }).trim();
}

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
