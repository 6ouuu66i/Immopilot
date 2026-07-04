import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { isSupabaseUuid, notesService, type NoteWithAuthor } from './services/notesService';

interface UseNotesParams {
  propertyId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
}

interface UseNotesResult {
  notes: NoteWithAuthor[];
  isLoading: boolean;
  error: string | null;
  createNote: (content: string) => Promise<void>;
  updateNote: (noteId: string, content: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  canEditNote: (note: NoteWithAuthor) => boolean;
}

function contextKey({ propertyId, dealId, contactId }: UseNotesParams): string {
  return [propertyId ?? '', dealId ?? '', contactId ?? ''].join('|');
}

function getValidContext({ propertyId, dealId, contactId }: UseNotesParams): UseNotesParams {
  return {
    propertyId: isSupabaseUuid(propertyId) ? propertyId : null,
    dealId: isSupabaseUuid(dealId) ? dealId : null,
    contactId: isSupabaseUuid(contactId) ? contactId : null,
  };
}

function hasSingleContext({ propertyId, dealId, contactId }: UseNotesParams): boolean {
  return [propertyId, dealId, contactId].filter(Boolean).length === 1;
}

export function useNotes(params: UseNotesParams): UseNotesResult {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<NoteWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const validContext = useMemo(() => getValidContext(params), [params.propertyId, params.dealId, params.contactId]);
  const key = useMemo(() => contextKey(validContext), [validContext]);

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      if (!user || !hasSingleContext(validContext)) {
        setNotes([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let nextNotes: NoteWithAuthor[] = [];
        if (validContext.propertyId) nextNotes = await notesService.getNotesForProperty(validContext.propertyId);
        if (validContext.dealId) nextNotes = await notesService.getNotesForDeal(validContext.dealId);
        if (validContext.contactId) nextNotes = await notesService.getNotesForContact(validContext.contactId);
        if (active) setNotes(nextNotes);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Chargement des notes impossible.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadNotes();

    return () => {
      active = false;
    };
  }, [key, user, validContext]);

  const createNote = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (!user || !profile || !hasSingleContext(validContext)) {
        setError("Cette fiche n'est pas encore synchronisée avec Supabase.");
        return;
      }

      const tempNote: NoteWithAuthor = {
        id: `temp-${Date.now()}`,
        agency_id: profile.agency_id ?? '',
        author_id: user.id,
        property_id: validContext.propertyId ?? null,
        deal_id: validContext.dealId ?? null,
        contact_id: validContext.contactId ?? null,
        content: trimmed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          id: user.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
        },
      };

      const previousNotes = notes;
      setError(null);
      setNotes([tempNote, ...notes]);

      try {
        const created = await notesService.createNote({
          content: trimmed,
          propertyId: validContext.propertyId,
          dealId: validContext.dealId,
          contactId: validContext.contactId,
        });
        setNotes((current) => [created, ...current.filter((note) => note.id !== tempNote.id)]);
      } catch (createError) {
        setNotes(previousNotes);
        setError(createError instanceof Error ? createError.message : 'Création de la note impossible.');
      }
    },
    [notes, profile, user, validContext],
  );

  const updateNote = useCallback(
    async (noteId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const previousNotes = notes;
      setError(null);
      setNotes(notes.map((note) => note.id === noteId ? { ...note, content: trimmed, updated_at: new Date().toISOString() } : note));

      try {
        const updated = await notesService.updateNote(noteId, trimmed);
        setNotes((current) => current.map((note) => note.id === noteId ? updated : note));
      } catch (updateError) {
        setNotes(previousNotes);
        setError(updateError instanceof Error ? updateError.message : 'Modification de la note impossible.');
      }
    },
    [notes],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const previousNotes = notes;
      setError(null);
      setNotes(notes.filter((note) => note.id !== noteId));

      try {
        await notesService.deleteNote(noteId);
      } catch (deleteError) {
        setNotes(previousNotes);
        setError(deleteError instanceof Error ? deleteError.message : 'Suppression de la note impossible.');
      }
    },
    [notes],
  );

  const canEditNote = useCallback(
    (note: NoteWithAuthor) => Boolean(user && (note.author_id === user.id || profile?.role === 'admin')),
    [profile?.role, user],
  );

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    canEditNote,
  };
}
