import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import Device from './Device';
import { ProjectFile } from './Project';

class TsMessager {
    public static getDeviceId(device: Device) {
        return axios.get(`/deviceid`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
            },
        });
    }
    public static getAuth(device: Device, key: string) {
        let postData = JSON.stringify({
            action: 'getAuth',
            key: key,
            devices: [device.id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        return axios.post('/api/openapi', postData, {
            baseURL: 'http://openapi.touchsprite.com',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        });
    }
    public static getDeviceName(device: Device) {
        return axios.get(`/devicename`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public static getPicture(device: Device) {
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
    public static setLogServer(device: Device, logIp: string) {
        return axios.get(`/logServer`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                auth: device.auth,
                port: 14088,
                server: logIp,
            },
        });
    }
    public static setLuaPath(device: Device, filename: string) {
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
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                auth: device.auth,
            },
        });
    }
    public static runLua(device: Device) {
        return axios.get(`/runLua`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public static stopLua(device: Device) {
        return axios.get(`/stopLua`, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: device.auth,
            },
        });
    }
    public static upload(device: Device, projectfile: ProjectFile) {
        console.log(`准备上传文件：${projectfile.uploadUrl}`);
        const postData = fs.readFileSync(projectfile.uploadUrl);
        return axios.post('/upload', postData, {
            baseURL: `http://${device.ip}:50005`,
            headers: {
                'Content-Type': 'touchsprite/uploadfile',
                'Content-Length': Buffer.byteLength(postData),
                Connection: 'close',
                auth: device.auth,
                root: projectfile.uploadRoot,
                path: projectfile.uploadPath,
                filename: projectfile.uploadFileName,
            },
        });
    }
}

export default TsMessager;
