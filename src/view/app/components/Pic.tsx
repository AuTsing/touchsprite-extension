import * as React from 'react';
import { FC, useRef, useContext, useEffect, useCallback } from 'react';
import { Dropdown, Menu } from 'antd';

import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import { RecordContext } from '../contexts/RecordContext';

export interface IPicProps {
    base64: string;
}

const Pic: FC<IPicProps> = ({ base64 }) => {
    const { x, y, c, updateCoordinate, resetCoordinate } = useContext(CoordinateContext);
    const { activeJimp, rotateJimp, clearCaptures } = useContext(CaptrueContext);
    const { addRecordByMouse, addRecordByKeyboard, setPoint1, setPoint2, imgCover } = useContext(RecordContext);
    const imgContainer = useRef<HTMLDivElement>(undefined!);

    const handleMouseLeave = useCallback(() => {
        resetCoordinate();
    }, [resetCoordinate]);

    const handleMouseMove = useCallback(
        (ev: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
            const x = ev.clientX - 10 + imgContainer.current.scrollLeft;
            const y = ev.clientY - 114 + imgContainer.current.scrollTop;
            updateCoordinate(x, y, activeJimp);
        },
        [activeJimp, updateCoordinate]
    );

    const handlePixelMove = useCallback(
        (orient: string) => {
            if (!activeJimp) {
                return;
            }
            switch (orient) {
                case 'w':
                    if (y <= 0) {
                        return;
                    }
                    updateCoordinate(x, y - 1, activeJimp);
                    break;
                case 'a':
                    if (x <= 0) {
                        return;
                    }
                    updateCoordinate(x - 1, y, activeJimp);
                    break;
                case 's':
                    if (y >= activeJimp.bitmap.height - 1) {
                        return;
                    }
                    updateCoordinate(x, y + 1, activeJimp);
                    break;
                case 'd':
                    if (x >= activeJimp.bitmap.width - 1) {
                        return;
                    }
                    updateCoordinate(x + 1, y, activeJimp);
                    break;
                default:
                    break;
            }
        },
        [activeJimp, updateCoordinate, x, y]
    );

    const handleClick = useCallback(() => {
        if (x === -1 || y === -1) {
            return;
        }
        addRecordByMouse(x, y, c);
    }, [addRecordByMouse, c, x, y]);

    const handleClickClearCaptures = useCallback(() => {
        clearCaptures();
        resetCoordinate();
    }, [clearCaptures, resetCoordinate]);

    const handleKeypress = useCallback(
        (ev: KeyboardEvent) => {
            if (x === -1 || y === -1 || !activeJimp) {
                return;
            }
            const key = ev.key.toLowerCase();
            if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) {
                addRecordByKeyboard(key, x, y, c);
            } else if (['w', 'a', 's', 'd'].includes(key)) {
                handlePixelMove(key);
            } else if (key === 'q') {
                setPoint1(x, y, activeJimp.bitmap.width, activeJimp.bitmap.height);
            } else if (key === 'e') {
                setPoint2(x, y, activeJimp.bitmap.width, activeJimp.bitmap.height);
            }
        },
        [activeJimp, addRecordByKeyboard, c, handlePixelMove, setPoint1, setPoint2, x, y]
    );

    useEffect(() => {
        window.addEventListener('keypress', handleKeypress);
        return () => window.removeEventListener('keypress', handleKeypress);
    }, [handleKeypress]);

    return (
        <div className='img-container' ref={imgContainer}>
            <Dropdown
                overlay={
                    <Menu>
                        <Menu.SubMenu title='旋转'>
                            <Menu.Item onClick={() => rotateJimp(90)}>90°</Menu.Item>
                            <Menu.Item onClick={() => rotateJimp(180)}>180°</Menu.Item>
                            <Menu.Item onClick={() => rotateJimp(270)}>270°</Menu.Item>
                        </Menu.SubMenu>
                        <Menu.Item onClick={handleClickClearCaptures}>关闭所有页面</Menu.Item>
                    </Menu>
                }
                trigger={['contextMenu']}
            >
                <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>
                    <div>
                        <img className='img-cover' src={imgCover} alt='' draggable='false' />
                    </div>
                    <div>
                        <img className='img' src={base64} alt='' draggable='false' />
                    </div>
                </div>
            </Dropdown>
        </div>
    );
};

export default Pic;
