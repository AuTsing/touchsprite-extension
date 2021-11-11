import * as React from 'react';
import { FC, useCallback, useContext, useState, useEffect } from 'react';
import { Button, Modal, Form, Switch } from 'antd';

import { VscodeContext, IVscodeMessageEventData } from '../contexts/VscodeContext';
import { SettingContext } from '../contexts/SettingContext';

const Setting: FC = () => {
    const vscode = useContext(VscodeContext);
    const { showSamePixelInZoomValue, setShowSamePixelInZoomValue } = useContext(SettingContext);

    const [visible, setVisible] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const [form] = Form.useForm();

    const handleOk = useCallback(() => {
        setConfirmLoading(true);
        form.validateFields()
            .then(values => {
                setShowSamePixelInZoomValue(values.showSamePixelInZoom);
                return Promise.resolve(values);
            })
            .then(values => {
                for (const [key, value] of Object.entries(values)) {
                    vscode.postMessage({
                        command: 'putValue',
                        data: { key, value },
                    });
                }
            })
            .then(() => {
                setConfirmLoading(false);
                setVisible(false);
            });
    }, [form, setShowSamePixelInZoomValue, vscode]);
    const handleCancel = useCallback(() => {
        setVisible(false);
    }, []);

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            const eventData: IVscodeMessageEventData = event.data;
            switch (eventData.command) {
                case 'getValue-showSamePixelInZoom':
                    const value = (eventData.data as { key: string; value: any }).value ?? false;
                    setShowSamePixelInZoomValue(value);
                    break;
                default:
                    break;
            }
        },
        [setShowSamePixelInZoomValue]
    );

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage, vscode]);

    useEffect(() => {
        vscode.postMessage({ command: 'getValue', data: { key: 'showSamePixelInZoom' } });
    }, [vscode]);

    return (
        <div>
            <Button type='primary' size='large' onClick={() => setVisible(true)}>
                设置
            </Button>
            <Modal title='设置' visible={visible} okText='保存' cancelText='取消' confirmLoading={confirmLoading} onOk={handleOk} onCancel={handleCancel}>
                <Form
                    form={form}
                    name='settingForm'
                    initialValues={{
                        showSamePixelInZoom: showSamePixelInZoomValue,
                    }}
                >
                    <Form.Item name='showSamePixelInZoom' label='预览显示相同像素' valuePropName='checked'>
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Setting;
