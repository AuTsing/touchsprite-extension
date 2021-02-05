import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import { IProjectFile } from './ProjectGenerator';

interface ITsOpenApiResponseData {
    status: number;
    message: string;
    time: number;
    auth: string;
    valid: string;
    remainder_token: number;
}

export default class Api {
    private readonly instance: AxiosInstance = axios.create({ timeout: 5000 });

    public getDeviceId(ip: string) {
        return this.instance.get<string>(`/deviceid`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
            },
        });
    }

    public getAuth(id: string, ak: string) {
        const postData = JSON.stringify({
            action: 'getAuth',
            key: ak,
            devices: [id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        return this.instance.post<ITsOpenApiResponseData>(`/api/openapi`, postData, {
            baseURL: `http://openapi.touchsprite.com`,
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        });
    }

    public getDeviceName(ip: string, auth: string) {
        return this.instance.get<string>(`/devicename`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: auth,
            },
        });
    }

    public getSnapshot(ip: string, auth: string) {
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
        return this.instance.get(`/snapshot`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: auth,
            },
            params: {
                ext: 'png',
                orient: orient,
            },
            responseType: 'arraybuffer',
        });
    }

    public setLogServer(ip: string, auth: string, server: string, port: number = 14088) {
        return this.instance.get(`/logServer`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: auth,
                port: 14088,
                server: server,
            },
        });
    }

    public setLuaPath(ip: string, auth: string, filename: string, osType: string) {
        let filepath: string;
        if (osType === 'iOS') {
            filepath = '/var/mobile/Media/TouchSprite/lua/';
        } else if (osType === 'Android') {
            filepath = '/storage/emulated/0/TouchSprite/lua/';
        } else {
            filepath = '/sdcard/TouchSprite/lua/';
        }
        const fileurl = filepath + filename;
        const postData = JSON.stringify({ path: fileurl });
        return this.instance.post(`/setLuaPath`, postData, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                auth: auth,
            },
        });
    }

    public runLua(ip: string, auth: string) {
        return this.instance.get(`/runLua`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: auth,
            },
        });
    }

    public stopLua(ip: string, auth: string) {
        return this.instance.get(`/stopLua`, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: auth,
            },
        });
    }

    public upload(ip: string, auth: string, pjf: IProjectFile) {
        const postData = fs.readFileSync(pjf.url);
        return this.instance.post('/upload', postData, {
            baseURL: `http://${ip}:50005`,
            headers: {
                Connection: 'close',
                'Content-Type': 'touchsprite/uploadfile',
                'Content-Length': Buffer.byteLength(postData),
                auth: auth,
                root: pjf.root,
                path: encodeURIComponent(pjf.path),
                filename: encodeURIComponent(pjf.filename),
            },
        });
    }
}
