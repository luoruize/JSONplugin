require('../css/jsonToHtml.css');

import { helpers } from './helpers';
import { JsonEditor } from './jsonEditor';

export class JSONtoHTML {

    displayLinkContent(result) {
        const contentType = result.getResponseHeader('content-type');

        let content = result.responseText;
        if(contentType.indexOf('image') === 0) {
            content = `<img class="jp-preview-image" src="${ result.responseURL }" />`;
        }

        const el = document.createElement('div');
        el.className = 'jp-link-preview';
        el.innerHTML = `
            <div class="jp-link-preview-inner">
                <i class="fa fa-close jp-close-preview"></i>
                <div class="jp-preview-content">${ content }</div>
            </div>
        `;

        el.querySelector('.jp-close-preview').onclick = () => {
            document.body.removeChild(el);
        };

        document.body.appendChild(el);
    }

    displayErrorMessage(text) {
        const el = document.createElement('div');
        el.className = 'jp-error-alert';
        el.innerHTML = `<span class="jp-alert-content">${text}</span>`;
        document.body.appendChild(el);
        setTimeout(() => {
            el.classList.add('jp-alert-enter');
            setTimeout(() => {
                el.classList.add('jp-alert-fade');
                setTimeout(() => {
                    document.body.removeChild(el);
                }, 500);
            }, 2500);
        });
    }

