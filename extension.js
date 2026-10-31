const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

function activate(context) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codebaseContextView', new CodebaseTreeProvider(context.extensionUri))
    );
}

class CodebaseTreeProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            const rootPath = workspaceFolders[0].uri.fsPath;

            if (data.command === 'ready') {
                this.updateFileTree();
            } else if (data.command === 'copyContext') {
                const selectedPaths = data.files;
                if (!selectedPaths || selectedPaths.length === 0) {
                    vscode.window.showErrorMessage('No files selected.');
                    return;
                }

                let payload = 'Here is the relevant code context:\n\n';
                for (const relPath of selectedPaths) {
                    const fullPath = pathModule.join(rootPath, relPath);
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        payload += `// File: ${relPath}\n\`\`\`\n${content}\n\`\`\`\n\n`;
                    }
                }
                payload += 'Prompt: ';

                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage(`Successfully copied ${selectedPaths.length} files to clipboard!`);
            } else if (data.command === 'copyAllProject') {
                const allFiles = this.getValidProjectFiles(rootPath);
                if (allFiles.length === 0) {
                    vscode.window.showErrorMessage('No valid project files found.');
                    return;
                }

                let payload = 'Here is the entire project context:\n\n';
                for (const relPath of allFiles) {
                    const fullPath = pathModule.join(rootPath, relPath);
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        payload += `// File: ${relPath}\n\`\`\`\n${content}\n\`\`\`\n\n`;
                    }
                }
                payload += 'Prompt: ';

                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage(`Successfully copied entire project (${allFiles.length} files) to clipboard!`);
            } else if (data.command === 'packProjectXml') {
                const allFiles = this.getValidProjectFiles(rootPath);
                if (allFiles.length === 0) {
                    vscode.window.showErrorMessage('No valid project files found.');
                    return;
                }

                let xmlPayload = '<?xml version="1.0" encoding="UTF-8"?>\n<project_context>\n';
                for (const relPath of allFiles) {
                    const fullPath = pathModule.join(rootPath, relPath);
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const safeContent = content.replace(/\]\]>/g, ']]]]><![CDATA[>');
                        xmlPayload += `  <file path="${relPath}">\n    <![CDATA[\n${safeContent}\n    ]]>\n  </file>\n`;
                    }
                }
                xmlPayload += '</project_context>';

                const targetXmlPath = pathModule.join(rootPath, 'packedproject.xml');
                fs.writeFileSync(targetXmlPath, xmlPayload, 'utf8');

                const doc = await vscode.workspace.openTextDocument(targetXmlPath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage('Successfully generated packedproject.xml!');
            } else if (data.command === 'packSelectedXml') {
                const selectedPaths = data.files;
                if (!selectedPaths || selectedPaths.length === 0) {
                    vscode.window.showErrorMessage('No files selected.');
                    return;
                }

                let xmlPayload = '<?xml version="1.0" encoding="UTF-8"?>\n<project_context>\n';
                for (const relPath of selectedPaths) {
                    const fullPath = pathModule.join(rootPath, relPath);
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const safeContent = content.replace(/\]\]>/g, ']]]]><![CDATA[>');
                        xmlPayload += `  <file path="${relPath}">\n    <![CDATA[\n${safeContent}\n    ]]>\n  </file>\n`;
                    }
                }
                xmlPayload += '</project_context>';

                const targetXmlPath = pathModule.join(rootPath, 'packedselected.xml');
                fs.writeFileSync(targetXmlPath, xmlPayload, 'utf8');

                const doc = await vscode.workspace.openTextDocument(targetXmlPath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage('Successfully generated packedselected.xml!');
            }
        });
    }

    parseGitignore(rootPath) {
        const gitignorePath = pathModule.join(rootPath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) return [];
        const content = fs.readFileSync(gitignorePath, 'utf8');
        return content.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    isPathIgnored(relPath, ignorePatterns) {
        const normalizedPath = relPath.replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/');

        for (const pattern of ignorePatterns) {
            let cleanPattern = pattern.replace(/\/$/, '');
            if (normalizedPath === cleanPattern || pathSegments.includes(cleanPattern)) {
                return true;
            }
            if (cleanPattern.startsWith('*.')) {
                const ext = cleanPattern.slice(1);
                if (normalizedPath.endsWith(ext)) return true;
            }
            if (pattern.endsWith('/') && normalizedPath.startsWith(cleanPattern)) {
                return true;
            }
        }
        return false;
    }

    getValidProjectFiles(rootPath) {
        const relativePaths = [];
        const ignorePatterns = this.parseGitignore(rootPath);
        const defaultIgnored = new Set(['node_modules', '.git', 'dist', 'build', '.vscode']);
        const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff', '.mp3', '.mp4', '.zip', '.tar', '.gz', '.pdf', '.exe', '.bin']);

        function walk(dir, currentRelative = '') {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (defaultIgnored.has(entry.name)) continue;
                const relPath = currentRelative ? pathModule.join(currentRelative, entry.name) : entry.name;
                const normalizedRelPath = relPath.replace(/\\/g, '/');

                if (entry.isDirectory()) {
                    walk(pathModule.join(dir, entry.name), relPath);
                } else {
                    const ext = pathModule.extname(entry.name).toLowerCase();
                    if (!ignoredExtensions.has(ext)) {
                        relativePaths.push(normalizedRelPath);
                    }
                }
            }
        }

        try {
            walk(rootPath);
        } catch (e) {
            console.error(e);
        }

        return relativePaths.filter(p => !this.isPathIgnored(p, ignorePatterns));
    }

    updateFileTree() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootPath = workspaceFolders[0].uri.fsPath;
        const validFiles = this.getValidProjectFiles(rootPath);

        if (this._view) {
            this._view.webview.postMessage({ command: 'loadFiles', files: validFiles });
        }
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 8px; margin: 0; font-size: 13px; user-select: none; }
                .tree-container { margin-bottom: 8px; max-height: calc(100vh - 160px); overflow-y: auto; }
                ul { list-style-type: none; padding-left: 14px; margin: 1px 0; }
                .tree-container > ul { padding-left: 0; }
                li { margin: 1px 0; white-space: nowrap; }
                .folder-row, .file-row { display: flex; align-items: center; cursor: pointer; padding: 3px 6px; border-radius: 4px; }
                .folder-row:hover, .file-row:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-list-hoverForeground); }
                input[type="checkbox"] { margin-right: 8px; cursor: pointer; accent-color: var(--vscode-checkbox-background); }
                .arrow { display: inline-block; width: 10px; font-size: 9px; margin-right: 6px; color: var(--vscode-icon-foreground); transition: transform 0.1s; }
                
                .folder-node.collapsed > div > ul,
                .folder-node.collapsed > ul { display: none; }
                .folder-node.collapsed .arrow { transform: rotate(-90deg); }
                
                .icon { margin-right: 6px; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; color: var(--vscode-icon-foreground); }
                
                .button-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 8px; cursor: pointer; border-radius: 2px; font-weight: 500; font-size: 11px; text-align: center; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                
                #counter { font-weight: 500; color: var(--vscode-descriptionForeground); margin-bottom: 6px; display: block; font-size: 12px; }
            </style>
        </head>
        <body>
            <span id="counter">0 files selected</span>
            <div id="tree" class="tree-container"></div>
            
            <div class="button-grid">
                <button id="copy-btn">Copy Selected</button>
                <button id="pack-selected-xml-btn">Pack Selected XML</button>
                <button id="copy-all-btn">Copy Project to Clipboard</button>
                <button id="pack-xml-btn">Pack Project XML</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let selectedFiles = new Set();
                let lastClickedRow = null;

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'loadFiles') {
                        const treeData = buildNestedTree(message.files);
                        renderTree(treeData, document.getElementById('tree'));
                    }
                });

                function buildNestedTree(paths) {
                    const root = { name: '', type: 'folder', children: {}, path: '' };
                    for (const p of paths) {
                        const parts = p.split('/');
                        let curr = root;
                        let currentPath = '';
                        for (let i = 0; i < parts.length; i++) {
                            const part = parts[i];
                            currentPath = currentPath ? currentPath + '/' + part : part;
                            if (!curr.children[part]) {
                                curr.children[part] = {
                                    name: part,
                                    type: i === parts.length - 1 ? 'file' : 'folder',
                                    children: {},
                                    path: currentPath
                                };
                            }
                            curr = curr.children[part];
                        }
                    }
                    return root;
                }

                function renderTree(node, container) {
                    container.innerHTML = '';
                    const ul = document.createElement('ul');
                    
                    const sortedKeys = Object.keys(node.children).sort((a, b) => {
                        const nodeA = node.children[a];
                        const nodeB = node.children[b];
                        if (nodeA.type !== nodeB.type) return nodeA.type === 'folder' ? -1 : 1;
                        return a.localeCompare(b);
                    });

                    for (const key of sortedKeys) {
                        const child = node.children[key];
                        const li = document.createElement('li');

                        if (child.type === 'folder') {
                            li.className = 'folder-node';
                            const row = document.createElement('div');
                            row.className = 'folder-row';
                            row.innerHTML = '<span class="arrow">▼</span><span class="icon">📁</span><span>' + child.name + '</span>';
                            
                            const childContainer = document.createElement('div');
                            renderTree(child, childContainer);
                            li.appendChild(row);
                            li.appendChild(childContainer);

                            row.onclick = (e) => {
                                e.stopPropagation();
                                li.classList.toggle('collapsed');
                            };
                        } else {
                            const row = document.createElement('div');
                            row.className = 'file-row';
                            row.dataset.path = child.path;
                            
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.value = child.path;
                            checkbox.checked = selectedFiles.has(child.path);

                            const handleSelection = (e) => {
                                e.stopPropagation();
                                const currentPath = child.path;
                                const targetState = !selectedFiles.has(currentPath);

                                if (e.shiftKey && lastClickedRow && lastClickedRow !== row) {
                                    const allFileRows = Array.from(document.querySelectorAll('.file-row'));
                                    const startIdx = allFileRows.indexOf(lastClickedRow);
                                    const endIdx = allFileRows.indexOf(row);

                                    if (startIdx !== -1 && endIdx !== -1) {
                                        const [low, high] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                                        for (let i = low; i <= high; i++) {
                                            const r = allFileRows[i];
                                            const p = r.dataset.path;
                                            const cb = r.querySelector('input[type="checkbox"]');
                                            if (cb && p) {
                                                cb.checked = targetState;
                                                if (targetState) {
                                                    selectedFiles.add(p);
                                                } else {
                                                    selectedFiles.delete(p);
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    checkbox.checked = targetState;
                                    if (targetState) {
                                        selectedFiles.add(currentPath);
                                    } else {
                                        selectedFiles.delete(currentPath);
                                    }
                                }

                                lastClickedRow = row;
                                updateCounter();
                            };

                            checkbox.onclick = handleSelection;

                            const label = document.createElement('span');
                            label.innerText = child.name;

                            row.onclick = handleSelection;

                            row.appendChild(checkbox);
                            row.appendChild(label);
                            li.appendChild(row);
                        }
                        ul.appendChild(li);
                    }
                    container.appendChild(ul);
                }

                function updateCounter() {
                    document.getElementById('counter').innerText = selectedFiles.size + ' files selected';
                }

                document.getElementById('copy-btn').onclick = () => {
                    vscode.postMessage({ command: 'copyContext', files: Array.from(selectedFiles) });
                };

                document.getElementById('pack-selected-xml-btn').onclick = () => {
                    vscode.postMessage({ command: 'packSelectedXml', files: Array.from(selectedFiles) });
                };

                document.getElementById('copy-all-btn').onclick = () => {
                    vscode.postMessage({ command: 'copyAllProject' });
                };

                document.getElementById('pack-xml-btn').onclick = () => {
                    vscode.postMessage({ command: 'packProjectXml' });
                };

                vscode.postMessage({ command: 'ready' });
            </script>
        </body>
        </html>`;
    }
}

function deactivate() { }

exports.activate = activate;
exports.deactivate = deactivate;
