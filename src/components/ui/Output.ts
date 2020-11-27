import * as vscode from 'vscode';

class Output {
    private readonly _channel: vscode.OutputChannel;
    private _debugChannel?: vscode.OutputChannel;

    constructor() {
        this._channel = vscode.window.createOutputChannel('触动插件');
    }

    public enableDebugChannel() {
        this._debugChannel = vscode.window.createOutputChannel('触动插件调试日志');
    }

    public logging(content: string) {
        const contentWithTimestamp = `[${new Date().toLocaleString('chinese', { hour12: false })}] ` + content;
        this._channel.appendLine(contentWithTimestamp);
        // this._channel.show(true);
    }

    public loggingShow(content: string) {
        this.logging(content);
        this._channel.show();
    }

    public logError(content: string) {
        const contentWithType = `[Error] ` + content;
        this.logging(contentWithType);
    }

    public logWarning(content: string) {
        const contentWithType = `[Warning] ` + content;
        this.logging(contentWithType);
    }

    public logDebug(content: string) {
        if (!this._debugChannel) {
            return;
        }
        const contentWithType = `[Debug] ` + content;
        const contentWithTimestamp = `[${new Date().toLocaleString('chinese', { hour12: false })}] ` + contentWithType;
        this._debugChannel.appendLine(contentWithTimestamp);
    }
}

export default Output;
