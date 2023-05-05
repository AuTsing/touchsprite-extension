import * as Vscode from 'vscode';
import Storage from './Storage';
import { TsFileRoot } from './Device';

export default class Asker {
    private readonly storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }

    private validateIp(ip: string) {
        if (!/^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(ip)) {
            throw new Error('设备 IP 无效');
        }
    }

    async askForDeviceIp(): Promise<string> {
        const ip = (await Vscode.window.showInputBox({ prompt: '请输入设备 IP', value: '192.168.', placeHolder: '192.168.' })) ?? '';
        this.validateIp(ip);
        return ip;
    }

    async askForDeviceIpWithHistory(): Promise<string> {
        const deviceIps = this.storage.getDeviceIps();
        if (deviceIps.length === 0) {
            return this.askForDeviceIp();
        }
        const defaultSelections = ['清空历史设备', '连接新设备'];
        const selections = defaultSelections.concat(deviceIps).reverse();
        const selection = (await Vscode.window.showQuickPick(selections, { placeHolder: '请输入设备IP' })) ?? '';
        if (selection === '连接新设备') {
            return this.askForDeviceIp();
        }
        if (selection === '清空历史设备') {
            this.storage.setDeviceIps();
            return this.askForDeviceIp();
        }
        this.validateIp(selection);
        return selection;
    }

    private validateCookie(cookie: string) {
        if (cookie === '') {
            throw new Error('登录 Cookie 无效');
        }
        const cookies = cookie.split(';').map(str => str.trim());
        const identity = cookies.find(cookie => cookie.slice(0, 9) === '_identity');
        if (!identity) {
            throw new Error('登录Cookie不包含字段"identity"');
        }
    }

    async askForCookie(): Promise<string> {
        const cookie = (await Vscode.window.showInputBox({ prompt: '请输入登录 Cookie', value: '' })) ?? '';
        this.validateCookie(cookie);
        return cookie;
    }

    private validateAccessKey(accessKey: string) {
        if (accessKey === '') {
            throw new Error('开发者 AccessKey 无效');
        }
    }

    async askForAccessKey(): Promise<string> {
        const accessKey = (await Vscode.window.showInputBox({ prompt: '请输入开发者 AccessKey', value: '' })) ?? '';
        this.validateAccessKey(accessKey);
        return accessKey;
    }

    private validateUploadDst(dst: string) {
        if (dst === '') {
            throw new Error('未选择目标目录');
        }
    }

    async askForUploadDst(): Promise<TsFileRoot> {
        const dst = (await Vscode.window.showQuickPick([TsFileRoot.lua, TsFileRoot.res], { placeHolder: '上传至...' })) ?? '';
        this.validateUploadDst(dst);
        return dst as TsFileRoot;
    }

    private validateUploadFiles(files: Vscode.Uri[]) {
        if (files.length === 0) {
            throw new Error('未选择文件');
        }
    }

    async askForUploadFiles(): Promise<Vscode.Uri[]> {
        const uris =
            (await Vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
            })) ?? [];
        this.validateUploadFiles(uris);
        return uris;
    }
}
