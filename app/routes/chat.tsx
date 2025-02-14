import { useEffect, useState, useRef } from 'react';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { db } from '~/db.server';
import { BroadcastChannel } from 'broadcast-channel';
import { socket } from '~/socket';

// Fetches the most recent 50 messages from the database when the page loads
export async function loader() {
  const messages = await db.execute({
    sql: 'SELECT * FROM messages ORDER BY created_at ASC LIMIT 50',
    args: []
  });

  return new Response(JSON.stringify({ messages: messages.rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

const messageChannel = new BroadcastChannel('chat-messages');

// Handles new message submissions and validates the input data
export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'react') {
    const messageId = formData.get('messageId')?.toString();
    const emoji = formData.get('emoji')?.toString();
    const username = formData.get('username')?.toString();

    if (!messageId || !emoji || !username) {
      return new Response(JSON.stringify({ error: 'Invalid reaction data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await db.execute({
      sql: 'INSERT INTO reactions (message_id, emoji, username) VALUES (?, ?, ?) RETURNING *',
      args: [messageId, emoji, username]
    });

    messageChannel.postMessage({
      type: 'reaction',
      reaction: result.rows[0],
      messageId
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Existing message submission logic
  const content = formData.get('content');
  const username = formData.get('username');

  if (typeof content !== 'string' || typeof username !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await db.execute({
    sql: 'INSERT INTO messages (content, username) VALUES (?, ?) RETURNING *',
    args: [content, username]
  });

  const newMessage = result.rows[0];

  // Broadcast the new message to all clients
  messageChannel.postMessage({ type: 'message', message: newMessage });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Reaction {
  id: number;
  message_id: number;
  emoji: string;
  username: string;
}

interface Message {
  id: number;
  content: string;
  username: string;
  created_at: string;
  reactions?: Reaction[];
}

// Add this constant for emoji groups
const EMOJI_GROUPS = {
  'Smileys': ['😀', '😂', '🥹', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘'],
  'Gestures': ['👍', '👎', '👏', '🙌', '🤝', '👊', '✌️', '🤞', '🫶', '❤️'],
  'Objects': ['🎉', '🎊', '🎈', '🎁', '⭐', '✨', '💡', '🔥', '💯', '🏆'],
};

// Main chat room component that handles the UI and real-time message updates
export default function ChatRoom() {
  const { messages: initialMessages } = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState(initialMessages);
  const [username, setUsername] = useState('');
  const fetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sets up the username from localStorage or generates a new one on component mount
    const storedUsername = localStorage.getItem('chat-username');
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      const newUsername = `User${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('chat-username', newUsername);
      setUsername(newUsername);
    }

    // Set up SSE connection
    const eventSource = new EventSource('/chat/events');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages((prevMessages: Message[]) => [...prevMessages, data.message]);
      } else if (data.type === 'reaction') {
        setMessages((prevMessages: Message[]) =>
          prevMessages.map(msg =>
            msg.id === Number(data.messageId)
              ? {
                ...msg,
                reactions: [...(msg.reactions || []), data.reaction]
              }
              : msg
          )
        );
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    socket.on('show', (data: {
      username: string;
      // meessage: db data
    }) => {
      // get the message from the db and show to the ui
    });

    return () => {
      socket.off('show');
    };
  }, []);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageInput.trim()) return;

    const form = event.currentTarget;
    fetcher.submit(form);
    setMessageInput('');
    socket.emit("created", {
      username,
      // message: db index
    });
  };

  const insertEmoji = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleReaction = (messageId: number, emoji: string) => {
    fetcher.submit(
      {
        intent: 'react',
        messageId: messageId.toString(),
        emoji,
        username,
      },
      { method: 'post' }
    );
    setShowEmojiPicker(false);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Message History Area - Make it scrollable */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        <div className="h-full overflow-y-auto p-4">
          <div className="min-h-full flex flex-col justify-end">
            <div className="space-y-4">
              {messages.map((message: Message) => {
                const isMyMessage = message.username === username;
                return (
                  <div key={message.id}
                    className={`group flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-3 max-w-[80%] ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold">
                        {message.username[0].toUpperCase()}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 ${isMyMessage ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`text-xs text-gray-500 dark:text-gray-400 ${isMyMessage ? 'ml-auto' : ''}`}>
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                          <span className="font-bold">{message.username}</span>
                        </div>

                        <div className={`inline-block rounded-2xl px-4 py-2 
                          ${isMyMessage
                            ? 'bg-blue-500 text-white rounded-tr-none'
                            : 'bg-gray-100 dark:bg-gray-700 rounded-tl-none'}`}
                        >
                          {message.content}
                        </div>

                        {/* Emoji Reactions */}
                        <div className={`flex flex-wrap gap-1 mt-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(
                            message.reactions?.reduce((acc: { [key: string]: string[] }, reaction) => {
                              if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
                              acc[reaction.emoji].push(reaction.username);
                              return acc;
                            }, {}) || {}
                          ).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message.id, emoji)}
                              className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full 
                                       hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title={users.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                {users.length}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sticky bottom-0">
        <fetcher.Form method="post" onSubmit={handleSubmit}>
          <input type="hidden" name="username" value={username} />
          <div ref={inputContainerRef} className="relative">
            <div className="flex items-center gap-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 p-2">
              <input
                ref={inputRef}
                type="text"
                name="content"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                placeholder="Type a message..."
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className="text-xl">😊</span>
              </button>
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 
                         rounded-lg shadow-lg p-4 border dark:border-gray-700"
              >
                <div className="space-y-4">
                  {Object.entries(EMOJI_GROUPS).map(([groupName, emojis]) => (
                    <div key={groupName}>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {groupName}
                      </div>
                      <div className="grid grid-cols-8 gap-2">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}