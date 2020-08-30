import * as JSZip from 'jszip';
import * as fs from 'fs';
import Project, { IProjectFile } from './Project';

class Zipper extends JSZip {
    public addFile(pjf: IProjectFile) {
        const data = fs.readFileSync(pjf.url);
        this.file(pjf.filename, data);
    }

    public addFiles(project: Project) {
        const list = project.getList();
        return Promise.all(
            list.map(pjf => {
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

    public zipFiles(mainPath: string): Promise<string> {
        return new Promise(resolve => {
            this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(fs.createWriteStream(mainPath + '.zip'))
                .on('finish', () => resolve('ok'));
        });
    }
}

export default Zipper;
