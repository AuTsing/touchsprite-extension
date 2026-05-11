import { Disposable } from 'vscode';
import * as http from 'node:http';
import * as Express from 'express';
import * as Cors from 'cors';
import Touchsprite from './Touchsprite';

export interface Api {
    title: string;
    url: string;
}

export default class Server implements Disposable {
    private readonly touchsprite: Touchsprite;
    private server: http.Server | null;
    private port: number;

    constructor(touchsprite: Touchsprite) {
        this.touchsprite = touchsprite;
        this.server = null;
        this.port = 26000;
        this.up();
    }

    async up() {
        const express = Express();
        express.use(Cors());
        express.get('/get-api', (req, res) => {
            console.log(req);

            res.json({
                title: `从 触动插件 端口: ${this.port} 加载`,
                url: `http://${req.host}/api/snap`,
            } satisfies Api);
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
