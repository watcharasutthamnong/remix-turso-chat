import { type LoaderFunctionArgs } from "@remix-run/node";
import { BroadcastChannel } from 'broadcast-channel';
import { io } from 'socket.io-client';
export const socket = io("http://localhost:3000");

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

      // Keeps the connection alive with periodic pings
      const interval = setInterval(() => {
        messageChannel.postMessage({ type: 'ping' });
      }, 15000);

      // Cleans up resources when connection is closed
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        messageChannel.close();
      });
    },
  });

  return new Response(stream, { headers });
} 