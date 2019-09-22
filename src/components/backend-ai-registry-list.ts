/**
 @license
 Copyright (c) 2015-2018 Lablup Inc. All rights reserved.
 */

import {css, customElement, html, property} from "lit-element";
import {render} from 'lit-html';
import {BackendAIPage} from './backend-ai-page';

import '@polymer/paper-icon-button/paper-icon-button';
import '@polymer/iron-icon/iron-icon';
import '@polymer/iron-icons/iron-icons';
import '@polymer/iron-icons/hardware-icons';
import '@polymer/iron-icons/av-icons';

import '@vaadin/vaadin-grid/theme/lumo/vaadin-grid';
import '@vaadin/vaadin-progress-bar/vaadin-progress-bar';
import '@polymer/paper-progress/paper-progress';
import '../plastics/lablup-shields/lablup-shields';

import 'weightless/button';
import 'weightless/card';
import 'weightless/dialog';
import 'weightless/icon';
import 'weightless/textfield';
import 'weightless/title';

import {default as PainKiller} from "./backend-ai-painkiller";
import {BackendAiStyles} from "./backend-ai-console-styles";
import {IronFlex, IronFlexAlignment} from "../plastics/layout/iron-flex-layout-classes";
import './lablup-notification';
import './backend-ai-indicator';

@customElement("backend-ai-registry-list")
class BackendAIRegistryList extends BackendAIPage {
  public registryList: any;
  @property({type: Object}) indicator = Object();
  @property({type: Number}) selectedIndex = 0;
  @property({type: String}) boundControlsRenderer = this._controlsRenderer.bind(this);

  constructor() {
    super();
    this.registryList = [];
  }

  static get styles() {
    return [
      BackendAiStyles,
      IronFlex,
      IronFlexAlignment,
      css`
        vaadin-grid {
          border: 0;
          font-size: 14px;
          height: calc(100vh - 265px);
        }

        h4 {
          font-weight: 200;
          font-size: 14px;
          margin: 0px;
          padding: 5px 15px 5px 20px;
        }

        wl-button {
          --button-bg: var(--paper-yellow-50);
          --button-bg-hover: var(--paper-yellow-100);
          --button-bg-active: var(--paper-yellow-600);
        }

        wl-button.delete {
          --button-bg: var(--paper-red-50);
          --button-bg-hover: var(--paper-red-100);
          --button-bg-active: var(--paper-red-600);
        }

        wl-dialog wl-textfield {
          --input-font-family: Roboto, Noto, sans-serif;
          margin-bottom: 20px
        }

        wl-dialog {
          --dialog-min-width: 350px;
        }
      `
    ];
  }

  firstUpdated() {
    this.notification = window.lablupNotification;
    this.indicator = this.shadowRoot.querySelector('#indicator');
  }

  _parseRegistryList(obj) {
    const isString = (val) => typeof val === "string" || val instanceof String;

    return Object.keys(obj).map(hostname =>
      isString(obj[hostname])
        ? {
          "": obj[hostname],
          hostname
        }
        : {
          ...obj[hostname],
          hostname
        }
    );

  }

  _refreshRegistryList() {
    window.backendaiclient.registry.list()
      .then(({result}) => {
        this.registryList = this._parseRegistryList(result);
        console.log(this.registryList);
        this.requestUpdate();
      })
  }

  async _viewStateChanged(active) {
    await this.updateComplete;
    if (active === false) {
      return;
    }

    // If disconnected
    if (window.backendaiclient === undefined || window.backendaiclient === null || window.backendaiclient.ready === false) {
      document.addEventListener('backend-ai-connected', () => {
      }, true);
    } else { // already connected
      this._refreshRegistryList();
    }
  }

  _getHostname(url) {
    const anchor = document.createElement("a");
    anchor.href = url;

    return anchor.hostname;
  }

  _addRegistry() {
    // somehow type casting is needed to prevent errors, unlike similar use cases in other files
    const hostname = (<HTMLInputElement>this.shadowRoot.querySelector("#add-registry-hostname")).value,
      url = (<HTMLInputElement>this.shadowRoot.querySelector("#add-registry-url")).value,
      username = (<HTMLInputElement>this.shadowRoot.querySelector("#add-registry-username")).value,
      password = (<HTMLInputElement>this.shadowRoot.querySelector("#add-registry-password")).value;

    if (hostname === "") {
      this.notification.text = "Hostname is empty";
      this.notification.show();
      return;
    }
    if (url === "") {
      this.notification.text = "URL field is empty";
      this.notification.show();
      return;
    }

    let input = {};
    input[""] = url;

    if (username !== "") {
      input['username'] = username;

      if (password !== "") input['password'] = password;
    }

    const key = `config/docker/registry/${this._getHostname(url)}`;
    window.backendaiclient.registry.add(key, input)
      .then(({result}) => {
        if (result === "ok") {
          this.notification.text = "Registry successfully added";
          this._refreshRegistryList();
        } else {
          this.notification.text = "Error occurred";
        }
        this._hideDialogById("#add-registry-dialog");
        this.notification.show();
      })
  }

  _deleteRegistry() {
    const name = (<HTMLInputElement>this.shadowRoot.querySelector("#delete-registry")).value;

    if (this.registryList[this.selectedIndex].hostname === name) {
      window.backendaiclient.registry.delete(name)
        .then(({result}) => {
          if (result === "ok") {
            this.notification.text = "Registry successfully deleted";
            this._refreshRegistryList();
          } else {
            this.notification.text = "Error Occurred";
          }
          this._hideDialogById("#delete-registry-dialog");
          this.notification.show();
        })
    } else {
      this.notification.text = "Hostname does not match!";
      this.notification.show();
    }
  }

