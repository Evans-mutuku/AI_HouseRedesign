import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';

import Wordmark from '../components/Wordmark.jsx';
import DesignBoard from '../components/DesignBoard.jsx';
import Button from '../components/ui/Button.jsx';
import { Badge, EmptyState, Skeleton } from '../components/ui/Surface.jsx';
import Icon from '../components/Icon.jsx';
import { getSharedBoard } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { formatDate } from '../lib/format.js';

/**
 * A shared board, viewed by someone who may have no account at all.
 *
 * Read-only by construction: the payload the server sends has no budget, no
 * checklist, and no ids that would work anywhere else, so there is nothing here
 * to lock down in the UI. The page's other job is to be a decent advert - hence
 * the footer.
 */
export default function SharedBoard() {
  const { token } = useParams();
  const fetcher = useCallback(() => getSharedBoard(token), [token]);
  const { data, error, status, loading } = useResource(fetcher, token);

  if (error) {
    return (
      <Shell>
        <EmptyState
          className="mt-10"
          icon={status === 404 ? Icon.Lock : Icon.Alert}
          title={status === 404 ? 'This link is no longer active' : 'Could not load this board'}
          description={
            status === 404
              ? 'Shared links expire, and the person who created it can revoke it at any time. Ask them for a fresh link.'
              : error
          }
          action={
            <Button as={Link} to="/" variant="secondary">
              Visit STUDIO
            </Button>
          }
        />
      </Shell>
    );
  }

  if (loading || !data) {
    return (
      <Shell>
        <div className="mt-10 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="aspect-[16/10] w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mt-8 border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{data.board.roomType || 'Redesign'}</Badge>
          {data.style && <Badge>{data.style}</Badge>}
          <Badge>Revision {data.revisionNo}</Badge>
        </div>
        <h1 className="mt-4 font-display text-title font-semibold text-ink">
          {data.roomName || data.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {data.sharedBy ? `Shared by ${data.sharedBy} · ` : ''}
          {formatDate(data.createdAt)}
        </p>
      </div>

      <div className="mt-6">
        <DesignBoard
          board={data.board}
          beforeUrl={data.before?.url}
          afterUrl={data.render?.url}
          paints={data.paints}
          readOnly
        />
      </div>

      <section className="mt-10 border-t border-line py-12 text-center">
        <h2 className="font-display text-title font-semibold text-ink">
          Want one of these for your room?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Upload one photo and get a costed plan, a palette, a floor plan, and a
          render of your own space. Free to start.
        </p>
        <div className="mt-6 flex justify-center">
          <Button as={Link} to="/signup" size="lg" iconRight={Icon.ArrowRight}>
            Try it free
          </Button>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Wordmark to="/" />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Icon.ExternalLink size={13} />
            Shared board
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">{children}</main>
    </div>
  );
}
