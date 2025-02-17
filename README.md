# Bun Scripts

**Execute scripts from anywhere in your terminal with ease, powered by Bun.**

## Installation

1. **Install Bun:** If you haven't already, install Bun from
   [bun.sh](https://bun.sh).
2. **Install Dependencies:** Navigate to the project directory in your terminal
   and run:

   ```bash
   bun install
   ```

## Usage

Create an [executable binary](https://bun.sh/docs/bundler/executables) from the
CLI script:

```bash
bun run cli # Change the `cli` command in `package.json` for your specific OS from https://bun.sh/docs/bundler/executables
```

## Available Scripts

- `convert-deepgram-json-to-srt.ts`: Converts Deepgram `.json` files into the
  commonly used `.srt` subtitle format.

### Turboscribe's Settings

We don't need to tweak anything else here, since `@deepgram/captions` already
uses 8 words per segment by default. Plus, we're setting all the other Deepgram
parameters we need directly in the `generate_video_subtitles_using_deepgram.go`
script.

```bash
Max Words Per Segment=8

## Advanced Segmentation Settings
Max Duration Per Segment (Seconds) = 10
Max Characters Per Segment = 80

## Sentence-Aware Segmentation
If enabled, the start of a new sentence will always begin a new segment.
```
