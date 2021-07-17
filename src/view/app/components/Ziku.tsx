import * as React from 'react';
import { FC, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import { Button, Modal, Input, InputNumber, Divider, Tag, Table, Row, Col, message, Space, Select } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import Jimp from 'jimp/es';

import { VscodeContext } from '../contexts/VscodeContext';
import { RecordContext } from '../contexts/RecordContext';
import { CaptrueContext } from '../contexts/CaptureContext';

const { Column } = Table;

function hexToRgb(hex: string) {
    const result = /^(0x)?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[2], 16),
              g: parseInt(result[3], 16),
              b: parseInt(result[4], 16),
          }
        : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number) {
    return `00${r.toString(16)}`.slice(-2).toUpperCase() + `00${g.toString(16)}`.slice(-2).toUpperCase() + `00${b.toString(16)}`.slice(-2).toUpperCase();
}

interface ICodeItem {
    key: number;
    code: string;
    words: string;
}

const Ziku: FC = () => {
    const vscode = useContext(VscodeContext);
    const { records, p1, p2 } = useContext(RecordContext);
    const { activeJimp } = useContext(CaptrueContext);

    const [visible, setVisible] = useState<boolean>(false);
    const [tolerance, setTolerance] = useState<number>(0);
    const [previewJimp, setPreviewJimp] = useState<Jimp | undefined>(undefined);
    const [preview, setPreview] = useState<string>('');
    const [toDefineWords, setToDefineWords] = useState<string>('');
    const [codeIndex, setCodeIndex] = useState<number>(0);
    const [codes, setCodes] = useState<ICodeItem[]>([]);
    const [castMode, setCastMode] = useState<'自动生成' | '自定义'>('自动生成');
    const [customCast, setCustomCast] = useState<string>('');

    const castRgb = useMemo(() => {
        const rgbList = records
            .map(record => hexToRgb(record.color))
            .reduce<{ r: number[]; g: number[]; b: number[] }>(
                (lastRgb, rgb) => {
                    lastRgb.r.push(rgb.r);
                    lastRgb.g.push(rgb.g);
                    lastRgb.b.push(rgb.b);
                    return lastRgb;
                },
                { r: [], g: [], b: [] }
            );
        const range = {
            r: [Math.min(...rgbList.r), Math.max(...rgbList.r)],
            g: [Math.min(...rgbList.g), Math.max(...rgbList.g)],
            b: [Math.min(...rgbList.b), Math.max(...rgbList.b)],
        };
        const castRgb = {
            r: [Math.floor((range.r[0] + range.r[1]) / 2 + tolerance), (Math.ceil((range.r[1] - range.r[0]) / 2) || 1) + tolerance],
            g: [Math.floor((range.g[0] + range.g[1]) / 2 + tolerance), (Math.ceil((range.g[1] - range.g[0]) / 2) || 1) + tolerance],
            b: [Math.floor((range.b[0] + range.b[1]) / 2 + tolerance), (Math.ceil((range.b[1] - range.b[0]) / 2) || 1) + tolerance],
        };
        return castRgb;
    }, [records, tolerance]);

    const cast = useMemo(
        () => (records.length > 0 ? `${rgbToHex(castRgb.r[0], castRgb.g[0], castRgb.b[0])} , ${rgbToHex(castRgb.r[1], castRgb.g[1], castRgb.b[1])}` : ''),
        [castRgb.b, castRgb.g, castRgb.r, records.length]
    );

    const customCastRgb = useMemo(() => {
        if (!customCast) {
            return { r: [], g: [], b: [] };
        }
        const rgb1 = hexToRgb(customCast.slice(0, 6));
        const rgb2 = hexToRgb(customCast.slice(-6));
        const castRgb = {
            r: [rgb1.r, rgb2.r],
            g: [rgb1.g, rgb2.g],
            b: [rgb1.b, rgb2.b],
        };
        return castRgb;
    }, [customCast]);

    const range = useMemo(() => `${p1.x}, ${p1.y}, ${p2.x}, ${p2.y}`, [p1.x, p1.y, p2.x, p2.y]);

    const addCode = useCallback(() => {
        if (!previewJimp) {
            return;
        }
        const zikuBinary: number[] = [];
        const zikuWords: string[] = [];
        const range = { x1: previewJimp.bitmap.width, y1: previewJimp.bitmap.height, x2: 0, y2: 0 };
        previewJimp.scan(
            0,
            0,
            previewJimp.bitmap.width,
            previewJimp.bitmap.height,
            (x, y) => {
                const color = previewJimp.getPixelColor(x, y);
                if (color === 0x000000ff && x < range.x1) {
                    range.x1 = x;
                }
                if (color === 0x000000ff && y < range.y1) {
                    range.y1 = y;
                }
                if (color === 0x000000ff && x > range.x2) {
                    range.x2 = x;
                }
                if (color === 0x000000ff && y > range.y2) {
                    range.y2 = y;
                }
            },
            (_, jimp) => {
                jimp.crop(range.x1, range.y1, Math.abs(range.x2 - range.x1 + 1), Math.abs(range.y2 - range.y1 + 1), (_, cropedJimp) => {
                    for (let x = 0; x < cropedJimp.bitmap.width; x++) {
                        for (let y = 0; y < cropedJimp.bitmap.height; y++) {
                            if (cropedJimp.getPixelColor(x, y) === 0x000000ff) {
                                zikuBinary.push(1);
                            } else {
                                zikuBinary.push(0);
                            }
                        }
                    }
                    zikuBinary.reduce((pre, cur, idx, arr) => {
                        const word = pre + cur;
                        if (idx % 4 === 3) {
                            zikuWords.push(word);
                            return '';
                        } else if (idx === arr.length - 1) {
                            zikuWords.push(word);
                            return '';
                        } else {
                            return word;
                        }
                    }, '');
                    const zikuCodes = zikuWords.map(word => {
                        if (word.length === 4) {
                            return parseInt(word, 2).toString(16);
                        } else {
                            return '@' + word;
                        }
                    });
                    zikuCodes.push('$' + toDefineWords);
                    zikuCodes.push('$' + zikuBinary.filter(b => b === 1).length);
                    zikuCodes.push('$' + previewJimp.bitmap.height);
                    zikuCodes.push('$' + previewJimp.bitmap.width);
                    const zikuCode = zikuCodes.join('');
                    const code: ICodeItem = {
                        key: codeIndex,
                        code: zikuCode,
                        words: toDefineWords,
                    };
                    setCodeIndex(codeIndex + 1);
                    setCodes([code, ...codes]);
                    setToDefineWords('');
                });
            }
        );
    }, [codeIndex, codes, previewJimp, toDefineWords]);

    const copyInfo = useCallback(
        (code: string) => {
            vscode.postMessage({ command: 'copy', data: code });
            message.info(`${code.slice(0, 30)}${code.length > 30 ? '...' : ''} 已复制到剪贴板`);
        },
        [vscode]
    );

    const deleteCode = useCallback(
        (index: number) => {
            setCodes(codes.filter(code => code.key !== index));
        },
        [codes]
    );

    const copyCode = useCallback(
        (code: ICodeItem) => {
            copyInfo(`'${code.code}',`);
        },
        [copyInfo]
    );

    const generateZiku = useCallback(() => {
        const code = '{\n' + codes.map(code => `'${code.code}'`).join(',\n') + '\n}';
        copyInfo(code);
    }, [codes, copyInfo]);

    const copyCast = useCallback(() => {
        copyInfo(`'${cast}'`);
    }, [cast, copyInfo]);

    const copyRange = useCallback(() => {
        copyInfo(range);
    }, [copyInfo, range]);

    const handleInputNumberChange = useCallback((value: string | number | undefined) => {
        if (typeof value === 'string') {
            setTolerance(parseInt(value));
        } else if (typeof value === 'number') {
            setTolerance(value);
        } else {
            setTolerance(0);
        }
    }, []);

    const handleBlurCustomCast = useCallback(() => {
        const result = /^([a-f\d]{6})\s*\,\s*([a-f\d]{6})$/i.test(customCast);
        if (!result) {
            setCustomCast('');
        }
    }, [customCast]);

    useEffect(() => {
        if (!visible || p1.x === -1 || p1.y === -1 || p2.x === -1 || p2.y === -1 || !activeJimp || (records.length === 0 && customCast === '')) {
            setPreview('');
            setPreviewJimp(undefined);
            return;
        }
        const whichCastRgb = castMode === '自定义' && customCast !== '' ? customCastRgb : castRgb;
        const castRgbCalc = {
            r: [whichCastRgb.r[0] - whichCastRgb.r[1], whichCastRgb.r[0] + whichCastRgb.r[1]],
            g: [whichCastRgb.g[0] - whichCastRgb.g[1], whichCastRgb.g[0] + whichCastRgb.g[1]],
            b: [whichCastRgb.b[0] - whichCastRgb.b[1], whichCastRgb.b[0] + whichCastRgb.b[1]],
        };
        const xMin = Math.min(p1.x, p2.x);
        const yMin = Math.min(p1.y, p2.y);
        const xd = Math.abs(p2.x - p1.x);
        const yd = Math.abs(p2.y - p1.y);
        new Jimp(xd + 1, yd + 1, 0, (_, jimp) => {
            jimp.scan(0, 0, jimp.bitmap.width, jimp.bitmap.height, (x, y) => {
                const rgba = Jimp.intToRGBA(activeJimp.getPixelColor(x + xMin, y + yMin));
                if (
                    castRgbCalc.r[0] <= rgba.r &&
                    castRgbCalc.r[1] >= rgba.r &&
                    castRgbCalc.g[0] <= rgba.g &&
                    castRgbCalc.g[1] >= rgba.g &&
                    castRgbCalc.b[0] <= rgba.b &&
                    castRgbCalc.b[1] >= rgba.b
                ) {
                    jimp.setPixelColor(0x000000ff, x, y);
                } else {
                    jimp.setPixelColor(0xffffffff, x, y);
                }
            });
            setPreviewJimp(jimp);
            jimp.getBase64(Jimp.MIME_PNG, (_, base64) => setPreview(base64));
        });
    }, [activeJimp, castMode, castRgb, customCast, customCastRgb, p1.x, p1.y, p2.x, p2.y, records.length, visible]);

    return (
        <>
            <Button type='primary' size='large' onClick={() => setVisible(true)}>
                制作字库
            </Button>
            <Modal title='制作字库' visible={visible} footer={null} onCancel={() => setVisible(false)}>
                <Divider orientation='left' plain>
                    已选择范围
                </Divider>
                <div onClick={copyRange}>{range}</div>
                <Divider orientation='left' plain>
                    已选择颜色
                </Divider>
                <div>{records.length === 0 && <Tag>未选择颜色</Tag>}</div>
                <div>
                    {records.length > 0 &&
                        records.map((record, index) => (
                            <Tag key={index} color={'#' + record.color.slice(-6)}>
                                {record.color}
                            </Tag>
                        ))}
                </div>
                <Divider orientation='left' plain>
                    容差
                </Divider>
                <InputNumber min={0} max={100} value={tolerance} onChange={handleInputNumberChange} style={{ width: '30%' }} />
                <Divider orientation='left' plain>
                    偏色
                </Divider>
                <Input.Group compact>
                    <Select value={castMode} onChange={setCastMode} style={{ width: '30%' }}>
                        <Select.Option value='自动生成'>自动生成</Select.Option>
                        <Select.Option value='自定义'>自定义</Select.Option>
                    </Select>
                    {castMode === '自动生成' && <Input onClick={copyCast} placeholder='未选择颜色' value={cast} style={{ width: '30%' }} />}
                    {castMode === '自定义' && (
                        <Input
                            placeholder={cast ? cast : '未选择颜色'}
                            value={customCast}
                            onChange={e => setCustomCast(e.target.value)}
                            onBlur={handleBlurCustomCast}
                            style={{ width: '30%' }}
                        />
                    )}
                </Input.Group>
                <Divider orientation='left' plain>
                    预览
                </Divider>
                <div>{preview === '' && '未选择颜色或范围'}</div>
                <div>{preview !== '' && <img src={preview} alt='' />}</div>
                <Divider orientation='left' plain>
                    字库
                </Divider>
                <Row>
                    <Col span={12}>
                        <Input
                            placeholder='定义文字'
                            value={toDefineWords}
                            onChange={e => setToDefineWords(e.target.value)}
                            allowClear
                            onPressEnter={addCode}
                        />
                    </Col>
                    <Col span={6}>
                        <Button style={{ width: '100%' }} disabled={!toDefineWords || !previewJimp} onClick={addCode}>
                            添加到字库
                        </Button>
                    </Col>
                    <Col span={6}>
                        <Button style={{ width: '100%' }} disabled={codes.length === 0} onClick={generateZiku}>
                            生成字库
                        </Button>
                    </Col>
                </Row>
                <Table dataSource={codes} size='small' bordered={true} pagination={false}>
                    <Column title='字库编码' dataIndex='code' width='50%' ellipsis={true} />
                    <Column title='定义文字' dataIndex='words' width='25%' ellipsis={true} />
                    <Column
                        title='操作'
                        render={(code: ICodeItem) => (
                            <Space>
                                <CopyOutlined onClick={() => copyCode(code)} />
                                <DeleteOutlined onClick={() => deleteCode(code.key)} />
                            </Space>
                        )}
                        width='25%'
                    />
                </Table>
            </Modal>
        </>
    );
};

export default Ziku;
