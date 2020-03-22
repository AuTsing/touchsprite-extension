import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import { ProjectFile } from './Project';
import { Device } from './Device';

class MyHttpClient {
    protected constructor() {}
    public static MyHttpPost(options: http.RequestOptions, postData: any): Promise<string> {
        return new Promise((resolve, reject) => {
            let req = http
                .request(options, res => {
                    if (res.statusCode != 200) {
                        res.resume();
                        reject('请求失败\n' + `状态码: ${res.statusCode}`);
                    } else {
                        res.setEncoding('utf8');
                        let rawData = '';
                        res.on('data', chunk => {
                            rawData += chunk;
                        });
                        res.on('end', () => {
                            resolve(rawData);
                        });
                    }
                })
                .on('error', e => {
                    reject(e.message);
                });
            req.write(postData);
            req.end();
        });
    }
    public static MyHttpGet(options: http.RequestOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            let req = http
                .request(options, res => {
                    if (res.statusCode != 200) {
                        res.resume();
                        reject('请求失败\n' + `状态码: ${res.statusCode}`);
                    } else {
                        res.setEncoding('utf8');
                        let rawData = '';
                        res.on('data', chunk => {
                            rawData += chunk;
                        });
                        res.on('end', () => {
                            resolve(rawData);
                        });
                    }
                })
                .on('error', e => {
                    reject(e.message);
                });
            req.end();
        });
    }
}

export class TsRequset extends MyHttpClient {
    public static GetAuth(dev: Device, key: string): Promise<string> {
        let postData = JSON.stringify({
            action: 'getAuth',
            key: key,
            devices: [dev.deviceId],
            valid: 3600,
            time: Math.floor(Date.now() / 1000)
        });
        let options = {
            hostname: 'openapi.touchsprite.com',
            port: 80,
            path: '/api/openapi',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        return this.MyHttpPost(options, postData);
    }
    public static GetDeviceId(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/deviceid',
            method: 'GET',
            headers: {
                Connection: 'close',
                'Content-Length': 0
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetDeviceName(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/devicename',
            method: 'GET',
            headers: {
                Connection: 'close',
                'Content-Length': 0,
                auth: dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetStatus(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/status',
            method: 'GET',
            headers: {
                auth: dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetPicture(dev: Device): Promise<string> {
        let ori: number | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
        if (ori == 0 || ori == 1) {
            ori = ori;
        } else {
            ori = 0;
        }
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/snapshot',
            method: 'GET',
            ext: 'png',
            orient: ori,
            headers: {
                auth: dev.auth
            }
        };
        return new Promise((resolve, reject) => {
            let req = http
                .request(options, res => {
                    if (res.statusCode != 200) {
                        res.resume();
                        reject('请求失败\n' + `状态码: ${res.statusCode}`);
                    } else {
                        res.setEncoding('binary');
                        let rawData = '';
                        res.on('data', chunk => {
                            rawData += chunk;
                        });
                        res.on('end', () => {
                            resolve(rawData);
                        });
                    }
                })
                .on('error', e => {
                    reject(e.message);
                });
            req.end();
        });
    }
    public static LogServer(dev: Device, logIp: string): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/logServer',
            method: 'GET',
            headers: {
                auth: dev.auth,
                port: 14088,
                server: logIp
            }
        };
        return this.MyHttpGet(options);
    }
    public static SetLuaPath(dev: Device): Promise<string> {
        let luaPath: string;
        if (dev.osType == 'iOS') {
            luaPath = '/var/mobile/Media/TouchSprite/lua/main.lua';
        } else if (dev.osType == 'Android') {
            luaPath = '/storage/emulated/0/TouchSprite/lua/main.lua';
        } else {
            luaPath = '/sdcard/TouchSprite/lua/main.lua';
        }
        let postData = JSON.stringify({
            path: luaPath
        });
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/setLuaPath',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                auth: dev.auth
            }
        };
        return this.MyHttpPost(options, postData);
    }
    public static RunLua(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/runLua',
            method: 'GET',
            headers: {
                auth: dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static StopLua(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/stopLua',
            method: 'GET',
            headers: {
                auth: dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static async Upload(dev: Device, pjf: ProjectFile): Promise<any> {
        try {
            console.log(`准备上传：${pjf.uploadUrl} || ${pjf.uploadPath} || ${pjf.uploadFileName}`);
            let postData: Buffer = await new Promise((resolve, reject) => {
                fs.readFile(pjf.uploadUrl, (err: any, data: Buffer | PromiseLike<Buffer> | undefined) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
            let options = {
                hostname: dev.ip,
                port: 50005,
                path: '/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'touchsprite/uploadfile',
                    'Content-Length': Buffer.byteLength(postData),
                    auth: dev.auth,
                    root: 'lua',
                    path: pjf.uploadPath,
                    filename: pjf.uploadFileName,
                    Connection: 'close'
                }
            };
            return this.MyHttpPost(options, postData);
        } catch (err) {
            console.log('上传失败:' + err);
        }
    }
}
