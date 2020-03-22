import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Device } from './Device';
import { TsRequset } from './MyHttpClient';
import { Ziper } from './Ziper';
import { Project } from './Project';

export class Server {
    attachingDevice!: Device;
    tsChannel = vscode.window.createOutputChannel('触动精灵日志');
    logServer!: net.Server;
    key: string | undefined;

    constructor() {
        this.setKey();
        this.setLogServer();
    }
    private setKey() {
        let accessKey: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (accessKey) {
            this.key = accessKey;
        } else {
            vscode.window.showInformationMessage('开发者key未填写，是否现在填写？', '是', '否', '不再提示').then(result => {
                if (result === '是') {
                    vscode.window
                        .showInputBox({
                            prompt: '请输入开发者key',
                            value: '',
                            placeHolder: '开发者key请浏览触动官网查询',
                            ignoreFocusOut: true
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
    }
    private setLogServer() {
        this.logServer = net.createServer((socket: net.Socket) => {
            socket.on('data', data => {
                this.tsChannel.append(
                    `[${new Date().toLocaleString('chinese', {
                        hour12: false
                    })}] `
                );
                this.tsChannel.appendLine(data.toString('utf8', 4, data.length - 2));
                this.tsChannel.show(true);
            });
        });
        this.logServer.on('error', (err: any) => {
            this.logServer.close();
            this.tsChannel.appendLine('发生错误，日志服务器已关闭：' + err.message);
            this.tsChannel.show(true);
        });
        this.logServer.listen(14088, () => {
            this.tsChannel.appendLine('日志服务器已启用');
            this.tsChannel.show(true);
        });
    }
    private IsConnected() {
        if (this.attachingDevice) {
            // console.log('已连接设备:');
            // console.log(this.attachingDevice);
            return true;
        } else {
            vscode.window.showErrorMessage('未连接设备！');
            return false;
        }
    }
    private getLogIp(): Promise<string> {
        let interfaces = os.networkInterfaces();
        return new Promise<string>((resolve, reject) => {
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
    public ReceiveIp() {
        return new Promise<string>((resolve, reject) => {
            vscode.window
                .showInputBox({
                    prompt: '请输入设备IP地址',
                    value: '',
                    placeHolder: 'x.x.x.x'
                })
                .then(inputValue => {
                    if (inputValue) {
                        resolve(inputValue);
                    } else {
                        reject('');
                    }
                });
        });
    }
    public Connect(ip: string) {
        if (this.key) {
            let dev = new Device(ip);
            return dev
                .init(this.key)
                .then(value => {
                    this.attachingDevice = value;
                    vscode.window.showInformationMessage(`设备:${dev.ip}连接成功`);
                })
                .catch(err => {
                    vscode.window.showWarningMessage(`设备:${dev.ip}连接失败`);
                    console.log(err);
                });
        } else {
            vscode.window.showWarningMessage('未填写开发者AccessKey无法连接设备');
        }
    }
    public GetStatus() {
        if (this.IsConnected()) {
            return TsRequset.GetStatus(this.attachingDevice).then(
                value => {
                    if (value == 'f00') {
                        vscode.window.showInformationMessage(`设备:${this.attachingDevice.ip}空闲`);
                    } else if (value == 'f01') {
                        vscode.window.showInformationMessage(`设备:${this.attachingDevice.ip}运行中`);
                    }
                },
                err => console.log(err)
            );
        }
    }
    public GetPicture() {
        if (this.IsConnected()) {
            return TsRequset.GetPicture(this.attachingDevice).then(
                value => {
                    return new Promise((resolve, reject) => {
                        let saveName: string;
                        let snapshotDir: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
                        if (snapshotDir) {
                            saveName = `${snapshotDir}\\PIC_${Date.now()}.png`;
                            fs.writeFile(saveName, value, 'binary', err => {
                                if (err) {
                                    console.log('截图失败' + err.message);
                                    vscode.window.showWarningMessage('截图失败');
                                } else {
                                    console.log('截图成功');
                                    vscode.window.showInformationMessage('截图成功');
                                }
                            });
                        } else {
                            let name = vscode.window.activeTextEditor?.document;
                            if (name) {
                                saveName = path.dirname(name.fileName) + '\\snapshot.png';
                                fs.writeFile(saveName, value, 'binary', err => {
                                    if (err) {
                                        console.log('截图失败' + err.message);
                                        vscode.window.showWarningMessage('截图失败');
                                    } else {
                                        console.log('截图成功');
                                        vscode.window.showInformationMessage('截图成功');
                                    }
                                });
                            } else {
                                vscode.window.showInformationMessage('未选择保存路径');
                            }
                        }
                    });
                },
                err => console.log(err)
            );
        }
    }
    public SetLogServer() {
        if (this.IsConnected()) {
            return this.getLogIp().then(ip => {
                return TsRequset.LogServer(this.attachingDevice, ip).then(
                    value => console.log('远程日志:' + value),
                    err => console.log(err)
                );
            });
        }
    }
    public SetLuaPath() {
        if (this.IsConnected()) {
            return TsRequset.SetLuaPath(this.attachingDevice).then(
                value => console.log('设置运行路径:' + value),
                err => console.log(err)
            );
        }
    }
    public RunLua() {
        if (this.IsConnected()) {
            return TsRequset.RunLua(this.attachingDevice).then(
                value => {
                    console.log('运行脚本:' + value);
                    if (value == 'ok') {
                        vscode.window.showInformationMessage('运行脚本成功');
                    } else if (value == 'fail') {
                        vscode.window.showInformationMessage('运行脚本失败');
                    }
                },
                err => console.log(err)
            );
        }
    }
    public StopLua() {
        if (this.IsConnected()) {
            return TsRequset.StopLua(this.attachingDevice).then(
                value => {
                    console.log('停止脚本:' + value);
                    if (value == 'ok') {
                        vscode.window.showInformationMessage('运行停止成功');
                    } else if (value == 'fail') {
                        vscode.window.showInformationMessage('运行停止失败');
                    }
                },
                err => console.log(err)
            );
        }
    }
    public async Upload() {
        if (this.IsConnected()) {
            let focusFile = vscode.window.activeTextEditor?.document;
            if (focusFile) {
                let rootPath = path.dirname(focusFile.fileName);
                let rootPathFiles: string[] = fs.readdirSync(rootPath);
                if (rootPathFiles.includes('main.lua')) {
                    let pj = new Project(rootPath);
                    for (let pjf of pj.list) {
                        await TsRequset.Upload(this.attachingDevice, pjf).then(
                            value => console.log(`上传文件${pjf.uploadFileName}:${value}`),
                            (err: any) => console.log(err)
                        );
                    }
                } else {
                    vscode.window.showErrorMessage('所选目录必须包含main.lua文件');
                }
            } else {
                vscode.window.showErrorMessage('请先选择工程');
            }
        }
    }
    public async UploadInclude() {
        if (this.IsConnected()) {
            let pathArr: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (pathArr && pathArr.length > 0) {
                for (let rootPath of pathArr) {
                    let pj = new Project(rootPath);
                    for (let pjf of pj.list) {
                        await TsRequset.Upload(this.attachingDevice, pjf).then(
                            value => console.log(`上传文件${pjf.uploadFileName}:${value}`),
                            (err: any) => console.log(err)
                        );
                    }
                }
            } else {
                return Promise.resolve();
            }
        }
    }
    public ZipProject() {
        let ziper = new Ziper();
        let focusFile = vscode.window.activeTextEditor?.document;
        if (focusFile) {
            let rootPath = path.dirname(focusFile.fileName);
            let rootPathFiles: string[] = fs.readdirSync(rootPath);
            if (rootPathFiles.includes('main.lua')) {
                let pj = new Project(rootPath);
                let pathArr: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
                if (pathArr && pathArr.length > 0) {
                    for (let rootPath2 of pathArr) {
                        pj.AddProjectFile(rootPath2);
                    }
                }
                ziper
                    .addFiles(pj.list)
                    .then(() => {
                        ziper.zipFiles(pj.rootPath);
                    })
                    .catch(reason => {
                        vscode.window.showErrorMessage(reason);
                    });
            } else {
                vscode.window.showErrorMessage('所选目录必须包含main.lua文件');
            }
        } else {
            vscode.window.showErrorMessage('请先选择工程');
        }
    }
    public async MyTest() {
        this.Upload();
    }
}
