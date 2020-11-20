import * as vscode from 'vscode';

export enum StatusBarType {
    disconnected,
    connected,
    failed,
    successful,
}

class StatusBar {
    private readonly _statusBar: vscode.StatusBarItem;
    private _statusBarDisconnected: string = '$(play) 触动插件: 未连接设备';
    private _statusBarConnected: string = '$(play) 触动插件: 未连接设备';

    constructor() {
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this._statusBar.tooltip = '触动插件: 连接/断开设备';
        this._statusBar.command = 'extension.menu';
        this._statusBar.text = this._statusBarDisconnected;
        this._statusBar.show();
    }

    public setStatusBar(content: string | StatusBarType) {
        if (typeof content === 'string') {
            this._statusBar.text = content;
            if (content.indexOf('已连接') > -1) {
                this._statusBarConnected = content;
            }
        } else {
            switch (content) {
                case StatusBarType.connected:
                    this._statusBar.text = this._statusBarConnected;
                    break;
                case StatusBarType.disconnected:
                    this._statusBar.text = this._statusBarDisconnected;
                    break;
                default:
                    break;
            }
        }
    }

    public setStatusBarTemporary(content: string | StatusBarType, timeout?: number) {
        if (typeof content === 'string') {
            this.setStatusBar(content);
            setTimeout(() => this.setStatusBar(StatusBarType.connected), timeout);
        } else {
            switch (content) {
                case StatusBarType.failed:
                    this.setStatusBar('$(issues) 操作失败...');
                    setTimeout(() => this.setStatusBar(StatusBarType.connected), 3000);
                    break;
                case StatusBarType.successful:
                    this.setStatusBar('$(check) 操作成功...');
                    setTimeout(() => this.setStatusBar(StatusBarType.connected), 3000);
                    break;
                default:
                    break;
            }
        }
    }

    public resetStatusBar() {
        this.setStatusBar(StatusBarType.disconnected);
    }
}

export default StatusBar;
