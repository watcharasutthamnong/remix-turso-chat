import { type LoaderFunctionArgs } from "@remix-run/node";
import { BroadcastChannel } from 'broadcast-channel';
import { io } from 'socket.io-client';
// export const socket = io("http://localhost:3000");
export const socket = io("https://socket-server-l8gn.onrender.com");

export const pingToSocket = (topic: string) => {
  socket.emit(topic);
}

// Handles Server-Sent Events (SSE) for real-time chat updates
export async function loader({ request }: LoaderFunctionArgs) {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const stream = new ReadableStream({
    // Sets up the SSE connection and handles message streaming
    start(controller) {
      const encoder = new TextEncoder();
      const messageChannel = new BroadcastChannel('chat-messages');

      messageChannel.onmessage = (message) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
        );
      };

      // Listen for messages from the Socket.IO server
      socket.on("new_message", () => {
        messageChannel.postMessage({ type: 'ping' });
      });

      // Cleans up resources when connection is closed
      request.signal.addEventListener('abort', () => {
        socket.off("new_message");
        messageChannel.close();
      });
    },
  });

  return new Response(stream, { headers });
} 