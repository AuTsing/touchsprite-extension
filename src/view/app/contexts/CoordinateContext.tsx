import * as React from 'react';
import { createContext, useState, useCallback } from 'react';
import Jimp from 'jimp/es';

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

const defaultPreview =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2BgYGAAAAAFAAGKM+MAAAAAAElFTkSuQmCC';

const CoordinateContextProvider = (props: { children: React.ReactNode }) => {
    const [x, setX] = useState<number>(-1);
    const [y, setY] = useState<number>(-1);
    const [c, setC] = useState<string>('0x000000');
    const [preview, setPreview] = useState<string>(defaultPreview);

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
            const c0 = activeJimp.getPixelColor(x0, y0)
            setC(`0x` + `000000${c0.toString(16).slice(0, -2)}`.slice(-6));
            // 把图像大小改为21*14=294
            new Jimp(294, 294, 0, (_, previewJimp) => {
                for (let i = -10; i <= 10; ++i) {
                    for (let j = -10; j <= 10; ++j) {
                        const xx = i + x0;
                        const yy = j + y0;
                        if (xx >= 0 && xx < activeJimp.bitmap.width && yy >= 0 && yy < activeJimp.bitmap.height) {
                            // 记录原图的点的颜色
                            const cc = activeJimp.getPixelColor(xx, yy)
                            // 每个放大的像素块为14*14的大小,遍历画图
                            for (let ii = 0; ii <= 13; ++ii) {
                                const x1 = (i + 10) * 14 + ii
                                for (let jj = 0; jj <= 13; ++jj) {
                                    const y1 = (j + 10) * 14 + jj
                                    // 预留边框2个像素点,不是边框的填充原色
                                    if (ii > 1 && ii < 12 && jj > 1 && jj < 12) {
                                        previewJimp.setPixelColor(cc, x1, y1);
                                    }else{
                                        // 颜色如果和中心点一样,则画边框,边框2层,外层红色,内层白色
                                        if (c0 == cc) {
                                            if (ii == 0 || ii == 13 || jj == 0 || jj == 13) {
                                                previewJimp.setPixelColor(0xFF0000FF, x1, y1);
                                            }else{
                                                previewJimp.setPixelColor(0xFFFFFFFF, x1, y1);
                                            }
                                        }else{
                                            previewJimp.setPixelColor(cc, x1, y1);
                                        }
                                    }
                                }
                            }
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
