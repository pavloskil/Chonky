import React from 'react';

import { FileHelper } from '../../util/file-helper';
import { BaseFileEntry, FileEntryProps } from './BaseFileEntry';
import { useFileClickHandlers } from './ClickableFileEntry-hooks';
import { ClickableWrapper, ClickableWrapperProps } from './ClickableWrapper';

export const ClickableFileEntry: React.FC<FileEntryProps> = (props) => {
    const { file } = props;

    const fileClickHandlers = useFileClickHandlers(file);

    const wrapperProps: ClickableWrapperProps = {
        wrapperTag: 'div',
        passthroughProps: {
            className: 'chonky-file-entry-clickable-wrapper chonky-fill-parent',
        },
        ...(FileHelper.isClickable(file) ? fileClickHandlers : undefined),
    };

    return (
        <ClickableWrapper {...wrapperProps}>
            <BaseFileEntry {...props} />
        </ClickableWrapper>
    );
};