import * as Fs from 'fs';
import * as Path from 'path';
import { AxiosInstance } from 'axios';

export enum TsApiNormalResponseData {
    ok = 'ok',
    fail = 'fail',
}

export enum TsApiStatusResponseData {
    free = 'f00',
    running = 'f01',
}

export enum TsFileRoot {
    lua = 'lua',
    res = 'res',
}

export interface TsFile {
    url: string;
    root: TsFileRoot;
    path: string;
    filename: string;
}

export interface TsApiFileListResponseData {
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

    public async logServer(server: string, port: number = 14088): Promise<void> {
        const resp = await this.axios.get<TsApiNormalResponseData>('/logServer', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
                server,
                port,
            },
        });

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error('设置日志服务器失败');
        }
    }

    public async upload(file: TsFile): Promise<void> {
        const postData = Fs.readFileSync(file.url);
        const postDataLength = Buffer.byteLength(postData);
        const root = encodeURIComponent(file.root);
        const path = encodeURIComponent(file.path);
        const filename = encodeURIComponent(file.filename);

        const resp = await this.axios.post<TsApiNormalResponseData>('/upload', postData, {
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

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error(`上传文件 ${file.url} 失败`);
        }
    }

    public async status(): Promise<TsApiStatusResponseData> {
        const resp = await this.axios.get<TsApiStatusResponseData>('/status', {
            headers: { Connection: 'close', 'Content-Length': 0, auth: this.auth },
        });

        return resp.data;
    }

    public async getFileList(path: string, root: TsFileRoot = TsFileRoot.lua): Promise<TsApiFileListResponseData> {
        const resp = await this.axios.get<TsApiFileListResponseData>('/getFileList', {
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

    public async rmFile(filename: string, root: TsFileRoot = TsFileRoot.lua): Promise<void> {
        const file = encodeURIComponent(filename);

        const resp = await this.axios.get<TsApiNormalResponseData>('/rmFile', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
                path: '/',
                root,
                file,
            },
        });

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error(`删除文件 ${filename} 失败`);
        }
    }

    public async setLuaPath(filename: string): Promise<void> {
        const path = Path.join(this.userPath, 'lua', filename).replace(/\\/g, '/');
        const postData = JSON.stringify({ path });
        const postDataLength = Buffer.byteLength(postData);

        const resp = await this.axios.post<TsApiNormalResponseData>('/setLuaPath', postData, {
            headers: {
                Connection: 'close',
                'Content-Type': 'application/json',
                'Content-Length': postDataLength,
                auth: this.auth,
            },
        });

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error('设置引导文件失败');
        }
    }

    public async runLua(): Promise<void> {
        const resp = await this.axios.get<TsApiNormalResponseData>('/runLua', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
            },
        });

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error('运行引导文件失败');
        }
    }

    public async stopLua(): Promise<void> {
        const resp = await this.axios.get<TsApiNormalResponseData>('/stopLua', {
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: this.auth,
            },
        });

        if (resp.data !== TsApiNormalResponseData.ok) {
            throw new Error('停止脚本失败');
        }
    }
}
