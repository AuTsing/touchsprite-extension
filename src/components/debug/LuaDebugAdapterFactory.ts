import * as vscode from 'vscode';
import * as Net from 'net';
import { LuaDebugSession } from './LuaDebug';
import TsDebugger from '../TsDebugger';

export default class LuaDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
    private netServer: Net.Server | undefined;
    private tsDebugger: TsDebugger;

    constructor(tsDebugger: TsDebugger) {
        this.tsDebugger = tsDebugger;
    }

    createDebugAdapterDescriptor(): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        if (!this.netServer) {
            this.netServer = Net.createServer(socket => {
                const session = new LuaDebugSession(this.tsDebugger);
                session.setRunAsServer(true);
                session.start(socket as NodeJS.ReadableStream, socket);
            }).listen(0);
        }
        return new vscode.DebugAdapterServer((this.netServer.address() as Net.AddressInfo).port);
    }

    dispose() {
        this.netServer?.close();
    }
}
