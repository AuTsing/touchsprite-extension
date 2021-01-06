import * as React from 'react';
import { createContext, useState, useCallback } from 'react';
import Jimp from 'jimp';

export interface ICoordinateContext {
    x: number;
    y: number;
    c: string;
    preview: string;
    updateCoordinate: (x: number, y: number, activeJimp: Jimp | undefined) => void;
    resetCoordinate: () => void;
}

export const CoordinateContextDefaultValue: ICoordinateContext = {
    x: -1,
    y: -1,
    c: '',
    preview: '',
    updateCoordinate: () => null,
    resetCoordinate: () => null,
};

export const CoordinateContext = createContext<ICoordinateContext>(CoordinateContextDefaultValue);

const CoordinateContextProvider = (props: { children: React.ReactNode }) => {
    const [x, setX] = useState<number>(-1);
    const [y, setY] = useState<number>(-1);
    const [c, setC] = useState<string>('0x000000');
    const [preview, setPreview] = useState<string>('');

    const resetCoordinate = useCallback(() => {
        setX(-1);
        setY(-1);
        setC('0x000000');
        setPreview('');
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
            setC(`0x` + `000000${activeJimp.getPixelColor(x0, y0).toString(16).slice(0, -2)}`.slice(-6));
            new Jimp(21, 21, 0, (_, previewJimp) => {
                for (let i = -10; i <= 10; ++i) {
                    for (let j = -10; j <= 10; ++j) {
                        const xx = i + x0;
                        const yy = j + y0;
                        if (xx >= 0 && xx < activeJimp.bitmap.width && yy >= 0 && yy < activeJimp.bitmap.height) {
                            previewJimp.setPixelColor(activeJimp.getPixelColor(xx, yy), i + 10, j + 10);
                        }
                    }
                }
                previewJimp.resize(300, 300, Jimp.RESIZE_NEAREST_NEIGHBOR).getBase64(Jimp.MIME_PNG, (_, base64) => {
                    setPreview(base64);
                });
            });
        },
        [resetCoordinate]
    );

    return <CoordinateContext.Provider value={{ x, y, c, preview, updateCoordinate, resetCoordinate }}>{props.children}</CoordinateContext.Provider>;
};

export default CoordinateContextProvider;
