import * as React from 'react';
import { FC, useState, useEffect, useContext, useCallback } from 'react';
import { Button, Modal, Form, Input, message, Table } from 'antd';

import { VscodeContext, IVscodeMessageEventData } from '../contexts/VscodeContext';
import { RecordContext } from '../contexts/RecordContext';
import { KeyboardContext } from '../contexts/KeyboardContext';

const { Column } = Table;

interface ITemplate {
    key: string;
    content: string;
}

const CodeMaker: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records, p1, p2, clearRecords, clearPoints } = useContext(RecordContext);
    const { listen, leave } = useContext(KeyboardContext);

    const [templates, setTemplates] = useState<ITemplate[]>([
        { key: '1', content: "{'untitled',{$pointList}}," },
        { key: '2', content: "{'untitled',{$point[1][c],'$delta'}}," },
        { key: '3', content: '{$pointList},' },
    ]);
    const [visible, setVisible] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const [form] = Form.useForm();
    const dataSource = [
        { key: '1', keywords: '$pointList', instruction: '颜色列表' },
        { key: '2', keywords: '$delta', instruction: '找色差值' },
        { key: '3', keywords: '$p1', instruction: '范围左上角点' },
        { key: '4', keywords: '$p2', instruction: '范围右下角点' },
        { key: '5', keywords: '$point[n]', instruction: '点n(n填写第几个点)' },
        { key: '6', keywords: '$point[n][x]', instruction: '点n的x坐标' },
        { key: '7', keywords: '$point[n][y]', instruction: '点n的y坐标' },
        { key: '8', keywords: '$point[n][c]', instruction: '点n的c颜色值' },
    ];

    const handleOk = useCallback(() => {
        setConfirmLoading(true);
        form.validateFields()
            .then(values => {
                const newTemplates = [
                    { key: '1', content: values.template1 },
                    { key: '2', content: values.template2 },
                    { key: '3', content: values.template3 },
                ];
                setTemplates(newTemplates);
                return Promise.resolve(newTemplates);
            })
            .then(newTemplates => {
                vscode.postMessage({
                    command: 'saveTemplates',
                    data: JSON.stringify(newTemplates),
                });
            })
            .then(() => {
                setConfirmLoading(false);
                setVisible(false);
            });
    }, [form, vscode]);

    const handleCancel = useCallback(() => {
        setVisible(false);
    }, []);

    const makeCode = useCallback(
        (key: string) => {
            const unEmptyRecords = records.filter(record => record.coordinate.x !== -1 || record.coordinate.y !== -1);
            let template: string = templates[0].content;
            switch (key) {
                case 'f':
                    template = templates[0].content;
                    break;
                case 'g':
                    template = templates[1].content;
                    break;
                case 'h':
                    template = templates[2].content;
                    break;
                default:
                    break;
            }
            const pointStringList = unEmptyRecords.map(record => `{${record.coordinate.x},${record.coordinate.y},${record.color}}`);
            const delta = unEmptyRecords.map(
                record => `${record.coordinate.x - unEmptyRecords[0].coordinate.x}|${record.coordinate.y - unEmptyRecords[0].coordinate.y}|${record.color}`
            );
            delta.shift();

            const code = template
                .replace(/\$pointList/g, pointStringList.join(','))
                .replace(/\$delta/g, delta.join(','))
                .replace(/\$p1/g, `${p1.x},${p1.y}`)
                .replace(/\$p2/g, `${p2.x},${p2.y}`)
                .replace(/\$point\[[1-9]\]\[x\]/g, str => unEmptyRecords[parseInt(str.slice(7, 8)) - 1].coordinate.x.toString())
                .replace(/\$point\[[1-9]\]\[y\]/g, str => unEmptyRecords[parseInt(str.slice(7, 8)) - 1].coordinate.y.toString())
                .replace(/\$point\[[1-9]\]\[c\]/g, str => unEmptyRecords[parseInt(str.slice(7, 8)) - 1].color)
                .replace(/\$point\[[1-9]\]/g, str => pointStringList[parseInt(str.slice(7, 8)) - 1]);

            vscode.postMessage({ command: 'copy', data: code });
            message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
        },
        [p1.x, p1.y, p2.x, p2.y, records, templates, vscode]
    );

    const handleMessage = useCallback((event: MessageEvent) => {
        const eventData: IVscodeMessageEventData = event.data;
        switch (eventData.command) {
            case 'loadTemplates':
                const templates = (eventData.data as { templates: string }).templates;
                if (templates) {
                    const preSave = JSON.parse(templates);
                    if (preSave && preSave.length > 0) {
                        setTemplates(preSave);
                    }
                }
                break;
            default:
                break;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'loadTemplates' });
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage, vscode]);

    const handleKeypress = useCallback(
        (ev: KeyboardEvent) => {
            const key = ev.key.toLowerCase();
            if (['f', 'g', 'h'].includes(key)) {
                makeCode(key);
            } else if (key === 'z') {
                clearRecords();
            } else if (key === 'x') {
                clearPoints();
            }
        },
        [clearPoints, clearRecords, makeCode]
    );

    useEffect(() => {
        listen('keypress', handleKeypress);
        return () => leave('keypress', handleKeypress);
    }, [handleKeypress, leave, listen]);

    return (
        <div>
            <Button type='primary' size='large' onClick={() => setVisible(true)}>
                模板设置
            </Button>
            <Modal title='模板设置' visible={visible} okText='保存' cancelText='取消' onOk={handleOk} confirmLoading={confirmLoading} onCancel={handleCancel}>
                <Form
                    form={form}
                    name='templatesForm'
                    initialValues={{ template1: templates[0].content, template2: templates[1].content, template3: templates[2].content }}
                >
                    <Form.Item name='template1' label='模板1'>
                        <Input />
                    </Form.Item>
                    <Form.Item name='template2' label='模板2'>
                        <Input />
                    </Form.Item>
                    <Form.Item name='template3' label='模板3'>
                        <Input />
                    </Form.Item>
                </Form>
                <Table dataSource={dataSource} size='small' bordered={true} pagination={false}>
                    <Column title='关键字' dataIndex='keywords' width='40%' />
                    <Column title='说明' dataIndex='instruction' width='60%' />
                </Table>
            </Modal>
        </div>
    );
};

export default CodeMaker;
