import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, "../client/src/data/contentPacks");

const REQUIRED_SEGMENTS = [
  "braincell_check",
  "truth_cache",
  "glitch_dare",
  "prompt_duel",
  "robot_slapdown",
  "system_crash",
  "crowd_override",
  "holo_drama",
  "firewall_bonus",
] as const;

const MIN_COUNTS: Record<string, number> = {
  braincell_check: 30,
  truth_cache: 30,
  glitch_dare: 30,
  prompt_duel: 30,
  robot_slapdown: 20,
  system_crash: 20,
  crowd_override: 20,
  holo_drama: 20,
  firewall_bonus: 20,
};

const BANNED_PHRASES = [
  "interpretive dance",
  "your mom",
  "rape",
  "child",
  "minor",
  "underage",
  "illegal",
  "murder",
  // explicit body parts / graphic content
  "penis",
  "vagina",
  "genitals",
  "nude",
  "naked body",
  "masturbat",
  "pornograph",
];

interface TriviaQuestion {
  q: string;
  a: string;
  options: string[];
  correct: number;
}

type ContentEntry = string | TriviaQuestion;

interface ContentPack {
  pack: string;
  intensity: string;
  version: string;
  content: Record<string, ContentEntry[]>;
}

let totalErrors = 0;
let totalWarnings = 0;

function error(msg: string) {
  console.error(`  ❌ ${msg}`);
  totalErrors++;
}

function warn(msg: string) {
  console.warn(`  ⚠️  ${msg}`);
  totalWarnings++;
}

function pass(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function validatePack(packName: string, pack: ContentPack) {
  console.log(`\n📦 Validating: ${packName}`);

  if (!pack.pack) error("Missing 'pack' field");
  if (!pack.intensity) error("Missing 'intensity' field");
  if (!pack.content) { error("Missing 'content' field"); return; }

  for (const seg of REQUIRED_SEGMENTS) {
    const items = pack.content[seg];
    if (!items) {
      error(`Missing segment: ${seg}`);
      continue;
    }

    const minCount = MIN_COUNTS[seg] ?? 20;
    if (items.length < minCount) {
      error(`${seg}: only ${items.length} items, need ${minCount}`);
    } else {
      pass(`${seg}: ${items.length} items ✓`);
    }

    // Check for empty strings
    const emptyItems = items.filter((item) =>
      typeof item === "string" ? item.trim() === "" : !item.q || item.q.trim() === ""
    );
    if (emptyItems.length > 0) {
      error(`${seg}: ${emptyItems.length} empty items`);
    }

    // Check for duplicate prompts
    const strings = items.map((item) =>
      typeof item === "string" ? item.toLowerCase().trim() : (item as TriviaQuestion).q.toLowerCase().trim()
    );
    const unique = new Set(strings);
    if (unique.size < strings.length) {
      error(`${seg}: ${strings.length - unique.size} duplicate prompt(s)`);
    }

    // Check banned phrases
    for (const item of items) {
      const text = typeof item === "string" ? item : JSON.stringify(item);
      for (const banned of BANNED_PHRASES) {
        if (text.toLowerCase().includes(banned.toLowerCase())) {
          error(`${seg}: contains banned phrase "${banned}" in: "${text.slice(0, 60)}..."`);
        }
      }
    }

    // For trivia: validate structure
    if (seg === "braincell_check") {
      for (const item of items) {
        if (typeof item === "string") {
          warn(`braincell_check: item is a plain string, expected trivia object: "${item.slice(0, 40)}"`);
          continue;
        }
        const q = item as TriviaQuestion;
        if (!q.q || !q.a) error(`braincell_check: trivia item missing q or a: ${JSON.stringify(q).slice(0, 60)}`);
        if (!q.options || q.options.length !== 4) error(`braincell_check: trivia item needs 4 options`);
        if (q.correct === undefined || q.correct < 0 || q.correct > 3) {
          error(`braincell_check: trivia item needs correct index 0-3`);
        }
      }
    }

    // Check for repetitive template language
    const templatePatterns = [
      /^tell us about/i,
      /^describe (yourself|your)/i,
      /do an interpretive dance/i,
    ];
    for (const item of items) {
      const text = typeof item === "string" ? item : "";
      for (const pat of templatePatterns) {
        if (pat.test(text)) {
          warn(`${seg}: possible template language: "${text.slice(0, 60)}"`);
        }
      }
    }

    // Every item must have category context (implicit from segment key)
    // All items have intensity from the pack-level field
    pass(`${seg}: structure valid ✓`);
  }
}

function main() {
  console.log("🔍 AI4U Party Wheel — Content Validation\n");

  let files: string[];
  try {
    files = readdirSync(PACKS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`❌ Cannot read content packs directory: ${PACKS_DIR}`);
    console.error("   Run from the party-wheel/ root directory.");
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("❌ No content pack JSON files found in", PACKS_DIR);
    process.exit(1);
  }

  for (const file of files) {
    const filePath = join(PACKS_DIR, file);
    let pack: ContentPack;
    try {
      pack = JSON.parse(readFileSync(filePath, "utf-8")) as ContentPack;
    } catch (e) {
      console.error(`❌ Failed to parse ${file}: ${e}`);
      totalErrors++;
      continue;
    }
    validatePack(file, pack);
  }

  console.log("\n" + "─".repeat(60));
  console.log(`📊 Results: ${files.length} pack(s) checked`);
  console.log(`   Errors:   ${totalErrors}`);
  console.log(`   Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.error(`\n❌ CONTENT VALIDATION FAILED — ${totalErrors} error(s)\n`);
    process.exit(1);
  } else {
    console.log(`\n✅ CONTENT VALIDATION PASSED${totalWarnings > 0 ? ` (${totalWarnings} warning(s))` : ""}\n`);
    process.exit(0);
  }
}

main();
