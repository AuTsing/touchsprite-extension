import * as Vscode from 'vscode';
import * as Express from 'express';
import * as Cors from 'cors';
import * as Http from 'http';
import Touchsprite from './Touchsprite';

export default class Server implements Vscode.Disposable {
    private readonly touchsprite: Touchsprite;
    private server: Http.Server | null;
    private port: number;

    constructor(touchsprite: Touchsprite) {
        this.touchsprite = touchsprite;
        this.server = null;
        this.port = 26001;
        this.up();
    }

    async up() {
        const express = Express();
        express.use(Cors());
        express.get('/api/ping', (req, res) => {
            res.send('pong');
        });
        express.get('/api/title', (req, res) => {
            res.send(`从 触动插件 端口: ${this.port} 加载`);
        });
        express.get('/api/snap', async (req, res) => {
            try {
                const img = await this.touchsprite.getSnap();
                res.type('png').send(img);
            } catch (e) {
                res.status(500).send((e as Error).message);
            }
        });
        this.server = express.listen(this.port);
        this.server.on('error', (e: { code: string }) => {
            if (e.code !== 'EADDRINUSE') {
                throw e;
            }
            this.port++;
            this.up();
        });
    }

    down() {
        this.server?.close();
    }

    dispose() {
        this.down();
    }
}
