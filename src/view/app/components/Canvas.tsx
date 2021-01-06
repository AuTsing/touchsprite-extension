import * as React from 'react';
import { FC, useContext, useCallback } from 'react';
import { Tabs, Empty, Button, Tooltip } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import Pic from './Pic';

const { TabPane } = Tabs;

const Canvas: FC = () => {
    const { captures, activeKey, setActiveKey, removeCapture, setActiveJimp, clearCaptures } = useContext(CaptrueContext);
    const { resetCoordinate } = useContext(CoordinateContext);

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

    return captures.length <= 0 ? (
        <div>
            <Empty className='empty' image={Empty.PRESENTED_IMAGE_SIMPLE} description='无图片' />
        </div>
    ) : (
        <div>
            <Tabs
                hideAdd
                onChange={handleChange}
                activeKey={activeKey}
                type='editable-card'
                onEdit={onEdit}
                animated={true}
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
        </div>
    );
};

export default Canvas;
