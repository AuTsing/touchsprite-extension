import * as React from 'react';
import { createContext, useState, useEffect } from 'react';
import * as Jimp from 'jimp';

export interface IWebviewPostMessage {
    command: string;
    data?: any;
}

export interface ICaptures {
    title: string;
    jimp: Jimp;
    base64: string;
    key: string;
}

export interface ICaptureContext {
    captures: ICaptures[];
    activeKey: string;
    setActiveKey: (key: string) => void;
    addCapture: (img: string) => void;
    removeCapture: (key: string) => void;
    activeJimp: Jimp;
    setActiveJimp: (jimp: Jimp) => void;
}

export const CaptrueContext = createContext<ICaptureContext>(undefined);

const CaptrueContextProvider = (props: { children: React.ReactNode }) => {
    const [newTabIndex, setNewTabIndex] = useState<number>(0);
    const [captures, setCaptures] = useState<ICaptures[]>([]);
    const [activeKey, setActiveKey] = useState<string | undefined>();
    const [activeJimp, setActiveJimp] = useState<Jimp>(undefined);

    const addCapture = async (img: string) => {
        const jimp = await Jimp.read(Buffer.from(img, 'base64'));
        const base64 = await jimp.getBase64Async(Jimp.MIME_PNG);
        const key = `newTab${newTabIndex}`;
        const title = `图片${newTabIndex + 1}`;

        setNewTabIndex(newTabIndex + 1);
        setCaptures([...captures, { title, jimp, base64, key }]);
        setActiveKey(key);
        setActiveJimp(jimp);
    };
    const removeCapture = (key: string) => {
        if (captures.length === 1) {
            setCaptures([]);
            return;
        }
        if (activeKey !== key) {
            setCaptures(captures.filter(capture => capture.key !== key));
            return;
        }
        let keyIndex: number;
        captures.forEach((capture, i) => {
            if (capture.key === key) {
                keyIndex = i;
            }
        });
        if (captures[keyIndex + 1]) {
            setCaptures(captures.filter(capture => capture.key !== key));
            setActiveKey(captures[keyIndex + 1].key);
        } else {
            setCaptures(captures.filter(capture => capture.key !== key));
            setActiveKey(captures[keyIndex - 1].key);
        }
        console.log(activeKey);
    };
    const handleMessage = (ev: MessageEvent) => {
        const message: IWebviewPostMessage = ev.data;
        if (message.command === 'add') {
            addCapture(message.data.img);
        }
    };
    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [captures]);

    return (
        <CaptrueContext.Provider value={{ captures, activeKey, setActiveKey, addCapture, removeCapture, activeJimp, setActiveJimp }}>
            {props.children}
        </CaptrueContext.Provider>
    );
};

export default CaptrueContextProvider;
