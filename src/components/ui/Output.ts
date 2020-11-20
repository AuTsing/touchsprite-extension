import * as vscode from 'vscode';

class Output {
    private readonly _channel: vscode.OutputChannel;

    constructor() {
        this._channel = vscode.window.createOutputChannel('触动插件');
    }

    public logging(content: string) {
        let contentWithTimestamp = `[${new Date().toLocaleString('chinese', { hour12: false })}] ` + content;
        this._channel.appendLine(contentWithTimestamp);
        this._channel.show(true);
    }
}

export default Output;
