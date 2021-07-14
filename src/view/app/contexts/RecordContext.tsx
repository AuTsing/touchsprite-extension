import * as React from 'react';
import { createContext, useState, useCallback } from 'react';
import { message } from 'antd';
import Jimp from 'jimp/es';

export interface IRecord {
    coordinate: string;
    color: string;
    preview: string;
    key: string;
}

export interface IPoint {
    x: number;
    y: number;
}

export interface IRecordContext {
    records: IRecord[];
    addRecordByMouse: (x: number, y: number, c: string) => void;
    addRecordByKeyboard: (key: string, x: number, y: number, c: string) => void;
    deleteRecord: (key: string) => void;
    clearRecords: () => void;
    p1: IPoint;
    p2: IPoint;
    setPoint1: (x: number, y: number, width: number, height: number) => void;
    setPoint2: (x: number, y: number, width: number, height: number) => void;
    clearPoints: () => void;
    imgCover: string;
}

export const RecordContextDefaultValue: IRecordContext = {
    records: [],
    addRecordByMouse: () => null,
    addRecordByKeyboard: () => null,
    deleteRecord: () => null,
    clearRecords: () => null,
    p1: { x: -1, y: -1 },
    p2: { x: -1, y: -1 },
    setPoint1: () => null,
    setPoint2: () => null,
    clearPoints: () => null,
    imgCover: '',
};

export const RecordContext = createContext<IRecordContext>(RecordContextDefaultValue);

const RecordContextProvider = (props: { children: React.ReactNode }) => {
    const [records, setRecords] = useState<IRecord[]>([]);
    const [p1, setP1] = useState<IPoint>({ x: -1, y: -1 });
    const [p2, setP2] = useState<IPoint>({ x: -1, y: -1 });
    const [imgCover, setImgCover] = useState<string>('');

    const addRecordByMouse = useCallback(
        (x: number, y: number, c: string) => {
            if (records.length >= 9) {
                message.warning('最大取点数为9个');
                return;
            }
            setRecords([...records, { coordinate: `${x},${y}`, color: c, preview: c, key: (records.length + 1).toString() }]);
        },
        [records]
    );

    const addRecordByKeyboard = useCallback(
        (key: string, x: number, y: number, c: string) => {
            const index = parseInt(key) - 1;
            const copy = [...records];
            for (let i = 0; i < index; i++) {
                if (!copy[i]) {
                    copy[i] = { key: (i + 1).toString(), coordinate: '', color: '', preview: '' };
                }
            }
            copy[index] = { coordinate: `${x},${y}`, color: c, preview: c, key: key };
            setRecords(copy);
        },
        [records]
    );

    const deleteRecord = useCallback(
        (key: string) => {
            const copy = records.filter(record => record.key !== key);
            const newRecords = copy.map((record: IRecord, i: number) => {
                return { ...record, key: i.toString() };
            });
            setRecords(newRecords);
        },
        [records]
    );

    const clearRecords = useCallback(() => setRecords([]), []);

    const setPoint1 = useCallback(
        (x: number, y: number, width: number, height: number) => {
            setP1({ x, y });
            new Jimp(width, height, 0, (_, img) => {
                if (p2.x !== -1 && p2.y !== -1 && x !== p2.x && y !== p2.y) {
                    const x1 = x < p2.x ? x : p2.x;
                    const y1 = y < p2.y ? y : p2.y;
                    const x2 = x > p2.x ? x : p2.x;
                    const y2 = y > p2.y ? y : p2.y;
                    for (let i = x1; i <= x2; i++) {
                        for (let j = y1; j <= y2; j++) {
                            img.setPixelColor(0x0078d788, i, j);
                        }
                    }
                } else {
                    for (let i = x - 10; i < x + 10; i++) {
                        if (i >= 0 && i <= width) {
                            img.setPixelColor(0x0078d7ff, i, y);
                        }
                    }
                    for (let i = y - 10; i < y + 10; i++) {
                        if (i >= 0 && i <= width) {
                            img.setPixelColor(0x0078d7ff, x, i);
                        }
                    }
                }
                img.getBase64(Jimp.MIME_PNG, (_, base64) => {
                    setImgCover(base64);
                });
            });
        },
        [p2.x, p2.y]
    );

    const setPoint2 = useCallback(
        (x: number, y: number, width: number, height: number) => {
            setP2({ x, y });
            new Jimp(width, height, 0, (_, img) => {
                if (p1.x !== -1 && p1.y !== -1 && x !== p1.x && y !== p1.y) {
                    const x1 = x < p1.x ? x : p1.x;
                    const y1 = y < p1.y ? y : p1.y;
                    const x2 = x > p1.x ? x : p1.x;
                    const y2 = y > p1.y ? y : p1.y;
                    for (let i = x1; i < x2; i++) {
                        for (let j = y1; j < y2; j++) {
                            img.setPixelColor(0x0078d788, i, j);
                        }
                    }
                } else {
                    for (let i = x - 10; i < x + 10; i++) {
                        if (i >= 0 && i <= width) {
                            img.setPixelColor(0x0078d7ff, i, y);
                        }
                    }
                    for (let i = y - 10; i < y + 10; i++) {
                        if (i >= 0 && i <= width) {
                            img.setPixelColor(0x0078d7ff, x, i);
                        }
                    }
                }
                img.getBase64(Jimp.MIME_PNG, (_, base64) => {
                    setImgCover(base64);
                });
            });
        },
        [p1.x, p1.y]
    );

    const clearPoints = useCallback(() => {
        setP1({ x: -1, y: -1 });
        setP2({ x: -1, y: -1 });
        setImgCover('');
    }, []);

    return (
        <RecordContext.Provider
            value={{ records, addRecordByMouse, addRecordByKeyboard, deleteRecord, clearRecords, p1, p2, setPoint1, setPoint2, clearPoints, imgCover }}
        >
            {props.children}
        </RecordContext.Provider>
    );
};

export default RecordContextProvider;
