import { useMemo, useRef, useState } from "react";
import { Phone, Send, Video, X, Smile } from "lucide-react";

import type { Mood } from "../../lib/theme";
import type {
  AttachmentPayload,
  CallType,
  Conversation,
  DecryptedMessage
} from "../../lib/types";

type ConversationStageProps = {
  conversation: Conversation | null;
  currentUserId: string;
  messages: DecryptedMessage[];
  typingUsers: string[];
  smartReplies: string[];
  mood: Mood;
  isMoodManual: boolean;
  onSend: (input: {
    text: string;
    attachments: AttachmentPayload[];
    expiresAt: string | null;
  }) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
  onStartCall: (callType: CallType) => void;
  onLeaveRoom: (conversationId: string) => Promise<void>;
  onMoodChange: (conversationId: string, mood: Mood | "auto") => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
};

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const titleForConversation = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "direct") {
    return (
      conversation.participants.find((participant) => participant.userId !== currentUserId)?.username ??
      "Direct chat"
    );
  }

  return conversation.name || "Untitled channel";
};

const receiptLabel = (message: DecryptedMessage, currentUserId: string) => {
  if (message.senderId !== currentUserId) {
    return "";
  }

  const others = message.recipientKeys.filter((key) => key.userId !== currentUserId);

  if (others.length > 0 && others.every((item) => item.readAt)) {
    return "Read";
  }

  if (others.length > 0 && others.every((item) => item.deliveredAt)) {
    return "Delivered";
  }

  return "Sent";
};

