/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2019
 * @license MIT
 */

import React from 'react';
import {Nullable} from 'tsdef';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {shallowEqualArrays, shallowEqualObjects} from 'shallow-equal';

import FileList from './FileList';
import Controls from './Controls';
import {FileUtil} from './FileUtil';
import {
    ClickEvent,
    FileClickHandler,
    FileData,
    FolderView,
    Option,
    Options,
    Selection,
    SelectionStatus,
    SelectionType,
    SortOrder,
    SortProperty,
    ThumbnailGenerator,
} from './typedef';
import Util, {clampIndex, getNonNil, isArray, isFunction, isNil, isNumber, isObject, isString} from './Util';

// Important: Make sure to keep `FileBrowserProps` and `FileBrowserPropTypes` in sync!
interface FileBrowserProps {
    files: Nullable<FileData>[];
    folderChain?: Nullable<FileData>[];

    doubleClickDelay?: number;
    onFileSingleClick?: FileClickHandler<boolean>;
    onFileDoubleClick?: FileClickHandler<boolean>;
    onFileOpen?: (file: FileData) => void;
    onSelectionChange?: (selection: Selection) => void;

    thumbnailGenerator?: ThumbnailGenerator;

    disableSelection?: boolean;
    view?: FolderView;
    options?: Partial<Options>;
    sortProperty?: SortProperty;
    sortOrder?: SortOrder;
}

// Important: Make sure to keep `FileBrowserProps` and `FileBrowserPropTypes` in sync!
const FileBrowserPropTypes = {
    files: PropTypes.array.isRequired,
    folderChain: PropTypes.array,

    doubleClickDelay: PropTypes.number,
    onFileSingleClick: PropTypes.func,
    onFileDoubleClick: PropTypes.func,
    onFileOpen: PropTypes.func,
    onSelectionChange: PropTypes.func,

    thumbnailGenerator: PropTypes.func,

    disableSelection: PropTypes.bool,
    view: PropTypes.string,
    options: PropTypes.object,
    sortProperty: PropTypes.string,
    sortOrder: PropTypes.string,
} as unknown as FileBrowserProps;

interface FileBrowserState {
    rawFiles: Nullable<FileData>[];
    folderChain?: Nullable<FileData>[];
    sortedFiles: Nullable<FileData>[];
    fileIndexMap: { [id: string]: number }; // Maps file ID to its index in file array

    previousSelectionIndex?: number;
    selection: Selection;

    view: FolderView;
    options: Options;
    sortProperty: SortProperty;
    sortOrder: SortOrder;
}

export default class FileBrowser extends React.Component<FileBrowserProps, FileBrowserState> {

    public static propTypes = FileBrowserPropTypes;

    public static defaultProps: Partial<FileBrowserProps> = {
        doubleClickDelay: 300,
    };

    private readonly instanceId: string;

    public constructor(props: FileBrowserProps) {
        super(props);
        this.instanceId = Util.generateInstanceId();

        const {
            files: rawFiles, folderChain, view: propView,
            options: propOptions, sortProperty: propSortProperty, sortOrder: propSortOrder,
        } = props;
        // const rawFiles = files.concat([null, null]);

        const selection = {};
        const view = !isNil(propView) ? propView : FolderView.Details;
        const options = {
            [Option.ShowHidden]: true,
            [Option.FoldersFirst]: true,
            [Option.ShowExtensions]: true,
            [Option.ConfirmDeletions]: true,
            [Option.DisableSelection]: true,
            ...propOptions,
        };
        const sortProperty = !isNil(propSortProperty) ? propSortProperty : SortProperty.Name;
        const sortOrder = !isNil(propSortOrder) ? propSortOrder : SortOrder.Asc;

        const [sortedFiles, fileIndexMap] = FileUtil.sortFiles(rawFiles, options, sortProperty, sortOrder);

        this.state = {
            rawFiles,
            folderChain,
            sortedFiles,
            fileIndexMap,
            selection,
            view,
            options,
            sortProperty,
            sortOrder,
        };
    }

