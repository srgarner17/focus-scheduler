import type { ComponentProps } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ItemCard } from './ItemCard';

type ItemCardProps = ComponentProps<typeof ItemCard>;

// Wraps ItemCard with dnd-kit's sortable behavior — only meaningful in edit
// mode, where the caller wraps a list of these in a DndContext/SortableContext
// and passes a drag handle down. The handle (not the whole card) gets the
// drag listeners, so every other control on the card — inputs, the checkbox,
// delete — stays a normal, separately-clickable element.
export function SortableItemCard(props: Omit<ItemCardProps, 'dragHandle'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
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
      <ItemCard {...props} dragHandle={props.editMode ? { attributes, listeners } : undefined} />
    </div>
  );
}
