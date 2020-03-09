import * as JSZip from "jszip";
import * as fs from "fs";

class Ziper extends JSZip {
    public addFile(fileName: string, pathName: string) {
        let data = fs.readFileSync(pathName + "\\" + fileName);
        this.file(fileName, data);
    }
    public zipFiles(pathName: string) {
        this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(pathName + '.zip'))
            .on('finish', function () {
                console.log("out.zip written.");
            })
    }
}

let p1 = "D:\\OneDrive\\git\\JS\\touchsprite-extension\\src\\test";
let f1 = "fileTest.ts";
let f2 = "index.html";

let ziper = new Ziper()
ziper.addFile(f1, p1);
// ziper.addFile(f2, p1);
ziper.zipFiles(p1);