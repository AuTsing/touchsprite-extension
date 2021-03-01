import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from './Server';
import Ui from './ui/Ui';
import { IProjectFile, ProjectFileRoot } from './ProjectGenerator';

export default class TsDebugger {
    private readonly server: Server;
    private readonly extensionPath: string;

    constructor(server: Server, context: vscode.ExtensionContext) {
        this.server = server;
        this.extensionPath = context.extensionPath;
    }

    public async startClient() {
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
                throw new Error('上传工程失败');
            }
            const runfile: string = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile') || 'maintest.lua';
            this.server.runProject(runfile, 'boot.lua');
            Ui.output(`启用调试成功`);
            return true;
        } catch (err) {
            Ui.outputError(`启动调试失败: ${err.toString()}`);
            return false;
        }
    }

    public debug() {
        vscode.debug.startDebugging(undefined, {
            type: 'ts-lua',
            request: 'launch',
            name: 'TouchspriteDebug',
        });
    }

    public test() {}
}
