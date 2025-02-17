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

// Type guard for Deepgram JSON structure
function isDeepgramTranscript(json: any): json is DeepgramSchema {
  return (
    typeof json === "object" &&
    typeof json?.metadata?.created === "string" &&
    Array.isArray(json?.results?.channels) &&
    json.results.channels.every(
      (channel: any) =>
        Array.isArray(channel.alternatives) &&
        channel.alternatives.every(
          (alt: any) =>
            Array.isArray(alt.words) &&
            alt.words.every(
              (word: any) =>
                typeof word.word === "string" &&
                typeof word.start === "number" &&
                typeof word.end === "number",
            ),
        ),
    )
  );
}

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
      console.log(
        `${COLOR.yellow}No files found matching the glob pattern '**/*.json' in directory '${resolvedDir}'.${COLOR.reset}`,
      );
      return;
    }

    let conversionHappened = false;
    let conversionCount = 0;

    for (const [dir, files] of dirMap) {
      let directoryPrinted = false;

      for (const file of files) {
        try {
          const filePath = path.join(resolvedDir, file);
          const jsonContent = await Bun.file(filePath).json();

          if (!isDeepgramTranscript(jsonContent)) {
            continue;
          }

          const srtPath = filePath.replace(/\.json$/, ".srt");
          if (!directoryPrinted) {
            console.log(`${COLOR.cyan}📁 ${dir}${COLOR.reset}`);
            directoryPrinted = true;
          }

          const srtContent = srt(jsonContent);
          await Bun.write(srtPath, srtContent);
          console.log(
            `  ${COLOR.green}→${COLOR.reset} ${path.basename(file)} → ${
              path.basename(
                srtPath,
              )
            }`,
          );
          conversionCount++;
          conversionHappened = true;
        } catch (error: unknown) {
          if (error instanceof SyntaxError) {
            continue;
          }

          console.error(
            `  ${COLOR.red}✗${COLOR.reset} Error processing ${
              path.basename(
                file,
              )
            }: ${(error as Error).message}`,
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
      `${COLOR.red}🚨 Critical error: ${
        (error as Error).message
      }${COLOR.reset}`,
    );
  }
}

await processFiles();

// Type definitions for Deepgram response
interface DeepgramSchema {
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
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
  };
}
