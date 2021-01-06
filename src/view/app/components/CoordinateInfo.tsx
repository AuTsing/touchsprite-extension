import * as React from 'react';
import { FC, useContext } from 'react';
import { CoordinateContext } from '../contexts/CoordinateContext';
import { Row, Col, Statistic } from 'antd';

const CoordinateInfo: FC = () => {
    const { x, y, c } = useContext(CoordinateContext);

    return (
        <Row className='coordinate-info'>
            <Col span={12}>
                <Statistic title='坐标' value={x + ',' + y} />
            </Col>
            <Col span={12}>
                <Statistic title='颜色值' value={c} />
            </Col>
        </Row>
    );
};

export default CoordinateInfo;
