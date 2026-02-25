import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { AccuracyData, LadderEntry, Prediction } from "@/lib/types";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonWithFallback<T>(fileName: string): Promise<T> {
  const livePath = path.join(process.cwd(), "src/data", fileName);
  const mockPath = path.join(process.cwd(), "src/data-mock", fileName);
  const target = (await fileExists(livePath)) ? livePath : mockPath;

  if (!(await fileExists(target))) {
    throw new Error(`Missing data file: ${fileName}. Checked ${livePath} and ${mockPath}`);
  }

  const raw = await readFile(target, "utf-8");
  return JSON.parse(raw) as T;
}

export function loadPredictions(): Promise<Prediction[]> {
  return loadJsonWithFallback<Prediction[]>("predictions.json");
}

export function loadLadderPreseason(): Promise<LadderEntry[]> {
  return loadJsonWithFallback<LadderEntry[]>("ladder-preseason.json");
}

export function loadLadderCurrent(): Promise<LadderEntry[]> {
  return loadJsonWithFallback<LadderEntry[]>("ladder-current.json");
}

export function loadAccuracy(): Promise<AccuracyData> {
  return loadJsonWithFallback<AccuracyData>("accuracy.json");
}
