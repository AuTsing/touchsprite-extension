import * as React from 'react';
import { FC, useContext } from 'react';
import { VscodeContext } from '../contexts/vscodeContext';
import { Button, Space } from 'antd';
import CodeMaker from './CodeMaker';

const Navbar: FC = () => {
    const vscode = useContext(VscodeContext);

    const handleLoadImgFromDevice = () => vscode.postMessage({ command: 'loadImgFromDevice' });
    const handleLoadImgFromLocal = () => vscode.postMessage({ command: 'loadImgFromLocal' });

    return (
        <div>
            <Space>
                <Button type='primary' size='large' onClick={handleLoadImgFromDevice}>
                    设备截图
                </Button>
                <Button type='primary' size='large' onClick={handleLoadImgFromLocal}>
                    本地打开
                </Button>
                <CodeMaker />
            </Space>
        </div>
    );
};

export default Navbar;
