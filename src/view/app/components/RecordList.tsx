import * as React from 'react';
import { FC, useContext, useCallback } from 'react';
import { Row, Col, Table, Space, message } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';

import { VscodeContext } from '../contexts/VscodeContext';
import { RecordContext, IRecord, IPoint } from '../contexts/RecordContext';

const { Column } = Table;

const RecordList: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records, deleteRecord, p1, p2 } = useContext(RecordContext);

    const copyRecord = useCallback((record: IRecord) => {
        const code = `{${record.coordinate},${record.color}}`;
        vscode.postMessage({ command: 'copy', data: code });
        message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
    }, [vscode]);

    const copyPoint = useCallback((point: IPoint) => {
        const code = `${point.x},${point.y}`;
        vscode.postMessage({ command: 'copy', data: code });
        message.info(`${code} 已复制到剪贴板`);
    }, [vscode]);

    const copyInfo = useCallback((coordinate: string) => {
        vscode.postMessage({ command: 'copy', data: coordinate });
        message.info(`${coordinate} 已复制到剪贴板`);
    }, [vscode]);

    return (
        <Row>
            <Col className='record-list'>
                <Table dataSource={records} size='small' bordered={true} pagination={false} locale={{ emptyText: '鼠标左键/数字键1-9开始取色' }}>
                    <Column title='坐标' dataIndex='coordinate' width='25%' onCell={(record: IRecord) => ({ onClick: () => copyInfo(record.coordinate) })} />
                    <Column title='颜色值' dataIndex='color' width='25%' onCell={(record: IRecord) => ({ onClick: () => copyInfo(record.color) })} />
                    <Column
                        title='预览'
                        dataIndex='preview'
                        render={(text: string, record: IRecord, index: number) => {
                            if (record.coordinate) {
                                return { props: { style: { background: `#${text.slice(2)}` } } };
                            } else {
                                return <div></div>;
                            }
                        }}
                        width='20%'
                    />
                    <Column
                        title='操作'
                        width='30%'
                        render={(record: IRecord) => (
                            <Space>
                                <CopyOutlined onClick={() => copyRecord(record)} />
                                <DeleteOutlined onClick={() => deleteRecord(record.key)} />
                            </Space>
                        )}
                    />
                </Table>
                <Table dataSource={[{ key: '0' }]} size='small' bordered={true} pagination={false} showHeader={false}>
                    <Column render={() => '点1'} width='25%'></Column>
                    <Column render={() => `${p1.x},${p1.y}`} width='25%' onCell={() => ({ onClick: () => copyPoint(p1) })}></Column>
                    <Column render={() => '点2'} width='25%'></Column>
                    <Column render={() => `${p2.x},${p2.y}`} width='25%' onCell={() => ({ onClick: () => copyPoint(p2) })}></Column>
                </Table>
            </Col>
        </Row>
    );
};

export default RecordList;