    public UNSAFE_componentWillReceiveProps(nextProps: Readonly<FileBrowserProps>): void {
        const old = this.props;
        const {
            files, folderChain, onSelectionChange, disableSelection,
            view, options, sortProperty, sortOrder,
        } = nextProps;

        let selectionStatus = SelectionStatus.Ok;

        if (!shallowEqualArrays(files, old.files)) {
            selectionStatus = SelectionStatus.NeedsCleaning;
            this.setState({rawFiles: files});
        }
        if (!shallowEqualArrays(folderChain, old.folderChain)) {
            if (!isArray(folderChain) || getNonNil(folderChain, -1) !== getNonNil(old.folderChain, -1)) {
                selectionStatus = SelectionStatus.NeedsResetting;
            }
            this.setState({folderChain});
        }

        if (disableSelection === true && disableSelection !== old.disableSelection) {
            selectionStatus = SelectionStatus.NeedsResetting;
        }
        if (!isNil(view) && view !== old.view) this.setState({view});
        if (isObject(options) && options !== old.options) {
            this.setState(prevState => ({options: {...prevState.options, ...options}}));
        }
        if (!isNil(sortProperty) && sortProperty !== old.sortProperty) this.setState({sortProperty});
        if (!isNil(sortOrder) && sortOrder !== old.sortOrder) this.setState({sortOrder});

        if (selectionStatus === SelectionStatus.NeedsResetting) {
            this.setState(() => {
                const selection = {};
                if (isFunction(onSelectionChange)) onSelectionChange(selection);
                return {selection, previousSelectionIndex: undefined};
            });
        } else if (selectionStatus === SelectionStatus.NeedsCleaning) {
            this.setState(prevState => {
                const {rawFiles: files, selection: oldSelection, previousSelectionIndex: prevIndex} = prevState;
                const selection = {};
                let previousSelectionIndex = undefined;
                if (isArray(files)) {
                    previousSelectionIndex = isNumber(prevIndex) ? clampIndex(prevIndex, files) : undefined;
                    files.map(file => {
                        if (!isObject(file)) return;
                        const wasSelected = oldSelection[file.id] === true;
                        const canBeSelected = file.selectable !== false;
                        if (wasSelected && canBeSelected) selection[file.id] = true;
                    });
                }

                if (isFunction(onSelectionChange)) onSelectionChange(selection);
                return {selection, previousSelectionIndex};
            });
        }
    }

    public componentDidUpdate(prevProps: Readonly<FileBrowserProps>, prevState: Readonly<FileBrowserState>): void {
        const {
            rawFiles: oldRawFiles, options: oldOptions,
            sortProperty: oldSortProperty, sortOrder: oldSortOrder,
        } = prevState;
        const {rawFiles, options, sortProperty, sortOrder} = this.state;
        const needToResort = !shallowEqualArrays(rawFiles, oldRawFiles)
            || !shallowEqualObjects(options, oldOptions)
            || sortProperty !== oldSortProperty
            || sortOrder !== oldSortOrder;
        if (needToResort) {
            const [sortedFiles, fileIndexMap] = FileUtil.sortFiles(rawFiles, options, sortProperty, sortOrder);
            this.setState({
                sortedFiles,
                fileIndexMap,
            });
        }
    }

    public componentDidMount(): void {
        document.addEventListener('keydown', this.handleKeyPress);
    }

    public componentWillUnmount(): void {
        document.removeEventListener('keydown', this.handleKeyPress);
    }

    protected setView = (view: FolderView) => {
        this.setState(prevState => {
            if (prevState.view !== view) return {view};
            return null;
        });
    };

    protected setOption = (name: Option, value: boolean) => {
        this.setState(prevState => {
            const {options} = prevState;
            if (options[name] !== value) return {options: {...options, [name]: value}};
            else return null;
        });
    };

    protected activateSortProperty = (name: SortProperty) => {
        this.setState(prevState => {
            if (prevState.sortProperty !== name) {
                return {sortProperty: name, sortOrder: SortOrder.Asc};
            } else {
                const sortOrder = prevState.sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
                return {sortProperty: name, sortOrder};
            }
        });
    };

    protected handleSelectionToggle = (file: FileData, displayIndex: number, type: SelectionType) => {
        const {onSelectionChange, disableSelection} = this.props;

        if (disableSelection === true) return;

        this.setState(prevState => {
            const {sortedFiles, selection: oldSelection, previousSelectionIndex: prevI} = prevState;
            const prevIndex = isNumber(prevI) ? clampIndex(prevI as number, sortedFiles) : null;

            if (type === SelectionType.Range && !isNumber(prevIndex)) {
                // Fallback to multiple selection if no previous index is available
                type = SelectionType.Multiple;
            }

            let selectionIndexToPersist = displayIndex;
            if (type == SelectionType.Multiple || type == SelectionType.Range) {
                if (isNumber(prevIndex)) selectionIndexToPersist = prevIndex as number;
            }

            let newSelection: Selection = {};
            const oldSelected = oldSelection[file.id];
            switch (type) {
                case SelectionType.Single:
                    if (isNil(oldSelected) && file.selectable !== false) newSelection[file.id] = true;
                    break;
                case SelectionType.Multiple:
                    newSelection = {...oldSelection};
                    if (oldSelected === true) delete newSelection[file.id];
                    else newSelection[file.id] = true;
                    break;
                case SelectionType.Range:
                    let indexA = prevIndex as number;
                    let indexB = displayIndex;
                    if (indexA > indexB) [indexA, indexB] = [indexB, indexA];
                    for (let i = indexA; i < indexB + 1; ++i) {
                        const file = sortedFiles[i];
                        if (!isNil(file) && file.selectable !== false) newSelection[file.id] = true;
                    }
                    break;
            }

            if (isFunction(onSelectionChange)) onSelectionChange(newSelection);
            return {selection: newSelection, previousSelectionIndex: selectionIndexToPersist};
        });
    };

