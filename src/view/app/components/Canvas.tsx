import * as React from 'react';
import { FC, useContext } from 'react';
import { CaptrueContext } from '../contexts/CaptureContext';
import { Tabs } from 'antd';
import Pic from './Pic';

const { TabPane } = Tabs;

const Canvas: FC = () => {
    const { captures, activeKey, setActiveKey, removeCapture, setActiveJimp } = useContext(CaptrueContext);

    const onEdit = (key: string, action: string) => {
        if (action === 'remove') {
            return removeCapture(key);
        }
    };
    const handleChange = (key: string) => {
        setActiveKey(key);
        const capture = captures.find(capture => capture.key === key);
        setActiveJimp(capture.jimp);
    };

    return captures.length <= 0 ? (
        <div></div>
    ) : (
        <div>
            <Tabs hideAdd onChange={handleChange} activeKey={activeKey} type='editable-card' onEdit={onEdit}>
                {captures.map(capture => (
                    <TabPane tab={capture.title} key={capture.key}>
                        <Pic base64={capture.base64} />
                    </TabPane>
                ))}
            </Tabs>
        </div>
    );
};

export default Canvas;
