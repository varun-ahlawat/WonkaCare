import { liveCallStore, type LiveCallEvent } from "@/lib/live-calls";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let listener: ((event: LiveCallEvent) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send current state immediately (live + completed)
      const currentCalls = liveCallStore.getAll();
      const completedCalls = liveCallStore.getCompleted();
      console.log(`[SSE] Client connected. Active live calls: ${currentCalls.length}, completed: ${completedCalls.length}`);
      const initEvent: LiveCallEvent = { type: "full-state", calls: currentCalls, completedCalls };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`)
      );

      // Listen for updates
      listener = (event: LiveCallEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Client disconnected
          liveCallStore.removeListener("update", listener!);
        }
      };
      liveCallStore.on("update", listener);
    },
    cancel() {
      if (listener) {
        liveCallStore.removeListener("update", listener);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
