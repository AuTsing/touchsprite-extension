import * as vscode from 'vscode';
import * as Net from 'net';
import { LuaDebugSession } from './LuaDebug';
import Ui from '../ui/Ui';

class LuaDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    private _server?: Net.Server;

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        Ui.logging('start createDebugAdapterDescriptor');

        if (!this._server) {
            // start listening on a random port
            this._server = Net.createServer(socket => {
                const session = new LuaDebugSession();
                session.setRunAsServer(true);
                session.start(socket as NodeJS.ReadableStream, socket);
            }).listen(0);

            return new vscode.DebugAdapterServer((this._server.address() as Net.AddressInfo).port);
        }

        // make VS Code connect to debug server
        return new vscode.DebugAdapterServer((this._server.address() as Net.AddressInfo).port);
    }

    dispose() {
        if (this._server) {
            this._server.close();
        }
    }
}

export default LuaDebugAdapterServerDescriptorFactory;
