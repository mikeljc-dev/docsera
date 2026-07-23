import { useEffect } from "preact/hooks";
import type { Conversation } from "./api.js";
import { renderMarkdown } from "./markdown.js";

interface Props {
  conversation: Conversation;
  deleting: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function sourceLabel(source: Conversation["sources"][number]): string {
  if (!source.anchor) return source.title;
  return source.anchor.replace(/-/g, " ");
}

function sourceHref(source: Conversation["sources"][number]): string {
  if (!source.url) return "";
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

export function ConversationModal({ conversation, deleting, onClose, onDelete }: Props) {
  // Escape cierra, como cualquier modal; y se bloquea el scroll del fondo
  // mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const feedback =
    conversation.feedback === 1 ? "👍" : conversation.feedback === -1 ? "👎" : null;

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header class="modal-header">
          <div class="modal-meta">
            <span class={conversation.answered ? "badge ok" : "badge warn"}>
              {conversation.answered ? "Answered" : "Unanswered"}
            </span>
            <span class="modal-date">{dateFormatter.format(new Date(conversation.createdAt))}</span>
            {feedback && <span class="modal-feedback">{feedback}</span>}
          </div>
          <button class="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div class="modal-body">
          <div class="modal-question">{conversation.question}</div>

          <div class="modal-answer md">
            {conversation.answer == null ? (
              <p class="empty-note">No answer recorded.</p>
            ) : conversation.answered ? (
              renderMarkdown(conversation.answer)
            ) : (
              <p>{conversation.answer}</p>
            )}
          </div>

          {conversation.sources.length > 0 && (
            <div class="modal-sources">
              <span class="source-chips-label">Sources</span>
              <div class="source-chips">
                {conversation.sources.map((source) => (
                  <a
                    key={sourceHref(source)}
                    href={sourceHref(source)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sourceLabel(source)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer class="modal-footer">
          <button
            class="delete-button"
            disabled={deleting}
            onClick={() => onDelete(conversation.id)}
          >
            {deleting ? "Deleting…" : "Delete conversation"}
          </button>
        </footer>
      </div>
    </div>
  );
}
