import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from './Server';
import Ui from './ui/Ui';
import { IProjectFile, ProjectFileRoot } from './ProjectGenerator';

export default class Debuger {
    private server: Server;
    private extensionPath: string;

    constructor(server: Server, context: vscode.ExtensionContext) {
        this.server = server;
        this.extensionPath = context.extensionPath;
    }

    public async debug() {
        try {
            const attachingDevice = await this.server.getAttachingDevice();
            const { ip, auth } = attachingDevice;
            const luapanda = vscode.Uri.file(path.join(this.extensionPath, 'assets', 'debugger', 'LuaPanda.lua'));
            const hostIp = await this.server.getHostIp();
            const bootStr = `require("LuaPanda").start("${hostIp}",8818)local a=function(b)LuaPanda.printToVSCode(b,1,2)end;nLog=a;require("maintest")`;
            fs.writeFileSync(path.join(this.extensionPath, 'assets', 'debugger', 'boot.lua'), bootStr);
            const boot = vscode.Uri.file(path.join(this.extensionPath, 'assets', 'debugger', 'boot.lua'));
            const uris: vscode.Uri[] = [luapanda, boot];
            const pjfs: IProjectFile[] = uris.map(uri => {
                const url = uri.path.substring(1);
                return {
                    url: url,
                    path: '/',
                    filename: path.basename(url),
                    root: ProjectFileRoot.lua,
                };
            });
            const resp1: string[] = [];
            for (const pjf of pjfs) {
                const resp = await this.server.api.upload(ip, auth, pjf);
                resp1.push(resp.data);
            }
            if (resp1.some(resp => resp !== 'ok')) {
                return Promise.reject('上传工程失败');
            }
            const ret = await vscode.debug.startDebugging(undefined, {
                type: 'lua',
                request: 'launch',
                tag: 'normal',
                name: 'LuaPanda',
                description: '通用模式,通常调试项目请选择此模式 | launchVer:3.2.0',
                luaFileExtension: '',
                connectionPort: 8818,
                stopOnEntry: false,
                useCHook: true,
                autoPathMode: true,
            });
            if (!ret) {
                return Promise.reject('启用调试服务器失败');
            }
            const runfile: string = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile') || 'maintest.lua';
            this.server.runProject(runfile, 'boot.lua');
            Ui.logging(`启用调试成功`);
        } catch (err) {
            Ui.logging(`启动调试失败: ${err.toString()}`);
        }
    }
}