  _rescanImage() {
    this.indicator.start('indeterminate');
    this.indicator.set(10, 'Updating registry information...');
    window.backendaiclient.maintenance.rescan_images(this.registryList[this.selectedIndex]["hostname"])
      .then(({rescan_images}) => {
        if (rescan_images.ok) {
          this.indicator.set(100, 'Registry update finished.');
          this.indicator.end(1000);
        } else {
          this.indicator.set(50, 'Registry update failed.');
          this.indicator.end(1000);
          this.notification.text = PainKiller.relieve(rescan_images.msg);
          this.notification.show();
        }
      }).catch(err => {
      console.log(err);
      this.indicator.set(50, 'Rescan failed.');
      this.indicator.end(1000);
      if (err && err.message) {
        this.notification.text = PainKiller.relieve(err.message);
        this.notification.show(true);
      }
    });
  }

  _launchDialogById(id) {
    this.shadowRoot.querySelector(id).show();
  }

  _hideDialogById(id) {
    this.shadowRoot.querySelector(id).hide();
  }

  _hideDialog(e) {
    let hideButton = e.target;
    let dialog = hideButton.closest('wl-dialog');
    dialog.hide();
  }

  _indexRenderer(root, column, rowData) {
    let idx = rowData.index + 1;
    render(
      html`
        <div>${idx}</div>
      `,
      root
    );
  }

  _registryRenderer(root, column, rowData) {
    render(
      html`
        <div>
          ${rowData.item[""]}
        </div>
      `,
      root
    )
  }

  _controlsRenderer(root, column, rowData) {
    render(
      html`
        <div
          id="controls"
          class="layout horizontal flex center"
        >
          <paper-icon-button
            icon="delete"
            class="fg red"
            @click=${() => {
        this.selectedIndex = rowData.index;
        this._launchDialogById("#delete-registry-dialog")
      }}
          ></paper-icon-button>
          <paper-icon-button
            icon="refresh"
            class="fg blue"
            @click=${() => {
        this.selectedIndex = rowData.index;
        this._rescanImage();
      }}
          ></paper-icon-button>
        </div>
      `,
      root
    )
  }

  render() {
    // language=HTML
    return html`
      <lablup-notification id="notification"></lablup-notification>
      <backend-ai-indicator id="indicator"></backend-ai-indicator>
      <h4 class="horizontal flex center center-justified layout">
        <span>Registries</span>
        <span class="flex"></span>
        <wl-button
          class="fg orange"
          id="add-registry"
          outlined
          @click=${() => this._launchDialogById("#add-registry-dialog")}
        >
          <wl-icon>add</wl-icon>
          Add Registry
        </wl-button>
      </h4>

      <vaadin-grid theme="row-stripes column-borders compact" aria-label="Job list" .items="${this.registryList}">
        <vaadin-grid-column flex-grow="0" width="40px" header="#" .renderer=${this._indexRenderer}>
        </vaadin-grid-column>
        <vaadin-grid-column flex-grow="1" header="Hostname">
          <template>
            <div> [[item.hostname]] </div>
          </template>
        </vaadin-grid-column>
        <vaadin-grid-column flex-grow="2" header="Registry URL" resizable .renderer=${this._registryRenderer}>
        </vaadin-grid-column>
        <vaadin-grid-column flex-grow="1" header="Username">
          <template>
            <div> [[item.username]] </div>
          </template>
        </vaadin-grid-column>
        <vaadin-grid-column flex-grow="1" header="Password">
          <template>
            <div> [[item.password]] </div>
          </template>
        </vaadin-grid-column>
        <vaadin-grid-column flex-grow="1" header="Controls" .renderer=${this.boundControlsRenderer}>
        </vaadin-grid-column>
      </vaadin-grid>
      <wl-dialog id="add-registry-dialog" fixed backdrop blockscrolling>
        <wl-card elevation="1" class="login-panel intro centered" style="margin: 0;">
          <h3 class="horizontal center layout">
            <span>Add Registry</span>
            <div class="flex"></div>
            <wl-button class="fab" fab flat inverted @click=${e => this._hideDialog(e)}>
              <wl-icon>close</wl-icon>
            </wl-button>
          </h3>
          <form>
            <fieldset>
              <wl-textfield
                id="add-registry-hostname"
                type="text"
                label="Registry Hostname"
              ></wl-textfield>
              <wl-textfield
                id="add-registry-url"
                type="text"
                label="Registry URL"
              ></wl-textfield>
              <wl-textfield
                id="add-registry-username"
                type="text"
                label="Username (Optional)"
              ></wl-textfield>
              <wl-textfield
                id="add-registry-password"
                type="password"
                label="Password (Optional)"
              ></wl-textfield>

              <div class="horizontal layout center-justified">
                <wl-button
                  class="fg orange"
                  outlined
                  type="button"
                  style="box-sizing: border-box; width: 100%"
                  @click=${this._addRegistry}
                >
                  <wl-icon>add</wl-icon>
                  Add Registry
                </wl-button>
              </div>
            </fieldset>
          </form>
        </wl-card>
      </wl-dialog>

      <wl-dialog id="delete-registry-dialog" fixed backdrop blockscrolling>
        <wl-title level="3" slot="header" style="color: rgb(242, 100, 85)">Warning: this cannot be undone!</wl-title>
        <div slot="content">
          <wl-textfield
            id="delete-registry"
            type="text"
            label="Type registry hostname to delete"
          ></wl-textfield>
          <wl-button
            class="fg red delete"
            type="button"
            outlined
            style="width: 100%; box-sizing: border-box;"
            @click=${this._deleteRegistry}
          >
            <wl-icon>delete</wl-icon>
            Delete
          </wl-button>
        </div>
      </wl-dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "backend-ai-registry-list": BackendAIRegistryList;
  }
}
