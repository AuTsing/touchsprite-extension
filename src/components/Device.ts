import * as Fs from 'fs';
import * as Path from 'path';

import { AxiosInstance } from 'axios';

export enum ETsApiNormalResponseData {
    ok = 'ok',
    fail = 'fail',
}

export enum ETsApiStatusResponseData {
    free = 'f00',
    running = 'f01',
}

export enum ETsFileRoot {
    lua = 'lua',
    res = 'res',
}

export interface ITsFile {
    url: string;
    root: ETsFileRoot;
    path: string;
    filename: string;
}

export interface ITsApiFileListResponseData {
    ret: boolean;
    Dirs?: string[];
    Files?: string[];
}

export default class Device {
    private readonly auth: string;
    private readonly axios: AxiosInstance;

    public readonly ip: string;
    public readonly id: string;
    public readonly name: string;
    public readonly platform: string;
    public readonly userPath: string;

    constructor(ip: string, id: string, auth: string, name: string, platform: string, userPath: string, axios: AxiosInstance) {
        this.ip = ip;
        this.id = id;
        this.auth = auth;
        this.name = name;
        this.platform = platform;
        this.userPath = userPath;
        this.axios = axios;
    }

    public async snapshot(orient: number = 1): Promise<ArrayBuffer> {
        const resp = await this.axios.get<ArrayBuffer>('/snapshot', {
            headers: { Connection: 'close', 'Content-Length': 0, auth: this.auth },
            params: { ext: 'png', orient },
            responseType: 'arraybuffer',
        });

        return resp.data;
    }

    public async logServer(server: string, port: number = 14088): Promise<boolean> {
        const resp = await this.axios.get<ETsApiNormalResponseData>('/logServer', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
                server,
                port,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }

    public async upload(file: ITsFile): Promise<boolean> {
        const postData = Fs.readFileSync(file.url);
        const postDataLength = Buffer.byteLength(postData);
        const root = encodeURIComponent(file.root);
        const path = encodeURIComponent(file.path);
        const filename = encodeURIComponent(file.filename);

        const resp = await this.axios.post<ETsApiNormalResponseData>('/upload', postData, {
            headers: {
                Connection: 'close',
                'Content-Type': 'touchsprite/uploadfile',
                'Content-Length': postDataLength,
                auth: this.auth,
                root,
                path,
                filename,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }

    public async status(): Promise<ETsApiStatusResponseData> {
        const resp = await this.axios.get<ETsApiStatusResponseData>('/status', {
            headers: { Connection: 'close', 'Content-Length': 0, auth: this.auth },
        });

        return resp.data;
    }

    public async getFileList(path: string, root: ETsFileRoot = ETsFileRoot.lua): Promise<ITsApiFileListResponseData> {
        const resp = await this.axios.get<ITsApiFileListResponseData>('/getFileList', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
                path,
                root,
            },
        });

        return resp.data;
    }

    public async rmFile(filename: string, root: ETsFileRoot = ETsFileRoot.lua): Promise<boolean> {
        const file = encodeURIComponent(filename);

        const resp = await this.axios.get<ETsApiNormalResponseData>('/rmFile', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
                path: '/',
                root,
                file,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }

    public async setLuaPath(filename: string): Promise<boolean> {
        const path = Path.join(this.userPath, 'lua', filename).replace(/\\/g, '/');
        const postData = JSON.stringify({ path });
        const postDataLength = Buffer.byteLength(postData);

        const resp = await this.axios.post<ETsApiNormalResponseData>('/setLuaPath', postData, {
            headers: {
                Connection: 'close',
                'Content-Type': 'application/json',
                'Content-Length': postDataLength,
                auth: this.auth,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }

    public async runLua(): Promise<boolean> {
        const resp = await this.axios.get<ETsApiNormalResponseData>('/runLua', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }

    public async stopLua(): Promise<boolean> {
        const resp = await this.axios.get<ETsApiNormalResponseData>('/stopLua', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
            },
        });

        if (resp.data === ETsApiNormalResponseData.ok) {
            return true;
        } else {
            return false;
        }
    }
}
