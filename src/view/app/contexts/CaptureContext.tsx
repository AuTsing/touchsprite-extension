import * as React from 'react';
import { createContext, useState, useEffect } from 'react';
import * as Jimp from 'jimp';
import { message } from 'antd';

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
    rotateJimp: (deg: number) => void;
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
    const rotateJimp = async (deg: number) => {
        const jimpCopy = activeJimp.clone();
        const bData = jimpCopy.bitmap.data;
        const bDataLength = bData.length;
        const dstBuffer = Buffer.allocUnsafe(bDataLength);

        switch (deg) {
            case 180:
                for (let i = 0; i < bDataLength; i += 4) {
                    dstBuffer.writeUInt32BE(bData.readUInt32BE(i), bDataLength - i - 4);
                }
                break;
            case 90:
            case 270:
                const w = jimpCopy.bitmap.width;
                const h = jimpCopy.bitmap.height;
                const dstOffsetStep = deg === 90 ? 4 : -4;
                let dstOffset = deg === 90 ? 0 : dstBuffer.length - 4;

                for (let x = 0; x < w; x++) {
                    for (let y = h - 1; y >= 0; y--) {
                        dstBuffer.writeUInt32BE(bData.readUInt32BE((w * y + x) << 2), dstOffset);
                        dstOffset += dstOffsetStep;
                    }
                }

                jimpCopy.bitmap.width = h;
                jimpCopy.bitmap.height = w;
                break;
            default:
                break;
        }

        jimpCopy.bitmap.data = dstBuffer;

        const base64 = await jimpCopy.getBase64Async(Jimp.MIME_PNG);
        const copy = [...captures];
        setCaptures(
            copy.map(capture => {
                if (capture.key === activeKey) {
                    capture.base64 = base64;
                    capture.jimp = jimpCopy;
                }
                return capture;
            })
        );
        setActiveJimp(jimpCopy);
    };
    const handleMessage = (ev: MessageEvent) => {
        const msg: IWebviewPostMessage = ev.data;
        switch (msg.command) {
            case 'add':
                addCapture(msg.data.img);
                break;
            case 'showMessage':
                message.info(msg.data.message);
                break;
            default:
                break;
        }
    };
    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [captures]);

    return (
        <CaptrueContext.Provider value={{ captures, activeKey, setActiveKey, addCapture, removeCapture, activeJimp, setActiveJimp, rotateJimp }}>
            {props.children}
        </CaptrueContext.Provider>
    );
};

export default CaptrueContextProvider;
