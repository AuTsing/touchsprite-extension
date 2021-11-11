import * as React from 'react';
import { createContext, useState, useCallback } from 'react';
import Jimp from 'jimp/es';

export interface ICoordinateContext {
    x: number;
    y: number;
    c: string;
    preview: string;
    previewCover: string;
    updateCoordinate: (x: number, y: number, activeJimp: Jimp | undefined) => void;
    resetCoordinate: () => void;
}

export const CoordinateContextDefaultValue: ICoordinateContext = {
    x: -1,
    y: -1,
    c: '',
    preview: '',
    previewCover: '',
    updateCoordinate: () => null,
    resetCoordinate: () => null,
};

export const CoordinateContext = createContext<ICoordinateContext>(CoordinateContextDefaultValue);

const defaultPreview =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2BgYGAAAAAFAAGKM+MAAAAAAElFTkSuQmCC';
const zoomRadius = 10;
const zoomSideLength = zoomRadius * 2 + 1;
const zoomDisplayRatio = 14;
const zoomSideLengthDisplay = zoomSideLength * zoomDisplayRatio;

const CoordinateContextProvider = (props: { children: React.ReactNode }) => {
    const [x, setX] = useState<number>(-1);
    const [y, setY] = useState<number>(-1);
    const [c, setC] = useState<string>('0x000000');
    const [preview, setPreview] = useState<string>(defaultPreview);
    const [previewCover, setPreviewCover] = useState<string>(defaultPreview);

    const resetCoordinate = useCallback(() => {
        setX(-1);
        setY(-1);
        setC('0x000000');
        setPreview(defaultPreview);
    }, []);

    const updateCoordinate = useCallback(
        (x0: number, y0: number, activeJimp: Jimp | undefined) => {
            if (!activeJimp) {
                return;
            }
            if (x0 < 0 || y0 < 0 || x0 > activeJimp.bitmap.width || y0 > activeJimp.bitmap.height) {
                resetCoordinate();
                return;
            }
            setX(x0);
            setY(y0);
            const c0 = activeJimp.getPixelColor(x0, y0);
            setC(`0x` + `000000${c0.toString(16).slice(0, -2)}`.slice(-6));

            new Jimp(zoomSideLength, zoomSideLength, 0, (_, previewJimp) => {
                for (let i = -zoomRadius; i <= zoomRadius; ++i) {
                    for (let j = -zoomRadius; j <= zoomRadius; ++j) {
                        const xx = i + x0;
                        const yy = j + y0;
                        if (xx >= 0 && xx < activeJimp.bitmap.width && yy >= 0 && yy < activeJimp.bitmap.height) {
                            previewJimp.setPixelColor(activeJimp.getPixelColor(xx, yy), i + 10, j + 10);
                        }
                    }
                }
                previewJimp.resize(zoomSideLengthDisplay, zoomSideLengthDisplay, Jimp.RESIZE_NEAREST_NEIGHBOR).getBase64(Jimp.MIME_PNG, (_, base64) => {
                    setPreview(base64);
                });
            });

            new Jimp(zoomSideLengthDisplay, zoomSideLengthDisplay, 0, (_, previewJimp) => {
                for (let i = -zoomRadius; i <= zoomRadius; ++i) {
                    for (let j = -zoomRadius; j <= zoomRadius; ++j) {
                        const xx = i + x0;
                        const yy = j + y0;
                        if (xx >= 0 && xx < activeJimp.bitmap.width && yy >= 0 && yy < activeJimp.bitmap.height) {
                            const cc = activeJimp.getPixelColor(xx, yy);
                            if (cc === c0) {
                                for (let i2 = 1; i2 <= zoomDisplayRatio; ++i2) {
                                    for (let j2 = 1; j2 <= zoomDisplayRatio; ++j2) {
                                        if (i2 === 1 || i2 === zoomDisplayRatio || j2 === 1 || j2 === zoomDisplayRatio) {
                                            previewJimp.setPixelColor(
                                                0xff0000ff,
                                                (i + zoomRadius) * zoomDisplayRatio + i2,
                                                (j + zoomRadius) * zoomDisplayRatio + j2
                                            );
                                        } else if (i2 === 2 || i2 === zoomDisplayRatio - 1 || j2 === 2 || j2 === zoomDisplayRatio - 1) {
                                            previewJimp.setPixelColor(
                                                0xffffffff,
                                                (i + zoomRadius) * zoomDisplayRatio + i2,
                                                (j + zoomRadius) * zoomDisplayRatio + j2
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                previewJimp.getBase64(Jimp.MIME_PNG, (_, base64) => {
                    setPreviewCover(base64);
                });
            });
        },
        [resetCoordinate]
    );

    return (
        <CoordinateContext.Provider value={{ x, y, c, preview, previewCover, updateCoordinate, resetCoordinate }}>{props.children}</CoordinateContext.Provider>
    );
};

export default CoordinateContextProvider;
