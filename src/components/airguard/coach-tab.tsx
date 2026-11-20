'use client';

/**
 * AI coach chat. The server DB is the source of truth (hydrated via TanStack
 * Query); local state only holds the optimistic turns of the in-flight
 * question, which keeps hydration free of sync effects. Model output is
 * rendered as plain text (whitespace preserved, never HTML) so there is no
 * injection surface.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser, SendHorizonal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/components/airguard/state';
import {
  askCoach,
  clearCoachHistory,
  fetchCoachHistory,
  ApiError,
} from '@/lib/client/api';

const MAX_MESSAGE_LENGTH = 1000;

const SUGGESTIONS = [
  'Is it safe for the kids to play outside today?',
  'When exactly should I open the windows?',
  'How can I cut the smoke from my commute?',
  'Give me one high-impact action for today',
] as const;

interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function CoachBubble({ message }: { message: ChatMessageView }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      role="listitem"
      aria-label={isUser ? 'Your message' : 'Coach message'}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border bg-card'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-16 w-3/4 rounded-2xl" />
      <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
      <Skeleton className="h-20 w-2/3 rounded-2xl" />
    </div>
  );
}

export function CoachTab() {
  const { sessionId, location, profile, hydrated } = useApp();
  const queryClient = useQueryClient();
  const [pendingTurns, setPendingTurns] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ['coach-history', sessionId],
    queryFn: ({ signal }) => fetchCoachHistory(sessionId, signal),
    enabled: hydrated && sessionId !== '',
    staleTime: Infinity,
  });

  // Derived view: persisted transcript + in-flight optimistic turns.
  // Pending turns that the server has already persisted (same id for the
  // assistant reply, or same content for the user turn) are dropped here so
  // the reconciling refetch never produces duplicates.
  const serverMessages: ChatMessageView[] = (history.data?.messages ?? []).map(
    (m) => ({ id: m.id, role: m.role, content: m.content }),
  );
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const serverUserContents = new Set(
    serverMessages.filter((m) => m.role === 'user').map((m) => m.content),
  );
  const pendingVisible = pendingTurns.filter((turn) => {
    if (serverIds.has(turn.id)) return false;
    if (turn.role === 'user' && serverUserContents.has(turn.content)) return false;
    return true;
  });
  const messages: ChatMessageView[] = [...serverMessages, ...pendingVisible];

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const ask = useMutation({
    mutationFn: (message: string) =>
      askCoach({
        sessionId,
        message,
        location,
        profile,
      }),
    onMutate: (message) => {
      setPendingTurns((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: 'user', content: message },
      ]);
      setDraft('');
    },
    onSuccess: (data) => {
      setPendingTurns((prev) => [
        ...prev,
        { id: data.replyId, role: 'assistant', content: data.reply },
      ]);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError
          ? error.message
          : 'Network problem — please check your connection.';
      toast.error(detail);
      // Drop the in-flight user turn so the user can retry cleanly.
      setPendingTurns((prev) => {
        const copy = [...prev];
        while (copy.length > 0 && copy[copy.length - 1].role === 'user') {
          copy.pop();
        }
        return copy;
      });
    },
    onSettled: () => {
      // Reconcile: once the mutation settles, the server owns the turn.
      queryClient.invalidateQueries({ queryKey: ['coach-history', sessionId] });
    },
  });

  const send = useCallback(() => {
    const message = draft.trim();
    if (message.length === 0 || ask.isPending) return;
    ask.mutate(message);
  }, [draft, ask]);

  function clearConversation() {
    clearCoachHistory(sessionId)
      .then(() => {
        setPendingTurns([]);
        queryClient.invalidateQueries({ queryKey: ['coach-history', sessionId] });
        toast.success('Conversation cleared.');
      })
      .catch(() => toast.error('Could not clear the conversation.'));
  }

  const canSend = draft.trim().length > 0 && !ask.isPending;
  const isLoadingHistory = !hydrated || (history.isPending && pendingTurns.length === 0);

  return (
    <Card className="flex min-h-[560px] flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles aria-hidden="true" className="size-5 text-primary" />
            AI air coach
          </CardTitle>
          <CardDescription>
            Knows your location, the live AQI and your household profile.
            Answers stay on-topic and never diagnose.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConversation}
          disabled={messages.length === 0}
          aria-label="Clear conversation"
          className="min-h-9 shrink-0 gap-2"
        >
          <Eraser aria-hidden="true" className="size-4" />
          Clear
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div
          ref={listRef}
          className="chat-scroll max-h-[46vh] min-h-48 flex-1 space-y-4 overflow-y-auto rounded-xl border bg-muted/30 p-4"
          role="list"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with the air coach"
        >
          {isLoadingHistory ? (
            <HistorySkeleton />
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium">Ask anything about today&apos;s air</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                The coach uses live measurements for {location.name} and your
                household settings. Try a suggestion below or type your own.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <CoachBubble key={message.id} message={message} />
            ))
          )}
          {ask.isPending && (
            <div className="flex justify-start" role="status" aria-label="Coach is thinking">
              <div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                  <span className="size-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="size-2 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </span>
                <span className="sr-only">The coach is thinking…</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={ask.isPending}
                onClick={() => ask.mutate(suggestion)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="coach-input" className="sr-only">
                Your question for the air coach
              </label>
              <textarea
                id="coach-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="e.g. Should I reschedule tomorrow morning's jog?"
                className="min-h-[52px] w-full resize-y rounded-xl border bg-transparent px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby="coach-input-help"
              />
              <p id="coach-input-help" className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Enter to send, Shift+Enter for a new line</span>
                <Badge variant="outline" className="tabular-nums">
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </Badge>
              </p>
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label="Send message"
              className="size-11 shrink-0"
            >
              <SendHorizonal aria-hidden="true" className="size-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
