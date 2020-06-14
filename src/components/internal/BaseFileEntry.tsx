import c from 'classnames';
import React, { useState } from 'react';
import { Nullable } from 'tsdef';

import { FileData } from '../../typedef';
import { ColorsDark, ColorsLight, useIconData } from '../../util/icon-helper';
import { ChonkyIconFA, ChonkyIconName } from '../external/ChonkyIcon';
import { useDndIcon, useThumbnailUrl } from './BaseFileEntry-hooks';
import { DnDProps } from './DnDFileEntry';
import { FileThumbnail } from './FileThumbnail';

export interface FileEntryProps extends DnDProps {
    file: Nullable<FileData>;
    style?: React.CSSProperties;
}

export const BaseFileEntry: React.FC<FileEntryProps> = (props) => {
    const { file, style, dndIsDragging, dndIsOver, dndCanDrop } = props;

    // Deal with thumbnails
    const [thumbnailUrl, setThumbnailUrl] = useState<Nullable<string>>(null);
    const [thumbnailLoading, setThumbnailLoading] = useState<boolean>(false);
    useThumbnailUrl(file, setThumbnailUrl, setThumbnailLoading);

    // Deal with file icon
    const iconData = useIconData(file);
    const backgroundColor = thumbnailUrl
        ? ColorsDark[iconData.colorCode]
        : ColorsLight[iconData.colorCode];
    const iconSpin = thumbnailLoading || !file;
    const icon = thumbnailLoading ? ChonkyIconName.loading : iconData.icon;

    // Deal with drag & drop
    const dndIcon = useDndIcon(dndIsDragging, dndIsOver, dndCanDrop);

    // Render the component
    const className = c({
        'chonky-file-entry': true,
        'chonky-file-entry-dragging': dndIsDragging,
        'chonky-file-entry-drop-hovered': dndIsOver && dndCanDrop,
    });
    return (
        <div className={className} style={style}>
            {dndIcon && (
                <div className="chonky-file-entry-dnd-indicator">
                    <ChonkyIconFA icon={dndIcon} />
                </div>
            )}
            <div className="chonky-file-entry-preview">
                <div className="chonky-file-icon">
                    <div className="chonky-file-icon-inside">
                        <ChonkyIconFA icon={icon} spin={iconSpin} />
                    </div>
                </div>
                <FileThumbnail thumbnailUrl={thumbnailUrl} />
                <div className="chonky-file-background" style={{ backgroundColor }} />
            </div>
            <div className="chonky-file-entry-description">
                {file ? file.name : '---'}
            </div>
        </div>
    );
};