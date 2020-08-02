import * as React from 'react';
import * as ReactDOM from 'react-dom';

import './index.css';
import App from './app';

declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

const vscode = window.acquireVsCodeApi();

ReactDOM.render(<App vscode={vscode} />, document.getElementById('root'));
