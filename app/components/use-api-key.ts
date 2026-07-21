"use client";

// BYOK state (PRD §4/§5): the user's model choice + API key live in the browser
// only (localStorage), never sent to our server except as the per-request key on
// a query. Backed by useSyncExternalStore so reads are SSR-safe and stay in sync
// across tabs without a setState-in-effect cascade.

import { useSyncExternalStore } from "react";

import { DEFAULT_MODEL, isKnownModel } from "@/lib/text2sql/model-options";

const API_KEY_STORAGE = "awc:apiKey";
const MODEL_STORAGE = "awc:model";

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener); // cross-tab changes
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readValue(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function writeValue(key: string, value: string): void {
  localStorage.setItem(key, value);
  notify(); // "storage" doesn't fire in the same tab — nudge our own subscribers
}

export interface ApiKeyState {
  apiKey: string;
  model: string;
  isLoaded: boolean;
  setApiKey: (value: string) => void;
  setModel: (value: string) => void;
}

export function useApiKey(): ApiKeyState {
  const apiKey = useSyncExternalStore(subscribe, () => readValue(API_KEY_STORAGE, ""), () => "");
  const storedModel = useSyncExternalStore(subscribe, () => readValue(MODEL_STORAGE, DEFAULT_MODEL), () => DEFAULT_MODEL);
  const isLoaded = useSyncExternalStore(subscribe, () => true, () => false);

  // Auto-migrate a stale/removed model id (e.g. a deprecated Gemini snapshot) to
  // the current default, so an old localStorage value can't pin a dead model.
  const model = isKnownModel(storedModel) ? storedModel : DEFAULT_MODEL;

  return {
    apiKey,
    model,
    isLoaded,
    setApiKey: (value: string) => writeValue(API_KEY_STORAGE, value),
    setModel: (value: string) => writeValue(MODEL_STORAGE, value),
  };
}
