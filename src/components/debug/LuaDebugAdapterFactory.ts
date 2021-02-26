import * as vscode from 'vscode';
import * as Net from 'net';
import { LuaDebugSession } from './LuaDebug';

export default class LuaDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
    private server: Net.Server | undefined;

    createDebugAdapterDescriptor(): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        if (!this.server) {
            this.server = Net.createServer(socket => {
                const session = new LuaDebugSession();
                session.setRunAsServer(true);
                session.start(socket as NodeJS.ReadableStream, socket);
            }).listen(0);
        }
        return new vscode.DebugAdapterServer((this.server.address() as Net.AddressInfo).port);
    }

    dispose() {
        this.server?.close();
    }
}
