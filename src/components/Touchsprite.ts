import * as Vscode from 'vscode';
import * as Path from 'path';
import * as Fs from 'fs';
import Axios from 'axios';
import Device from './Device';
import * as Ui from './Ui';

interface ITsOpenApiResponseData {
    status: number;
    message: string;
    time: number;
    auth: string;
    valid: string;
    remainder_token: number;
}

export default class Touchsprite {
    private usingDevice?: Device;
    private output: Ui.Output;
    private statusBar: Ui.StatusBar;

    constructor() {
        this.output = Ui.useOutput();
        this.statusBar = Ui.useStatusBar();
    }

    private async getAuth(accessKey: string, id: string): Promise<string> {
        const postData = JSON.stringify({
            action: 'getAuth',
            key: accessKey,
            devices: [id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        const resp = await Axios.post<ITsOpenApiResponseData>(`/api/openapi`, postData, {
            baseURL: 'http://openapi.touchsprite.com',
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        });
        if (!resp.data.auth) {
            throw Error('获取授权失败');
        }

        return resp.data.auth;
    }

    private async getAccessKey(): Promise<string> {
        let accessKey = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('accessKey') ?? '';
        if (accessKey === '') {
            accessKey = (await Vscode.window.showInputBox({ prompt: '请输入开发者AccessKey', value: '' })) ?? '';
            Vscode.workspace.getConfiguration('touchsprite-extension').update('accessKey', accessKey, true);
        }
        if (accessKey === '') {
            throw new Error('开发者AccessKey不正确');
        }
        return accessKey;
    }

    private async attachDevice(ip: string): Promise<Device> {
        const accessKey = await this.getAccessKey();
        const axios = Axios.create({ baseURL: `http://${ip}:50005`, timeout: 10000 });
        const id = (await axios.get<string>('/deviceid', { headers: { Connection: 'close', 'Content-Length': 0 } })).data;
        const auth = await this.getAuth(accessKey, id);
        const name = (await axios.get<string>('/devicename', { headers: { Connection: 'close', 'Content-Length': 0, auth } })).data;

        const selectedPlatform = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('platform') ?? '自动';
        let platform!: string;
        if (selectedPlatform === '自动') {
            if (name === 'iPhone') {
                platform = 'ios';
            } else {
                platform = 'android';
            }
        }
        if (selectedPlatform === '苹果') {
            platform = 'ios';
        }
        if (selectedPlatform === '安卓') {
            platform = 'android';
        }

        let userPath!: string;
        if (platform === 'ios') {
            userPath = '/var/mobile/Media/TouchSprite/';
        }
        if (platform === 'android') {
            userPath = '/sdcard/TouchSprite/';
        }

        const device = new Device(ip, id, auth, name, platform, userPath, axios);
        this.usingDevice = device;

        return device;
    }

    public async attachDeviceByInput(): Promise<void> {
        const doing = this.statusBar.doing('连接中');
        try {
            const ip = (await Vscode.window.showInputBox({ prompt: '请输入设备IP地址', value: '192.168.', placeHolder: 'x.x.x.x' })) ?? '';
            if (!/^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(ip)) {
                throw new Error('IP格式不正确');
            }
            await this.attachDevice(ip);
            this.statusBar.attach(ip);
        } catch (e) {
            this.output.error('连接设备失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async attachDeviceBySearch() {}
}
