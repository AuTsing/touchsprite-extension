import * as React from 'react';
import { FC, useRef, useContext, useEffect, useCallback } from 'react';

import { CoordinateContext } from '../contexts/CoordinateContext';
import { CaptrueContext } from '../contexts/CaptureContext';
import { RecordContext } from '../contexts/RecordContext';
import { KeyboardContext } from '../contexts/KeyboardContext';

// DEVTEMP 新增引入
import { VscodeContext } from '../contexts/VscodeContext';

export interface IPicProps {
    base64: string;
}

const Pic: FC<IPicProps> = ({ base64 }) => {
    const { x, y, c, updateCoordinate, resetCoordinate } = useContext(CoordinateContext);
    const { activeJimp, captures, activeKey } = useContext(CaptrueContext);
    const { addRecordByMouse, addRecordByKeyboard, setPoint1, setPoint2, imgCover, refreshPoints } = useContext(RecordContext);
    const { listen, leave } = useContext(KeyboardContext);
    const imgContainer = useRef<HTMLDivElement>(undefined!);
    // DEVTEMP 读取配置文件时用到
    const vscode = useContext(VscodeContext);

    const handleMouseLeave = useCallback(() => {
        resetCoordinate();
    }, [resetCoordinate]);

    const handleMouseMove = useCallback(
        (ev: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
            const x = ev.clientX - 10 + Math.round(imgContainer.current.scrollLeft);
            const y = ev.clientY - 114 + Math.round(imgContainer.current.scrollTop);
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
            } else if (key === 'r') {
                refreshPoints(activeJimp);
            } else if (key === 'l') {
                //  DEVTEMP 临时测试,读取
                const capture = captures.find(capture => capture.key === activeKey)
                if (capture) {
                    vscode.postMessage({
                        command: 'loadImgInfo',
                        data: capture.title
                    });
                } 
            }
        },
        [activeJimp, addRecordByKeyboard, c, handlePixelMove, refreshPoints, setPoint1, setPoint2, x, y]
    );

    useEffect(() => {
        listen('keypress', handleKeypress);
        return () => leave('keypress', handleKeypress);
    }, [handleKeypress, leave, listen]);

    return (
        <div className='img-container' ref={imgContainer} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>
            <img className='img-cover' src={imgCover} alt='' draggable='false' />
            <img className='img-content' src={base64} alt='' draggable='false' />
        </div>
    );
};

export default Pic;
