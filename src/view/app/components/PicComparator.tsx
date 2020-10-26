import * as React from 'react';
import { FC, useState, useContext } from 'react';
import { Button, Modal, Select, Form, InputNumber } from 'antd';
import { CaptrueContext } from '../contexts/CaptureContext';

const PicComparator: FC = () => {
    const { captures, compareJimp } = useContext(CaptrueContext);

    const [tolerance, setTolerance] = useState<number>(0);
    const [visible, setVisible] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const [form] = Form.useForm();
    const options = captures.map((capture, index) => ({ label: capture.title, value: index }));

    const handleOk = () => {
        setConfirmLoading(true);
        form.validateFields()
            .then(values => {
                const pic1 = captures[values.pic1];
                const pic2 = captures[values.pic2];
                setTolerance(values.tolerance);
                return compareJimp(pic1, pic2, values.tolerance);
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
                图片比较器
            </Button>
            <Modal title='图片比较器' visible={visible} okText='比较' cancelText='取消' onOk={handleOk} confirmLoading={confirmLoading} onCancel={handleCancel}>
                <Form form={form} name='picComparatorForm' initialValues={{ tolerance }}>
                    <Form.Item name='pic1' label='选择图片' rules={[{ required: true, message: '请选择图片以进行比较' }]}>
                        <Select options={options} />
                    </Form.Item>
                    <Form.Item name='pic2' label='选择图片' rules={[{ required: true, message: '请选择图片以进行比较' }]}>
                        <Select options={options} />
                    </Form.Item>
                    <Form.Item name='tolerance' label='容差' rules={[{ required: true, message: '请填写容差' }]}>
                        <InputNumber style={{ width: '100%' }} min={0} max={255} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PicComparator;
