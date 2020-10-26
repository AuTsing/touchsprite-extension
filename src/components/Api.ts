import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import { IProjectFile } from './Project';
import { IDevice } from './Server';

axios.defaults.timeout = 3000;

class Api {
    public getDeviceId(device: IDevice) {
        return axios.get(`/deviceid`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
            },
        });
    }
    public getAuth(device: IDevice, key: string) {
        const postData = JSON.stringify({
            action: 'getAuth',
            key: key,
            devices: [device.id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        return axios.post(`/api/openapi`, postData, {
            baseURL: `http://openapi.touchsprite.com`,
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        });
    }
    public getDeviceName(device: IDevice) {
        return axios.get(`/devicename`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public getSnapshot(device: IDevice) {
        const selected: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotOrient');
        let orient: number;
        switch (selected) {
            case 'home键在下':
                orient = 0;
                break;
            case 'home键在右':
                orient = 1;
                break;
            case 'home键在左':
                orient = 2;
                break;
            default:
                orient = 1;
                break;
        }
        return axios.get(`/snapshot`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
            params: {
                ext: 'png',
                orient: orient,
            },
            responseType: 'arraybuffer',
        });
    }
    public setLogServer(device: IDevice, logIp: string) {
        return axios.get(`/logServer`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
                port: 14088,
                server: logIp,
            },
        });
    }
    public setLuaPath(device: IDevice, filename: string) {
        let filepath: string;
        if (device.osType === 'iOS') {
            filepath = '/var/mobile/Media/TouchSprite/lua/';
        } else if (device.osType === 'Android') {
            filepath = '/storage/emulated/0/TouchSprite/lua/';
        } else {
            filepath = '/sdcard/TouchSprite/lua/';
        }
        const fileurl = filepath + filename;
        const postData = JSON.stringify({ path: fileurl });
        return axios.post(`/setLuaPath`, postData, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                auth: device.auth,
            },
        });
    }
    public runLua(device: IDevice) {
        return axios.get(`/runLua`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public stopLua(device: IDevice) {
        return axios.get(`/stopLua`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public upload(device: IDevice, pjf: IProjectFile) {
        const postData = fs.readFileSync(pjf.url);
        return axios.post('/upload', postData, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Type': 'touchsprite/uploadfile',
                'Content-Length': Buffer.byteLength(postData),
                auth: device.auth,
                root: pjf.root,
                path: encodeURIComponent(pjf.path),
                filename: encodeURIComponent(pjf.filename),
            },
        });
    }
}

export default Api;
