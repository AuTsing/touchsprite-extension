import * as vscode from 'vscode';

class Output {
    private readonly channel: vscode.OutputChannel;
    private debugChannel: vscode.OutputChannel | undefined;

    constructor() {
        this.channel = vscode.window.createOutputChannel('触动插件');
    }

    private getTimestamp() {
        return `[${new Date().toLocaleString('chinese', { hour12: false })}]`;
    }

    public output(content: string, level: number = 0) {
        content = `${this.getTimestamp()} ${content}`;
        switch (level) {
            case 0:
                this.channel.appendLine(content);
                break;
            case 1:
                this.channel.appendLine(content);
                this.channel.show(true);
                break;
            case 2:
                this.channel.appendLine(content);
                this.channel.show();
                break;
            default:
                this.channel.appendLine(content);
                break;
        }
    }

    public outputWarn(content: string) {
        content = `[WARN] ${content}`;
        return this.output(content, 1);
    }

    public outputError(content: string) {
        content = `[ERROR] ${content}`;
        return this.output(content, 1);
    }

    public outputShow() {
        this.channel.show(true);
    }

    public enableDebugChannel() {
        this.debugChannel = vscode.window.createOutputChannel('触动插件调试日志');
    }

    public outputDebug(content: string) {
        if (!this.debugChannel) {
            return;
        }
        content = `[DEBUG] ${this.getTimestamp()} ${content}`;
        this.debugChannel.appendLine(content);
    }
}

export default Output;
