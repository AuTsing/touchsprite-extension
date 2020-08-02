import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Device from './Device';
import TsMessager from './TsMessager';
import { Project } from './Project';
import Zipper from './Zipper';

class Server {
    attachingDevice: Device | undefined;
    tsChannel: vscode.OutputChannel;
    logger: net.Server | undefined;
    key: string | undefined;
    runfile = 'main.lua';

    constructor() {
        this.setKey();
        this.tsChannel = vscode.window.createOutputChannel('触动服务');
        this.setLogger();
    }
    private setKey() {
        let accessKey: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (accessKey) {
            this.key = accessKey;
            return;
        }
        vscode.window.showInformationMessage('开发者key未填写，是否现在填写？', '是', '否', '不再提示').then(result => {
            if (result === '是') {
                vscode.window
                    .showInputBox({
                        prompt: '请输入开发者key',
                        value: '',
                        placeHolder: '开发者key请浏览触动官网查询',
                        ignoreFocusOut: true,
                    })
                    .then(inputValue => {
                        if (inputValue) {
                            this.key = inputValue;
                            vscode.workspace.getConfiguration().update('touchsprite-extension.accessKey', inputValue, true);
                        } else {
                            vscode.window.showWarningMessage('开发者key未填写将导致插件无法正常使用');
                            return this.setKey();
                        }
                    });
            } else if (result === '否') {
                vscode.window.showWarningMessage('开发者key未填写将导致插件无法正常使用');
                return this.setKey();
            } else {
                return;
            }
        });
    }
    private setLogger() {
        this.logger = net.createServer((socket: net.Socket) => {
            socket.on('data', data => {
                this.logging(data.toString('utf8', 4, data.length - 2));
            });
        });
        this.logger.on('error', (err: any) => {
            this.logger ? this.logger.close() : null;
            this.logging('日志服务器启用失败，很可能是端口已被占用：' + err.message);
        });
        this.logger.listen(14088, () => {
            this.logging('日志服务器已启用');
        });
    }
    private getLogIp(): Promise<string> {
        let interfaces = os.networkInterfaces();
        return new Promise<string>(resolve => {
            for (let devName in interfaces) {
                let iface = interfaces[devName];
                for (let i = 0; i < iface.length; i++) {
                    let alias = iface[i];
                    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                        resolve(alias.address);
                    }
                }
            }
        });
    }
    public logging(content: string) {
        let contentWithTimestamp = `[${new Date().toLocaleString('chinese', { hour12: false })}] ` + content;
        this.tsChannel.appendLine(contentWithTimestamp);
        this.tsChannel.show(true);
    }
    public inputIp() {
        return new Promise<string>((resolve, reject) => {
            vscode.window
                .showInputBox({
                    prompt: '请输入设备IP地址',
                    value: '',
                    placeHolder: 'x.x.x.x',
                })
                .then(inputValue => {
                    inputValue = inputValue ? inputValue : '';
                    inputValue = /^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(inputValue) ? inputValue : '';
                    if (inputValue === '') {
                        reject('IP地址格式错误');
                        return;
                    }
                    resolve(inputValue);
                    return;
                });
        });
    }
    public connect(ip: string) {
        return new Promise<string>((resolve, reject) => {
            if (!this.key) {
                reject(`连接失败，未填写开发者AccessKey无法连接设备`);
                return;
            }
            let dev = new Device(ip);
            dev.init(this.key, this)
                .then((device: Device) => {
                    this.attachingDevice = device;
                    resolve(`触动服务: ${dev.ip} 已连接`);
                    return;
                })
                .catch((err: any) => {
                    console.log(err);
                    reject(`设备:${dev.ip}连接失败`);
                    return;
                });
        });
    }
    public setRunFile(mode: string) {
        if (mode === 'prod') {
            this.runfile = 'main.lua';
        } else if (mode === 'dev') {
            let filename: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
            filename = filename ? filename : 'main.test.lua';
            this.runfile = filename;
        }
    }
    public getPicture() {
        return new Promise<string>((resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            let filename = `PIC_${Date.now()}.png`;
            let snapshotDir: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
            let activeDir = vscode.window.activeTextEditor?.document.fileName ? path.dirname(vscode.window.activeTextEditor?.document.fileName) : undefined;
            let filepath = snapshotDir || activeDir || undefined;
            if (!filepath) {
                reject('未设置截图路径');
                return;
            }
            let fileurl = filepath + '\\' + filename;
            TsMessager.getPicture(this.attachingDevice).then(res => {
                fs.writeFile(fileurl, res.data, 'binary', err => {
                    if (err) {
                        reject('截图失败：' + err.message);
                        return;
                    } else {
                        resolve('截图成功：' + fileurl);
                        return;
                    }
                });
            });
        });
    }
    public setLogServer() {
        return new Promise<string>((resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            this.getLogIp().then(ip => {
                if (!this.attachingDevice) {
                    reject('未连接设备');
                    return;
                }
                TsMessager.setLogServer(this.attachingDevice, ip).then(res => {
                    if (res.data === 'ok') {
                        resolve('设置日志服务器成功');
                        return;
                    } else {
                        reject('设置日志服务器失败');
                        return;
                    }
                });
            });
        });
    }
    public setLuaPath() {
        return new Promise<string>((resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            TsMessager.setLuaPath(this.attachingDevice, this.runfile).then(res => {
                if (res.data === 'ok') {
                    resolve('设置运行main.lua成功');
                    return;
                } else {
                    reject('设置运行main.lua失败');
                    return;
                }
            });
        });
    }
    public runLua() {
        return new Promise<string>((resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            TsMessager.runLua(this.attachingDevice).then(res => {
                if (res.data === 'ok') {
                    resolve('运行脚本成功');
                    return;
                } else {
                    reject('运行脚本失败');
                    return;
                }
            });
        });
    }
    public stopLua() {
        return new Promise<string>((resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            TsMessager.stopLua(this.attachingDevice).then(res => {
                if (res.data === 'ok') {
                    resolve('停止脚本成功');
                    return;
                } else {
                    reject('停止脚本失败');
                    return;
                }
            });
        });
    }
    public upload() {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            const focusfile = vscode.window.activeTextEditor?.document;
            if (!focusfile) {
                reject('未选择工程');
                return;
            }
            const focusdir = path.dirname(focusfile.fileName);
            const focusproject = fs.readdirSync(focusdir);
            if (!focusproject.includes(this.runfile)) {
                reject('所选工程不包含引导文件：' + this.runfile);
                return;
            }
            const project = new Project(focusdir);
            for (let projectfile of project.list) {
                await TsMessager.upload(this.attachingDevice, projectfile).then(res => {
                    if (res.data !== 'ok') {
                        reject('上传文件：' + projectfile.uploadFileName + ' 失败');
                        return;
                    }
                });
            }
            resolve('上传完毕');
            return;
        });
    }
    public uploadIncludes() {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.attachingDevice) {
                reject('未连接设备');
                return;
            }
            const includes: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (!includes) {
                resolve('上传完毕');
                return;
            }
            if (includes.length <= 0) {
                resolve('上传完毕');
                return;
            }
            for (let includePath of includes) {
                let project = new Project(includePath);
                for (let projectfile of project.list) {
                    await TsMessager.upload(this.attachingDevice, projectfile).then(res => {
                        if (res.data !== 'ok') {
                            reject('上传文件：' + projectfile.uploadFileName + ' 失败');
                            return;
                        }
                    });
                }
            }
            resolve('上传完毕');
            return;
        });
    }
    public zipProject() {
        return new Promise<string>((resolve, reject) => {
            const focusfile = vscode.window.activeTextEditor?.document;
            if (!focusfile) {
                reject('未选择工程');
                return;
            }
            const focusdir = path.dirname(focusfile.fileName);
            const focusproject = fs.readdirSync(focusdir);
            if (!focusproject.includes('main.lua')) {
                reject('所选工程不包含引导文件：main.lua');
                return;
            }
            const project = new Project(focusdir);
            const includes: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (includes && includes.length > 0) {
                for (let includePath of includes) {
                    project.addProjectFile(includePath);
                }
            }
            const zipper = new Zipper();
            zipper
                .addFiles(project.list)
                .then(() => zipper.zipFiles(project.rootPath))
                .then(ret => {
                    resolve(ret);
                    return;
                });
        });
    }
}

export default Server;
