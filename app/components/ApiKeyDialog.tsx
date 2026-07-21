"use client";

// BYOK settings dialog (PRD §5): pick a model + paste your own API key. The key
// is held in the browser (localStorage via useApiKey) and never persisted on our
// server. A native <dialog> gives us focus trapping + Escape handling for free.

import { useEffect, useRef, useState } from "react";

import { keyUrlOf, MODEL_OPTIONS } from "@/lib/text2sql/model-options";

interface ApiKeyDialogProps {
  open: boolean;
  model: string;
  apiKey: string;
  onClose: () => void;
  onSave: (next: { model: string; apiKey: string }) => void;
}

export function ApiKeyDialog({ open, model, apiKey, onClose, onSave }: ApiKeyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftModel, setDraftModel] = useState(model);
  const [draftKey, setDraftKey] = useState(apiKey);

  // Sync the native dialog's open state and reset drafts each time it opens.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDraftModel(model);
      setDraftKey(apiKey);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, model, apiKey]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({ model: draftModel.trim(), apiKey: draftKey.trim() });
    onClose();
  };

  const keyUrl = keyUrlOf(draftModel);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="apikey-title"
      className="m-auto w-full max-w-md rounded-xl p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white p-6 dark:bg-zinc-900">
        <h2 id="apikey-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          API 설정 (BYOK)
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          키는 브라우저에만 저장되고 서버에 전송·기록되지 않습니다.
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          모델
          <select
            value={draftModel}
            onChange={(event) => setDraftModel(event.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.provider} — {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          API 키
          <input
            type="password"
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            placeholder="sk-... / AIza..."
            autoComplete="off"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        {keyUrl ? (
          <a href={keyUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline dark:text-blue-400">
            이 모델의 API 키 발급받기 →
          </a>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            저장
          </button>
        </div>
      </form>
    </dialog>
  );
}
