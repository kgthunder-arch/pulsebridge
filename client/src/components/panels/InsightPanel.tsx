import { useState } from "react";

import type { AuthUser, ContactRequest, Conversation } from "../../lib/types";

type InsightPanelSection = "contacts" | "requests" | "people" | "groups";

type InsightPanelProps = {
  discoverableUsers: AuthUser[];
  friends: AuthUser[];
  incomingRequests: ContactRequest[];
  outgoingRequests: ContactRequest[];
  peopleSearch: string;
  groupName: string;
  selectedGroupMembers: string[];
  onPeopleSearchChange: (value: string) => void;
  onGroupNameChange: (value: string) => void;
  onToggleMember: (userId: string) => void;
  onCreateGroup: () => Promise<void>;
  onStartDirect: (userId: string) => Promise<void>;
  onStartQuickCall: (userId: string, callType: "audio" | "video") => Promise<void>;
  onSendFriendRequest: (userId: string) => Promise<void>;
  onAcceptRequest: (requestId: string) => Promise<void>;
  onDeclineRequest: (requestId: string) => Promise<void>;
  activeConversation: Conversation | null;
};

const sections: { id: InsightPanelSection; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "requests", label: "Requests" },
  { id: "people", label: "People" },
  { id: "groups", label: "Groups" }
];

export const InsightPanel = ({
  discoverableUsers,
  friends,
  incomingRequests,
  outgoingRequests,
  peopleSearch,
  groupName,
  selectedGroupMembers,
  onPeopleSearchChange,
  onGroupNameChange,
  onToggleMember,
  onCreateGroup,
  onStartDirect,
  onStartQuickCall,
  onSendFriendRequest,
  onAcceptRequest,
  onDeclineRequest,
  activeConversation
}: InsightPanelProps) => {
  const [activeSection, setActiveSection] = useState<InsightPanelSection>("contacts");

  return (
    <aside className="insight-panel">
      <div className="insight-switcher">
        {sections.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? "insight-tab active" : "insight-tab"}
            type="button"
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "contacts" ? (
        <section className="insight-section">
          <span className="eyebrow">Contacts</span>
          <h3>Accepted friends</h3>
          <p className="quiet-copy">Private messaging and calling stay available only for accepted friends.</p>
          {friends.length === 0 ? <p className="quiet-copy">Add friends before starting private chats and calls.</p> : null}
          <div className="person-list">
            {friends.map((person) => (
              <div className="person-row" key={person.id}>
                <div>
                  <strong>{person.username}</strong>
                  <span>{person.status} · accepted contact</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" type="button" onClick={() => void onStartQuickCall(person.id, "audio")}>
                    Voice
                  </button>
                  <button className="ghost-button compact" type="button" onClick={() => void onStartQuickCall(person.id, "video")}>
                    Video
                  </button>
                  <button className="ghost-button compact" type="button" onClick={() => void onStartDirect(person.id)}>
                    Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "requests" ? (
        <section className="insight-section">
          <span className="eyebrow">Requests</span>
          <h3>Friend requests</h3>
          <p className="quiet-copy">Accept a request to unlock direct chats and calls.</p>
          {incomingRequests.length === 0 ? <p className="quiet-copy">No incoming requests right now.</p> : null}
          <div className="person-list">
            {incomingRequests.map((request) => (
              <div className="person-row" key={request.id}>
                <div>
                  <strong>{request.user.username}</strong>
                  <span>wants to connect</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" type="button" onClick={() => void onDeclineRequest(request.id)}>
                    Decline
                  </button>
                  <button className="primary-button compact" type="button" onClick={() => void onAcceptRequest(request.id)}>
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
          {outgoingRequests.length > 0 ? (
            <>
              <p className="quiet-copy">Pending outgoing requests</p>
              <div className="person-list">
                {outgoingRequests.map((request) => (
                  <div className="person-row" key={request.id}>
                    <div>
                      <strong>{request.user.username}</strong>
                      <span>awaiting response</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeSection === "people" ? (
        <section className="insight-section">
          <span className="eyebrow">People</span>
          <h3>Find people</h3>
          <input
            value={peopleSearch}
            onChange={(event) => onPeopleSearchChange(event.target.value)}
            placeholder="Search by username or email"
          />
          {discoverableUsers.length === 0 ? (
            <p className="quiet-copy">No people matched your search yet.</p>
          ) : null}
          <div className="person-list">
            {discoverableUsers.map((person) => (
              <div className="person-row" key={person.id}>
                <div>
                  <strong>{person.username}</strong>
                  <span>{person.email} · {person.relationshipStatus ?? "none"}</span>
                </div>
                <div className="button-row">
                  {person.relationshipStatus === "friends" ? (
                    <>
                      <button className="ghost-button compact" type="button" onClick={() => void onStartQuickCall(person.id, "audio")}>
                        Voice
                      </button>
                      <button className="ghost-button compact" type="button" onClick={() => void onStartQuickCall(person.id, "video")}>
                        Video
                      </button>
                      <button className="ghost-button compact" type="button" onClick={() => void onStartDirect(person.id)}>
                        Chat
                      </button>
                    </>
                  ) : person.relationshipStatus === "incoming-request" && person.relationshipRequestId ? (
                    <>
                      <button className="ghost-button compact" type="button" onClick={() => void onDeclineRequest(person.relationshipRequestId as string)}>
                        Decline
                      </button>
                      <button className="primary-button compact" type="button" onClick={() => void onAcceptRequest(person.relationshipRequestId as string)}>
                        Accept
                      </button>
                    </>
                  ) : person.relationshipStatus === "outgoing-request" ? (
                    <span className="quiet-copy">Pending</span>
                  ) : (
                    <button className="primary-button compact" type="button" onClick={() => void onSendFriendRequest(person.id)}>
                      Add friend
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "groups" ? (
        <section className="insight-section">
          <span className="eyebrow">Groups</span>
          <h3>Build a secure crew</h3>
          <input
            value={groupName}
            onChange={(event) => onGroupNameChange(event.target.value)}
            placeholder="Group name"
          />
          <p className="quiet-copy">Select at least 2 accepted friends to create a private group chat.</p>
          <div className="member-picks">
            {friends.map((person) => (
              <button
                key={person.id}
                className={selectedGroupMembers.includes(person.id) ? "member-pill active" : "member-pill"}
                type="button"
                onClick={() => onToggleMember(person.id)}
              >
                {person.username}
              </button>
            ))}
          </div>
          <button className="primary-button compact" type="button" onClick={() => void onCreateGroup()}>
            Create group
          </button>
          <p className="quiet-copy">Selected members: {selectedGroupMembers.length}</p>
          <p className="quiet-copy">
            Active conversation: {activeConversation ? activeConversation.name || activeConversation.type : "None"}
          </p>
        </section>
      ) : null}
    </aside>
  );
};