const AttachmentMedia = ({ dataUrl, name, mimeType }: { dataUrl: string; name: string; mimeType: string }) => {
  if (mimeType.startsWith("image/")) {
    return (
      <a className="attachment-pill" href={dataUrl} download={name} target="_blank" rel="noreferrer">
        <img alt={name} src={dataUrl} className="media-preview-img" />
        <span>{name}</span>
      </a>
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <div className="attachment-pill media-video-wrapper">
        <video controls src={dataUrl} className="media-preview-video" />
        <span>{name}</span>
      </div>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return (
      <div className="attachment-pill media-audio-wrapper">
        <audio controls src={dataUrl} className="media-preview-audio" />
        <span>{name}</span>
      </div>
    );
  }

  return (
    <a className="attachment-pill file-pill" href={dataUrl} download={name} target="_blank" rel="noreferrer">
      <span className="file-icon">📎</span>
      <span>{name}</span>
    </a>
  );
};

export const ConversationStage = ({
  conversation,
  currentUserId,
  messages,
  typingUsers,
  smartReplies,
  mood,
  isMoodManual,
  onSend,
  onTypingChange,
  onStartCall,
  onLeaveRoom,
  onMoodChange,
  onReact,
  onRemoveReact
}: ConversationStageProps) => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const [ephemeralMinutes, setEphemeralMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directPeer = conversation?.participants.find((participant) => participant.userId !== currentUserId) ?? null;

  const liveTypingText = useMemo(() => {
    if (typingUsers.length === 0) {
      return "";
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }

    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  const submitMessage = async () => {
    if (!conversation || submitting) {
      return;
    }

    const expiresAt = ephemeralMinutes
      ? new Date(Date.now() + Number(ephemeralMinutes) * 60_000).toISOString()
      : conversation.ephemeralSeconds
        ? new Date(Date.now() + conversation.ephemeralSeconds * 1000).toISOString()
        : null;

    setSubmitting(true);

    try {
      await onSend({ text, attachments, expiresAt });
      setText("");
      setAttachments([]);
      setEphemeralMinutes("");
      onTypingChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!conversation) {
    return (
      <section className="conversation-stage empty">
        <div className="empty-state">
          <span className="eyebrow">PulseBridge</span>
          <h2>Select a conversation to start the secure stream.</h2>
          <p>Open a direct chat, spin up a group, or jump into a live global room.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="conversation-stage">
      <header className="stage-header">
        <div>
          <span className="eyebrow">{conversation.type}</span>
          <h2>{titleForConversation(conversation, currentUserId)}</h2>
          <p>
            {conversation.type === "direct"
              ? `${directPeer?.status ?? "offline"} · secure peer-to-peer line`
              : conversation.topic || `${conversation.participants.length} active participants`}
          </p>
        </div>
        <div className="call-actions">
          <label className="mood-picker">
            <span className="eyebrow">Mood</span>
            <select
              value={isMoodManual ? mood : "auto"}
              onChange={(event) => onMoodChange(conversation.id, event.target.value as Mood | "auto")}
            >
              <option value="auto">Auto</option>
              <option value="aurora">Aurora</option>
              <option value="focus">Focus</option>
              <option value="warm">Warm</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          {conversation.type === "room" ? (
            <button
              className="ghost-button compact"
              type="button"
              onClick={() => void onLeaveRoom(conversation.id)}
            >
              Leave room
            </button>
          ) : null}
          <button
            className="icon-button"
            type="button"
            onClick={() => onStartCall("audio")}
            disabled={conversation.type !== "direct"}
            title={conversation.type === "direct" ? "Start voice call" : "Direct chats only"}
          >
            <Phone size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => onStartCall("video")}
            disabled={conversation.type !== "direct"}
            title={conversation.type === "direct" ? "Start video call" : "Direct chats only"}
          >
            <Video size={18} />
          </button>
        </div>
      </header>

      <div className="message-stream">
        {messages.map((message) => {
          const myReactions = (message.reactions ?? []).filter((r) => r.userId === currentUserId).map((r) => r.emoji);
          const reactionGroups = (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
            if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
            acc[r.emoji].count++;
            if (r.userId === currentUserId) acc[r.emoji].mine = true;
            return acc;
          }, {});

          return (
            <article
              key={message.id}
              className={message.senderId === currentUserId ? "message-bubble outgoing" : "message-bubble incoming"}
            >
              <div className="bubble-meta">
                <strong>{message.sender?.username ?? "Unknown"}</strong>
                <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {message.content.text ? <p>{message.content.text}</p> : null}
              {message.translatedText ? <p className="translated-line">{message.translatedText}</p> : null}
              {message.content.attachments.length > 0 ? (
                <div className="attachment-grid">
                  {message.content.attachments.map((attachment) => (
                    <AttachmentMedia
                      key={attachment.id}
                      dataUrl={attachment.dataUrl}
                      name={attachment.name}
                      mimeType={attachment.mimeType}
                    />
                  ))}
                </div>
              ) : null}
              {message.expiresAt ? <span className="ephemeral-tag">Ephemeral</span> : null}
              {receiptLabel(message, currentUserId) ? (
                <span className="receipt-line">{receiptLabel(message, currentUserId)}</span>
              ) : null}

              {/* Reactions bar */}
              <div className="reaction-bar">
                {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`reaction-chip${mine ? " mine" : ""}`}
                    onClick={() => mine ? onRemoveReact(message.id, emoji) : onReact(message.id, emoji)}
                    title={mine ? "Remove reaction" : "Add reaction"}
                  >
                    {emoji} {count}
                  </button>
                ))}
                <button
                  type="button"
                  className="reaction-add-btn"
                  title="React"
                  onClick={() => setReactionPickerFor(reactionPickerFor === message.id ? null : message.id)}
                >
                  <Smile size={14} />
                </button>
                {reactionPickerFor === message.id ? (
                  <div className="reaction-picker">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="reaction-picker-btn"
                        onClick={() => {
                          if (myReactions.includes(emoji)) {
                            onRemoveReact(message.id, emoji);
                          } else {
                            onReact(message.id, emoji);
                          }
                          setReactionPickerFor(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="typing-line">{liveTypingText}</div>

      {smartReplies.length > 0 ? (
        <div className="reply-strip">
          {smartReplies.map((reply) => (
            <button key={reply} type="button" onClick={() => setText(reply)}>
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      <div className="composer-shell">
        <textarea
          value={text}
          onChange={(event) => {
            const nextValue = event.target.value;
            setText(nextValue);
            onTypingChange(nextValue.trim().length > 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitMessage();
            }
          }}
          placeholder="Write an encrypted message · Enter to send · Shift+Enter for new line"
          rows={3}
        />
        <div className="composer-actions">
          <label className="file-picker">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                const mapped = await Promise.all(
                  files.map(async (file) => ({
                    id: `${file.name}-${crypto.randomUUID()}`,
                    name: file.name,
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                    dataUrl: await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(file);
                    })
                  }))
                );
                setAttachments((prev) => [...prev, ...mapped]);
              }}
            />
            📎 Attach
          </label>
          <input
            className="mini-input"
            value={ephemeralMinutes}
            onChange={(event) => setEphemeralMinutes(event.target.value)}
            placeholder="Delete in mins"
          />
          <button className="primary-button compact" type="button" onClick={submitMessage}>
            <Send size={16} />
            {submitting ? "Sending" : "Send"}
          </button>
        </div>
        {attachments.length > 0 ? (
          <div className="attachment-preview-strip">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-preview-chip">
                {attachment.mimeType.startsWith("image/") ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="preview-thumb" />
                ) : (
                  <span className="preview-icon">
                    {attachment.mimeType.startsWith("video/") ? "🎬" :
                     attachment.mimeType.startsWith("audio/") ? "🎵" : "📄"}
                  </span>
                )}
                <span className="preview-name">{attachment.name}</span>
                <button
                  type="button"
                  className="preview-remove"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))}
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};
