import * as React from 'react';
import { createContext, useState, useEffect } from 'react';
import * as Jimp from 'jimp';
import { message } from 'antd';

export interface IWebviewPostMessage {
    command: string;
    data?: any;
}

export interface ICapture {
    title: string;
    jimp: Jimp;
    base64: string;
    key: string;
}

export interface ICaptureContext {
    captures: ICapture[];
    activeKey: string;
    setActiveKey: (key: string) => void;
    addCapture: (img: string) => void;
    removeCapture: (key: string) => void;
    activeJimp: Jimp;
    setActiveJimp: (jimp: Jimp) => void;
    rotateJimp: (deg: number) => void;
    compareJimp: (jimp1: ICapture, jimp2: ICapture) => void;
    binaryJimp: (color: string, tolerance: string) => void;
}

export const CaptrueContext = createContext<ICaptureContext>(undefined);

const CaptrueContextProvider = (props: { children: React.ReactNode }) => {
    const [newTabIndex, setNewTabIndex] = useState<number>(0);
    const [captures, setCaptures] = useState<ICapture[]>([]);
    const [activeKey, setActiveKey] = useState<string | undefined>();
    const [activeJimp, setActiveJimp] = useState<Jimp>(undefined);

    const addCapture = async (img: string | Jimp) => {
        let jimp: Jimp;
        if (typeof img === 'string') {
            jimp = await Jimp.read(Buffer.from(img, 'base64'));
        } else {
            jimp = img;
        }
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
    const compareJimp = (capture1: ICapture, capture2: ICapture) => {
        const jimp1 = capture1.jimp;
        const jimp2 = capture2.jimp;
        new Jimp(jimp1.bitmap.width, jimp1.bitmap.height, (_, previewJimp) => {
            previewJimp.scan(
                0,
                0,
                previewJimp.bitmap.width,
                previewJimp.bitmap.height,
                (x, y) => {
                    const hex1 = jimp1.getPixelColor(x, y);
                    const hex2 = jimp2.getPixelColor(x, y);
                    if (hex1 === hex2) {
                        previewJimp.setPixelColor(0xffffffff, x, y);
                    } else {
                        previewJimp.setPixelColor(0xff0000ff, x, y);
                    }
                },
                (_, newJimp) => {
                    addCapture(newJimp);
                }
            );
        });
    };
    const binaryJimp = (color: string, tolerance: string) => {
        const colors = color.split(',').map(c => Jimp.intToRGBA(parseInt(c.trim() + 'ff')));
        const toleranceNumber = parseInt(tolerance);
        activeJimp.clone((_, copy) => {
            copy.scan(
                0,
                0,
                copy.bitmap.width,
                copy.bitmap.height,
                (x, y, idx) => {
                    const r = copy.bitmap.data[idx + 0];
                    const g = copy.bitmap.data[idx + 1];
                    const b = copy.bitmap.data[idx + 2];
                    if (
                        colors.some(
                            rgba =>
                                Math.abs(rgba.r - r) <= toleranceNumber && Math.abs(rgba.g - g) <= toleranceNumber && Math.abs(rgba.b - b) <= toleranceNumber
                        )
                    ) {
                        copy.setPixelColor(0x000000ff, x, y);
                    } else {
                        copy.setPixelColor(0xffffffff, x, y);
                    }
                },
                (_, newJimp) => {
                    addCapture(newJimp);
                }
            );
        });
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
        <CaptrueContext.Provider
            value={{ captures, activeKey, setActiveKey, addCapture, removeCapture, activeJimp, setActiveJimp, rotateJimp, compareJimp, binaryJimp }}
        >
            {props.children}
        </CaptrueContext.Provider>
    );
};

export default CaptrueContextProvider;
