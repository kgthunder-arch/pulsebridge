import type { Conversation } from "../../lib/types";

type ConversationRailProps = {
  currentUserId: string;
  conversations: Conversation[];
  rooms: Conversation[];
  activeConversationId: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onJoinRoom: (roomId: string) => void;
};

const conversationLabel = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "direct") {
    return (
      conversation.participants.find((participant) => participant.userId !== currentUserId)?.username ??
      "Direct chat"
    );
  }

  return conversation.name || conversation.topic || "Untitled space";
};

const conversationMeta = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "direct") {
    return (
      conversation.participants.find((participant) => participant.userId !== currentUserId)?.status ??
      "offline"
    );
  }

  return `${conversation.participants.length} members`;
};

const conversationPreview = (conversation: Conversation) => {
  if (conversation.type === "room") {
    return conversation.topic;
  }

  if (conversation.type === "group") {
    return conversation.topic || "Encrypted group chat";
  }

  return "Encrypted direct line";
};

export const ConversationRail = ({
  currentUserId,
  conversations,
  rooms,
  activeConversationId,
  searchTerm,
  onSearchChange,
  onSelectConversation,
  onJoinRoom
}: ConversationRailProps) => (
  <aside className="conversation-rail">
    <div className="rail-header">
      <span className="eyebrow">Channels</span>
      <h2>Pulse stream</h2>
    </div>

    <label className="search-shell">
      <input
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search conversations"
      />
    </label>

    <div className="conversation-list">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          className={conversation.id === activeConversationId ? "conversation-row active" : "conversation-row"}
          type="button"
          onClick={() => onSelectConversation(conversation.id)}
        >
          <span className={`presence-dot ${conversationMeta(conversation, currentUserId) === "online" ? "online" : ""}`} />
          <div>
            <strong>{conversationLabel(conversation, currentUserId)}</strong>
            <span>{conversationMeta(conversation, currentUserId)} · {conversationPreview(conversation)}</span>
          </div>
        </button>
      ))}
    </div>

    <div className="rooms-strip">
      <div className="section-line">
        <span className="eyebrow">Global rooms</span>
      </div>
      {rooms.length === 0 ? <p className="quiet-copy">You have joined every live room.</p> : null}
      {rooms.map((room) => (
        <div className="room-row" key={room.id}>
          <div>
            <strong>{room.name}</strong>
            <span>{room.topic}</span>
          </div>
          <button className="ghost-button compact" type="button" onClick={() => onJoinRoom(room.id)}>
            Join
          </button>
        </div>
      ))}
    </div>
  </aside>
);
