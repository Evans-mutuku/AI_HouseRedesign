import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { TextInput } from '../../components/ui/Field.jsx';
import { Banner, EmptyState, SectionHeader } from '../../components/ui/Surface.jsx';
import ProjectCard, { ProjectCardSkeleton } from '../../components/dashboard/ProjectCard.jsx';
import Icon from '../../components/Icon.jsx';
import { deleteRedesign, listRedesigns } from '../../lib/api.js';
import { formatBytes, pluralize } from '../../lib/format.js';
import { useResource } from '../../lib/useResource.js';
import { useAuth } from '../../lib/authContext.js';

export default function Projects() {
  const { applyStorage, refreshAccount } = useAuth();

  const {
    data: projects,
    error,
    clearError,
    setData: setProjects,
    reload,
  } = useResource(listRedesigns);

  const [query, setQuery] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return null;
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) =>
      [project.title, project.style, project.budget, project.concept]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q)),
    );
  }, [projects, query]);

  const totalBytes = projects?.reduce((sum, p) => sum + (p.bytes || 0), 0) || 0;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await deleteRedesign(pendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      applyStorage(result?.storage);
      refreshAccount().catch(() => {});
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Projects"
        description={
          projects?.length
            ? `${pluralize(projects.length, 'redesign')} · ${formatBytes(totalBytes)} stored`
            : 'Every board you have made lives here.'
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Icon.Refresh} onClick={reload}>
              Refresh
            </Button>
            <Button as={Link} to="/app/new" size="sm" icon={Icon.Plus}>
              New
            </Button>
          </>
        }
      />

      {error && (
        <Banner tone="danger" onDismiss={clearError}>
          {error}
        </Banner>
      )}
      {deleteError && (
        <Banner tone="danger" onDismiss={() => setDeleteError('')}>
          {deleteError}
        </Banner>
      )}

      {projects?.length > 0 && (
        <TextInput
          icon={Icon.Search}
          type="search"
          placeholder="Search by room, style, or concept"
          aria-label="Search projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      )}

      {projects === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      ) : projects.length ? (
        <EmptyState
          icon={Icon.Search}
          title="No matches"
          description={`Nothing here matches “${query}”.`}
          action={
            <Button variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Icon.Photo}
          title="No redesigns yet"
          description="Upload a photo of a room and the studio will return a palette, a materials plan, and a render of the same space."
          action={
            <Button as={Link} to="/app/new" icon={Icon.Plus}>
              Start your first redesign
            </Button>
          }
        />
      )}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.title || ''}”?`}
        description={`This removes the board, the original photo, and the render — and frees ${formatBytes(pendingDelete?.bytes || 0)} of storage. It cannot be undone.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              icon={Icon.Trash}
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete project
            </Button>
          </>
        }
      />
    </div>
  );
}
