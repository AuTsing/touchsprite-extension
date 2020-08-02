import * as React from 'react';
import { createContext, useState } from 'react';
import { message } from 'antd';

export interface IRecord {
    coordinate: string;
    color: string;
    preview: string;
    key: string;
}

export interface IRecordContext {
    records: IRecord[];
    addRecordByMouse: (x: number, y: number, c: string) => void;
    addRecordByKeyboard: (key: string, x: number, y: number, c: string) => void;
    deleteRecord: (key: string) => void;
    clearRecords: () => void;
}

export const RecordContext = createContext<IRecordContext>(undefined);

const RecordContextProvider = (props: { children: React.ReactNode; }) => {
    const [records, setRecords] = useState<IRecord[]>([]);

    const addRecordByMouse = (x: number, y: number, c: string) => {
        if (records.length >= 9) {
            message.warning('最大取点数为9个');
            return;
        }
        setRecords([...records, { coordinate: `${x},${y}`, color: c, preview: c, key: (records.length + 1).toString() }]);
    };
    const addRecordByKeyboard = (key: string, x: number, y: number, c: string) => {
        const index = parseInt(key) - 1;
        const copy = [...records];
        for (let i = 0; i < index; i++) {
            if (!copy[i]) {
                copy[i] = { key: (i + 1).toString(), coordinate: '', color: '', preview: '' };
            }
        }
        copy[index] = { coordinate: `${x},${y}`, color: c, preview: c, key: key };
        setRecords(copy);
    };
    const deleteRecord = (key: string) => {
        const copy = records.filter(record => record.key !== key);
        const newRecords = copy.map((record: IRecord, i: number) => {
            return { ...record, key: i.toString() };
        });
        setRecords(newRecords);
    };
    const clearRecords = () => setRecords([]);

    return (
        <RecordContext.Provider value={{ records, addRecordByMouse, addRecordByKeyboard, deleteRecord, clearRecords }}>{props.children}</RecordContext.Provider>
    );
};

export default RecordContextProvider;
