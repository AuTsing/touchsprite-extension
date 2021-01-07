import * as React from 'react';
import { FC, useState, useContext, useCallback } from 'react';
import { Button, Space } from 'antd';

import { VscodeContext } from '../contexts/VscodeContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import CodeMaker from './CodeMaker';
import PicComparator from './PicComparator';
import PicBinarization from './PicBinarization';

const Navbar: FC = () => {
    const vscode = useContext(VscodeContext);
    const { setAddedCallback } = useContext(CaptrueContext);

    const [handleLoadImgFromDeviceLoading, setHandleImgFromDeviceLoading] = useState<boolean>(false);
    const [handleLoadImgFromLocalLoading, setHandleLoadImgFromLocalLoading] = useState<boolean>(false);

    const handleLoadImgFromDevice = useCallback(() => {
        setAddedCallback(() => () => setHandleImgFromDeviceLoading(false));
        setHandleImgFromDeviceLoading(true);
        vscode.postMessage({ command: 'loadImgFromDevice' });
        setTimeout(() => setHandleImgFromDeviceLoading(false), 5000);
    }, [setAddedCallback, vscode]);

    const handleLoadImgFromLocal = useCallback(() => {
        setAddedCallback(() => () => setHandleLoadImgFromLocalLoading(false));
        setHandleLoadImgFromLocalLoading(true);
        vscode.postMessage({ command: 'loadImgFromLocal' });
        setTimeout(() => setHandleLoadImgFromLocalLoading(false), 5000);
    }, [setAddedCallback, vscode]);

    return (
        <div>
            <Space size={10}>
                <Button type='primary' size='large' onClick={handleLoadImgFromDevice} loading={handleLoadImgFromDeviceLoading}>
                    设备截图
                </Button>
                <Button type='primary' size='large' onClick={handleLoadImgFromLocal} loading={handleLoadImgFromLocalLoading}>
                    本地打开
                </Button>
                <CodeMaker />
                <PicComparator />
                <PicBinarization />
            </Space>
        </div>
    );
};

export default Navbar;
