import * as JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import { IProjectFile } from './ProjectGenerator';

class Zipper extends JSZip {
    public addFile(pjf: IProjectFile) {
        const data = fs.readFileSync(pjf.url);
        this.file(pjf.filename, data);
    }

    public addFiles(pjfs: IProjectFile[]) {
        return Promise.all(
            pjfs.map(pjf => {
                const data = fs.readFileSync(pjf.url);
                let path = pjf.path.substr(1, pjf.path.length);
                if (path === '') {
                    path = pjf.filename;
                } else {
                    path = path + '/' + pjf.filename;
                }
                this.file(path, data);
            })
        );
    }

    public zipFiles(dir: string, filename: string) {
        const url = path.join(dir, filename);
        return new Promise<string>(resolve =>
            this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(fs.createWriteStream(url))
                .on('finish', () => resolve(url))
        );
    }
}

export default Zipper;
