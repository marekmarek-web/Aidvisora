import { getMeetingNotesForBoard } from "@/app/actions/meeting-notes";
import { getContactNamePickerRows } from "@/app/actions/contacts";
import { getNotesBoardPositions } from "@/app/actions/notes-board-positions";
import { NotesVisionBoard } from "./NotesVisionBoard";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; noteId?: string }>;
}) {
  const sp = await searchParams;
  let notes: Awaited<ReturnType<typeof getMeetingNotesForBoard>> = [];
  let contactsList: Awaited<ReturnType<typeof getContactNamePickerRows>> = [];
  let boardPositions: Awaited<ReturnType<typeof getNotesBoardPositions>> = {};
  try {
    [notes, contactsList, boardPositions] = await Promise.all([
      getMeetingNotesForBoard(),
      getContactNamePickerRows(),
      getNotesBoardPositions(),
    ]);
  } catch {
    notes = [];
    contactsList = [];
    boardPositions = {};
  }

  return (
    <div className="portal-notes-board-light flex min-h-0 w-full min-h-[calc(100dvh-11rem)] flex-1 flex-col bg-[color:var(--wp-main-scroll-bg)]">
      <NotesVisionBoard
        initialNotes={notes}
        contacts={contactsList}
        initialSearchQuery={sp.q ?? ""}
        initialNoteId={sp.noteId ?? null}
        initialBoardPositions={boardPositions}
      />
    </div>
  );
}
