import * as Vscode from 'vscode';
import * as FsPromises from 'fs/promises';
import * as Path from 'path';

export interface WorkspaceFile {
    name: string;
    absolutePath: string;
    relativePath: string;
}

export default class Workspace {
    getWorkspaceFolder(): Vscode.WorkspaceFolder {
        const workspaceFolders = Vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('未打开工程');
        }
        if (workspaceFolders.length > 1) {
            throw new Error('暂不支持多工程工作区');
        }
        return workspaceFolders[0];
    }

    getFocusingFile(): Vscode.TextDocument {
        const focusingFile = Vscode.window.activeTextEditor?.document;
        if (!focusingFile) {
            throw new Error('未选择文件');
        }
        return focusingFile;
    }

    private async readdirRecursively(absolutePath: string, relativePath: string = '', files: WorkspaceFile[] = []): Promise<WorkspaceFile[]> {
        const dirents = await FsPromises.readdir(absolutePath, { withFileTypes: true });
        for (const dirent of dirents) {
            if (dirent.isFile()) {
                const file: WorkspaceFile = {
                    name: dirent.name,
                    absolutePath: Path.join(absolutePath, dirent.name).replace(/\\/g, '/'),
                    relativePath: Path.join(relativePath, dirent.name).replace(/\\/g, '/'),
                };
                files.push(file);
                continue;
            }
            if (dirent.isDirectory()) {
                await this.readdirRecursively(Path.join(absolutePath, dirent.name), Path.join(relativePath, dirent.name), files);
                continue;
            }
        }
        return files;
    }

    async getWrokspaceFiles(): Promise<WorkspaceFile[]> {
        const workspaceFolder = this.getWorkspaceFolder();
        const files = await this.readdirRecursively(workspaceFolder.uri.fsPath, 'Projects/' + workspaceFolder.name);
        return files;
    }
}
