import * as React from 'react';
import { FC, useState, useEffect, useContext } from 'react';
import { RecordContext } from '../contexts/RecordContext';
import { Button, Modal, Form, Input, message } from 'antd';
import { VscodeContext } from '../contexts/vscodeContext';

interface ITemplate {
    key: string;
    content: string;
}

const CodeMaker: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records } = useContext(RecordContext);
    const [templates, setTemplates] = useState<ITemplate[]>([
        { key: '1', content: "{'untitled',{$pointList}}," },
        { key: '2', content: "{'untitled',{$point[1][c],'$delta'}}," },
        { key: '3', content: '{$pointList},' },
    ]);
    const [visible, setVisible] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const [form] = Form.useForm();

    const handleOk = () => {
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
    };
    const handleCancel = () => {
        setVisible(false);
    };
    const makeCode = (key: string) => {
        const unEmptyRecords = records.filter(record => record.coordinate !== '');
        if (unEmptyRecords.length <= 0) {
            message.warning('取色记录为空');
            return;
        }
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
        const pointList = unEmptyRecords.map(record => ({
            x: record.coordinate.split(',')[0],
            y: record.coordinate.split(',')[1],
            c: record.color,
        }));
        const pointStringList = pointList.map(point => `{${point.x},${point.y},${point.c}}`);
        const delta = pointList.map(point => `${parseInt(point.x) - parseInt(pointList[0].x)}|${parseInt(point.y) - parseInt(pointList[0].y)}|${point.c}`);
        delta.shift();

        const code = template
            .replace(/\$pointList/g, pointStringList.join(','))
            .replace(/\$delta/g, delta.join(','))
            .replace(/\$point\[[1-9]\]\[x\]/g, str => pointList[parseInt(str.slice(7, 8)) - 1].x)
            .replace(/\$point\[[1-9]\]\[y\]/g, str => pointList[parseInt(str.slice(7, 8)) - 1].y)
            .replace(/\$point\[[1-9]\]\[c\]/g, str => pointList[parseInt(str.slice(7, 8)) - 1].c)
            .replace(/\$point\[[1-9]\]/g, str => pointStringList[parseInt(str.slice(7, 8)) - 1]);

        vscode.postMessage({ command: 'copy', data: code });
        message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
    };
    const handleKeypress = (ev: KeyboardEvent) => {
        if (['f', 'g', 'h'].includes(ev.key)) {
            makeCode(ev.key);
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            switch (msg.command) {
                case 'loadTemplates':
                    const { data } = msg;
                    // console.log(msg);
                    const preSave = JSON.parse(data);
                    if (preSave && preSave.length > 0) {
                        setTemplates(preSave);
                    }
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'loadTemplates' });
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    useEffect(() => {
        window.addEventListener('keypress', handleKeypress);
        return () => window.removeEventListener('keypress', handleKeypress);
    }, [records]);

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
                <p>
                    取色过程中使用快捷键生成代码： <br />
                    模板1(F)，模板2(G)，模板3(H)
                </p>
                <p>
                    模板设置关键字： <br />
                    $point[x] 取色点x，x填写第x(1-9)个点。 <br />
                    如：$point[1] 生成代码为{'{123,123,0x000fff}'} <br />
                </p>
                <p>
                    $point[x1]-x2 取色点x1的属性x2，x1填写第x(1-9)个点，x2填写x/y/c分别代表x坐标/y坐标/颜色值。 <br />
                    如：$point[1]-x 生成代码为 123 <br />
                </p>
                <p>
                    $pointList 比色数据列表。 <br />
                    如：$pointList 生成代码为 {'{123,123,0x000fff},{321,321,0xfff000},{111,111,0xffffff}'} <br />
                </p>
                <p>
                    $delta 找色颜色差值，首个有效点与后面所有点的颜色差值。 <br />
                    如：$delta 生成代码为 1|2|0x000fff,3|4|fff000,-5|-6|0xffffff
                </p>
            </Modal>
        </div>
    );
};

export default CodeMaker;
