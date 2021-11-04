import React, { FC, useCallback, useContext, useState } from 'react';
import { Spin } from 'antd';

import { VscodeContext } from '../contexts/VscodeContext';
import { CaptrueContext } from '../contexts/CaptureContext';

export interface ILoadingImageProps {}

let enterTarget: EventTarget | undefined = undefined;

const LoadingImage: FC<ILoadingImageProps> = props => {
    const vscode = useContext(VscodeContext);
    const { captureLoading, setCaptureLoading } = useContext(CaptrueContext);

    const [loading, setLoading] = useState<boolean>(false);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        enterTarget = e.target;
        setLoading(true);
    }, []);

    const handleFileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    const handleFileDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (enterTarget === e.target) {
            e.stopPropagation();
            e.preventDefault();
            setLoading(false);
        }
    }, []);

    const handleFileDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.stopPropagation();
            e.preventDefault();
            setLoading(false);
            const fileList = Array.from(e.dataTransfer.files);
            const exts = fileList.map(file => file.type);
            if (exts.some(ext => ext !== 'image/png')) {
                return;
            }
            const paths = fileList.map((file: any) => file.path);
            setCaptureLoading(true);
            setTimeout(() => vscode.postMessage({ command: 'loadImgFromLocalWithUris', data: paths }), 400);
        },
        [setCaptureLoading, vscode]
    );

    return (
        <div className='loading-image' onDragEnter={handleDragEnter} onDragOver={handleFileDragOver} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop}>
            <Spin spinning={captureLoading || loading} delay={150}>
                {props.children}
            </Spin>
        </div>
    );
};

export default LoadingImage;
