import type { ComponentProps } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CategorySection } from './CategorySection';

type CategorySectionProps = ComponentProps<typeof CategorySection>;

// Same wrapping pattern as SortableItemCard, one level up: only meaningful in
// edit mode, where App wraps a list of these in a DndContext/SortableContext.
// The handle (not the whole section) gets the drag listeners, so every other
// control inside — name/emoji inputs, item drag handles, delete — stays
// independently usable.
export function SortableCategorySection(props: Omit<CategorySectionProps, 'dragHandle'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.category.id,
    disabled: !props.editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategorySection {...props} dragHandle={props.editMode ? { attributes, listeners } : undefined} />
    </div>
  );
}
