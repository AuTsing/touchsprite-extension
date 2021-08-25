import * as React from 'react';
import { FC, useContext, useCallback } from 'react';
import { Table, Space, message } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';

import { VscodeContext } from '../contexts/VscodeContext';
import { RecordContext, IRecord, IPoint } from '../contexts/RecordContext';

const { Column } = Table;

const RecordList: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records, deleteRecord, p1, p2 } = useContext(RecordContext);

    const copyRecord = useCallback(
        (record: IRecord) => {
            const code = `{${record.coordinate.x},${record.coordinate.y},${record.color}}`;
            vscode.postMessage({ command: 'copy', data: code });
            message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
        },
        [vscode]
    );

    const copyPoint = useCallback(
        (point: IPoint) => {
            const code = `${point.x},${point.y}`;
            vscode.postMessage({ command: 'copy', data: code });
            message.info(`${code} 已复制到剪贴板`);
        },
        [vscode]
    );

    const copyInfo = useCallback(
        (coordinate: string) => {
            vscode.postMessage({ command: 'copy', data: coordinate });
            message.info(`${coordinate} 已复制到剪贴板`);
        },
        [vscode]
    );

    return (
        <div className='record-list'>
            <Table dataSource={records} size='small' bordered={true} pagination={false} locale={{ emptyText: '鼠标左键/数字键1-9开始取色' }}>
                <Column
                    title='坐标'
                    dataIndex='coordinate'
                    render={(point: IPoint, record: IRecord, index: number) => {
                        const exceptIt = records.filter(rcd => rcd !== record);
                        if (exceptIt.find(rcd => `${rcd.coordinate.x},${rcd.coordinate.y}` === `${point.x},${point.y}`)) {
                            return { children: `${point.x},${point.y}`, props: { style: { background: `#FF0000` } } };
                        } else {
                            return `${point.x},${point.y}`;
                        }
                    }}
                    width='25%'
                    onCell={(record: IRecord) => ({ onClick: () => copyInfo(`${record.coordinate.x},${record.coordinate.y}`) })}
                />
                <Column
                    title='颜色值'
                    dataIndex='color'
                    render={(text: string, record: IRecord, index: number) => {
                        const exceptIt = records.filter(rcd => rcd !== record);
                        if (exceptIt.find(rcd => rcd.coordinate === record.coordinate)) {
                            return { children: text, props: { style: { background: `#FF0000` } } };
                        } else {
                            return text;
                        }
                    }}
                    width='25%'
                    onCell={(record: IRecord) => ({ onClick: () => copyInfo(record.color) })}
                />
                <Column
                    title='预览'
                    dataIndex='preview'
                    render={(text: string, record: IRecord, index: number) => {
                        if (text) {
                            return { props: { style: { background: `#${text.slice(2)}` } } };
                        } else {
                            return <div></div>;
                        }
                    }}
                    width='25%'
                />
                <Column
                    title='操作'
                    width='25%'
                    render={(record: IRecord) => (
                        <Space>
                            <CopyOutlined onClick={() => copyRecord(record)} />
                            <DeleteOutlined onClick={() => deleteRecord(record.key)} />
                        </Space>
                    )}
                />
            </Table>
            <Table dataSource={[{ key: '0' }]} size='small' bordered={true} pagination={false} showHeader={false}>
                <Column render={() => '点1'} width='25%' />
                <Column
                    className={p1.x !== -1 || p1.y !== -1 ? undefined : 'record-list-empty'}
                    render={() => (p1.x !== -1 || p1.y !== -1 ? `${p1.x},${p1.y}` : 'q选取')}
                    width='25%'
                    onCell={() => ({ onClick: () => copyPoint(p1) })}
                />
                <Column render={() => '点2'} width='25%' />
                <Column
                    className={p2.x !== -1 || p2.y !== -1 ? undefined : 'record-list-empty'}
                    render={() => (p2.x !== -1 || p2.y !== -1 ? `${p2.x},${p2.y}` : 'e选取')}
                    width='25%'
                    onCell={() => ({ onClick: () => copyPoint(p2) })}
                />
            </Table>
        </div>
    );
};

export default RecordList;
