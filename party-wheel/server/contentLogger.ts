/**
 * Phase 10: Content Logging and Validation
 * Logs generated content for review and validates against policies
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOGS_DIR = join(process.cwd(), ".manus-logs", "content-generation");

interface ContentLogEntry {
  timestamp: string;
  segmentType: string;
  intensity: string;
  playerNames?: string[];
  generatedContent: string;
  validated: boolean;
  validationErrors?: string[];
}

/**
 * Initialize logs directory
 */
function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Log generated content for review
 */
export function logGeneratedContent(
  segmentType: string,
  intensity: string,
  content: string,
  playerNames?: string[],
  validationErrors?: string[]
): void {
  try {
    ensureLogsDir();

    const entry: ContentLogEntry = {
      timestamp: new Date().toISOString(),
      segmentType,
      intensity,
      playerNames,
      generatedContent: content,
      validated: !validationErrors || validationErrors.length === 0,
      validationErrors,
    };

    const logFile = join(LOGS_DIR, `content-${new Date().toISOString().split("T")[0]}.jsonl`);
    writeFileSync(logFile, JSON.stringify(entry) + "\n", { flag: "a" });
  } catch (err) {
    console.error("[ContentLogger] Failed to log content:", err);
  }
}

/**
 * Validate content against policies
 */
export function validateContent(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for blocked patterns
  const blockedPatterns = [
    { regex: /\b(explicit sex|nude|naked|genitals?|penis|vagina|rape|assault|molest)\b/i, reason: "Explicit sexual content" },
    { regex: /\b(hate|slur|racial|homophob|transphob)\b/i, reason: "Hate speech or discrimination" },
    { regex: /\b(kill yourself|suicide|self.harm)\b/i, reason: "Self-harm content" },
    { regex: /\b(meth|heroin|cocaine|fentanyl|drug recipe)\b/i, reason: "Illegal drug references" },
  ];

  for (const { regex, reason } of blockedPatterns) {
    if (regex.test(content)) {
      errors.push(reason);
    }
  }

  // Check for minimum length
  if (content.trim().length < 10) {
    errors.push("Content too short (minimum 10 characters)");
  }

  // Check for maximum length
  if (content.length > 500) {
    errors.push("Content too long (maximum 500 characters)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get content validation report
 */
export function getContentValidationReport(): string {
  try {
    ensureLogsDir();
    const logFile = join(LOGS_DIR, `content-${new Date().toISOString().split("T")[0]}.jsonl`);
    
    if (!existsSync(logFile)) {
      return "No content logged today";
    }

    const fs = require("fs");
    const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);
    const entries: ContentLogEntry[] = lines.map((line: string) => JSON.parse(line));

    const totalGenerated = entries.length;
    const validatedCount = entries.filter((e) => e.validated).length;
    const failedCount = entries.filter((e) => !e.validated).length;

    const failedByReason: Record<string, number> = {};
    entries.forEach((e) => {
      e.validationErrors?.forEach((err) => {
        failedByReason[err] = (failedByReason[err] ?? 0) + 1;
      });
    });

    return `Content Generation Report (${new Date().toISOString().split("T")[0]})
Total Generated: ${totalGenerated}
Validated: ${validatedCount} (${((validatedCount / totalGenerated) * 100).toFixed(1)}%)
Failed: ${failedCount}

Failed by Reason:
${Object.entries(failedByReason).map(([reason, count]) => `  - ${reason}: ${count}`).join("\n")}`;
  } catch (err) {
    console.error("[ContentLogger] Failed to generate report:", err);
    return "Error generating report";
  }
}
