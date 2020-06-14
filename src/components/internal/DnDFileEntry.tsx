import React, { useCallback, useContext, useEffect } from 'react';
import { DragObjectWithType, DragSourceMonitor, useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { ExcludeKeys, Nilable, Nullable } from 'tsdef';

import { FileData } from '../../typedef';
import { ChonkyDispatchSpecialActionContext } from '../../util/context';
import { FileHelper } from '../../util/file-helper';
import { SpecialAction, SpecialDndDropAction } from '../../util/special-actions';
import { BaseFileEntry, FileEntryProps } from './BaseFileEntry';
import { ClickableFileEntry } from './ClickableFileEntry';

export interface DnDProps {
    dndIsDragging?: boolean;
    dndIsOver?: boolean;
    dndCanDrop?: boolean;
}

export const DnDFileEntryType = 'chonky-file-entry';

export const DnDFileEntry: React.FC<FileEntryProps> = (props) => {
    const { file } = props;

    const dispatchSpecialAction = useContext(ChonkyDispatchSpecialActionContext);

    type ChonkyDnDItem = DragObjectWithType & { file: Nullable<FileData> };
    interface ChonkyDnDDropResult {
        dropTarget: Nilable<FileData>;
        dropEffect: 'move' | 'copy';
    }

    // For drag source
    const canDrag = FileHelper.isDraggable(file);
    const onDragEnd = useCallback(
        (item: ChonkyDnDItem, monitor: DragSourceMonitor) => {
            const dropResult = monitor.getDropResult() as ChonkyDnDDropResult;
            if (!file || !dropResult || !dropResult.dropTarget) return;

            const actionData: SpecialDndDropAction = {
                actionName: SpecialAction.DragNDropFiles,
                dragSource: file,
                dropTarget: dropResult.dropTarget,
                dropEffect: dropResult.dropEffect,
            };
            dispatchSpecialAction(actionData);
        },
        [dispatchSpecialAction, file]
    );

    // For drop target
    const onDrop = useCallback(
        (item: ChonkyDnDItem, monitor) => {
            if (!monitor.canDrop()) return;
            const customDropResult: ExcludeKeys<ChonkyDnDDropResult, 'dropEffect'> = {
                dropTarget: file,
            };
            return customDropResult;
        },
        [file]
    );
    const canDrop = useCallback(
        (item: ChonkyDnDItem) => {
            const isSameFile = item.file?.id === file?.id;
            return FileHelper.isDroppable(file) && !isSameFile;
        },
        [file]
    );

    // Create refs for react-dnd hooks
    const [{ isDragging: dndIsDragging }, drag, preview] = useDrag({
        item: { type: DnDFileEntryType, file } as ChonkyDnDItem,
        canDrag,
        end: onDragEnd,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });
    const [{ isOver: dndIsOver, canDrop: dndCanDrop }, drop] = useDrop({
        accept: DnDFileEntryType,
        drop: onDrop,
        canDrop,
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    useEffect(() => {
        // Set drag preview to an empty image because `DnDFileListDragLayer` will
        // provide its own preview.
        preview(getEmptyImage(), { captureDraggingState: true });
    }, []);

    return (
        <div
            ref={drop}
            className="chonky-file-entry-droppable-wrapper chonky-fill-parent"
        >
            <div
                ref={drag}
                className="chonky-file-entry-draggable-wrapper chonky-fill-parent"
            >
                <ClickableFileEntry
                    {...props}
                    dndIsDragging={dndIsDragging}
                    dndIsOver={dndIsOver}
                    dndCanDrop={dndCanDrop}
                />
            </div>
        </div>
    );
};