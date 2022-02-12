import * as Vscode from 'vscode';
import * as Os from 'os';
import Axios from 'axios';
import Device from './Device';
import * as Ui from './Ui';
import DeviceSearcher from './DeviceSearcher';

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
    private hostIp?: string;
    private readonly output: Ui.Output;
    private readonly statusBar: Ui.StatusBar;

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
        const postDataLength = Buffer.byteLength(postData);
        const resp = await Axios.post<ITsOpenApiResponseData>(`/api/openapi`, postData, {
            baseURL: 'http://openapi.touchsprite.com',
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postDataLength,
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

    public getHostIp(): string {
        if (!this.hostIp) {
            const interfaces = Os.networkInterfaces();
            for (const interfaceKey in interfaces) {
                if (interfaceKey.toLocaleLowerCase().indexOf('vmware') >= 0) {
                    continue;
                }
                if (interfaceKey.toLocaleLowerCase().indexOf('virtualbox') >= 0) {
                    continue;
                }
                for (const alias of interfaces[interfaceKey]!) {
                    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                        this.hostIp = alias.address;
                        break;
                    }
                }
            }
        }

        if (!this.hostIp) {
            throw Error('无法获取本机IP');
        }

        return this.hostIp;
    }

    private async attachDevice(ip: string): Promise<Device> {
        const accessKey = await this.getAccessKey();
        const axios = Axios.create({ baseURL: `http://${ip}:50005`, timeout: 10000 });
        const id = (await axios.get<string>('/deviceid', { headers: { Connection: 'close', 'Content-Length': 0 } })).data;
        const auth = await this.getAuth(accessKey, id);
        const name = (await axios.get<string>('/devicename', { headers: { Connection: 'close', 'Content-Length': 0, auth } })).data;

        let platform!: 'ios' | 'android';
        if (id.length === 32) {
            platform = 'ios';
        }
        if (id.length === 33) {
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

    public async attachDeviceBySearch() {
        let doing: Ui.StatusBarItem | undefined;
        const deviceSearcher = new DeviceSearcher(this);
        try {
            const device = await deviceSearcher.search();
            doing = this.statusBar.doing('连接中');
            await this.attachDevice(device.ip);
            console.log(this.usingDevice);
            
            this.statusBar.attach(device.ip);
        } catch (e) {
            this.output.error('连接设备失败: ' + (e as Error).message);
        }
        if (doing) {
            doing.dispose();
        }
    }
}
