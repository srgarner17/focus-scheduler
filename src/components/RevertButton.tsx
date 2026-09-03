interface Props {
  onRevert: () => void;
}

// Sits next to a field that's been changed this edit-mode session, letting
// a parent put it back to what it said before — for when you start editing
// the wrong thing and don't want to have to remember or retype the original.
export function RevertButton({ onRevert }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Revert buttons often sit inside a larger clickable row (e.g. an
        // item's expand/collapse toggle) — stop the click from also
        // triggering that.
        e.stopPropagation();
        onRevert();
      }}
      aria-label="Undo this edit"
      title="Undo this edit"
      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
    >
      ⟲
    </button>
  );
}
