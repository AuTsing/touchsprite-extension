import * as React from 'react';
import { FC, useContext } from 'react';
import { CoordinateContext } from '../contexts/CoordinateContext';
import { Statistic } from 'antd';

const CoordinateInfo: FC = () => {
    const { x, y, c } = useContext(CoordinateContext);

    return (
        <div className='coordinate-info-container'>
            <Statistic className='coordinate-info' title='坐标' value={x + ',' + y} />
            <Statistic className='coordinate-info' title='颜色值' value={c} />
        </div>
    );
};

export default CoordinateInfo;
