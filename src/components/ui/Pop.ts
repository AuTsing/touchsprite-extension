import * as vscode from 'vscode';

class Pop {
    public popMessage(content: string) {
        vscode.window.showInformationMessage(content);
    }

    public popError(content: string) {
        vscode.window.showErrorMessage(content);
    }

    public popWarning(content: string) {
        vscode.window.showWarningMessage(content);
    }
}

export default Pop;
