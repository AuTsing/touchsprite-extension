import * as React from 'react';
import { FC, useRef, useContext, useEffect } from 'react';
import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import { RecordContext } from '../contexts/RecordContext';
import { Dropdown, Menu } from 'antd';

export interface IPicProps {
    base64: string;
}

const Pic: FC<IPicProps> = ({ base64 }) => {
    const { x, y, c, updateCoordinate } = useContext(CoordinateContext);
    const { activeJimp, rotateJimp } = useContext(CaptrueContext);
    const { records, addRecordByMouse, addRecordByKeyboard, clearRecords, setPoint1, setPoint2 } = useContext(RecordContext);
    const imgContainer = useRef<HTMLDivElement>(undefined);

    const handleMouseLeave = () => {
        updateCoordinate(-1, -1, activeJimp);
    };
    const handleMouseMove = (ev: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
        const x = ev.clientX - 15 + imgContainer.current.scrollLeft;
        const y = ev.clientY - 120 + window.pageYOffset;
        updateCoordinate(x, y, activeJimp);
    };
    const handlePixelMove = (orient: string) => {
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
    };
    const handleClick = () => {
        if (x === -1 || y === -1) {
            return;
        }
        addRecordByMouse(x, y, c);
    };
    const handleKeypress = (ev: KeyboardEvent) => {
        if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(ev.key)) {
            if (x === -1 || y === -1) {
                return;
            }
            addRecordByKeyboard(ev.key, x, y, c);
        } else if (['w', 'a', 's', 'd'].includes(ev.key)) {
            handlePixelMove(ev.key);
        } else if (ev.key === 'z') {
            clearRecords();
        } else if (ev.key === 'q') {
            setPoint1(x, y);
        } else if (ev.key === 'e') {
            setPoint2(x, y);
        }
    };

    useEffect(() => {
        window.addEventListener('keypress', handleKeypress);
        return () => window.removeEventListener('keypress', handleKeypress);
    }, [x, y, c, records]);

    return (
        <Dropdown
            overlay={
                <Menu>
                    <Menu.SubMenu title='旋转'>
                        <Menu.Item onClick={() => rotateJimp(90)}>90°</Menu.Item>
                        <Menu.Item onClick={() => rotateJimp(180)}>180°</Menu.Item>
                        <Menu.Item onClick={() => rotateJimp(270)}>270°</Menu.Item>
                    </Menu.SubMenu>
                </Menu>
            }
            trigger={['contextMenu']}
        >
            <div className='imgContainer' ref={imgContainer}>
                <img
                    className='img'
                    src={base64}
                    alt=''
                    draggable='false'
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                />
            </div>
        </Dropdown>
    );
};

export default Pic;
