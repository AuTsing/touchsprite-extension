import * as React from 'react';
import { FC, useContext, useCallback } from 'react';
import { Button, Space } from 'antd';

import { VscodeContext } from '../contexts/VscodeContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import CodeMaker from './CodeMaker';
import PicComparator from './PicComparator';
import Ziku from './Ziku';

const Navbar: FC = () => {
    const vscode = useContext(VscodeContext);
    const { captureLoading, setCaptureLoading } = useContext(CaptrueContext);

    const handleLoadImgFromDevice = useCallback(() => {
        setCaptureLoading(true);
        vscode.postMessage({ command: 'loadImgFromDevice' });
    }, [setCaptureLoading, vscode]);

    const handleLoadImgFromLocal = useCallback(() => {
        setCaptureLoading(true);
        vscode.postMessage({ command: 'loadImgFromLocal' });
    }, [setCaptureLoading, vscode]);

    return (
        <div>
            <Space size={10}>
                <Button type='primary' size='large' onClick={handleLoadImgFromDevice} loading={captureLoading} disabled={captureLoading}>
                    设备截图
                </Button>
                <Button type='primary' size='large' onClick={handleLoadImgFromLocal} loading={captureLoading} disabled={captureLoading}>
                    本地打开
                </Button>
                <CodeMaker />
                <PicComparator />
                <Ziku />
            </Space>
        </div>
    );
};

export default Navbar;
