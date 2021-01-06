import * as React from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import Jimp from 'jimp';
import { message } from 'antd';

import { IVscodeMessageEventData } from '../contexts/VscodeContext';

export interface ICapture {
    title: string;
    jimp: Jimp;
    base64: string;
    key: string;
}

export interface ICaptureContext {
    captures: ICapture[];
    activeKey: string | undefined;
    setActiveKey: (key: string) => void;
    addCapture: (imgs: Jimp[]) => void;
    addCaptureByString: (imgs: string[]) => void;
    removeCapture: (key: string) => void;
    activeJimp: Jimp | undefined;
    setActiveJimp: (jimp: Jimp) => void;
    rotateJimp: (deg: number) => void;
    compareJimp: (jimp1: ICapture, jimp2: ICapture, tolerance: string) => void;
    binaryJimp: (color: string, tolerance: string) => void;
    clearCaptures: () => void;
    setAddedCallback: (cb: () => void) => void;
}

export const CaptrueContextDefaultValue: ICaptureContext = {
    captures: [],
    activeKey: undefined,
    setActiveKey: () => null,
    addCapture: () => null,
    addCaptureByString: () => null,
    removeCapture: () => null,
    activeJimp: undefined,
    setActiveJimp: () => null,
    rotateJimp: () => null,
    compareJimp: () => null,
    binaryJimp: () => null,
    clearCaptures: () => null,
    setAddedCallback: () => null,
};

export const CaptrueContext = createContext<ICaptureContext>(CaptrueContextDefaultValue);

const CaptrueContextProvider = (props: { children: React.ReactNode }) => {
    const [newTabIndex, setNewTabIndex] = useState<number>(0);
    const [captures, setCaptures] = useState<ICapture[]>([]);
    const [activeKey, setActiveKey] = useState<string | undefined>(undefined);
    const [activeJimp, setActiveJimp] = useState<Jimp | undefined>(undefined);
    const [addedCaptureCallback, setAddedCallback] = useState<() => void>(() => () => {});

    const addCapture = useCallback(
        (imgs: Jimp[]) => {
            let keyRecord = newTabIndex;
            const capturesRecord = [...captures];
            Promise.all(
                imgs.map(async (img: Jimp) => {
                    let jimp: Jimp;
                    if (typeof img === 'string') {
                        jimp = await Jimp.read(Buffer.from(img, 'base64'));
                    } else {
                        jimp = img;
                    }
                    const base64 = await jimp.getBase64Async(Jimp.MIME_PNG);
                    keyRecord++;
                    const key = `newTab${keyRecord}`;
                    const title = `图片${keyRecord}`;
                    capturesRecord.push({ title, jimp, base64, key });
                })
            ).then(() => {
                setCaptures(capturesRecord);
                const lastCapture = capturesRecord.slice(-1)[0];
                setNewTabIndex(keyRecord);
                setActiveKey(lastCapture.key);
                setActiveJimp(lastCapture.jimp);
            });
        },
        [newTabIndex, captures]
    );

    const addCaptureByString = useCallback(
        (imgs: string[]) => {
            Promise.all(
                imgs.map(async img => {
                    return await Jimp.read(Buffer.from(img, 'base64'));
                })
            ).then(jimps => {
                return addCapture(jimps);
            });
        },
        [addCapture]
    );

    const removeCapture = useCallback(
        (key: string) => {
            if (captures.length === 1) {
                setCaptures([]);
                return;
            }
            if (activeKey !== key) {
                setCaptures(captures.filter(capture => capture.key !== key));
                return;
            }
            let keyIndex: number = 0;
            captures.forEach((capture, i) => {
                if (capture.key === key) {
                    keyIndex = i;
                }
            });
            if (captures[keyIndex + 1]) {
                setCaptures(captures.filter(capture => capture.key !== key));
                setActiveKey(captures[keyIndex + 1].key);
                setActiveJimp(captures[keyIndex + 1].jimp);
            } else {
                setCaptures(captures.filter(capture => capture.key !== key));
                setActiveKey(captures[keyIndex - 1].key);
                setActiveJimp(captures[keyIndex - 1].jimp);
            }
        },
        [activeKey, captures]
    );

    const clearCaptures = useCallback(() => setCaptures([]), []);

    const rotateJimp = useCallback(
        async (deg: number) => {
            if (!activeJimp) {
                return;
            }
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
        },
        [activeJimp, activeKey, captures]
    );

    const compareJimp = useCallback(
        (capture1: ICapture, capture2: ICapture, tolerance: string = '0') => {
            const jimp1 = capture1.jimp;
            const jimp2 = capture2.jimp;
            const toleranceNumber = parseInt(tolerance);
            new Jimp(jimp1.bitmap.width, jimp1.bitmap.height, (err, previewJimp) => {
                previewJimp.scan(
                    0,
                    0,
                    previewJimp.bitmap.width,
                    previewJimp.bitmap.height,
                    (x, y, idx) => {
                        const r1 = jimp1.bitmap.data[idx + 0];
                        const g1 = jimp1.bitmap.data[idx + 1];
                        const b1 = jimp1.bitmap.data[idx + 2];
                        const r2 = jimp2.bitmap.data[idx + 0];
                        const g2 = jimp2.bitmap.data[idx + 1];
                        const b2 = jimp2.bitmap.data[idx + 2];
                        if (Math.abs(r1 - r2) <= toleranceNumber && Math.abs(g1 - g2) <= toleranceNumber && Math.abs(b1 - b2) <= toleranceNumber) {
                            previewJimp.setPixelColor(0xffffffff, x, y);
                        } else {
                            previewJimp.setPixelColor(0xff0000ff, x, y);
                        }
                    },
                    (_, newJimp) => {
                        addCapture([newJimp]);
                    }
                );
            });
        },
        [addCapture]
    );

    const binaryJimp = useCallback(
        (color: string, tolerance: string) => {
            if (!activeJimp) {
                return;
            }
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
                                    Math.abs(rgba.r - r) <= toleranceNumber &&
                                    Math.abs(rgba.g - g) <= toleranceNumber &&
                                    Math.abs(rgba.b - b) <= toleranceNumber
                            )
                        ) {
                            copy.setPixelColor(0x000000ff, x, y);
                        } else {
                            copy.setPixelColor(0xffffffff, x, y);
                        }
                    },
                    (_, newJimp) => {
                        addCapture([newJimp]);
                    }
                );
            });
        },
        [activeJimp, addCapture]
    );

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            const eventData: IVscodeMessageEventData = event.data;
            switch (eventData.command) {
                case 'add':
                    const imgs = (eventData.data as { imgs: string[] }).imgs;
                    addCaptureByString(imgs);
                    addedCaptureCallback();
                    break;
                case 'showMessage':
                    const msg = (eventData.data as { message: string }).message;
                    message.info(msg);
                    addedCaptureCallback();
                    break;
                default:
                    break;
            }
        },
        [addCapture, addedCaptureCallback]
    );

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [captures, handleMessage]);

    return (
        <CaptrueContext.Provider
            value={{
                captures,
                activeKey,
                setActiveKey,
                addCapture,
                addCaptureByString,
                removeCapture,
                activeJimp,
                setActiveJimp,
                rotateJimp,
                compareJimp,
                binaryJimp,
                clearCaptures,
                setAddedCallback,
            }}
        >
            {props.children}
        </CaptrueContext.Provider>
    );
};

export default CaptrueContextProvider;
