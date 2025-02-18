#!/usr/bin/env bun
import { Glob } from "bun";
import { srt } from "@deepgram/captions";
import path from "node:path";
import { existsSync, statSync } from "node:fs";

// ANSI escape codes for colors
const COLOR = {
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

async function processFiles() {
  try {
    const targetDirArg = process.argv[2];
    if (!targetDirArg) {
      console.error(
        `${COLOR.red}Error: Please specify a directory to process.${COLOR.reset}`,
      );
      process.exit(1);
    }

    const resolvedDir = path.resolve(targetDirArg);

    if (!existsSync(resolvedDir)) {
      console.error(
        `${COLOR.red}Error: Directory '${resolvedDir}' does not exist.${COLOR.reset}`,
      );
      process.exit(1);
    }

    if (!statSync(resolvedDir).isDirectory()) {
      console.error(
        `${COLOR.red}Error: '${resolvedDir}' is not a directory.${COLOR.reset}`,
      );
      process.exit(1);
    }

    const glob = new Glob("**/*.json");
    const dirMap = new Map<string, string[]>();

    for await (const file of glob.scan(resolvedDir)) {
      const dir = path.dirname(file);
      dirMap.set(dir, [...(dirMap.get(dir) || []), file]);
    }

    if (dirMap.size === 0) {
      console.log(`${COLOR.yellow}No JSON files found.${COLOR.reset}`);
      return;
    }

    let conversionHappened = false;
    let conversionCount = 0;

    for (const [dir, files] of dirMap) {
      let directoryPrinted = false;

      for (const file of files) {
        try {
          const filePath = path.join(resolvedDir, file);

          let jsonContent: OrganicPathwayContent;
          try {
            jsonContent = (await Bun.file(
              filePath,
            ).json()) as OrganicPathwayContent;
          } catch (jsonError) {
            console.error(
              `  ${COLOR.yellow}⚠️${COLOR.reset} JSON Parsing Error in ${path.basename(file)}: ${(jsonError as Error).message}`,
            );
            continue; // Skip to the next file if JSON parsing fails
          }

          // Apply fix for missing start time in the first word in utterances
          if (
            jsonContent?.results?.utterances?.[0]?.words?.[0] &&
            typeof jsonContent.results.utterances[0].words[0].start ===
              "undefined"
          ) {
            console.log(
              "undefined start time in utterances[0].words[0], setting to 0",
            );
            jsonContent.results.utterances[0].words[0].start = 0.0;
          }

          // Apply fix for missing start time in the first word in channels (fallback)
          if (
            jsonContent?.results?.channels?.[0]?.alternatives?.[0]
              ?.words?.[0] &&
            typeof jsonContent.results.channels[0].alternatives[0].words[0]
              .start === "undefined"
          ) {
            console.log(
              "undefined start time in channels[0].alternatives[0].words[0], setting to 0",
            );
            jsonContent.results.channels[0].alternatives[0].words[0].start = 0.0;
          }

          if (!directoryPrinted) {
            console.log(`${COLOR.cyan}📁 ${dir}${COLOR.reset}`);
            directoryPrinted = true;
          }

          const srtPath = filePath.replace(/\.json$/, ".srt");

          let srtContent;
          try {
            srtContent = srt(jsonContent);
          } catch (srtError: unknown) {
            console.error(
              `  ${COLOR.red}✗${COLOR.reset} SRT Conversion Error for ${path.basename(file)}: ${(srtError as Error).message}`,
            );
            continue; // Skip to the next file if SRT conversion fails
          }

          try {
            await Bun.write(srtPath, srtContent);
            console.log(
              `  ${COLOR.green}→${COLOR.reset} ${path.basename(file)} → ${path.basename(srtPath)}`,
            );
            conversionCount++;
            conversionHappened = true;
          } catch (writeError: unknown) {
            console.error(
              `  ${COLOR.red}✗${COLOR.reset} File Write Error for ${path.basename(srtPath)}: ${(writeError as Error).message}`,
            );
          }
        } catch (error: unknown) {
          console.error(
            `  ${COLOR.red}✗${COLOR.reset} Error processing ${path.basename(file)}: ${(error as Error).message}`,
          );
        }
      }
    }

    if (!conversionHappened) {
      console.log(
        `${COLOR.yellow}No Deepgram JSON files converted to SRT.${COLOR.reset}`,
      );
    } else {
      console.log(
        `${COLOR.green}✅ All ${conversionCount} conversions completed successfully${COLOR.reset}`,
      );
    }
  } catch (error: unknown) {
    console.error(
      `${COLOR.red}🚨 Critical error: ${(error as Error).message}${COLOR.reset}`,
    );
  }
}

await processFiles();

// Type definitions for Deepgram OrganicPathwayContent response
interface OrganicPathwayContent {
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string; // ISO 8601 Date
    duration: number;
    channels: number;
    models: string[];
    model_info: Record<string, { name: string; version: string; arch: string }>;
  };
  results: {
    channels: {
      alternatives: {
        transcript: string;
        confidence: number;
        words: {
          word: string;
          start: number;
          end: number;
          confidence: number;
          punctuated_word?: string;
        }[];
      }[];
    }[];
    utterances?: {
      speaker: string;
      start: number;
      end: number;
      transcript: string;
      confidence: number;
      words: {
        word: string;
        start: number;
        end: number;
        confidence: number;
        punctuated_word?: string;
      }[];
    }[];
  };
}
