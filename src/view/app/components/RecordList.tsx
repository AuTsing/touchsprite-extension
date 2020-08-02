import * as React from 'react';
import { FC, useContext } from 'react';
import { RecordContext, IRecord } from '../contexts/RecordContext';
import { VscodeContext } from '../contexts/vscodeContext';
import { Row, Col, Table, Space, message } from 'antd';

const { Column } = Table;

const RecordList: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records, deleteRecord } = useContext(RecordContext);

    const copyRecord = (record: IRecord) => {
        const code = `{${record.coordinate},${record.color}}`;
        vscode.postMessage({ command: 'copy', data: code });
        message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
    };

    return (
        <Row>
            <Col className='zoomRow3'>
                <Table dataSource={records} size='small' bordered={true} pagination={false} locale={{ emptyText: '鼠标左键/数字键1-9开始取色' }}>
                    <Column title='坐标' dataIndex='coordinate' width='25%' />
                    <Column title='颜色值' dataIndex='color' width='25%' />
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
                                <a onClick={() => copyRecord(record)}>CP</a>
                                <a onClick={() => deleteRecord(record.key)}>DL</a>
                            </Space>
                        )}
                    />
                </Table>
            </Col>
        </Row>
    );
};

export default RecordList;