    convertJsonToHtml(key, value) {
        const valueType = helpers.getType(value);

        let typeName = helpers.getTypeName(valueType);
        let separator = key !== null ? ':&nbsp;' : '';

        let content;
        let child;

        const isRootNode = key === null;
        key = key || '';

        switch (valueType) {
            case 'object':
            case 'array':
                if(valueType === 'array') {
                    typeName += '[' + value.length + ']';
                }

                content = `<i class="fa fa-caret-down jp-json-caret"></i><span class="jp-object-name jp-reg-text">${ key }</span><span class="jp-object-name-separator jp-reg-text">${ separator }</span><span class="jp-object-type jp-reg-text">${ typeName }</span>`;
                child = `<ol class="jp-ol jp-object-children">`;
                for(let v in value) {
                    child += this.convertJsonToHtml(v, value[v]);
                }
                child += `</ol>`;
                break;

            default:
                const wrapper = valueType === 'string' ? '"' : '';
                if(valueType === 'string') {
                    value = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
                content = `
                        <i class="fa fa-caret-down jp-json-transparent-caret"></i>
                        <span class="jp-var-name jp-reg-text">${ key }</span><span class="jp-var-name-separator jp-reg-text">:&nbsp;</span><span class="jp-var-value jp-reg-text">${ wrapper }${ value }${ wrapper }</span>
                    `;
                break;
        }

        const isUrl = helpers.isValidURL(value);
        const urlClass = isUrl ? 'jp-url' : '';

        let relationClass = (valueType === 'array' || valueType === 'object') ? 'jp-parent-node' : '';
        let deleteBtn = isRootNode ? '' : `<i class="fa fa-trash-o jp-inline-icon-btn jp-delete-btn"></i>`;
        let copyBtn = `<i class="fa fa-copy jp-inline-icon-btn jp-copy-btn"></i>`;
        let searchBtn = isUrl ? `<i class="fa fa-search jp-inline-icon-btn jp-search-btn"></i>` : '';
        let editBtn = `<i class="fa fa-edit jp-inline-icon-btn jp-edit-btn"></i>`;
        let doneBtn = `<i class="fa fa-check jp-inline-icon-btn jp-editor-controller jp-done-editing-btn"></i>`;
        let cancelBtn = `<i class="fa fa-close jp-inline-icon-btn jp-editor-controller jp-cancel-editing-btn"></i>`;
        let template = `<li data-path-key="${ key }" class="jp-tree-li jp-class-${ valueType } ${ relationClass } ${ urlClass }">${ content }${ copyBtn }${ deleteBtn }${ searchBtn }${ editBtn }${ doneBtn }${ cancelBtn }</li>`;
        if(child) template += child;

        return template;
    }

    attachJsonEvents(root) {
        root = root || this.root;
        root.querySelectorAll('.jp-parent-node').forEach((el) => {
            if(el.getAttribute('jp-click')) return;
            el.setAttribute('jp-click', true);

            el.addEventListener('click', () => {
                if(this.isEditingNode) return;

                const sibling = helpers.getImmediateSibling(el);
                if(sibling) {
                    const isClosed = sibling.className.indexOf('jp-closed-node') >= 0;
                    const caret = el.querySelector('.jp-json-caret');
                    if(isClosed) {
                        sibling.classList.remove('jp-closed-node');
                        caret.classList.remove('fa-caret-right');
                        caret.classList.add('fa-caret-down');
                    } else {
                        sibling.classList.add('jp-closed-node');
                        caret.classList.add('fa-caret-right');
                        caret.classList.remove('fa-caret-down');
                    }
                }
            });
        });

        this.root.querySelectorAll('.jp-delete-btn').forEach((el) => {
            if(el.getAttribute('jp-click')) return;
            el.setAttribute('jp-click', true);

            el.addEventListener('click', (e) => {
                if(this.isEditingNode) return;

                e.stopPropagation();
                const path = this.getPathToElement(el);
                const reconstructionKey = path[path.length - 2];

                let object = this.json;
                while(path.length > 1) {
                    object = object[path.shift()];
                }

                var lastKey = path.shift();

                if(object.constructor === Array) {
                    object.splice(lastKey, 1);
                } else {
                    delete object[lastKey];
                }

                if(reconstructionKey) {
                    // find parent ol
                    let parent = el.parentNode;
                    while (parent.tagName !== 'OL') {
                        parent = parent.parentNode;
                    }

                    const newEl = document.createElement('div');
                    newEl.innerHTML = this.convertJsonToHtml(reconstructionKey, object);
                    const newOl = newEl.querySelector('ol');
                    const newLi = newEl.querySelector('li');
                    parent.parentNode.replaceChild(newLi, helpers.getPreviousNode(parent));
                    parent.parentNode.replaceChild(newOl, parent);
                    this.attachJsonEvents(parent);
                } else {
                    this.root.innerHTML = this.convertJsonToHtml(null, this.json);
                    this.attachJsonEvents();
                }
            });
        });

        this.root.querySelectorAll('.jp-copy-btn').forEach((el) => {
            if(el.getAttribute('jp-click')) return;
            el.setAttribute('jp-click', true);

            el.addEventListener('click', (e) => {
                if(this.isEditingNode) return;

                e.stopPropagation();
                const parent = el.parentNode;
                let value;
                if(parent.tagName === 'LI') {
                    const simpleValueEl = parent.querySelector('.jp-var-value');
                    if(simpleValueEl) {
                        value = simpleValueEl.textContent;
                    } else {
                        if(parent.getAttribute('data-path-key') === '') { // root
                            value = this.json;
                        } else {
                            const path = this.getPathToElement(parent);
                            value = this.getValueFromPath(path);
                        }
                    }
                }

                parent.classList.add('jp-is-copying');
                setTimeout(() => {
                    parent.classList.remove('jp-is-copying');
                }, 150);

                helpers.copyTextToClipboard(value);
            });
        });

        this.root.querySelectorAll('.jp-edit-btn').forEach((el) => {
            if(el.getAttribute('jp-click')) return;
            el.setAttribute('jp-click', true);

            el.addEventListener('click', (e) => {
                if(this.isEditingNode) return;

                e.stopPropagation();
                const parent = el.parentNode;
                const isObject = parent.className.indexOf('jp-parent-node') >= 0;
                const isRoot = parent.className.indexOf('jp-json-root') >= 0;
                const keyElement = parent.querySelector('.jp-var-name') || parent.querySelector('.jp-object-name');
                const varName = keyElement.innerText;

                let value;
                let valueElement;
                let parentObject;

                if(isRoot) {
                    value = this.json;
                    valueElement = parent.querySelector('.jp-object-type');
                } else {
                    const path = this.getPathToElement(parent);
                    const pathToParent = path.slice(0, path.length-1);
                    parentObject = this.getValueFromPath(pathToParent);

                    if(isObject) {
                        valueElement = parent.querySelector('.jp-object-type');
                        value = this.getValueFromPath(path);
                    } else {
                        valueElement = parent.querySelector('.jp-var-value');
                        value = valueElement.textContent;
                    }
                }

                this.isEditingNode = true;
                const editor = new JsonEditor(parent, parentObject);
                editor.editObject(varName, value, keyElement, valueElement)
                    .then((result) => {
                        if(isRoot) {
                            this.json = result.value;
                        }
                        this.root.innerHTML = this.convertJsonToHtml(null, this.json);
                        this.attachJsonEvents();
                        this.isEditingNode = false;

                        this.root.querySelector('.jp-parent-object > li.jp-tree-li').classList.add('jp-json-root');
                    })
                    .catch(() => {
                        console.log('cancelled');
                        this.isEditingNode = false;
                    });
            });
        });

        this.root.querySelectorAll('.jp-search-btn').forEach((el) => {
            if (el.getAttribute('jp-click')) return;
            el.setAttribute('jp-click', true);

            const value = el.parentNode.querySelector('.jp-var-value').textContent;

            el.addEventListener('click', () => {
                helpers.getLinkType(value)
                    .then((result) => {
                        this.displayLinkContent(result);
                    })
                    .catch(() => {
                        this.displayErrorMessage('Could not open url');
                    });
            });
        });
    }

    collapseAll() {
        if(this.isEditingNode) return;
        this.root.querySelectorAll('.jp-parent-node').forEach((el) => {
            const sibling = helpers.getImmediateSibling(el);
            if(sibling) {
                sibling.classList.add('jp-closed-node');
            }

            const caret = el.querySelector('.jp-json-caret');
            caret.classList.add('fa-caret-right');
            caret.classList.remove('fa-caret-down');
        });
    }

    expandAll() {
        if(this.isEditingNode) return;
        this.root.querySelectorAll('.jp-parent-node').forEach((el) => {
            const sibling = helpers.getImmediateSibling(el);
            if(sibling) {
                sibling.classList.remove('jp-closed-node');
            }

            const caret = el.querySelector('.jp-json-caret');
            caret.classList.remove('fa-caret-right');
            caret.classList.add('fa-caret-down');
        });
    }

    getPathToElement(el) {
        if(el.tagName !== 'LI') {
            el = el.parentNode;
            if(el.tagName !== 'LI') throw 'Cannot extract path from this node';
        }

        const path = [el.getAttribute('data-path-key')];
        do {
            const parentNode = helpers.getParentNode(el);
            var key = parentNode.getAttribute('data-path-key');
            key !== '' && path.unshift(key);
            el = parentNode;
        } while(el.getAttribute('data-path-key') !== '');

        return path;
    }

    getValueFromPath(path) {
        let object = this.json;
        while(path.length > 0) {
            const key = path.shift();
            object = object[key];
        }

        return object;
    }

    constructor(json) {
        this.isEditingNode = false;

        try {
            if(typeof json === 'string') {
                json = JSON.parse(json);
            }

            this.json = json;

            this.root = document.createElement('ol');
            this.root.className = 'jp-ol jp-parent-object';

            this.root.innerHTML = this.convertJsonToHtml(null, json);

            this.attachJsonEvents();
            this.root.querySelector('li.jp-parent-node').classList.add('jp-json-root');
        } catch (e) {
            console.error('Could not parse json: ', e);
        }
    }

}