import * as React from 'react';
import { FC, useContext, useCallback } from 'react';
import { Tabs, Button, Tooltip, Empty } from 'antd';
import { CloseCircleOutlined, RotateRightOutlined } from '@ant-design/icons';

import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import Pic from './Pic';
import LoadingImage from './LoadingImage';

const { TabPane } = Tabs;

const Canvas: FC = () => {
    const { captures, activeKey, setActiveKey, removeCapture, setActiveJimp, clearCaptures, rotateJimp } = useContext(CaptrueContext);
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

    const handleRotate = useCallback(() => rotateJimp(90), [rotateJimp]);

    if (captures.length <= 0) {
        return (
            <LoadingImage>
                <Empty className='empty' image={Empty.PRESENTED_IMAGE_SIMPLE} description='将图片拖入打开图片' />
            </LoadingImage>
        );
    } else {
        return (
            <LoadingImage>
                <Tabs
                    className='tabs'
                    hideAdd
                    onChange={handleChange}
                    activeKey={activeKey}
                    type='editable-card'
                    onEdit={onEdit}
                    tabBarExtraContent={{
                        right: (
                            <div>
                                <Tooltip title='顺时针旋转90°'>
                                    <Button type='text' size='large' icon={<RotateRightOutlined onClick={handleRotate} />} />
                                </Tooltip>
                                <Tooltip title='关闭所有页面'>
                                    <Button type='text' size='large' icon={<CloseCircleOutlined onClick={handleClickClearCaptures} />} />
                                </Tooltip>
                            </div>
                        ),
                    }}
                >
                    {captures.map(capture => (
                        <TabPane tab={capture.title} key={capture.key}>
                            <Pic base64={capture.base64} />
                        </TabPane>
                    ))}
                </Tabs>
            </LoadingImage>
        );
    }
};

export default Canvas;
