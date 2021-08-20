import * as React from 'react';
import { FC, useContext, useCallback, useState } from 'react';
import { Tabs, Button, Tooltip, Upload } from 'antd';
import { CloseCircleOutlined, InboxOutlined } from '@ant-design/icons';

import { VscodeContext } from '../contexts/VscodeContext';
import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import Pic from './Pic';

const { TabPane } = Tabs;
const { Dragger } = Upload;

const Canvas: FC = () => {
    const vscode = useContext(VscodeContext);
    const { captures, activeKey, setActiveKey, removeCapture, setActiveJimp, clearCaptures, captureLoading, setCaptureLoading } = useContext(CaptrueContext);
    const { resetCoordinate } = useContext(CoordinateContext);
    const [fileList] = useState([]);

    const onEdit = useCallback(
        (key: string | any, action: string) => {
            if (typeof key === 'string' && action === 'remove') {
                return removeCapture(key);
            }
        },
        [removeCapture]
    );

    const handleChange = useCallback(
        (key: string) => {
            setActiveKey(key);
            const capture = captures.find(capture => capture.key === key);
            setActiveJimp(capture!.jimp);
        },
        [captures, setActiveJimp, setActiveKey]
    );

    const handleClickClearCaptures = useCallback(() => {
        clearCaptures();
        resetCoordinate();
    }, [clearCaptures, resetCoordinate]);

    const handleUpload = useCallback(
        info => {
            const { file, fileList } = info;
            if (file.uid !== fileList[fileList.length - 1].uid) {
                return;
            }
            setCaptureLoading(true);
            const paths: string[] = fileList.map((f: any) => f.originFileObj.path);
            setTimeout(() => vscode.postMessage({ command: 'loadImgFromLocalWithUris', data: paths }), 400);
        },
        [setCaptureLoading, vscode]
    );

    return captures.length <= 0 ? (
        <Dragger
            className='dragger'
            beforeUpload={() => false}
            fileList={fileList}
            showUploadList={false}
            onChange={handleUpload}
            openFileDialogOnClick={false}
            multiple={true}
            accept='.png'
            disabled={captureLoading}
        >
            <p className='ant-upload-drag-icon'>
                <InboxOutlined />
            </p>
            <p className='ant-upload-text'>将图片拖入以打开图片</p>
        </Dragger>
    ) : (
        <Tabs
            hideAdd
            onChange={handleChange}
            activeKey={activeKey}
            type='editable-card'
            onEdit={onEdit}
            tabBarExtraContent={{
                right: (
                    <Tooltip title='关闭所有页面'>
                        <Button type='text' size='large' icon={<CloseCircleOutlined onClick={handleClickClearCaptures} />} />
                    </Tooltip>
                ),
            }}
        >
            {captures.map(capture => (
                <TabPane tab={capture.title} key={capture.key}>
                    <Pic base64={capture.base64} />
                </TabPane>
            ))}
        </Tabs>
    );
};

export default Canvas;
