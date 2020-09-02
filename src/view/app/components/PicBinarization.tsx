import * as React from 'react';
import { FC, useState, useContext } from 'react';
import { Button, Modal, Form, Input, InputNumber } from 'antd';
import { CaptrueContext } from '../contexts/CaptureContext';

const PicBinarization: FC = () => {
    const { activeKey, binaryJimp } = useContext(CaptrueContext);

    const [color, setColor] = useState<string>('0xffffff');
    const [tolerance, setTolerance] = useState<number>(20);
    const [visible, setVisible] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const [form] = Form.useForm();

    const handleOk = () => {
        setConfirmLoading(true);
        form.validateFields()
            .then(values => {
                if (!activeKey) {
                    return Promise.reject();
                }
                binaryJimp(values.color, values.tolerance);
                setColor(values.color);
                setTolerance(values.tolerance);
                return Promise.resolve();
            })
            .then(() => {
                setVisible(false);
                setConfirmLoading(false);
            })
            .catch(() => {
                setTimeout(() => setConfirmLoading(false), 1000);
            });
    };
    const handleCancel = () => {
        setVisible(false);
    };

    return (
        <div>
            <Button type='primary' size='large' onClick={() => setVisible(true)}>
                图片二值化
            </Button>
            <Modal title='图片二值化' visible={visible} okText='转换' cancelText='取消' onOk={handleOk} confirmLoading={confirmLoading} onCancel={handleCancel}>
                <Form form={form} name='picComparatorForm' initialValues={{ color, tolerance }}>
                    <Form.Item
                        name='color'
                        label='颜色'
                        rules={[
                            { required: true, message: '请填写颜色' },
                            {
                                validator: (_, value: string) => {
                                    if (value.split(',').every(c => /0x[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/.test(c))) {
                                        return Promise.resolve();
                                    } else {
                                        return Promise.reject('字符格式错误');
                                    }
                                },
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item name='tolerance' label='容差' rules={[{ required: true, message: '请填写容差' }]}>
                        <InputNumber style={{ width: '100%' }} min={0} max={255} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PicBinarization;
