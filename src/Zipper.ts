import * as vscode from 'vscode';
import * as JSZip from 'jszip';
import * as fs from 'fs';
import { ProjectFile } from './Project';

class Zipper extends JSZip {
    public addFiles(list: Array<ProjectFile>) {
        return Promise.all(
            list.map(file => {
                let data = fs.readFileSync(file.uploadUrl);
                let p = file.uploadPath.substr(1, file.uploadPath.length);
                if (p === '') {
                    p = file.uploadFileName;
                } else {
                    p = p + '/' + file.uploadFileName;
                }
                // console.log(p);
                this.file(p, data);
            })
        );
    }
    public addFile(fileName: string, pathName: string) {
        let data = fs.readFileSync(pathName + '\\' + fileName);
        this.file(fileName, data);
    }
    public zipFiles(pathName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(fs.createWriteStream(pathName + '.zip'))
                .on('finish', () => {
                    resolve('项目已打包完成：' + pathName + '.zip');
                });
        });
    }
}

export default Zipper;