    private handleKeyPress = (event: KeyboardEvent) => {
        // TODO: Think of a way to move this logic into ClickableWrapper, without creating a ton of event listeners.
        const {folderChain, onFileOpen} = this.props;
        const {sortedFiles, fileIndexMap} = this.state;
        const activeElem = document.activeElement;

        const isBackspace = Util.kbEventIsBackspace(event);
        const isSpace = Util.kbEventIsSpace(event);
        const isEnter = Util.kbEventIsEnter(event);

        if (!isBackspace && !isSpace && !isEnter) return;
        event.preventDefault();


        if (isBackspace) {
            const parentFolder = getNonNil(folderChain, -2);
            if (isNil(parentFolder) || parentFolder.openable === false) return;
            if (isFunction(onFileOpen)) onFileOpen(parentFolder);
            return;
        }

        let fileId: Nullable<string> = null;
        let instanceId: Nullable<string> = null;
        if (!isNil(activeElem)) {
            fileId = activeElem.getAttribute('data-chonky-file-id');
            instanceId = activeElem.getAttribute('data-chonky-instance-id');
        }

        if (!isString(instanceId) || instanceId !== this.instanceId) return;
        if (isNil(fileId)) return;


        const displayIndex = fileIndexMap[fileId];
        if (!isNumber(displayIndex) || displayIndex < 0 || displayIndex >= sortedFiles.length) return;

        const file = sortedFiles[displayIndex];
        if (isNil(file)) return;

        const clickEvent: ClickEvent = {ctrlKey: true, shiftKey: false};

        if (isSpace) {
            this.handleFileSingleClick(file, displayIndex, clickEvent, true);
        } else if (isEnter) {
            this.handleFileDoubleClick(file, displayIndex, clickEvent, true);
        }
    };

    private handleFileSingleClick: FileClickHandler = (file: FileData, displayIndex: number,
                                                       event: ClickEvent, keyboard: boolean) => {
        const {onFileSingleClick} = this.props;

        // Prevent default behaviour if user's handler returns `true`
        let preventDefault = false;
        if (isFunction(onFileSingleClick)) {
            const funcResult = onFileSingleClick(file, displayIndex, event, keyboard) as boolean | undefined;
            preventDefault = funcResult === true;
        }
        if (preventDefault) return;

        let type = SelectionType.Single;
        if (event.ctrlKey) type = SelectionType.Multiple;
        if (event.shiftKey) type = SelectionType.Range;

        this.handleSelectionToggle(file, displayIndex, type);
    };

    private handleFileDoubleClick: FileClickHandler = (file: FileData, displayIndex: number,
                                                       event: ClickEvent, keyboard: boolean) => {
        const {onFileDoubleClick, onFileOpen} = this.props;

        // Prevent default behaviour if user's handler returns `true`
        let preventDefault = false;
        if (isFunction(onFileDoubleClick)) {
            const funcResult = onFileDoubleClick(file, displayIndex, event, keyboard) as boolean | undefined;
            preventDefault = funcResult === true;
        }
        if (preventDefault) return;

        if (isFunction(onFileOpen) && file.openable !== false) onFileOpen(file);
    };

    public render() {
        const {doubleClickDelay, onFileOpen, thumbnailGenerator} = this.props;
        const {folderChain, sortedFiles, selection, view, options, sortProperty, sortOrder} = this.state;

        const className = classnames({
            'chonky': true,
            'chonky-no-select': options[Option.DisableSelection],
        });
        return (
            <div className={className}>
                <Controls folderChain={folderChain} onFileOpen={onFileOpen} view={view}
                          setView={this.setView} options={options} setOption={this.setOption}/>
                <FileList instanceId={this.instanceId} files={sortedFiles} selection={selection} view={view}
                          sortProperty={sortProperty} sortOrder={sortOrder}
                          activateSortProperty={this.activateSortProperty}
                          doubleClickDelay={doubleClickDelay as number}
                          onFileSingleClick={this.handleFileSingleClick}
                          onFileDoubleClick={this.handleFileDoubleClick}
                          thumbnailGenerator={thumbnailGenerator}/>
            </div>
        );
    }

}
