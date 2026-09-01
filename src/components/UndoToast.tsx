interface Props {
  message: string;
  onUndo: () => void;
}

export function UndoToast({ message, onUndo }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900">
        <span>{message}</span>
        <button type="button" onClick={onUndo} className="font-semibold underline underline-offset-2">
          Undo
        </button>
      </div>
    </div>
  );
}
